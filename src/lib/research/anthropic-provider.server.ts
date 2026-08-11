/**
 * Anthropic provider adapter — the ONLY file in the project that knows how to
 * talk to Anthropic. It receives text and returns data.
 *
 * It deliberately does NOT receive:
 *  - a Supabase client (of any kind);
 *  - storage access;
 *  - any RPC (verify_evidence_field, adopt_canonical_fact, freeze_dataset, ...);
 *  - any secret other than the Anthropic key it needs for the HTTP call.
 *
 * Tool versions are read from configuration and RECORDED with the result: we
 * never claim a version we did not send.
 */

import {
  buildExtractionUserPrompt,
  buildQueryPlannerUserPrompt,
  EXTRACTION_JSON_SCHEMA,
  QUERY_PLANNER_SYSTEM_PROMPT,
  QUERY_PLAN_JSON_SCHEMA,
  QUERY_PLANNER_PROMPT_VERSION,
  SOURCE_EXTRACTOR_PROMPT_VERSION,
  SOURCE_EXTRACTOR_SYSTEM_PROMPT,
  WEB_FETCH_PROMPT_VERSION,
  WEB_FETCH_SYSTEM_PROMPT,
  WEB_SEARCH_PROMPT_VERSION,
  WEB_SEARCH_SYSTEM_PROMPT,
} from "@/lib/research/prompts";
import {
  EMPTY_USAGE,
  ProviderError,
  type ExtractRequest,
  type ExtractResponse,
  type FetchRequest,
  type FetchResponse,
  type ProviderCall,
  type ProviderSearchResult,
  type ProviderUsage,
  type QueryPlanRequest,
  type QueryPlanResponse,
  type ResearchLocation,
  type ResearchProvider,
  type SearchRequest,
  type SearchResponse,
} from "@/lib/research/provider";
import { queryPlanOutputSchema, rawExtractionOutputSchema } from "@/lib/validation/research-schemas";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Current GA server-tool versions. Overridable by configuration, never guessed. */
export const DEFAULT_WEB_SEARCH_TOOL = "web_search_20260318";
export const DEFAULT_WEB_FETCH_TOOL = "web_fetch_20260318";

export interface AnthropicProviderConfig {
  apiKey: string;
  researchModel: string;
  extractionModel: string;
  webSearchToolVersion: string;
  webFetchToolVersion: string;
  timeoutMs: number;
}

interface AnthropicMessageResponse {
  id?: string;
  model?: string;
  stop_reason?: string | null;
  content?: unknown[];
  usage?: Record<string, unknown>;
}

function readUsage(usage: Record<string, unknown> | undefined): ProviderUsage {
  if (!usage) return EMPTY_USAGE;
  const num = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const serverTool = usage["server_tool_use"] as Record<string, unknown> | undefined;
  const requests =
    serverTool === undefined
      ? null
      : (num(serverTool["web_search_requests"]) ?? 0) + (num(serverTool["web_fetch_requests"]) ?? 0);
  return {
    inputTokens: num(usage["input_tokens"]),
    outputTokens: num(usage["output_tokens"]),
    cacheReadTokens: num(usage["cache_read_input_tokens"]),
    cacheWriteTokens: num(usage["cache_creation_input_tokens"]),
    serverToolUses: requests,
  };
}

/**
 * Payload we are allowed to persist: content blocks and usage only.
 * The API key never appears here because it lives in a header we never echo.
 */
function safeRawOutput(body: AnthropicMessageResponse): unknown {
  return {
    id: body.id ?? null,
    model: body.model ?? null,
    stop_reason: body.stop_reason ?? null,
    content: body.content ?? [],
    usage: body.usage ?? null,
  };
}

function textBlocks(body: AnthropicMessageResponse): string[] {
  return (body.content ?? [])
    .filter(
      (block): block is { type: string; text: string } =>
        typeof block === "object" &&
        block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string",
    )
    .map((block) => block.text);
}

function blocksOfType(body: AnthropicMessageResponse, type: string): Record<string, unknown>[] {
  return (body.content ?? []).filter(
    (block): block is Record<string, unknown> =>
      typeof block === "object" && block !== null && (block as { type?: unknown }).type === type,
  );
}

function userLocation(location: ResearchLocation): Record<string, unknown> | null {
  const entries: Record<string, unknown> = { type: "approximate" };
  let filled = false;
  if (location.city) {
    entries["city"] = location.city;
    filled = true;
  }
  if (location.region) {
    entries["region"] = location.region;
    filled = true;
  }
  if (location.country) {
    entries["country"] = location.country;
    filled = true;
  }
  return filled ? entries : null;
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/gi;

export class AnthropicResearchProvider implements ResearchProvider {
  readonly id = "ANTHROPIC" as const;
  readonly researchModel: string;
  readonly extractionModel: string;

  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig) {
    this.config = config;
    this.researchModel = config.researchModel;
    this.extractionModel = config.extractionModel;
  }

  /** Single HTTP call. Retry policy lives in the orchestration layer. */
  private async call(body: Record<string, unknown>): Promise<{
    body: AnthropicMessageResponse;
    requestId: string | null;
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": API_VERSION,
          "x-api-key": this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const requestId = response.headers.get("request-id");
      const text = await response.text();

      if (!response.ok) {
        // The message is surfaced to the operator WITHOUT the request body,
        // so a prompt or a key can never leak through an error path.
        const retryable =
          response.status === 429 || response.status === 529 || response.status >= 500;
        throw new ProviderError(
          `Anthropic respondeu ${response.status}: ${text.slice(0, 400)}`,
          { retryable, statusCode: response.status },
        );
      }

      return { body: JSON.parse(text) as AnthropicMessageResponse, requestId };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderError("Tempo limite excedido na chamada ao provedor.", {
          retryable: true,
        });
      }
      throw new ProviderError(
        `Falha de transporte na chamada ao provedor: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
        { retryable: true },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private buildCall(input: {
    model: string;
    promptVersion: string;
    toolType: string | null;
    startedAt: string;
    body: AnthropicMessageResponse;
    requestId: string | null;
  }): ProviderCall {
    return {
      provider: this.id,
      model: input.body.model ?? input.model,
      toolType: input.toolType,
      promptVersion: input.promptVersion,
      requestId: input.requestId,
      usage: readUsage(input.body.usage),
      startedAt: input.startedAt,
      completedAt: new Date().toISOString(),
      status: "COMPLETED",
      rawOutput: safeRawOutput(input.body),
      stopReason: input.body.stop_reason ?? null,
    };
  }

  async generateQueryPlan(request: QueryPlanRequest): Promise<QueryPlanResponse> {
    const startedAt = new Date().toISOString();
    // No tools: the planner cannot search, cannot fetch, cannot reach a URL.
    const { body, requestId } = await this.call({
      model: this.researchModel,
      max_tokens: 2000,
      system: QUERY_PLANNER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildQueryPlannerUserPrompt(request) }],
      output_config: { format: { type: "json_schema", schema: QUERY_PLAN_JSON_SCHEMA } },
    });

    const raw = textBlocks(body).join("").trim();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new ProviderError("Resposta do planejador não é JSON válido.", { retryable: false });
    }
    const parsed = queryPlanOutputSchema.parse(parsedJson);

    return {
      queries: parsed.queries.slice(0, request.maxQueries).map((q) => ({
        query: q.query,
        purpose: q.purpose,
        inputFactIds: q.input_fact_ids,
      })),
      call: this.buildCall({
        model: this.researchModel,
        promptVersion: QUERY_PLANNER_PROMPT_VERSION,
        toolType: null,
        startedAt,
        body,
        requestId,
      }),
    };
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    const startedAt = new Date().toISOString();
    const tool: Record<string, unknown> = {
      type: this.config.webSearchToolVersion,
      name: "web_search",
      max_uses: request.maxUses,
      // Claude must call the tool directly; no code-execution indirection.
      allowed_callers: ["direct"],
    };
    if (request.allowedDomains && request.allowedDomains.length > 0) {
      tool["allowed_domains"] = [...request.allowedDomains];
    } else if (request.blockedDomains && request.blockedDomains.length > 0) {
      tool["blocked_domains"] = [...request.blockedDomains];
    }
    const location = userLocation(request.location);
    if (location) tool["user_location"] = location;

    const { body, requestId } = await this.call({
      model: this.researchModel,
      max_tokens: 2000,
      system: WEB_SEARCH_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Execute exatamente esta consulta de busca e nada mais: ${request.query}`,
        },
      ],
      tools: [tool],
    });

    // AUTHORITY: only tool result blocks are real provider results.
    const results: ProviderSearchResult[] = [];
    const toolUrls = new Set<string>();
    for (const block of blocksOfType(body, "web_search_tool_result")) {
      const content = block["content"];
      if (!Array.isArray(content)) continue;
      for (const item of content) {
        if (typeof item !== "object" || item === null) continue;
        const record = item as Record<string, unknown>;
        if (record["type"] !== "web_search_result") continue;
        const url = record["url"];
        if (typeof url !== "string" || url.trim() === "") continue;
        toolUrls.add(url);
        results.push({
          title: typeof record["title"] === "string" ? record["title"] : null,
          url,
          snippet:
            typeof record["snippet"] === "string"
              ? record["snippet"]
              : typeof record["encrypted_content"] === "string"
                ? null
                : null,
          pageAge: typeof record["page_age"] === "string" ? record["page_age"] : null,
          rank: results.length + 1,
          providerResultReference:
            typeof block["tool_use_id"] === "string" ? block["tool_use_id"] : null,
          raw: record,
        });
        if (results.length >= request.maxResults) break;
      }
      if (results.length >= request.maxResults) break;
    }

    // A URL that exists ONLY in the model's prose is not a source. Recorded so
    // the operator can see the attempt, never persisted as a search result.
    const rejectedProseUrls = Array.from(
      new Set(
        textBlocks(body)
          .flatMap((text) => text.match(URL_IN_TEXT) ?? [])
          .filter((url) => !toolUrls.has(url)),
      ),
    );

    return {
      results,
      rejectedProseUrls,
      call: this.buildCall({
        model: this.researchModel,
        promptVersion: WEB_SEARCH_PROMPT_VERSION,
        toolType: this.config.webSearchToolVersion,
        startedAt,
        body,
        requestId,
      }),
    };
  }

  async fetch(request: FetchRequest): Promise<FetchResponse> {
    const startedAt = new Date().toISOString();
    const tool: Record<string, unknown> = {
      type: this.config.webFetchToolVersion,
      name: "web_fetch",
      max_uses: 1,
      max_content_tokens: request.maxContentTokens,
      allowed_callers: ["direct"],
      citations: { enabled: true },
    };
    if (request.allowedDomains.length > 0) tool["allowed_domains"] = [...request.allowedDomains];

    // The context carries ONE url and nothing else: no case data, no personal
    // data, no other source. Minimal blast radius for a hostile page.
    const { body, requestId } = await this.call({
      model: this.researchModel,
      max_tokens: 1500,
      system: WEB_FETCH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Recupere o conteúdo desta URL: ${request.url}` }],
      tools: [tool],
    });

    let contentText: string | null = null;
    let contentType: string | null = null;
    let retrievedAt: string | null = null;
    let failureReason: string | null = null;
    let retrieved = false;
    const providerMetadata: Record<string, unknown> = {
      tool_type: this.config.webFetchToolVersion,
      requested_url: request.url,
    };

    for (const block of blocksOfType(body, "web_fetch_tool_result")) {
      const content = block["content"];
      if (typeof content !== "object" || content === null) continue;
      const record = content as Record<string, unknown>;
      if (record["type"] === "web_fetch_tool_result_error") {
        failureReason = String(record["error_code"] ?? "erro não identificado");
        continue;
      }
      providerMetadata["retrieved_url"] = record["url"] ?? null;
      retrievedAt = typeof record["retrieved_at"] === "string" ? record["retrieved_at"] : null;
      const document = record["content"] as Record<string, unknown> | undefined;
      const source = document?.["source"] as Record<string, unknown> | undefined;
      if (source && typeof source["data"] === "string") {
        contentText = source["data"];
        contentType = typeof source["media_type"] === "string" ? source["media_type"] : "text/plain";
        retrieved = true;
      } else if (source && typeof source["type"] === "string") {
        // Binary representation (e.g. PDF): we record what it is, not fake text.
        contentType = typeof source["media_type"] === "string" ? source["media_type"] : null;
        failureReason = "Conteúdo binário não textual retornado pelo provedor.";
      }
    }

    if (!retrieved && failureReason === null) {
      failureReason = "Provedor não retornou bloco de conteúdo para a URL.";
    }

    return {
      retrieved,
      contentText,
      contentType,
      retrievedAt,
      providerMetadata,
      failureReason,
      call: this.buildCall({
        model: this.researchModel,
        promptVersion: WEB_FETCH_PROMPT_VERSION,
        toolType: this.config.webFetchToolVersion,
        startedAt,
        body,
        requestId,
      }),
    };
  }

  /**
   * Extraction call. NOTE FOR AUDITORS: this request object has no `tools` key.
   * The extraction model cannot search, cannot fetch, cannot choose a URL and
   * cannot reach the database. It only reads the artifact we hand it.
   */
  async extract(request: ExtractRequest): Promise<ExtractResponse> {
    const startedAt = new Date().toISOString();
    const { body, requestId } = await this.call({
      model: this.extractionModel,
      max_tokens: 8000,
      system: SOURCE_EXTRACTOR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildExtractionUserPrompt({
            content: request.content,
            sourceUrl: request.sourceUrl,
            allowedFieldNames: request.allowedFieldNames,
          }),
        },
      ],
      output_config: { format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA } },
    });

    const raw = textBlocks(body).join("").trim();
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      throw new ProviderError("Resposta de extração não é JSON válido.", { retryable: false });
    }

    return {
      output: rawExtractionOutputSchema.parse(parsedJson),
      call: this.buildCall({
        model: this.extractionModel,
        promptVersion: SOURCE_EXTRACTOR_PROMPT_VERSION,
        toolType: null,
        startedAt,
        body,
        requestId,
      }),
    };
  }
}
