/**
 * PHASE 4B — research engine state machine.
 *
 * Each server function is ONE short, resumable step. There is no long
 * synchronous pipeline: the run state lives in the database, so any step can be
 * retried without repeating the previous ones.
 *
 * No step here verifies data. Verification remains a human act performed
 * through verify_evidence_field, and promotion through promote_research_candidate.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RESEARCH_FIELD_NAMES } from "@/lib/domain/research";
import type { ExtractionSupportStatus, ResearchCandidateType } from "@/lib/domain/research";
import { requireCaseInOrg, requireOpenCase } from "@/lib/market.server";
import {
  addManualUrlSchema,
  captureResultSchema,
  createResearchRunSchema,
  discardQuerySchema,
  executeQuerySchema,
  extractArtifactSchema,
  generatePlanSchema,
  promoteCandidateSchema,
  rejectCandidateSchema,
  runIdSchema,
  selectResultSchema,
  setDomainPolicySchema,
  upsertQuerySchema,
} from "@/lib/validation/research-schemas";
import {
  assertBudgetAvailable,
  assertDomainCapturable,
  buildContextFacts,
  enforceRateLimits,
  persistCapturedSource,
  persistExtraction,
  persistSearchResults,
  recordProviderCall,
  recordRunStarted,
  requireActiveRun,
  requireRunScope,
  resolveDomainPolicy,
  resolveProvider,
  setRunStatus,
} from "@/lib/research.server";
import { canonicalizeUrl } from "@/lib/research/url";
import {
  requireAdminAccess,
  requireMembership,
  requireWriteAccess,
  writeAudit,
} from "@/lib/workspace.server";

const caseIdInput = z.object({ caseId: z.string().uuid() });

/** Read-only: research runs of a case. */
export const listResearchRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: runs, error } = await supabase
      .from("property_research_runs")
      .select("*")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao listar pesquisas: ${error.message}`);

    const { provider, mode } = resolveProvider();
    return {
      runs: runs ?? [],
      providerMode: mode,
      providerId: provider.id,
      role: membership.role,
    };
  });

/** Full state of one run: queries, sources, candidates, fields and issues. */
export const getResearchRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const scope = await requireRunScope(supabase, data.runId, membership);

    const [run, queries, results, candidates, candidateFields, issues, snapshots, usage] =
      await Promise.all([
        supabase.from("property_research_runs").select("*").eq("id", data.runId).single(),
        supabase
          .from("research_queries")
          .select("*")
          .eq("research_run_id", data.runId)
          .order("created_at", { ascending: true }),
        supabase
          .from("research_search_results")
          .select(
            "id, research_query_id, url, canonical_url, domain, title, snippet, page_age, rank, selection_status, capture_status, capture_failure_reason, evidence_source_id, evidence_artifact_id, returned_at, provider",
          )
          .eq("research_run_id", data.runId)
          .order("rank", { ascending: true }),
        supabase
          .from("research_entity_candidates")
          .select("*")
          .eq("research_run_id", data.runId)
          .order("created_at", { ascending: true }),
        supabase
          .from("research_entity_candidate_fields")
          .select(
            "id, candidate_id, semantic_role, evidence_field_id, evidence_fields!inner(id, field_name, raw_value, normalized_value, numeric_value, unit, field_state, validation_status, ai_support_status, support_check_status, source_excerpt, verified_at, rejection_reason)",
          )
          .eq("valuation_case_id", scope.caseId),
        supabase
          .from("research_extraction_issues")
          .select("*")
          .eq("research_run_id", data.runId)
          .order("created_at", { ascending: true }),
        supabase
          .from("research_context_snapshots")
          .select("id, captured_at, facts, schema_version")
          .eq("research_run_id", data.runId)
          .order("captured_at", { ascending: false }),
        supabase
          .from("research_usage_events")
          .select("usage_type, provider, model, input_tokens, output_tokens, server_tool_uses, created_at")
          .eq("research_run_id", data.runId)
          .order("created_at", { ascending: false }),
      ]);

    if (run.error) throw new Error(`Falha ao carregar a pesquisa: ${run.error.message}`);

    const candidateIds = new Set((candidates.data ?? []).map((c) => c.id));
    const { provider, mode } = resolveProvider();

    return {
      run: run.data,
      queries: queries.data ?? [],
      results: results.data ?? [],
      candidates: candidates.data ?? [],
      candidateFields: (candidateFields.data ?? []).filter((f) => candidateIds.has(f.candidate_id)),
      issues: issues.data ?? [],
      contextSnapshots: snapshots.data ?? [],
      usage: usage.data ?? [],
      providerMode: mode,
      providerId: provider.id,
      role: membership.role,
    };
  });

/**
 * Creates the run and its immutable context snapshot. The snapshot records
 * exactly which verified facts were allowed to leave the platform boundary.
 */
export const createResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createResearchRunSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const caseScope = requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));
    await enforceRateLimits(supabase, membership, userId, "RUN_STARTED");

    const { data: property } = await supabase
      .from("properties")
      .select("id, city, state")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .maybeSingle();

    const { provider } = resolveProvider();

    const { data: run, error } = await supabase
      .from("property_research_runs")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: caseScope.caseId,
        subject_property_id: property?.id ?? null,
        requested_by: userId,
        research_type: data.researchType,
        objective: data.objective,
        provider: provider.id,
        research_model: provider.researchModel,
        extraction_model: provider.extractionModel,
        max_search_uses: data.maxSearchUses,
        max_sources: data.maxSources,
        max_fetches: data.maxFetches,
        max_extractions: data.maxExtractions,
        status: "DRAFT",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar a pesquisa: ${error.message}`);

    const scope = await requireRunScope(supabase, run.id, membership);
    const { facts, references } = await buildContextFacts(supabase, scope);

    const { error: snapshotError } = await supabase.from("research_context_snapshots").insert({
      organization_id: membership.organizationId,
      valuation_case_id: caseScope.caseId,
      research_run_id: run.id,
      subject_property_id: property?.id ?? null,
      created_by: userId,
      facts: facts as never,
      fact_references: references as never,
    });
    if (snapshotError) {
      throw new Error(`Falha ao registrar o contexto da pesquisa: ${snapshotError.message}`);
    }

    await supabase
      .from("property_research_runs")
      .update({
        location_city: property?.city ?? null,
        location_region: property?.state ?? null,
        location_country: "BR",
      })
      .eq("id", run.id);

    await recordRunStarted({
      userId,
      organizationId: membership.organizationId,
      caseId: caseScope.caseId,
      runId: run.id,
    });

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: caseScope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_RUN_CREATED",
      entityType: "property_research_run",
      entityId: run.id,
      after: { research_type: data.researchType, objective: data.objective },
      metadata: { provider: provider.id, context_fact_count: facts.length },
    });

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: caseScope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_CONTEXT_SNAPSHOT_CREATED",
      entityType: "research_context_snapshot",
      entityId: run.id,
      metadata: { fact_count: facts.length, attributes: facts.map((f) => f.attribute) },
    });

    return { runId: run.id, contextFactCount: facts.length };
  });

/** Step: ask the planner for search queries. The planner cannot reach a URL. */
export const generateResearchPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generatePlanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = requireActiveRun(await requireRunScope(supabase, data.runId, membership));
    await enforceRateLimits(supabase, membership, userId, "PLAN_QUERIES");

    const { provider } = resolveProvider();
    const { facts } = await buildContextFacts(supabase, scope);

    await setRunStatus(supabase, scope.runId, "PLANNING");

    let plan;
    try {
      plan = await provider.generateQueryPlan({
        researchType: scope.researchType,
        objective: scope.objective,
        facts,
        location: {
          city: scope.locationCity,
          region: scope.locationRegion,
          country: scope.locationCountry,
        },
        maxQueries: data.maxQueries,
      });
    } catch (error) {
      await setRunStatus(supabase, scope.runId, "FAILED", {
        failure_reason: error instanceof Error ? error.message : "erro desconhecido",
      });
      throw error;
    }

    const aiRunId = await recordProviderCall({
      supabase,
      membership,
      userId,
      scope,
      purpose: "RESEARCH_QUERY_PLANNING",
      usageType: "PLAN_QUERIES",
      call: plan.call,
      inputEvidenceIds: facts
        .filter((f) => f.factId.startsWith("evidence_field:"))
        .map((f) => f.factId.replace("evidence_field:", "")),
    });

    if (plan.queries.length > 0) {
      const { error } = await supabase.from("research_queries").insert(
        plan.queries.map((query) => ({
          organization_id: membership.organizationId,
          valuation_case_id: scope.caseId,
          research_run_id: scope.runId,
          created_by: userId,
          generated_by: "AI" as const,
          query_text: query.query,
          purpose: query.purpose,
          input_fact_references: { fact_ids: query.inputFactIds } as never,
          ai_run_id: aiRunId,
          status: "PROPOSED" as const,
        })),
      );
      if (error) throw new Error(`Falha ao registrar as consultas propostas: ${error.message}`);
    }

    await setRunStatus(supabase, scope.runId, "PLAN_READY");
    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_PLAN_GENERATED",
      entityType: "property_research_run",
      entityId: scope.runId,
      metadata: { query_count: plan.queries.length, ai_run_id: aiRunId },
    });

    return { queryCount: plan.queries.length };
  });

/** Human edits or adds a query. Editing an AI query preserves its origin. */
export const saveResearchQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => upsertQuerySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = requireActiveRun(await requireRunScope(supabase, data.runId, membership));

    if (data.queryId) {
      const { data: existing, error: readError } = await supabase
        .from("research_queries")
        .select("id, query_text, status, research_run_id")
        .eq("id", data.queryId)
        .maybeSingle();
      if (readError) throw new Error(`Falha ao carregar a consulta: ${readError.message}`);
      if (!existing || existing.research_run_id !== scope.runId) {
        throw new Error("Consulta não pertence a esta pesquisa.");
      }
      if (existing.status !== "PROPOSED" && existing.status !== "APPROVED") {
        throw new Error("Uma consulta já executada ou descartada não pode ser editada.");
      }

      const { error } = await supabase
        .from("research_queries")
        .update({ query_text: data.queryText, purpose: data.purpose ?? null, status: "APPROVED" })
        .eq("id", data.queryId);
      if (error) throw new Error(`Falha ao salvar a consulta: ${error.message}`);

      await writeAudit(supabase, {
        organizationId: membership.organizationId,
        caseId: scope.caseId,
        actorUserId: userId,
        eventType: "RESEARCH_QUERY_EDITED",
        entityType: "research_query",
        entityId: data.queryId,
        before: { query_text: existing.query_text },
        after: { query_text: data.queryText },
      });
      return { queryId: data.queryId };
    }

    const { data: created, error } = await supabase
      .from("research_queries")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: scope.caseId,
        research_run_id: scope.runId,
        created_by: userId,
        generated_by: "USER",
        query_text: data.queryText,
        purpose: data.purpose ?? null,
        status: "APPROVED",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar a consulta: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_QUERY_ADDED",
      entityType: "research_query",
      entityId: created.id,
      after: { query_text: data.queryText },
    });
    return { queryId: created.id };
  });

export const discardResearchQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => discardQuerySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: query, error: readError } = await supabase
      .from("research_queries")
      .select("id, organization_id, valuation_case_id, status")
      .eq("id", data.queryId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar a consulta: ${readError.message}`);
    if (!query || query.organization_id !== membership.organizationId) {
      throw new Error("Consulta fora do escopo da organização atual.");
    }

    const { error } = await supabase
      .from("research_queries")
      .update({ status: "DISCARDED" })
      .eq("id", data.queryId);
    if (error) throw new Error(`Falha ao descartar a consulta: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: query.valuation_case_id,
      actorUserId: userId,
      eventType: "RESEARCH_QUERY_DISCARDED",
      entityType: "research_query",
      entityId: data.queryId,
      metadata: { reason: data.reason ?? null },
    });
    return { queryId: data.queryId };
  });

/**
 * Step: execute ONE approved query. Only provider tool-result blocks become
 * sources; a URL that appears only in model prose is discarded and reported.
 */
export const executeResearchQuery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => executeQuerySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: query, error: readError } = await supabase
      .from("research_queries")
      .select("id, research_run_id, query_text, status, organization_id")
      .eq("id", data.queryId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar a consulta: ${readError.message}`);
    if (!query || query.organization_id !== membership.organizationId) {
      throw new Error("Consulta fora do escopo da organização atual.");
    }
    if (query.status === "EXECUTED") throw new Error("Esta consulta já foi executada.");
    if (query.status === "DISCARDED") throw new Error("Consulta descartada não pode ser executada.");

    const scope = requireActiveRun(await requireRunScope(supabase, query.research_run_id, membership));
    assertBudgetAvailable(scope, "SEARCH");
    await enforceRateLimits(supabase, membership, userId, "SEARCH");

    const { data: blocked } = await supabase
      .from("research_source_domain_policies")
      .select("domain")
      .eq("organization_id", membership.organizationId)
      .eq("policy_status", "BLOCKED");

    const { provider } = resolveProvider();
    await setRunStatus(supabase, scope.runId, "SEARCHING");

    let search;
    try {
      search = await provider.search({
        query: query.query_text,
        maxUses: 1,
        maxResults: Math.max(1, scope.maxSources - 0),
        blockedDomains: (blocked ?? []).map((b) => b.domain),
        location: {
          city: scope.locationCity,
          region: scope.locationRegion,
          country: scope.locationCountry,
        },
      });
    } catch (error) {
      await supabase.from("research_queries").update({ status: "FAILED" }).eq("id", query.id);
      await setRunStatus(supabase, scope.runId, "PLAN_READY");
      throw error;
    }

    await recordProviderCall({
      supabase,
      membership,
      userId,
      scope,
      purpose: "RESEARCH_WEB_SEARCH",
      usageType: "SEARCH",
      call: search.call,
    });

    const persisted = await persistSearchResults({
      supabase,
      userId,
      scope,
      queryId: query.id,
      provider: provider.id,
      results: search.results,
    });

    await supabase
      .from("research_queries")
      .update({
        status: "EXECUTED",
        executed_at: new Date().toISOString(),
        result_count: search.results.length,
      })
      .eq("id", query.id);

    await setRunStatus(supabase, scope.runId, "RESULTS_READY");

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_QUERY_EXECUTED",
      entityType: "research_query",
      entityId: query.id,
      metadata: {
        returned: search.results.length,
        inserted: persisted.inserted,
        deduplicated: persisted.deduplicated,
        rejected_prose_urls: search.rejectedProseUrls,
      },
    });

    return {
      returned: search.results.length,
      inserted: persisted.inserted,
      deduplicated: persisted.deduplicated,
      rejectedProseUrls: search.rejectedProseUrls,
    };
  });

/** Human selects which returned sources deserve capture. */
export const setResultSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => selectResultSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: result, error: readError } = await supabase
      .from("research_search_results")
      .select("id, organization_id, valuation_case_id, selection_status, capture_status")
      .eq("id", data.resultId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar o resultado: ${readError.message}`);
    if (!result || result.organization_id !== membership.organizationId) {
      throw new Error("Resultado fora do escopo da organização atual.");
    }

    const { error } = await supabase
      .from("research_search_results")
      .update({ selection_status: data.selectionStatus })
      .eq("id", data.resultId);
    if (error) throw new Error(`Falha ao atualizar a seleção: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: result.valuation_case_id,
      actorUserId: userId,
      eventType: "RESEARCH_RESULT_SELECTION_CHANGED",
      entityType: "research_search_result",
      entityId: data.resultId,
      before: { selection_status: result.selection_status },
      after: { selection_status: data.selectionStatus },
    });
    return { resultId: data.resultId };
  });

/** A human may add a source by URL. It enters the same capture/extraction gate. */
export const addManualSourceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addManualUrlSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = requireActiveRun(await requireRunScope(supabase, data.runId, membership));

    const canonical = canonicalizeUrl(data.url);

    const { data: existing } = await supabase
      .from("research_search_results")
      .select("id")
      .eq("research_run_id", scope.runId)
      .eq("canonical_url", canonical.canonicalUrl)
      .maybeSingle();
    if (existing) return { resultId: existing.id, deduplicated: true };

    const { data: row, error } = await supabase
      .from("research_search_results")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: scope.caseId,
        research_run_id: scope.runId,
        created_by: userId,
        provider: "USER",
        url: canonical.url,
        canonical_url: canonical.canonicalUrl,
        domain: canonical.domain,
        title: data.title ?? null,
        selection_status: "SELECTED",
        capture_status: "NOT_CAPTURED",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao registrar a URL: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_MANUAL_URL_ADDED",
      entityType: "research_search_result",
      entityId: row.id,
      after: { canonical_url: canonical.canonicalUrl },
    });
    return { resultId: row.id, deduplicated: false };
  });

/**
 * Step: capture ONE selected source. Produces an immutable artifact with a
 * server-computed hash. A failure is recorded on the row, never hidden.
 */
export const captureResearchSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => captureResultSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: result, error: readError } = await supabase
      .from("research_search_results")
      .select(
        "id, research_run_id, organization_id, canonical_url, url, domain, title, selection_status, capture_status",
      )
      .eq("id", data.resultId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar o resultado: ${readError.message}`);
    if (!result || result.organization_id !== membership.organizationId) {
      throw new Error("Resultado fora do escopo da organização atual.");
    }
    if (result.selection_status !== "SELECTED") {
      throw new Error("Somente fontes explicitamente selecionadas podem ser capturadas.");
    }
    if (result.capture_status === "CAPTURED") {
      throw new Error("Esta fonte já foi capturada. Artefatos são imutáveis.");
    }

    const scope = requireActiveRun(await requireRunScope(supabase, result.research_run_id, membership));
    assertBudgetAvailable(scope, "FETCH");
    await enforceRateLimits(supabase, membership, userId, "FETCH");

    const policy = await resolveDomainPolicy(supabase, membership.organizationId, result.canonical_url);
    if (policy.status === "BLOCKED") {
      await supabase
        .from("research_search_results")
        .update({
          capture_status: "BLOCKED_BY_POLICY",
          capture_failure_reason: `Domínio ${policy.domain} bloqueado por política da organização.`,
        })
        .eq("id", result.id);
      assertDomainCapturable(policy);
    }

    const { provider } = resolveProvider();
    await setRunStatus(supabase, scope.runId, "CAPTURING");
    await supabase
      .from("research_search_results")
      .update({ capture_status: "CAPTURING" })
      .eq("id", result.id);

    const fetched = await provider.fetch({
      url: result.canonical_url,
      allowedDomains: [result.domain],
      maxContentTokens: 100_000,
    });

    await recordProviderCall({
      supabase,
      membership,
      userId,
      scope,
      purpose: "RESEARCH_SOURCE_CAPTURE",
      usageType: "FETCH",
      call: fetched.call,
    });

    if (!fetched.retrieved || !fetched.contentText) {
      const failure = fetched.failureReason ?? "Conteúdo não recuperado.";
      const status = failure.includes("restrict") || failure.includes("403")
        ? "ACCESS_RESTRICTED"
        : "FAILED";
      await supabase
        .from("research_search_results")
        .update({ capture_status: status, capture_failure_reason: failure })
        .eq("id", result.id);
      await setRunStatus(supabase, scope.runId, "RESULTS_READY");
      await writeAudit(supabase, {
        organizationId: membership.organizationId,
        caseId: scope.caseId,
        actorUserId: userId,
        eventType: "RESEARCH_SOURCE_CAPTURE_FAILED",
        entityType: "research_search_result",
        entityId: result.id,
        metadata: { failure_reason: failure },
      });
      return { captured: false, failureReason: failure };
    }

    const capture = await persistCapturedSource({
      supabase,
      userId,
      membership,
      scope,
      url: result.url,
      canonicalUrl: result.canonical_url,
      title: result.title,
      contentText: fetched.contentText,
      contentType: fetched.contentType,
      retrievedAt: fetched.retrievedAt,
      providerMetadata: fetched.providerMetadata,
      captureMethod: provider.id === "ANTHROPIC" ? "ANTHROPIC_WEB_FETCH" : "OTHER",
    });

    const { error: updateError } = await supabase
      .from("research_search_results")
      .update({
        capture_status: "CAPTURED",
        capture_failure_reason: null,
        evidence_source_id: capture.evidenceSourceId,
        evidence_artifact_id: capture.evidenceArtifactId,
      })
      .eq("id", result.id);
    if (updateError) throw new Error(`Falha ao vincular a captura: ${updateError.message}`);

    await setRunStatus(supabase, scope.runId, "RESULTS_READY");
    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_SOURCE_CAPTURED",
      entityType: "evidence_artifact",
      entityId: capture.evidenceArtifactId,
      metadata: {
        canonical_url: result.canonical_url,
        sha256: capture.sha256,
        hash_computed_by: "SERVER",
      },
    });

    return { captured: true, artifactId: capture.evidenceArtifactId, sha256: capture.sha256 };
  });

/**
 * Step: extract candidates from ONE captured artifact. The extraction model
 * receives no tools: it cannot search, fetch or reach the database.
 */
export const extractResearchSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractArtifactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: result, error: readError } = await supabase
      .from("research_search_results")
      .select(
        "id, research_run_id, organization_id, canonical_url, capture_status, evidence_source_id, evidence_artifact_id",
      )
      .eq("id", data.resultId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar o resultado: ${readError.message}`);
    if (!result || result.organization_id !== membership.organizationId) {
      throw new Error("Resultado fora do escopo da organização atual.");
    }
    if (
      result.capture_status !== "CAPTURED" ||
      !result.evidence_artifact_id ||
      !result.evidence_source_id
    ) {
      throw new Error("Só é possível extrair de uma fonte efetivamente capturada.");
    }

    const scope = requireActiveRun(await requireRunScope(supabase, result.research_run_id, membership));
    assertBudgetAvailable(scope, "EXTRACT");
    await enforceRateLimits(supabase, membership, userId, "EXTRACT");

    const { data: artifact, error: artifactError } = await supabase
      .from("evidence_artifacts")
      .select("id, source_content_text, sha256_hash")
      .eq("id", result.evidence_artifact_id)
      .single();
    if (artifactError) throw new Error(`Falha ao carregar o artefato: ${artifactError.message}`);
    if (!artifact.source_content_text) {
      throw new Error("Artefato sem conteúdo textual armazenado; extração impossível.");
    }

    // Idempotency: an artifact is extracted once. Re-running would duplicate
    // candidates over the same immutable bytes.
    const { count: existingExtractions, error: existingError } = await supabase
      .from("evidence_extractions")
      .select("id", { count: "exact", head: true })
      .eq("artifact_id", result.evidence_artifact_id)
      .eq("status", "COMPLETED");
    if (existingError) {
      throw new Error(`Falha ao verificar extrações anteriores: ${existingError.message}`);
    }
    if ((existingExtractions ?? 0) > 0) {
      throw new Error(
        "Este artefato já foi extraído. Extrações são imutáveis; crie uma nova captura para reextrair.",
      );
    }

    const { provider } = resolveProvider();
    await setRunStatus(supabase, scope.runId, "EXTRACTING");

    const extraction = await provider.extract({
      content: artifact.source_content_text,
      sourceUrl: result.canonical_url,
      allowedFieldNames: RESEARCH_FIELD_NAMES,
      researchType: scope.researchType,
    });

    await recordProviderCall({
      supabase,
      membership,
      userId,
      scope,
      purpose: "RESEARCH_SOURCE_EXTRACTION",
      usageType: "EXTRACT",
      call: extraction.call,
    });

    const outcome = await persistExtraction({
      supabase,
      userId,
      scope,
      searchResultId: result.id,
      evidenceSourceId: result.evidence_source_id,
      evidenceArtifactId: result.evidence_artifact_id,
      contentText: artifact.source_content_text,
      rawOutput: extraction.call.rawOutput,
      promptVersion: extraction.call.promptVersion,
      processorName: `${provider.id}:${provider.extractionModel}`,
      processorVersion: extraction.call.model,
      candidates: extraction.output.entity_candidates.map((candidate) => ({
        candidateType: candidate.candidate_type as ResearchCandidateType,
        fields: candidate.fields.map((field) => ({
          fieldName: field.field_name,
          rawValue: field.raw_value,
          supportStatus: field.support_status as ExtractionSupportStatus,
          sourceExcerpt: field.source_excerpt,
          sourceLocator: field.source_locator,
          aiNumericValue: field.numeric_value,
        })),
      })),
      providerWarnings: extraction.output.warnings,
      injectionSuspected: extraction.output.document_assessment.prompt_injection_suspected,
    });

    await setRunStatus(supabase, scope.runId, "REVIEW_REQUIRED");
    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_EXTRACTION_COMPLETED",
      entityType: "evidence_extraction",
      entityId: outcome.extractionId,
      metadata: {
        candidates: outcome.candidateIds.length,
        fields: outcome.fieldCount,
        discarded_fields: outcome.discardedCount,
        issues: outcome.issueCount,
        artifact_sha256: artifact.sha256_hash,
      },
    });

    return outcome;
  });

export const rejectResearchCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rejectCandidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: candidate, error: readError } = await supabase
      .from("research_entity_candidates")
      .select("id, organization_id, valuation_case_id, status")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (readError) throw new Error(`Falha ao carregar o candidato: ${readError.message}`);
    if (!candidate || candidate.organization_id !== membership.organizationId) {
      throw new Error("Candidato fora do escopo da organização atual.");
    }
    if (candidate.status === "PROMOTED") {
      throw new Error("Um candidato promovido não pode ser rejeitado. Decida no acervo de mercado.");
    }

    const { error } = await supabase
      .from("research_entity_candidates")
      .update({ status: "REJECTED", rejection_reason: data.reason })
      .eq("id", data.candidateId);
    if (error) throw new Error(`Falha ao rejeitar o candidato: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: candidate.valuation_case_id,
      actorUserId: userId,
      eventType: "RESEARCH_CANDIDATE_REJECTED",
      entityType: "research_entity_candidate",
      entityId: data.candidateId,
      before: { status: candidate.status },
      after: { status: "REJECTED", rejection_reason: data.reason },
    });
    return { candidateId: data.candidateId };
  });

/**
 * Promotion is a single database operation: promote_research_candidate validates
 * lineage, requires VERIFIED fields and refuses to turn an offer into a
 * transaction. There is deliberately no application-side alternative path.
 */
export const promoteResearchCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => promoteCandidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireMembership(supabase, userId);

    // Optional arguments are omitted (not sent as empty strings) so the SQL
    // defaults apply; the RPC decides what a missing market property means.
    const args = {
      _candidate_id: data.candidateId,
      _field_ids: data.fieldIds,
      _observation_type: data.observationType,
      _observation_status: data.observationStatus,
      ...(data.marketPropertyId ? { _market_property_id: data.marketPropertyId } : {}),
      ...(data.label ? { _label: data.label } : {}),
      ...(data.notes ? { _notes: data.notes } : {}),
    } as unknown as Database["public"]["Functions"]["promote_research_candidate"]["Args"];

    const { data: outcome, error } = await supabase.rpc("promote_research_candidate", args);
    if (error) throw new Error(error.message);
    return { outcome: JSON.stringify(outcome ?? null) };
  });

export const cancelResearchRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => runIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = requireActiveRun(await requireRunScope(supabase, data.runId, membership));

    await setRunStatus(supabase, scope.runId, "CANCELLED", {
      completed_at: new Date().toISOString(),
    });
    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: scope.caseId,
      actorUserId: userId,
      eventType: "RESEARCH_RUN_CANCELLED",
      entityType: "property_research_run",
      entityId: scope.runId,
    });
    return { runId: scope.runId };
  });

/** Domain policy is an organization-level decision, so it requires ADMIN. */
export const setResearchDomainPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setDomainPolicySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireAdminAccess(supabase, userId);

    const domain = data.domain.toLowerCase().replace(/^www\./, "");
    const { error } = await supabase.from("research_source_domain_policies").upsert(
      {
        organization_id: membership.organizationId,
        domain,
        policy_status: data.policyStatus,
        notes: data.notes ?? null,
        created_by: userId,
      },
      { onConflict: "organization_id,domain" },
    );
    if (error) throw new Error(`Falha ao salvar a política de domínio: ${error.message}`);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "RESEARCH_DOMAIN_POLICY_SET",
      entityType: "research_source_domain_policy",
      entityId: null,
      after: { domain, policy_status: data.policyStatus },
    });
    return { domain, policyStatus: data.policyStatus };
  });

export const listResearchDomainPolicies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const { data, error } = await supabase
      .from("research_source_domain_policies")
      .select("domain, policy_status, notes, updated_at")
      .eq("organization_id", membership.organizationId)
      .order("domain", { ascending: true });
    if (error) throw new Error(`Falha ao listar políticas de domínio: ${error.message}`);
    return { policies: data ?? [], role: membership.role };
  });
