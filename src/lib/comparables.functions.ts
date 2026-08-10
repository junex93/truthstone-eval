import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createComparableCandidateSchema,
  decideComparableSchema,
} from "@/lib/validation/market-schemas";
import {
  requireCaseInOrg,
  requireObservationScope,
  requireOpenCase,
  requireSameCase,
} from "@/lib/market.server";
import {
  requireMembership,
  requireReviewAccess,
  requireWriteAccess,
  writeAudit,
} from "@/lib/workspace.server";

const caseIdInput = z.object({ caseId: z.string().uuid() });

/**
 * Comparáveis: seleção, elegibilidade e inclusão são decisões humanas
 * registradas. Nada aqui calcula valor, peso, fator ou convergência.
 */
export const listComparables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const scope = await requireCaseInOrg(supabase, data.caseId, membership);

    const [candidates, observations, properties, reasons, subject] = await Promise.all([
      supabase
        .from("comparable_candidates")
        .select("*")
        .eq("organization_id", membership.organizationId)
        .eq("valuation_case_id", data.caseId)
        .order("created_at", { ascending: false }),
      supabase
        .from("market_observations")
        .select(
          "id, market_property_id, observation_type, status, currency_code, asking_price, transaction_price, asking_monthly_rent, contracted_monthly_rent, observation_date, transaction_date, transaction_evidence_status, evidence_source_id, primary_artifact_id, portal_name, listing_url",
        )
        .eq("organization_id", membership.organizationId)
        .eq("valuation_case_id", data.caseId),
      supabase
        .from("market_properties")
        .select(
          "id, label, property_type_code, address_raw, address_normalized, district, city, private_area, usable_area, built_area, total_area, land_area, bedrooms, suites, bathrooms, parking_spaces, floor_number, construction_year, condition_status, occupancy_status, furnished_status, latitude, longitude, development_id",
        )
        .eq("organization_id", membership.organizationId)
        .eq("valuation_case_id", data.caseId),
      supabase
        .from("comparable_exclusion_reasons")
        .select("code, label, description, taxonomy_version")
        .eq("is_active", true)
        .order("code", { ascending: true }),
      supabase
        .from("properties")
        .select(
          "id, property_type_code, address_raw, district, city, private_area, land_area, bedrooms, suites, bathrooms, parking_spaces, floor_number, construction_year, condition_status, occupancy_status, furnished_status",
        )
        .eq("organization_id", membership.organizationId)
        .eq("valuation_case_id", data.caseId)
        .maybeSingle(),
    ]);

    for (const result of [candidates, observations, properties, reasons]) {
      if (result.error) throw new Error(result.error.message);
    }

    // Distância factual medida pelo PostGIS; sem coordenada não há distância.
    const distances: Record<string, number | null> = {};
    if (subject.data?.id) {
      await Promise.all(
        (properties.data ?? []).map(async (property) => {
          const { data: meters } = await supabase.rpc(
            "distance_subject_to_market_property_meters",
            { _subject_property_id: subject.data!.id, _market_property_id: property.id },
          );
          distances[property.id] = typeof meters === "number" ? meters : null;
        }),
      );
    }

    return {
      role: membership.role,
      caseStatus: scope.status,
      subjectProperty: subject.data ?? null,
      candidates: candidates.data ?? [],
      observations: observations.data ?? [],
      properties: properties.data ?? [],
      exclusionReasons: reasons.data ?? [],
      distances,
    };
  });

export const listComparableDecisionHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ candidateId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: rows, error } = await supabase
      .from("comparable_decision_history")
      .select("*")
      .eq("organization_id", membership.organizationId)
      .eq("candidate_id", data.candidateId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { history: rows ?? [] };
  });

export const createComparableCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createComparableCandidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const observation = await requireObservationScope(
      supabase,
      data.marketObservationId,
      membership,
    );
    requireSameCase(data.caseId, observation.caseId, "a observação de mercado");

    const { data: subject, error: subjectError } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .maybeSingle();
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) {
      throw new Error("Cadastre o imóvel avaliando antes de selecionar comparáveis.");
    }

    const { data: created, error } = await supabase
      .from("comparable_candidates")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        subject_property_id: subject.id,
        market_property_id: observation.marketPropertyId,
        market_observation_id: data.marketObservationId,
        candidate_status: "DISCOVERED",
        inclusion_status: "NOT_DECIDED",
        created_by: userId,
      })
      .select("id, candidate_status, inclusion_status")
      .single();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("Esta observação já está na fila de comparáveis deste caso.");
      }
      throw new Error(error.message);
    }

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "COMPARABLE_DISCOVERED",
      entityType: "comparable_candidate",
      entityId: created.id,
      after: created,
    });

    return created;
  });

/**
 * Única porta para decidir elegibilidade e inclusão. A RPC valida papel, exige
 * motivo na exclusão e grava histórico append-only na mesma transação.
 * EXCLUÍDO não é APAGADO: a linha permanece legível.
 */
export const decideComparable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => decideComparableSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);

    const { data: candidateId, error } = await supabase.rpc("decide_comparable", {
      _candidate_id: data.candidateId,
      _candidate_status: data.candidateStatus ?? null,
      _inclusion_status: data.inclusionStatus ?? null,
      _reason_code: data.reasonCode ?? null,
      _notes: data.notes ?? null,
    } as never);
    if (error) throw new Error(error.message);

    return { candidateId };
  });
