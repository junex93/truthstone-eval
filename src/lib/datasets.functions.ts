import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createDatasetSchema,
  datasetItemSchema,
  freezeDatasetSchema,
} from "@/lib/validation/schemas";
import {
  requireMembership,
  requireWriteAccess,
  sha256HexOfString,
  writeAudit,
} from "@/lib/workspace.server";

export const listDatasets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    let query = supabase
      .from("dataset_versions")
      .select(
        "id, valuation_case_id, version_number, name, purpose, created_at, frozen_at, frozen_by, dataset_hash",
      )
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false });
    if (data.caseId) query = query.eq("valuation_case_id", data.caseId);

    const { data: datasets, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (datasets ?? []).map((d) => d.id);
    const { data: items } = await supabase
      .from("dataset_items")
      .select("id, dataset_version_id")
      .in("dataset_version_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: cases } = await supabase
      .from("valuation_cases")
      .select("id, case_code, title")
      .eq("organization_id", membership.organizationId);

    return {
      role: membership.role,
      cases: cases ?? [],
      datasets: (datasets ?? []).map((d) => ({
        ...d,
        itemCount: (items ?? []).filter((i) => i.dataset_version_id === d.id).length,
        case: (cases ?? []).find((c) => c.id === d.valuation_case_id) ?? null,
      })),
    };
  });

export const createDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createDatasetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: valuationCase } = await supabase
      .from("valuation_cases")
      .select("id")
      .eq("id", data.caseId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!valuationCase) throw new Error("Caso não encontrado nesta organização.");

    const { data: last } = await supabase
      .from("dataset_versions")
      .select("version_number")
      .eq("valuation_case_id", data.caseId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = (last?.version_number ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("dataset_versions")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        version_number: versionNumber,
        name: data.name,
        description: data.description ?? null,
        purpose: data.purpose ?? null,
        inclusion_criteria: data.inclusionCriteria ?? null,
        exclusion_criteria: data.exclusionCriteria ?? null,
        known_limitations: data.knownLimitations ?? null,
        geographic_scope: data.geographicScope ?? null,
        temporal_scope: data.temporalScope ?? null,
        created_by: userId,
      })
      .select("id, version_number, name")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "DATASET_CREATED",
      entityType: "dataset_version",
      entityId: created.id,
      after: created,
    });

    return created;
  });

export const getDatasetDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ datasetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: dataset, error } = await supabase
      .from("dataset_versions")
      .select("*")
      .eq("id", data.datasetId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!dataset) throw new Error("Dataset não encontrado.");

    const { data: items } = await supabase
      .from("dataset_items")
      .select("id, evidence_field_id, role_in_dataset, created_at")
      .eq("dataset_version_id", dataset.id)
      .order("created_at", { ascending: true });

    const fieldIds = (items ?? []).map((i) => i.evidence_field_id);
    const fallback = ["00000000-0000-0000-0000-000000000000"];

    const { data: includedFields } = await supabase
      .from("evidence_fields")
      .select(
        "id, field_name, raw_value, normalized_value, unit, field_state, validation_status, source_excerpt, verified_at, extraction_id",
      )
      .in("id", fieldIds.length > 0 ? fieldIds : fallback);

    const { data: eligibleFields } = await supabase
      .from("evidence_fields")
      .select(
        "id, field_name, raw_value, normalized_value, unit, field_state, verified_at, extraction_id",
      )
      .eq("organization_id", membership.organizationId)
      .eq("validation_status", "VERIFIED")
      .order("verified_at", { ascending: false })
      .limit(300);

    const [{ count: rejectedCount }, { data: valuationCase }] = await Promise.all([
      supabase
        .from("evidence_fields")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", membership.organizationId)
        .eq("validation_status", "REJECTED"),
      supabase
        .from("valuation_cases")
        .select("id, case_code, title, status")
        .eq("id", dataset.valuation_case_id)
        .maybeSingle(),
    ]);

    return {
      role: membership.role,
      dataset,
      valuationCase: valuationCase ?? null,
      items: (items ?? []).map((item) => ({
        ...item,
        field: (includedFields ?? []).find((f) => f.id === item.evidence_field_id) ?? null,
      })),
      eligibleFields: (eligibleFields ?? []).filter((f) => !fieldIds.includes(f.id)),
      rejectedFieldCount: rejectedCount ?? 0,
      isFrozen: dataset.frozen_at !== null,
    };
  });

export const addDatasetItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => datasetItemSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: dataset } = await supabase
      .from("dataset_versions")
      .select("id, frozen_at, valuation_case_id")
      .eq("id", data.datasetVersionId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!dataset) throw new Error("Dataset não encontrado.");
    if (dataset.frozen_at) throw new Error("Dataset congelado: crie uma nova versão.");

    const { data: field } = await supabase
      .from("evidence_fields")
      .select("id, validation_status")
      .eq("id", data.evidenceFieldId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!field) throw new Error("Campo de evidência não encontrado.");
    if (field.validation_status !== "VERIFIED") {
      throw new Error("Somente campos VERIFICADOS podem compor um dataset.");
    }

    const { error } = await supabase.from("dataset_items").insert({
      organization_id: membership.organizationId,
      dataset_version_id: dataset.id,
      evidence_field_id: field.id,
      role_in_dataset: data.roleInDataset ?? null,
      created_by: userId,
    });
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: dataset.valuation_case_id,
      eventType: "DATASET_ITEM_ADDED",
      entityType: "dataset_item",
      entityId: dataset.id,
      after: { evidence_field_id: field.id },
    });

    return { ok: true };
  });

export const removeDatasetItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ itemId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: item } = await supabase
      .from("dataset_items")
      .select("id, dataset_version_id, evidence_field_id, organization_id")
      .eq("id", data.itemId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");

    const { data: dataset } = await supabase
      .from("dataset_versions")
      .select("id, frozen_at, valuation_case_id")
      .eq("id", item.dataset_version_id)
      .maybeSingle();
    if (dataset?.frozen_at) throw new Error("Dataset congelado: crie uma nova versão.");

    const { error } = await supabase.from("dataset_items").delete().eq("id", item.id);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: dataset?.valuation_case_id ?? null,
      eventType: "DATASET_ITEM_REMOVED",
      entityType: "dataset_item",
      entityId: item.id,
      before: { evidence_field_id: item.evidence_field_id },
    });

    return { ok: true };
  });

/**
 * Freezes a dataset version. The hash is a deterministic digest of the ordered
 * composition (field id + normalized value + unit + verification timestamp), so
 * the exact dataset used in a valuation can be reproduced and checked later.
 */
export const freezeDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => freezeDatasetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: dataset } = await supabase
      .from("dataset_versions")
      .select("*")
      .eq("id", data.datasetVersionId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (!dataset) throw new Error("Dataset não encontrado.");
    if (dataset.frozen_at) throw new Error("Este dataset já está congelado.");

    const { data: result, error } = await supabase.rpc("freeze_dataset", {
      _dataset_version_id: data.datasetVersionId,
      _confirmation: data.confirmation,
    });
    if (error) throw new Error(error.message);

    const payload = (result ?? {}) as {
      dataset_hash: string;
      frozen_at: string;
      item_count: number;
    };

    return {
      datasetHash: payload.dataset_hash,
      frozenAt: payload.frozen_at,
      itemCount: payload.item_count,
    };
  });
