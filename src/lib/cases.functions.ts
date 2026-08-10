import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CASE_STATUS_TRANSITIONS, type CaseStatus } from "@/lib/domain/constants";
import {
  changeCaseStatusSchema,
  createCaseSchema,
  propertySchema,
  updateCaseSchema,
} from "@/lib/validation/schemas";
import {
  requireMembership,
  requireWriteAccess,
  stripGeoPoint,
  writeAudit,
} from "@/lib/workspace.server";

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data, error } = await supabase
      .from("valuation_cases")
      .select("id, case_code, title, purpose, status, valuation_date, created_at, updated_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { role: membership.role, cases: data ?? [] };
  });

export const createCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createCaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: created, error } = await supabase
      .from("valuation_cases")
      .insert({
        organization_id: membership.organizationId,
        case_code: data.caseCode,
        title: data.title,
        purpose: data.purpose ?? null,
        valuation_date: data.valuationDate ?? null,
        created_by: userId,
        status: "DRAFT",
      })
      .select("id, case_code, title, status")
      .single();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("Já existe um caso com este código nesta organização.");
      }
      throw new Error(error.message);
    }

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: created.id,
      eventType: "CASE_CREATED",
      entityType: "valuation_case",
      entityId: created.id,
      after: created,
    });

    return created;
  });

export const getCaseDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: valuationCase, error } = await supabase
      .from("valuation_cases")
      .select("*")
      .eq("id", data.caseId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!valuationCase) throw new Error("Caso não encontrado.");

    const { data: propertyRow } = await supabase
      .from("properties")
      .select("*")
      .eq("valuation_case_id", data.caseId)
      .maybeSingle();

    // geo_point is a PostGIS value: not transport-serializable and redundant with
    // latitude/longitude, which the trigger keeps in sync with it.
    const property = propertyRow ? stripGeoPoint(propertyRow) : null;


    const [sources, datasets] = await Promise.all([
      supabase
        .from("evidence_sources")
        .select("id", { count: "exact", head: true })
        .eq("valuation_case_id", data.caseId),
      supabase
        .from("dataset_versions")
        .select("id, version_number, name, frozen_at")
        .eq("valuation_case_id", data.caseId)
        .order("version_number", { ascending: false }),
    ]);

    const { data: audit } = await supabase
      .from("audit_log")
      .select("id, event_type, entity_type, entity_id, actor_user_id, created_at, metadata")
      .eq("valuation_case_id", data.caseId)
      .order("created_at", { ascending: false })
      .limit(100);

    return {
      role: membership.role,
      valuationCase,
      property: property ?? null,
      sourceCount: sources.count ?? 0,
      datasets: datasets.data ?? [],
      audit: audit ?? [],
      allowedTransitions: CASE_STATUS_TRANSITIONS[valuationCase.status as CaseStatus] ?? [],
    };
  });

export const updateCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateCaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: before, error: readError } = await supabase
      .from("valuation_cases")
      .select("id, title, purpose, valuation_date, status, organization_id")
      .eq("id", data.caseId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!before) throw new Error("Caso não encontrado.");
    if (before.status === "ARCHIVED" || before.status === "COMPLETED") {
      throw new Error("Casos concluídos ou arquivados não podem ser editados.");
    }

    const { error } = await supabase
      .from("valuation_cases")
      .update({
        title: data.title,
        purpose: data.purpose ?? null,
        valuation_date: data.valuationDate ?? null,
      })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "CASE_UPDATED",
      entityType: "valuation_case",
      entityId: data.caseId,
      before,
      after: data,
    });

    return { ok: true };
  });

/**
 * Status transitions are executed by the database function
 * public.transition_case_status: the state machine, the "frozen dataset exists"
 * precondition, the justification requirement for reversals and the audit row all
 * live in one transaction. The client role has no UPDATE path to the status column.
 */
export const changeCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => changeCaseStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWriteAccess(supabase, userId);

    const { error } = await supabase.rpc("transition_case_status", {
      _case_id: data.caseId,
      _next_status: data.nextStatus,
      _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });


export const saveProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => propertySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: valuationCase, error: caseError } = await supabase
      .from("valuation_cases")
      .select("id, status")
      .eq("id", data.caseId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (caseError) throw new Error(caseError.message);
    if (!valuationCase) throw new Error("Caso não encontrado.");

    const { data: existing } = await supabase
      .from("properties")
      .select("*")
      .eq("valuation_case_id", data.caseId)
      .maybeSingle();

    const payload = {
      organization_id: membership.organizationId,
      valuation_case_id: data.caseId,
      property_type: data.propertyType ?? null,
      address_line: data.addressLine ?? null,
      address_number: data.addressNumber ?? null,
      complement: data.complement ?? null,
      district: data.district ?? null,
      city: data.city ?? null,
      state: data.state ?? null,
      postal_code: data.postalCode ?? null,
      country: data.country ?? "BR",
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      private_area: data.privateArea ?? null,
      built_area: data.builtArea ?? null,
      land_area: data.landArea ?? null,
      bedrooms: data.bedrooms ?? null,
      bathrooms: data.bathrooms ?? null,
      parking_spaces: data.parkingSpaces ?? null,
      construction_year: data.constructionYear ?? null,
      floor_number: data.floorNumber ?? null,
      description: data.description ?? null,
    };

    if (existing) {
      const { error } = await supabase.from("properties").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
      await writeAudit(supabase, {
        organizationId: membership.organizationId,
      actorUserId: userId,
        caseId: data.caseId,
        eventType: "PROPERTY_UPDATED",
        entityType: "property",
        entityId: existing.id,
        before: existing,
        after: payload,
      });
      return { propertyId: existing.id };
    }

    const { data: created, error } = await supabase
      .from("properties")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "PROPERTY_CREATED",
      entityType: "property",
      entityId: created.id,
      after: payload,
    });

    return { propertyId: created.id };
  });
