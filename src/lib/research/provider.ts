/**
 * PHASE 4B — Provider abstraction.
 *
 * The domain layer NEVER talks to a vendor SDK. It talks to this interface.
 * Consequences that matter for the constitution:
 *  - the provider cannot reach the database, storage, secrets or any RPC;
 *  - the provider returns DATA, never a decision;
 *  - swapping model/vendor, or running deterministic fixtures in tests, does not
 *    touch a single line of domain code.
 *
 * This file is pure types + pure helpers. No network, no imports from Supabase.
 */

export type ProviderId = "ANTHROPIC" | "FIXTURE";

export interface ProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  /** Server-side tool invocations actually billed by the provider. */
  serverToolUses: number | null;
}

export const EMPTY_USAGE: ProviderUsage = {
  inputTokens: null,
  outputTokens: null,
  cacheReadTokens: null,
  cacheWriteTokens: null,
  serverToolUses: null,
};

/** Everything we must be able to prove about a single provider invocation. */
export interface ProviderCall {
  provider: ProviderId;
  model: string;
  /** e.g. "web_search_20260318" — the version REALLY sent, never a guess. */
  toolType: string | null;
  promptVersion: string;
  requestId: string | null;
  usage: ProviderUsage;
  startedAt: string;
  completedAt: string;
  status: "COMPLETED" | "FAILED";
  /** Provider payload with secrets already excluded. Persisted for audit. */
  rawOutput: unknown;
  stopReason?: string | null;
  errorMessage?: string | null;
}

export interface ResearchLocation {
  city: string | null;
  region: string | null;
  country: string | null;
}

/** A fact allowed to leave the platform boundary. Nothing else may be sent. */
export interface ContextFact {
  factId: string;
  attribute: string;
  label: string;
  value: string;
  origin: string;
  state: string;
  reference: string | null;
}

export interface QueryPlanRequest {
  researchType: string;
  objective: string;
  facts: readonly ContextFact[];
  location: ResearchLocation;
  maxQueries: number;
}

export interface PlannedQuery {
  query: string;
  purpose: string;
  inputFactIds: string[];
}

export interface QueryPlanResponse {
  queries: PlannedQuery[];
  call: ProviderCall;
}

export interface SearchRequest {
  query: string;
  maxUses: number;
  maxResults: number;
  allowedDomains?: readonly string[];
  blockedDomains?: readonly string[];
  location: ResearchLocation;
}

/**
 * A search result that came from the provider's SEARCH TOOL RESULT BLOCK.
 * A URL written in the model's prose is NOT a search result and never reaches
 * this type (see anthropic-provider.server.ts).
 */
export interface ProviderSearchResult {
  title: string | null;
  url: string;
  snippet: string | null;
  pageAge: string | null;
  rank: number;
  providerResultReference: string | null;
  raw: unknown;
}

export interface SearchResponse {
  results: ProviderSearchResult[];
  /** URLs the model mentioned in prose but which no tool block returned. */
  rejectedProseUrls: string[];
  call: ProviderCall;
}

export interface FetchRequest {
  url: string;
  allowedDomains: readonly string[];
  maxContentTokens: number;
}

export interface FetchResponse {
  retrieved: boolean;
  /** Provider-processed text representation. NEVER called "raw HTML". */
  contentText: string | null;
  contentType: string | null;
  retrievedAt: string | null;
  providerMetadata: Record<string, unknown>;
  failureReason: string | null;
  call: ProviderCall;
}

export interface ExtractRequest {
  /** Captured artifact text. Untrusted data, never instructions. */
  content: string;
  sourceUrl: string;
  allowedFieldNames: readonly string[];
  researchType: string;
}

export interface RawExtractionField {
  field_name: string;
  support_status: string;
  raw_value: string | null;
  normalized_value: string | null;
  numeric_value: number | null;
  unit: string | null;
  source_excerpt: string | null;
  source_locator: string | null;
  ambiguity_reason: string | null;
}

export interface RawExtractionCandidate {
  candidate_type: string;
  fields: RawExtractionField[];
}

export interface RawExtractionOutput {
  document_assessment: {
    document_type: string;
    relevant_to_property: boolean;
    prompt_injection_suspected: boolean;
    notes: string | null;
  };
  entity_candidates: RawExtractionCandidate[];
  warnings: string[];
}

export interface ExtractResponse {
  output: RawExtractionOutput;
  call: ProviderCall;
}

/**
 * The four units of work. Each one is a single provider invocation, so each one
 * is separately budgeted, separately audited and separately retryable.
 */
export interface ResearchProvider {
  readonly id: ProviderId;
  readonly researchModel: string;
  readonly extractionModel: string;
  generateQueryPlan(request: QueryPlanRequest): Promise<QueryPlanResponse>;
  search(request: SearchRequest): Promise<SearchResponse>;
  fetch(request: FetchRequest): Promise<FetchResponse>;
  extract(request: ExtractRequest): Promise<ExtractResponse>;
}


/**
 * Transport/protocol failure of a provider call. `retryable` distinguishes a
 * temporary condition (429/5xx/timeout) from a permanent one (invalid output),
 * so the orchestration layer never retries a deterministic failure.
 */
export class ProviderError extends Error {
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(message: string, options?: { retryable?: boolean; statusCode?: number }) {
    super(message);
    this.name = "ProviderError";
    this.retryable = options?.retryable ?? false;
    this.statusCode = options?.statusCode ?? null;
  }
}
