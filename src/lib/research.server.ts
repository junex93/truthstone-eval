/**
 * PHASE 4B — server-only research engine helpers.
 *
 * Boundary rules enforced here:
 *  - the provider adapter never receives a database client, storage access or
 *    an RPC; it receives text and returns data;
 *  - every provider call is persisted as an ai_run plus a usage event BEFORE
 *    any candidate is created;
 *  - captured content is stored as an immutable artifact with a server-computed
 *    SHA-256 over the exact bytes we stored;
 *  - the deterministic gate (support-check) decides what becomes a candidate.
 *    Nothing the model claims is trusted.
 */

import type { Database } from "@/integrations/supabase/types";
import {
  RESEARCH_BUDGET_LIMITS,
  RESEARCH_FIELD_NAMES,
  TRANSACTION_FIELD_NAMES,
  type ResearchUsageType,
} from "@/lib/domain/research";
import { AnthropicResearchProvider, DEFAULT_WEB_FETCH_TOOL, DEFAULT_WEB_SEARCH_TOOL } from "@/lib/research/anthropic-provider.server";
import { FixtureResearchProvider } from "@/lib/research/fixture-provider";
import type {
  ContextFact,
  ProviderCall,
  ResearchProvider,
} from "@/lib/research/provider";
import { checkExtractedFields, type RawExtractedField } from "@/lib/research/support-check";
import { canonicalizeUrl, extractDomain } from "@/lib/research/url";
import type { Db, Membership } from "@/lib/workspace.server";
import { sha256Hex, writeAudit } from "@/lib/workspace.server";

export const RESEARCH_BUCKET = "evidence-originals";

/* --------------------------------------------------------------------------
 * Provider selection
 * ------------------------------------------------------------------------ */

export type ResearchDataMode = "REAL_PROVIDER" | "FIXTURE";

export interface ResolvedProvider {
  provider: ResearchProvider;
  mode: ResearchDataMode;
}

/**
 * Reads configuration inside the handler (never at module scope).
 *
 * There is NO silent fallback: deterministic fixture mode must be requested
 * explicitly with RESEARCH_PROVIDER=FIXTURE. A missing provider key is a
 * configuration failure, never an unannounced change of data source.
 */
export function resolveProvider(): ResolvedProvider {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  const forced = process.env["RESEARCH_PROVIDER"];

  if (forced === "FIXTURE") {
    return { provider: new FixtureResearchProvider(), mode: "FIXTURE" };
  }
  if (!apiKey) {
    throw new Error(
      "Provedor de pesquisa não configurado: defina ANTHROPIC_API_KEY para uso real ou RESEARCH_PROVIDER=FIXTURE para o modo determinístico de demonstração.",
    );
  }

  return {
    mode: "REAL_PROVIDER",
    provider: new AnthropicResearchProvider({
      apiKey,
      researchModel: process.env["ANTHROPIC_RESEARCH_MODEL"] ?? "claude-sonnet-4-5-20250929",
      extractionModel: process.env["ANTHROPIC_EXTRACTION_MODEL"] ?? "claude-sonnet-4-5-20250929",
      webSearchToolVersion: process.env["ANTHROPIC_WEB_SEARCH_TOOL"] ?? DEFAULT_WEB_SEARCH_TOOL,
      webFetchToolVersion: process.env["ANTHROPIC_WEB_FETCH_TOOL"] ?? DEFAULT_WEB_FETCH_TOOL,
      timeoutMs: 120_000,
    }),
  };
}

/* --------------------------------------------------------------------------
 * Run scope
 * ------------------------------------------------------------------------ */

export interface RunScope {
  runId: string;
  organizationId: string;
  caseId: string;
  subjectPropertyId: string | null;
  status: Database["public"]["Enums"]["research_run_status"];
  researchType: Database["public"]["Enums"]["research_type"];
  objective: string;
  maxSearchUses: number;
  maxSources: number;
  maxFetches: number;
  maxExtractions: number;
  searchUses: number;
  fetches: number;
  extractions: number;
  aiCalls: number;
  locationCity: string | null;
  locationRegion: string | null;
  locationCountry: string | null;
}

const TERMINAL_STATUSES: readonly string[] = ["COMPLETED", "FAILED", "CANCELLED"];

export async function requireRunScope(
  supabase: Db,
  runId: string,
  membership: Membership,
): Promise<RunScope> {
  const { data, error } = await supabase
    .from("property_research_runs")
    .select(
      "id, organization_id, valuation_case_id, subject_property_id, status, research_type, objective, max_search_uses, max_sources, max_fetches, max_extractions, search_uses_actual, fetches_actual, extractions_actual, ai_calls_actual, location_city, location_region, location_country",
    )
    .eq("id", runId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar a pesquisa: ${error.message}`);
  if (!data) throw new Error("Pesquisa não encontrada no escopo atual.");
  if (data.organization_id !== membership.organizationId) {
    throw new Error("Pesquisa fora do escopo da organização atual.");
  }

  return {
    runId: data.id,
    organizationId: data.organization_id,
    caseId: data.valuation_case_id,
    subjectPropertyId: data.subject_property_id,
    status: data.status,
    researchType: data.research_type,
    objective: data.objective,
    maxSearchUses: data.max_search_uses,
    maxSources: data.max_sources,
    maxFetches: data.max_fetches,
    maxExtractions: data.max_extractions,
    searchUses: data.search_uses_actual,
    fetches: data.fetches_actual,
    extractions: data.extractions_actual,
    aiCalls: data.ai_calls_actual,
    locationCity: data.location_city,
    locationRegion: data.location_region,
    locationCountry: data.location_country,
  };
}

export function requireActiveRun(scope: RunScope): RunScope {
  if (TERMINAL_STATUSES.includes(scope.status)) {
    throw new Error(
      `Esta pesquisa está encerrada (${scope.status}) e não aceita novas operações. Crie uma nova pesquisa.`,
    );
  }
  return scope;
}

export async function setRunStatus(
  supabase: Db,
  runId: string,
  status: Database["public"]["Enums"]["research_run_status"],
  extra: Partial<Database["public"]["Tables"]["property_research_runs"]["Update"]> = {},
): Promise<void> {
  const { error } = await supabase
    .from("property_research_runs")
    .update({ status, ...extra })
    .eq("id", runId);
  if (error) throw new Error(`Falha ao atualizar o estado da pesquisa: ${error.message}`);
}

/* --------------------------------------------------------------------------
 * Budget and rate limiting — enforced server-side, never trusted from client
 * ------------------------------------------------------------------------ */

export class ResearchBudgetError extends Error {}

export async function enforceRateLimits(
  supabase: Db,
  membership: Membership,
  userId: string,
  usageType: ResearchUsageType,
): Promise<void> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  if (usageType === "RUN_STARTED") {
    const { count, error } = await supabase
      .from("research_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", userId)
      .eq("usage_type", "RUN_STARTED")
      .gte("created_at", since);
    if (error) throw new Error(`Falha ao verificar limite de uso: ${error.message}`);
    if ((count ?? 0) >= RESEARCH_BUDGET_LIMITS.runsPerUserPerHour) {
      throw new ResearchBudgetError(
        `Limite de ${RESEARCH_BUDGET_LIMITS.runsPerUserPerHour} pesquisas por hora atingido para este usuário.`,
      );
    }
    return;
  }

  const [userCalls, orgCalls] = await Promise.all([
    supabase
      .from("research_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("actor_user_id", userId)
      .neq("usage_type", "RUN_STARTED")
      .gte("created_at", since),
    supabase
      .from("research_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId)
      .neq("usage_type", "RUN_STARTED")
      .gte("created_at", since),
  ]);

  if (userCalls.error) throw new Error(`Falha ao verificar limite de uso: ${userCalls.error.message}`);
  if (orgCalls.error) throw new Error(`Falha ao verificar limite de uso: ${orgCalls.error.message}`);

  if ((userCalls.count ?? 0) >= RESEARCH_BUDGET_LIMITS.aiCallsPerUserPerHour) {
    throw new ResearchBudgetError(
      `Limite de ${RESEARCH_BUDGET_LIMITS.aiCallsPerUserPerHour} chamadas de IA por hora atingido para este usuário.`,
    );
  }
  if ((orgCalls.count ?? 0) >= RESEARCH_BUDGET_LIMITS.aiCallsPerOrgPerHour) {
    throw new ResearchBudgetError(
      `Limite de ${RESEARCH_BUDGET_LIMITS.aiCallsPerOrgPerHour} chamadas de IA por hora atingido para a organização.`,
    );
  }
}

export function assertBudgetAvailable(scope: RunScope, kind: "SEARCH" | "FETCH" | "EXTRACT"): void {
  if (kind === "SEARCH" && scope.searchUses >= scope.maxSearchUses) {
    throw new ResearchBudgetError(
      `Orçamento de buscas desta pesquisa esgotado (${scope.maxSearchUses}).`,
    );
  }
  if (kind === "FETCH" && scope.fetches >= scope.maxFetches) {
    throw new ResearchBudgetError(
      `Orçamento de capturas desta pesquisa esgotado (${scope.maxFetches}).`,
    );
  }
  if (kind === "EXTRACT" && scope.extractions >= scope.maxExtractions) {
    throw new ResearchBudgetError(
      `Orçamento de extrações desta pesquisa esgotado (${scope.maxExtractions}).`,
    );
  }
}

/* --------------------------------------------------------------------------
 * Provider call bookkeeping
 * ------------------------------------------------------------------------ */

/** Persists the ai_run + usage event for a provider call. Never skipped. */
export async function recordProviderCall(input: {
  supabase: Db;
  membership: Membership;
  userId: string;
  scope: Pick<RunScope, "runId" | "caseId" | "organizationId">;
  purpose: string;
  usageType: ResearchUsageType;
  call: ProviderCall;
  inputEvidenceIds?: readonly string[];
}): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("ai_runs")
    .insert({
      organization_id: input.scope.organizationId,
      valuation_case_id: input.scope.caseId,
      created_by: input.userId,
      purpose: input.purpose,
      provider: input.call.provider,
      model: input.call.model,
      model_version: input.call.toolType,
      system_prompt_version: input.call.promptVersion,
      task_prompt_version: input.call.promptVersion,
      status: input.call.status === "COMPLETED" ? "COMPLETED" : "FAILED",
      started_at: input.call.startedAt,
      completed_at: input.call.completedAt,
      input_evidence_ids: [...(input.inputEvidenceIds ?? [])],
      output_raw: input.call.rawOutput as never,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Falha ao registrar execução de IA: ${error.message}`);

  const { error: usageError } = await supabaseAdmin.from("research_usage_events").insert({
    organization_id: input.scope.organizationId,
    valuation_case_id: input.scope.caseId,
    research_run_id: input.scope.runId,
    actor_user_id: input.userId,
    usage_type: input.usageType,
    provider: input.call.provider,
    model: input.call.model,
    quantity: 1,
    input_tokens: input.call.usage.inputTokens,
    output_tokens: input.call.usage.outputTokens,
    cache_read_tokens: input.call.usage.cacheReadTokens,
    cache_write_tokens: input.call.usage.cacheWriteTokens,
    server_tool_uses: input.call.usage.serverToolUses,
  });
  if (usageError) throw new Error(`Falha ao registrar consumo: ${usageError.message}`);

  // Counters are derived bookkeeping, not an invariant: the authoritative
  // consumption record is research_usage_events (append-only, written above).
  const { data: counters, error: readError } = await supabaseAdmin
    .from("property_research_runs")
    .select("ai_calls_actual, search_uses_actual, fetches_actual, extractions_actual")
    .eq("id", input.scope.runId)
    .single();
  if (readError) throw new Error(`Falha ao ler contadores da pesquisa: ${readError.message}`);

  const { error: counterError } = await supabaseAdmin
    .from("property_research_runs")
    .update({
      ai_calls_actual: counters.ai_calls_actual + 1,
      search_uses_actual: counters.search_uses_actual + (input.usageType === "SEARCH" ? 1 : 0),
      fetches_actual: counters.fetches_actual + (input.usageType === "FETCH" ? 1 : 0),
      extractions_actual: counters.extractions_actual + (input.usageType === "EXTRACT" ? 1 : 0),
    })
    .eq("id", input.scope.runId);
  if (counterError) throw new Error(`Falha ao atualizar contadores: ${counterError.message}`);

  return data.id;
}

/** Records a RUN_STARTED usage event (no provider call involved). */
export async function recordRunStarted(input: {
  userId: string;
  organizationId: string;
  caseId: string;
  runId: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("research_usage_events").insert({
    organization_id: input.organizationId,
    valuation_case_id: input.caseId,
    research_run_id: input.runId,
    actor_user_id: input.userId,
    usage_type: "RUN_STARTED",
    quantity: 1,
  });
  if (error) throw new Error(`Falha ao registrar início da pesquisa: ${error.message}`);
}

/* --------------------------------------------------------------------------
 * Context snapshot — the ONLY data allowed to leave the platform boundary
 * ------------------------------------------------------------------------ */

const CONTEXT_ATTRIBUTE_ALLOWLIST: readonly string[] = [
  "property_type",
  "property_type_code",
  "street_name",
  "district",
  "city",
  "state",
  "postal_code",
  "development_name",
  "private_area",
  "usable_area",
  "built_area",
  "total_area",
  "land_area",
  "bedrooms",
  "suites",
  "bathrooms",
  "parking_spaces",
  "floor_number",
  "construction_year",
  "condition_status",
];

/**
 * Builds the outbound context from VERIFIED evidence only.
 *
 * Excluded by construction: street_number, complement, owner/occupant names,
 * document numbers, internal notes, file paths, user identities and anything
 * not in the allowlist above. A verified field whose name is not allowlisted is
 * simply not sent.
 */
export async function buildContextFacts(
  supabase: Db,
  scope: Pick<RunScope, "caseId" | "organizationId" | "subjectPropertyId">,
): Promise<{ facts: ContextFact[]; references: Record<string, unknown> }> {
  const facts: ContextFact[] = [];
  const references: Record<string, unknown> = {
    schema: "valuation.research.context/1",
    sources: [] as unknown[],
  };
  const sourceRefs = references["sources"] as unknown[];

  if (scope.subjectPropertyId) {
    const { data: property, error } = await supabase
      .from("properties")
      .select(
        "id, property_type_code, street_name, district, city, state, postal_code, private_area, built_area, land_area, bedrooms, suites, bathrooms, parking_spaces, floor_number, construction_year, condition_status",
      )
      .eq("id", scope.subjectPropertyId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar o imóvel avaliando: ${error.message}`);

    if (property) {
      for (const [attribute, value] of Object.entries(property)) {
        if (attribute === "id") continue;
        if (!CONTEXT_ATTRIBUTE_ALLOWLIST.includes(attribute)) continue;
        if (value === null || value === "") continue;
        facts.push({
          factId: `property:${attribute}`,
          attribute,
          label: attribute,
          value: String(value),
          origin: "SUBJECT_PROPERTY_RECORD",
          state: "KNOWN",
          reference: property.id,
        });
      }
      sourceRefs.push({ type: "property", id: property.id });
    }
  }

  const { data: verifiedFields, error: fieldsError } = await supabase
    .from("evidence_fields")
    .select(
      "id, field_name, normalized_value, raw_value, numeric_value, unit, field_state, validation_status, extraction_id, evidence_extractions!inner(artifact_id, evidence_artifacts!inner(evidence_source_id, evidence_sources!inner(valuation_case_id)))",
    )
    .eq("validation_status", "VERIFIED")
    .eq("field_state", "PRESENT")
    .eq(
      "evidence_extractions.evidence_artifacts.evidence_sources.valuation_case_id",
      scope.caseId,
    )
    .limit(200);

  if (fieldsError) throw new Error(`Falha ao carregar campos verificados: ${fieldsError.message}`);

  for (const field of verifiedFields ?? []) {
    if (!CONTEXT_ATTRIBUTE_ALLOWLIST.includes(field.field_name)) continue;
    const value = field.normalized_value ?? field.raw_value;
    if (value === null || value === "") continue;
    facts.push({
      factId: `evidence_field:${field.id}`,
      attribute: field.field_name,
      label: field.field_name,
      value: field.unit ? `${value} ${field.unit}` : value,
      origin: "VERIFIED_EVIDENCE_FIELD",
      state: "VERIFIED",
      reference: field.id,
    });
    sourceRefs.push({ type: "evidence_field", id: field.id });
  }

  return { facts, references };
}

/* --------------------------------------------------------------------------
 * Capture — provider content becomes an immutable artifact
 * ------------------------------------------------------------------------ */

export interface CaptureOutcome {
  evidenceSourceId: string;
  evidenceArtifactId: string;
  sha256: string;
  contentText: string;
}

/**
 * Stores the captured text in the private bucket, computes the hash from the
 * bytes actually written, then registers source + artifact. The artifact is
 * immutable: a re-capture creates a NEW artifact, never an update.
 */
export async function persistCapturedSource(input: {
  supabase: Db;
  userId: string;
  membership: Membership;
  scope: RunScope;
  url: string;
  canonicalUrl: string;
  title: string | null;
  contentText: string;
  contentType: string | null;
  retrievedAt: string | null;
  providerMetadata: Record<string, unknown>;
  captureMethod: Database["public"]["Enums"]["capture_method"];
}): Promise<CaptureOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const bytes = new TextEncoder().encode(input.contentText);
  const sha256 = await sha256Hex(bytes.buffer as ArrayBuffer);
  const fileName = `${sha256.slice(0, 16)}.txt`;
  const storagePath = `${input.scope.organizationId}/${input.scope.caseId}/${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(RESEARCH_BUCKET)
    .upload(storagePath, bytes, { contentType: "text/plain; charset=utf-8", upsert: true });
  if (uploadError) throw new Error(`Falha ao armazenar o conteúdo capturado: ${uploadError.message}`);

  // Hash is recomputed from the stored object, never from the client payload.
  const { data: stored, error: downloadError } = await supabaseAdmin.storage
    .from(RESEARCH_BUCKET)
    .download(storagePath);
  if (downloadError || !stored) {
    throw new Error(
      `Falha ao reler o objeto armazenado para conferência de hash: ${downloadError?.message ?? "objeto ausente"}`,
    );
  }
  const storedBytes = await stored.arrayBuffer();
  const storedHash = await sha256Hex(storedBytes);
  if (storedHash !== sha256) {
    throw new Error("Hash do objeto armazenado difere do conteúdo capturado. Captura abortada.");
  }

  const { data: source, error: sourceError } = await input.supabase
    .from("evidence_sources")
    .insert({
      organization_id: input.scope.organizationId,
      valuation_case_id: input.scope.caseId,
      created_by: input.userId,
      source_name: input.title ?? extractDomain(input.canonicalUrl),
      source_type: "REAL_ESTATE_LISTING",
      source_url: input.canonicalUrl,
      accessed_at: input.retrievedAt ?? new Date().toISOString(),
      notes: `Capturado pelo motor de pesquisa (${input.captureMethod}).`,
    })
    .select("id")
    .single();
  if (sourceError) throw new Error(`Falha ao registrar a fonte: ${sourceError.message}`);

  const { data: artifact, error: artifactError } = await input.supabase
    .from("evidence_artifacts")
    .insert({
      organization_id: input.scope.organizationId,
      evidence_source_id: source.id,
      created_by: input.userId,
      file_name: fileName,
      file_size: bytes.byteLength,
      mime_type: input.contentType ?? "text/plain",
      storage_bucket: RESEARCH_BUCKET,
      storage_path: storagePath,
      capture_method: input.captureMethod,
      captured_at: input.retrievedAt ?? new Date().toISOString(),
      sha256_hash: sha256,
      hash_computed_by: "SERVER",
      source_content_text: input.contentText,
      provider_metadata: {
        ...input.providerMetadata,
        requested_url: input.url,
        canonical_url: input.canonicalUrl,
      } as never,
    })
    .select("id")
    .single();
  if (artifactError) throw new Error(`Falha ao registrar o artefato: ${artifactError.message}`);

  return {
    evidenceSourceId: source.id,
    evidenceArtifactId: artifact.id,
    sha256,
    contentText: input.contentText,
  };
}

/* --------------------------------------------------------------------------
 * Extraction — deterministic gate then candidate persistence
 * ------------------------------------------------------------------------ */

export interface ExtractionOutcome {
  extractionId: string;
  candidateIds: string[];
  fieldCount: number;
  discardedCount: number;
  issueCount: number;
  requiresReview: boolean;
}

export const ALLOWED_EXTRACTION_FIELD_NAMES = RESEARCH_FIELD_NAMES;

/**
 * Runs the gate over one captured artifact and persists the result.
 *
 * Every persisted field starts as EXTRACTED (never VERIFIED) and carries the
 * AI-declared support status side by side with the system's own support check.
 * A field whose check FAILED cannot be verified later — the database trigger
 * guard_support_check_before_verification enforces that independently.
 */
export async function persistExtraction(input: {
  supabase: Db;
  userId: string;
  scope: RunScope;
  searchResultId: string;
  evidenceSourceId: string;
  evidenceArtifactId: string;
  contentText: string;
  rawOutput: unknown;
  promptVersion: string;
  processorName: string;
  processorVersion: string;
  candidates: ReadonlyArray<{
    candidateType: Database["public"]["Enums"]["research_candidate_type"];
    fields: readonly RawExtractedField[];
  }>;
  providerWarnings: readonly string[];
  injectionSuspected: boolean;
}): Promise<ExtractionOutcome> {
  const { data: extraction, error: extractionError } = await input.supabase
    .from("evidence_extractions")
    .insert({
      organization_id: input.scope.organizationId,
      artifact_id: input.evidenceArtifactId,
      created_by: input.userId,
      processor_type: "LLM",
      processor_name: input.processorName,
      processor_version: input.processorVersion,
      prompt_version: input.promptVersion,
      extraction_type: "RESEARCH_SOURCE_EXTRACTION",
      status: "COMPLETED",
      raw_output: input.rawOutput as never,
    })
    .select("id")
    .single();
  if (extractionError) throw new Error(`Falha ao registrar a extração: ${extractionError.message}`);

  const candidateIds: string[] = [];
  let fieldCount = 0;
  let discardedCount = 0;
  let issueCount = 0;
  const issueRows: Database["public"]["Tables"]["research_extraction_issues"]["Insert"][] = [];

  if (input.injectionSuspected || input.providerWarnings.length > 0) {
    issueRows.push({
      organization_id: input.scope.organizationId,
      valuation_case_id: input.scope.caseId,
      research_run_id: input.scope.runId,
      evidence_extraction_id: extraction.id,
      issue_type: input.injectionSuspected
        ? "ADVERSARIAL_CONTENT_SUSPECTED"
        : "AMBIGUOUS_SUPPORT",
      detail: input.injectionSuspected
        ? "A extração sinalizou suspeita de instruções embutidas na fonte."
        : input.providerWarnings.join(" | ").slice(0, 1000),
      payload: { warnings: input.providerWarnings } as never,
    });
  }

  for (const candidate of input.candidates) {
    const gate = checkExtractedFields(input.contentText, candidate.fields);

    const { data: candidateRow, error: candidateError } = await input.supabase
      .from("research_entity_candidates")
      .insert({
        organization_id: input.scope.organizationId,
        valuation_case_id: input.scope.caseId,
        research_run_id: input.scope.runId,
        research_search_result_id: input.searchResultId,
        created_by: input.userId,
        candidate_type: candidate.candidateType,
        evidence_source_id: input.evidenceSourceId,
        evidence_artifact_id: input.evidenceArtifactId,
        evidence_extraction_id: extraction.id,
        status: "EXTRACTED",
      })
      .select("id")
      .single();
    if (candidateError) {
      throw new Error(`Falha ao registrar o candidato: ${candidateError.message}`);
    }
    candidateIds.push(candidateRow.id);

    for (const field of gate.fields) {
      const { data: fieldRow, error: fieldError } = await input.supabase
        .from("evidence_fields")
        .insert({
          organization_id: input.scope.organizationId,
          extraction_id: extraction.id,
          created_by: input.userId,
          field_name: field.fieldName,
          raw_value: field.rawValue,
          normalized_value: field.normalizedValue,
          numeric_value: field.numericValue,
          unit: field.unit,
          field_state: field.fieldState,
          validation_status: "EXTRACTED",
          ai_support_status: field.aiSupportStatus,
          support_check_status: field.supportCheckStatus,
          support_check_details: field.details as never,
          source_excerpt: field.sourceExcerpt,
          source_locator: (field.sourceLocator === null
            ? null
            : { locator: field.sourceLocator }) as never,
        })
        .select("id")
        .single();
      if (fieldError) throw new Error(`Falha ao registrar o campo extraído: ${fieldError.message}`);
      fieldCount += 1;

      const { error: linkError } = await input.supabase
        .from("research_entity_candidate_fields")
        .insert({
          organization_id: input.scope.organizationId,
          valuation_case_id: input.scope.caseId,
          candidate_id: candidateRow.id,
          evidence_field_id: fieldRow.id,
          semantic_role: field.definition.appliesTo,
        });
      if (linkError) throw new Error(`Falha ao vincular o campo ao candidato: ${linkError.message}`);

      for (const issue of field.issues) {
        issueRows.push({
          organization_id: input.scope.organizationId,
          valuation_case_id: input.scope.caseId,
          research_run_id: input.scope.runId,
          evidence_extraction_id: extraction.id,
          evidence_field_id: fieldRow.id,
          issue_type: issue.issueType,
          detail: issue.detail,
          payload: (issue.payload ?? null) as never,
        });
      }
    }

    // A transaction claim on a source that is not transaction evidence is an
    // issue by construction: an offer never becomes a sale.
    const claimsTransaction = gate.fields.some(
      (f) => TRANSACTION_FIELD_NAMES.includes(f.fieldName) && f.fieldState === "PRESENT",
    );
    if (
      claimsTransaction &&
      candidate.candidateType !== "CLOSED_SALE" &&
      candidate.candidateType !== "CLOSED_RENT"
    ) {
      issueRows.push({
        organization_id: input.scope.organizationId,
        valuation_case_id: input.scope.caseId,
        research_run_id: input.scope.runId,
        evidence_extraction_id: extraction.id,
        issue_type: "TRANSACTION_CLAIM_WITHOUT_DOCUMENT",
        detail:
          "A fonte apresenta alegação de preço transacionado sem ser evidência de transação documentada.",
      });
    }

    for (const item of gate.discarded) {
      discardedCount += 1;
      issueRows.push({
        organization_id: input.scope.organizationId,
        valuation_case_id: input.scope.caseId,
        research_run_id: input.scope.runId,
        evidence_extraction_id: extraction.id,
        issue_type: item.issue.issueType,
        detail: item.issue.detail,
        payload: { field_name: item.fieldName } as never,
      });
    }
  }

  if (issueRows.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("research_extraction_issues").insert(issueRows);
    if (error) throw new Error(`Falha ao registrar as inconsistências: ${error.message}`);
    issueCount = issueRows.length;
  }

  return {
    extractionId: extraction.id,
    candidateIds,
    fieldCount,
    discardedCount,
    issueCount,
    requiresReview: true,
  };
}

/* --------------------------------------------------------------------------
 * Domain policy
 * ------------------------------------------------------------------------ */

export interface DomainDecision {
  domain: string;
  status: Database["public"]["Enums"]["domain_policy_status"];
}

export async function resolveDomainPolicy(
  supabase: Db,
  organizationId: string,
  url: string,
): Promise<DomainDecision> {
  let domain: string;
  try {
    domain = extractDomain(url);
  } catch {
    throw new Error("URL sem domínio identificável.");
  }
  const { data, error } = await supabase
    .from("research_source_domain_policies")
    .select("domain, policy_status")
    .eq("organization_id", organizationId)
    .eq("domain", domain)
    .maybeSingle();
  if (error) throw new Error(`Falha ao consultar a política de domínio: ${error.message}`);
  return { domain, status: data?.policy_status ?? "ALLOWED" };
}

export function assertDomainCapturable(decision: DomainDecision): void {
  if (decision.status === "BLOCKED") {
    throw new Error(
      `O domínio ${decision.domain} está bloqueado por política da organização e não pode ser capturado.`,
    );
  }
}

/* --------------------------------------------------------------------------
 * Search result persistence
 * ------------------------------------------------------------------------ */

export async function persistSearchResults(input: {
  supabase: Db;
  userId: string;
  scope: RunScope;
  queryId: string;
  provider: string;
  results: ReadonlyArray<{
    title: string | null;
    url: string;
    snippet: string | null;
    pageAge: string | null;
    rank: number;
    providerResultReference: string | null;
    raw: unknown;
  }>;
}): Promise<{ inserted: number; deduplicated: number }> {
  let inserted = 0;
  let deduplicated = 0;

  for (const result of input.results) {
    let canonical;
    try {
      canonical = canonicalizeUrl(result.url);
    } catch {
      // A malformed provider URL is not a source. It is skipped, never guessed.
      continue;
    }

    const { data: existing, error: existingError } = await input.supabase
      .from("research_search_results")
      .select("id")
      .eq("research_run_id", input.scope.runId)
      .eq("canonical_url", canonical.canonicalUrl)
      .maybeSingle();
    if (existingError) {
      throw new Error(`Falha ao verificar duplicidade de fonte: ${existingError.message}`);
    }

    if (existing) {
      deduplicated += 1;
      const { error: hitError } = await input.supabase.from("research_result_query_hits").insert({
        organization_id: input.scope.organizationId,
        valuation_case_id: input.scope.caseId,
        research_query_id: input.queryId,
        research_search_result_id: existing.id,
        rank: result.rank,
      });
      // A repeated hit for the same query is not an error: keep the first.
      if (hitError && !hitError.message.includes("duplicate key")) {
        throw new Error(`Falha ao registrar reincidência da fonte: ${hitError.message}`);
      }
      continue;
    }

    const rawHash = await sha256Hex(
      new TextEncoder().encode(JSON.stringify(result.raw)).buffer as ArrayBuffer,
    );

    const { data: row, error } = await input.supabase
      .from("research_search_results")
      .insert({
        organization_id: input.scope.organizationId,
        valuation_case_id: input.scope.caseId,
        research_run_id: input.scope.runId,
        research_query_id: input.queryId,
        created_by: input.userId,
        provider: input.provider,
        url: result.url,
        canonical_url: canonical.canonicalUrl,
        domain: canonical.domain,
        title: result.title,
        snippet: result.snippet,
        page_age: result.pageAge,
        rank: result.rank,
        provider_result_reference: result.providerResultReference,
        raw_result_payload: result.raw as never,
        raw_payload_hash: rawHash,
        selection_status: "UNREVIEWED",
        capture_status: "NOT_CAPTURED",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao registrar o resultado de busca: ${error.message}`);
    inserted += 1;

    const { error: hitError } = await input.supabase.from("research_result_query_hits").insert({
      organization_id: input.scope.organizationId,
      valuation_case_id: input.scope.caseId,
      research_query_id: input.queryId,
      research_search_result_id: row.id,
      rank: result.rank,
    });
    if (hitError) throw new Error(`Falha ao registrar a origem do resultado: ${hitError.message}`);
  }

  return { inserted, deduplicated };
}

export { writeAudit };
