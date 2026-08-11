import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { JsonObject } from "@/lib/domain/intelligence";
import { asIntelligenceReport } from "@/lib/market-intelligence.server";
import {
  requireIssueInCase,
  requireSelectionRunInCase,
  requireSnapshotInCase,
} from "@/lib/market-intelligence.server";
import { requireCaseInOrg, requireOpenCase } from "@/lib/market.server";
import {
  acknowledgeReadinessSchema,
  assessReadinessSchema,
  buildFeatureSnapshotSchema,
  caseScopeSchema,
  completeSampleSelectionSchema,
  confirmIdentityClusterSchema,
  createDiagnosticPolicySchema,
  createMarketEvidenceSnapshotSchema,
  decideSampleItemSchema,
  issueDecisionSchema,
  refreshIssuesSchema,
  startSampleSelectionSchema,
  verifySnapshotSchema,
} from "@/lib/validation/intelligence-schemas";
import {
  requireAdminAccess,
  requireMembership,
  requireReviewAccess,
  requireWriteAccess,
  writeAudit,
} from "@/lib/workspace.server";

/* ============================================================== leitura == */

export const getMarketIntelligence = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const scope = await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: report, error } = await supabase.rpc("market_intelligence_report", {
      _case_id: data.caseId,
    });
    if (error) throw new Error(error.message);

    const [policies, snapshots, selectionRuns, selectionSnapshots, issues, readiness, clusters] =
      await Promise.all([
        supabase
          .from("market_diagnostic_policies")
          .select("*")
          .or(`organization_id.eq.${membership.organizationId},organization_id.is.null`)
          .order("created_at", { ascending: false }),
        supabase
          .from("market_evidence_snapshots")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("version_number", { ascending: false }),
        supabase
          .from("sample_selection_runs")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("sample_selection_snapshots")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("version_number", { ascending: false }),
        supabase
          .from("market_data_issues")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("opened_at", { ascending: false }),
        supabase
          .from("sample_readiness_assessments")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("version_number", { ascending: false }),
        supabase
          .from("market_identity_clusters")
          .select("*")
          .eq("valuation_case_id", data.caseId)
          .order("confirmed_at", { ascending: false }),
      ]);

    for (const result of [
      policies,
      snapshots,
      selectionRuns,
      selectionSnapshots,
      issues,
      readiness,
      clusters,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      role: membership.role,
      caseStatus: scope.status,
      report: asIntelligenceReport(report),
      policies: policies.data ?? [],
      snapshots: snapshots.data ?? [],
      selectionRuns: selectionRuns.data ?? [],
      selectionSnapshots: selectionSnapshots.data ?? [],
      issues: issues.data ?? [],
      readiness: readiness.data ?? [],
      clusters: clusters.data ?? [],
    };
  });

export const listSampleSelectionItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => completeSampleSelectionSchema.pick({ caseId: true, runId: true }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);
    await requireSelectionRunInCase(supabase, data.runId, data.caseId, membership);

    const { data: items, error } = await supabase
      .from("sample_selection_items")
      .select("*")
      .eq("selection_run_id", data.runId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { role: membership.role, items: items ?? [] };
  });

export const verifySnapshotIntegrity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifySnapshotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);
    await requireSnapshotInCase(
      supabase,
      data.kind === "MARKET_EVIDENCE" ? "market_evidence_snapshots" : "sample_selection_snapshots",
      data.snapshotId,
      data.caseId,
      membership,
    );

    const { data: result, error } = await supabase.rpc("verify_snapshot_integrity", {
      _kind: data.kind,
      _snapshot_id: data.snapshotId,
    });
    if (error) throw new Error(error.message);
    return result as JsonObject;
  });

/* ============================================================= políticas == */

export const createDiagnosticPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createDiagnosticPolicySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireAdminAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: created, error } = await supabase
      .from("market_diagnostic_policies")
      .insert({
        organization_id: membership.organizationId,
        name: data.name,
        version: data.version,
        status: "ACTIVE",
        configuration: data.configuration as never,
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      caseId: data.caseId,
      actorUserId: userId,
      eventType: "DIAGNOSTIC_POLICY_CREATED",
      entityType: "market_diagnostic_policies",
      entityId: created.id,
      after: created,
    });

    return { policy: created };
  });

/* ============================================================== retratos == */

export const createMarketEvidenceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMarketEvidenceSnapshotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const { data: snapshotId, error } = await supabase.rpc("create_market_evidence_snapshot", {
      _case_id: data.caseId,
      _description: data.description,
    });
    if (error) throw new Error(error.message);
    return { snapshotId: snapshotId as string };
  });

/* ============================================================ identidade == */

export const confirmIdentityCluster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => confirmIdentityClusterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const { data: clusterId, error } = await supabase.rpc("confirm_market_identity_cluster", {
      _case_id: data.caseId,
      _market_property_ids: data.marketPropertyIds,
      _representative_market_property_id: data.representativeMarketPropertyId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { clusterId: clusterId as string };
  });

/* ====================================================== diferenças factuais == */

export const buildFeatureSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => buildFeatureSnapshotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const { data: snapshotId, error } = await supabase.rpc("build_comparable_feature_snapshot", {
      _candidate_id: data.candidateId,
    });
    if (error) throw new Error(error.message);

    const { data: snapshot, error: readError } = await supabase
      .from("comparable_feature_snapshots")
      .select("*")
      .eq("id", snapshotId as string)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    return { snapshot };
  });

/* ============================================================== amostra == */

export const startSampleSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startSampleSelectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));
    await requireSnapshotInCase(
      supabase,
      "market_evidence_snapshots",
      data.marketEvidenceSnapshotId,
      data.caseId,
      membership,
    );

    const { data: runId, error } = await supabase.rpc("start_sample_selection", {
      _case_id: data.caseId,
      _market_evidence_snapshot_id: data.marketEvidenceSnapshotId,
      _purpose: data.purpose,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { runId: runId as string };
  });

export const decideSampleItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decideSampleItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));
    await requireSelectionRunInCase(supabase, data.runId, data.caseId, membership);

    const { data: itemId, error } = await supabase.rpc("decide_sample_selection_item", {
      _run_id: data.runId,
      _market_observation_id: data.marketObservationId,
      _final_state: data.finalState,
      _reason_code: data.reasonCode,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { itemId: itemId as string };
  });

export const completeSampleSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => completeSampleSelectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));
    await requireSelectionRunInCase(supabase, data.runId, data.caseId, membership);

    const { data: snapshotId, error } = await supabase.rpc("complete_sample_selection", {
      _run_id: data.runId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { snapshotId: snapshotId as string };
  });

/* =========================================================== ocorrências == */

export const refreshMarketDataIssues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => refreshIssuesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: result, error } = await supabase.rpc("refresh_market_data_issues", {
      _case_id: data.caseId,
      _policy_id: data.policyId,
    });
    if (error) throw new Error(error.message);
    return { result: result as JsonObject };
  });

export const acknowledgeMarketDataIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => issueDecisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);
    await requireIssueInCase(supabase, data.issueId, data.caseId, membership);

    const { data: eventId, error } = await supabase.rpc("acknowledge_market_data_issue", {
      _issue_id: data.issueId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { eventId: eventId as string };
  });

export const resolveMarketDataIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => issueDecisionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);
    await requireIssueInCase(supabase, data.issueId, data.caseId, membership);

    const { data: eventId, error } = await supabase.rpc("resolve_market_data_issue", {
      _issue_id: data.issueId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { eventId: eventId as string };
  });

/* ============================================================ readiness == */

export const assessSampleReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assessReadinessSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);
    await requireSnapshotInCase(
      supabase,
      "market_evidence_snapshots",
      data.marketEvidenceSnapshotId,
      data.caseId,
      membership,
    );
    await requireSnapshotInCase(
      supabase,
      "sample_selection_snapshots",
      data.sampleSelectionSnapshotId,
      data.caseId,
      membership,
    );

    const { data: assessmentId, error } = await supabase.rpc("assess_sample_readiness", {
      _case_id: data.caseId,
      _market_evidence_snapshot_id: data.marketEvidenceSnapshotId,
      _sample_selection_snapshot_id: data.sampleSelectionSnapshotId,
      _policy_id: data.policyId,
    });
    if (error) throw new Error(error.message);
    return { assessmentId: assessmentId as string };
  });

export const acknowledgeReadinessWarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => acknowledgeReadinessSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: assessmentId, error } = await supabase.rpc("acknowledge_readiness_warnings", {
      _assessment_id: data.assessmentId,
      _notes: data.notes,
    });
    if (error) throw new Error(error.message);
    return { assessmentId: assessmentId as string };
  });
