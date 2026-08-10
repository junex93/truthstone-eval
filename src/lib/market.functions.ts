import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  adoptCanonicalFactSchema,
  createAttributeObservationSchema,
  createDevelopmentSchema,
  createMarketObservationSchema,
  createMarketPropertySchema,
  createMatchCandidateSchema,
  recordPriceObservationSchema,
  resolveMatchSchema,
  sourceQualityAssessmentSchema,
  updateMarketObservationSchema,
  updateMarketPropertySchema,
} from "@/lib/validation/market-schemas";
import {
  marketPropertyColumns,
  nullable,
  requireCaseInOrg,
  requireMarketPropertyScope,
  requireObservationScope,
  requireOpenCase,
  requireSameCase,
} from "@/lib/market.server";
import {
  requireMembership,
  requireReviewAccess,
  requireWriteAccess,
  stripGeoPoint,
  writeAudit,
} from "@/lib/workspace.server";

const caseIdInput = z.object({ caseId: z.string().uuid() });
const marketPropertyIdInput = z.object({ marketPropertyId: z.string().uuid() });

/* ====================================================== empreendimentos == */

export const listDevelopments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: rows, error } = await supabase
      .from("developments")
      .select("*")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    return { role: membership.role, developments: (rows ?? []).map(stripGeoPoint) };
  });

export const createDevelopment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createDevelopmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const { data: created, error } = await supabase
      .from("developments")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        name: data.name,
        development_type: data.developmentType,
        address_raw: nullable(data.addressRaw),
        district: nullable(data.district),
        city: nullable(data.city),
        state: nullable(data.state),
        postal_code: nullable(data.postalCode),
        latitude: nullable(data.latitude),
        longitude: nullable(data.longitude),
        construction_year: nullable(data.constructionYear),
        number_of_floors: nullable(data.numberOfFloors),
        number_of_units: nullable(data.numberOfUnits),
        developer_name: nullable(data.developerName),
        notes: nullable(data.notes),
        created_by: userId,
      })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "DEVELOPMENT_CREATED",
      entityType: "development",
      entityId: created.id,
      after: created,
    });

    return created;
  });

/* ================================================== imóveis de mercado === */

export const listMarketProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const scope = await requireCaseInOrg(supabase, data.caseId, membership);

    const [{ data: properties, error: propertiesError }, { data: observations, error: obsError }] =
      await Promise.all([
        supabase
          .from("market_properties")
          .select("*")
          .eq("organization_id", membership.organizationId)
          .eq("valuation_case_id", data.caseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("market_observations")
          .select(
            "id, market_property_id, observation_type, status, currency_code, asking_price, transaction_price, asking_monthly_rent, contracted_monthly_rent, observation_date, transaction_date, evidence_source_id, primary_artifact_id, portal_name, listing_url, created_at",
          )
          .eq("organization_id", membership.organizationId)
          .eq("valuation_case_id", data.caseId)
          .order("created_at", { ascending: false }),
      ]);
    if (propertiesError) throw new Error(propertiesError.message);
    if (obsError) throw new Error(obsError.message);

    const { data: subject } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .maybeSingle();

    return {
      role: membership.role,
      caseStatus: scope.status,
      subjectPropertyId: subject?.id ?? null,
      properties: (properties ?? []).map(stripGeoPoint),
      observations: observations ?? [],
    };
  });

export const getMarketPropertyDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => marketPropertyIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const scope = await requireMarketPropertyScope(supabase, data.marketPropertyId, membership);

    const { data: property, error } = await supabase
      .from("market_properties")
      .select("*")
      .eq("id", data.marketPropertyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!property) throw new Error("Imóvel de mercado não encontrado.");

    const [observations, priceHistory, attributes, facts, sources, quality] = await Promise.all([
      supabase
        .from("market_observations")
        .select("*")
        .eq("market_property_id", data.marketPropertyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("market_observation_price_history")
        .select("*")
        .eq("organization_id", scope.organizationId)
        .eq("valuation_case_id", scope.caseId)
        .order("observed_at", { ascending: false }),
      supabase
        .from("property_attribute_observations")
        .select("*")
        .eq("market_property_id", data.marketPropertyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_canonical_facts")
        .select("*")
        .eq("market_property_id", data.marketPropertyId)
        .order("adopted_at", { ascending: false }),
      supabase
        .from("evidence_sources")
        .select("id, source_name, source_type, source_url")
        .eq("organization_id", membership.organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("market_source_quality_assessments")
        .select("*")
        .eq("organization_id", scope.organizationId)
        .eq("valuation_case_id", scope.caseId),
    ]);

    for (const result of [observations, priceHistory, attributes, facts, sources, quality]) {
      if (result.error) throw new Error(result.error.message);
    }

    const { data: subject } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", scope.caseId)
      .maybeSingle();

    let distanceMeters: number | null = null;
    if (subject?.id) {
      const { data: distance } = await supabase.rpc(
        "distance_subject_to_market_property_meters",
        { _subject_property_id: subject.id, _market_property_id: data.marketPropertyId },
      );
      distanceMeters = typeof distance === "number" ? distance : null;
    }

    const observationIds = new Set((observations.data ?? []).map((row) => row.id));

    return {
      role: membership.role,
      caseId: scope.caseId,
      subjectPropertyId: subject?.id ?? null,
      distanceMeters,
      property: stripGeoPoint(property),
      observations: observations.data ?? [],
      priceHistory: (priceHistory.data ?? []).filter((row) =>
        observationIds.has(row.market_observation_id),
      ),
      attributeObservations: attributes.data ?? [],
      canonicalFacts: facts.data ?? [],
      sources: sources.data ?? [],
      qualityAssessments: (quality.data ?? []).filter((row) =>
        observationIds.has(row.market_observation_id),
      ),
    };
  });

export const createMarketProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMarketPropertySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const { data: created, error } = await supabase
      .from("market_properties")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        created_by: userId,
        ...marketPropertyColumns(data),
      })
      .select("id, label")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "MARKET_PROPERTY_CREATED",
      entityType: "market_property",
      entityId: created.id,
      after: created,
    });

    return created;
  });

export const updateMarketProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMarketPropertySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = await requireMarketPropertyScope(supabase, data.marketPropertyId, membership);

    const { data: before, error: beforeError } = await supabase
      .from("market_properties")
      .select("*")
      .eq("id", data.marketPropertyId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: updated, error } = await supabase
      .from("market_properties")
      .update(marketPropertyColumns(data))
      .eq("id", data.marketPropertyId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: scope.caseId,
      eventType: "MARKET_PROPERTY_UPDATED",
      entityType: "market_property",
      entityId: data.marketPropertyId,
      before: stripGeoPoint(before),
      after: stripGeoPoint(updated),
    });

    return stripGeoPoint(updated);
  });

/* ================================================ observações de mercado = */

export const createMarketObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMarketObservationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));
    const scope = await requireMarketPropertyScope(supabase, data.marketPropertyId, membership);
    requireSameCase(data.caseId, scope.caseId, "o imóvel de mercado");

    const { data: created, error } = await supabase
      .from("market_observations")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        market_property_id: data.marketPropertyId,
        observation_type: data.observationType,
        status: data.status ?? "UNKNOWN",
        currency_code: data.currencyCode ?? "BRL",
        asking_price: nullable(data.askingPrice),
        transaction_price: nullable(data.transactionPrice),
        asking_monthly_rent: nullable(data.askingMonthlyRent),
        contracted_monthly_rent: nullable(data.contractedMonthlyRent),
        observation_date: nullable(data.observationDate),
        publication_date: nullable(data.publicationDate),
        transaction_date: nullable(data.transactionDate),
        transaction_document_type: nullable(data.transactionDocumentType),
        registry_reference: nullable(data.registryReference),
        transaction_evidence_status: nullable(data.transactionEvidenceStatus),
        publisher_name: nullable(data.publisherName),
        portal_name: nullable(data.portalName),
        external_listing_id: nullable(data.externalListingId),
        listing_url: nullable(data.listingUrl),
        broker_reference: nullable(data.brokerReference),
        broker_name: nullable(data.brokerName),
        seller_type: data.sellerType ?? "UNKNOWN",
        notes: nullable(data.notes),
        evidence_source_id: nullable(data.evidenceSourceId),
        primary_artifact_id: nullable(data.primaryArtifactId),
        created_by: userId,
      })
      .select("id, observation_type")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "MARKET_OBSERVATION_CREATED",
      entityType: "market_observation",
      entityId: created.id,
      after: created,
    });

    return created;
  });

export const updateMarketObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateMarketObservationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = await requireObservationScope(supabase, data.observationId, membership);

    const { data: before, error: beforeError } = await supabase
      .from("market_observations")
      .select("*")
      .eq("id", data.observationId)
      .single();
    if (beforeError) throw new Error(beforeError.message);

    const { data: updated, error } = await supabase
      .from("market_observations")
      .update({
        status: data.status ?? before.status,
        observation_date: nullable(data.observationDate),
        publication_date: nullable(data.publicationDate),
        transaction_date: nullable(data.transactionDate),
        transaction_document_type: nullable(data.transactionDocumentType),
        registry_reference: nullable(data.registryReference),
        transaction_evidence_status: nullable(data.transactionEvidenceStatus),
        publisher_name: nullable(data.publisherName),
        portal_name: nullable(data.portalName),
        external_listing_id: nullable(data.externalListingId),
        listing_url: nullable(data.listingUrl),
        broker_reference: nullable(data.brokerReference),
        broker_name: nullable(data.brokerName),
        seller_type: data.sellerType ?? before.seller_type,
        notes: nullable(data.notes),
        evidence_source_id: nullable(data.evidenceSourceId),
        primary_artifact_id: nullable(data.primaryArtifactId),
      })
      .eq("id", data.observationId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: scope.caseId,
      eventType: "MARKET_OBSERVATION_UPDATED",
      entityType: "market_observation",
      entityId: data.observationId,
      before,
      after: updated,
    });

    return updated;
  });

/**
 * Preço pedido só muda por aqui: a RPC grava a nova leitura no histórico
 * append-only e atualiza a observação na mesma transação. Nenhum valor anterior
 * é sobrescrito.
 */
export const recordPriceObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => recordPriceObservationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireObservationScope(supabase, data.observationId, membership);

    // Parâmetros omitidos assumem o DEFAULT da RPC; `null` é ausência explícita.
    const { data: historyId, error } = await supabase.rpc("record_price_observation", {
      _observation_id: data.observationId,
      _asking_price: data.askingPrice ?? null,
      _asking_monthly_rent: data.askingMonthlyRent ?? null,
      _observed_at: data.observedAt ?? null,
      _status: data.status ?? null,
      _evidence_source_id: data.evidenceSourceId ?? null,
      _evidence_field_id: data.evidenceFieldId ?? null,
      _notes: data.notes ?? null,
    } as never);

    if (error) throw new Error(error.message);

    return { historyId };
  });

/* ============================================ observações de atributo ==== */

/**
 * Observações de atributo do imóvel avaliando (não de mercado) para este caso,
 * incluindo os fatos canônicos já adotados. Divergência é apenas exibida aqui —
 * a resolução é sempre um ato humano em adoptCanonicalFact.
 */
export const listSubjectAttributeObservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ subjectPropertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: subject, error: subjectError } = await supabase
      .from("properties")
      .select("id, organization_id, valuation_case_id")
      .eq("id", data.subjectPropertyId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (subjectError) throw new Error(subjectError.message);
    if (!subject) throw new Error("Imóvel avaliando não encontrado nesta organização.");

    const [observations, facts] = await Promise.all([
      supabase
        .from("property_attribute_observations")
        .select("*")
        .eq("subject_property_id", data.subjectPropertyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("property_canonical_facts")
        .select("*")
        .eq("subject_property_id", data.subjectPropertyId)
        .order("adopted_at", { ascending: false }),
    ]);
    if (observations.error) throw new Error(observations.error.message);
    if (facts.error) throw new Error(facts.error.message);

    return {
      role: membership.role,
      caseId: subject.valuation_case_id,
      observations: observations.data ?? [],
      canonicalFacts: facts.data ?? [],
    };
  });

export const createAttributeObservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createAttributeObservationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    if (data.marketPropertyId) {
      const scope = await requireMarketPropertyScope(supabase, data.marketPropertyId, membership);
      requireSameCase(data.caseId, scope.caseId, "o imóvel de mercado");
    }

    const { data: created, error } = await supabase
      .from("property_attribute_observations")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        subject_property_id: nullable(data.subjectPropertyId),
        market_property_id: nullable(data.marketPropertyId),
        attribute_name: data.attributeName,
        raw_value: nullable(data.rawValue),
        normalized_value: nullable(data.normalizedValue),
        numeric_value: nullable(data.numericValue),
        unit: nullable(data.unit),
        knowledge_state: data.knowledgeState,
        value_origin: data.valueOrigin,
        evidence_field_id: nullable(data.evidenceFieldId),
        evidence_source_id: nullable(data.evidenceSourceId),
        observed_at: nullable(data.observedAt),
        notes: nullable(data.notes),
        created_by: userId,
      })
      .select("id, attribute_name")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "ATTRIBUTE_OBSERVATION_CREATED",
      entityType: "property_attribute_observation",
      entityId: created.id,
      after: created,
    });

    return created;
  });

/** Adoção de fato canônico: ato humano autorizado, nunca automático. */
export const adoptCanonicalFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => adoptCanonicalFactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);

    const { data: factId, error } = await supabase.rpc("adopt_canonical_fact", {
      _subject_property_id: data.subjectPropertyId ?? null,
      _market_property_id: data.marketPropertyId ?? null,
      _attribute_name: data.attributeName,
      _observation_id: data.observationId,
      _reason: data.reason,
    } as never);

    if (error) throw new Error(error.message);

    return { factId };
  });

/* ===================================================== qualidade fonte === */

export const saveSourceQualityAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceQualityAssessmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);
    const scope = await requireObservationScope(supabase, data.marketObservationId, membership);

    const { data: existing, error: existingError } = await supabase
      .from("market_source_quality_assessments")
      .select("id")
      .eq("market_observation_id", data.marketObservationId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const payload = {
      source_reliability: data.sourceReliability,
      temporal_relevance: data.temporalRelevance,
      spatial_relevance: data.spatialRelevance,
      data_completeness: data.dataCompleteness,
      cross_source_confirmation: data.crossSourceConfirmation,
      notes: nullable(data.notes),
      assessed_by: userId,
    };

    if (existing) {
      const { error } = await supabase
        .from("market_source_quality_assessments")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }

    const { data: created, error } = await supabase
      .from("market_source_quality_assessments")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: scope.caseId,
        market_observation_id: data.marketObservationId,
        ...payload,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

/* ======================================================= duplicidades ==== */

export const listMatchCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => caseIdInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireCaseInOrg(supabase, data.caseId, membership);

    const { data: rows, error } = await supabase
      .from("property_match_candidates")
      .select("*")
      .eq("organization_id", membership.organizationId)
      .eq("valuation_case_id", data.caseId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return { role: membership.role, matches: rows ?? [] };
  });

export const createMatchCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMatchCandidateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    requireOpenCase(await requireCaseInOrg(supabase, data.caseId, membership));

    const left = await requireMarketPropertyScope(supabase, data.leftMarketPropertyId, membership);
    const right = await requireMarketPropertyScope(supabase, data.rightMarketPropertyId, membership);
    requireSameCase(data.caseId, left.caseId, "o primeiro imóvel");
    requireSameCase(data.caseId, right.caseId, "o segundo imóvel");

    const { data: rows, error: rowsError } = await supabase
      .from("market_properties")
      .select(
        "id, address_normalized, postal_code, street_number, unit_identifier, private_area, latitude, longitude",
      )
      .in("id", [data.leftMarketPropertyId, data.rightMarketPropertyId]);
    if (rowsError) throw new Error(rowsError.message);

    const [a, b] = rows ?? [];
    const { data: distance } = await supabase.rpc("distance_between_properties_meters", {
      _left_market_property_id: data.leftMarketPropertyId,
      _right_market_property_id: data.rightMarketPropertyId,
    });

    // Sinais determinísticos: comparação literal, sem escore e sem probabilidade.
    const equal = (x: unknown, y: unknown) =>
      x !== null && x !== undefined && y !== null && y !== undefined && String(x) === String(y);
    const deterministicSignals = {
      signals_version: "valuation.match.signals/1",
      same_normalized_address: equal(a?.address_normalized, b?.address_normalized),
      same_postal_code_and_number:
        equal(a?.postal_code, b?.postal_code) && equal(a?.street_number, b?.street_number),
      same_unit_identifier: equal(a?.unit_identifier, b?.unit_identifier),
      same_private_area: equal(a?.private_area, b?.private_area),
      distance_meters: typeof distance === "number" ? distance : null,
    };

    const { data: created, error } = await supabase
      .from("property_match_candidates")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId,
        left_market_property_id: data.leftMarketPropertyId,
        right_market_property_id: data.rightMarketPropertyId,
        match_status: "CANDIDATE",
        reason_codes: data.reasonCodes,
        deterministic_signals: deterministicSignals,
        review_notes: nullable(data.notes),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId,
      eventType: "DUPLICATE_CANDIDATE_CREATED",
      entityType: "property_match_candidate",
      entityId: created.id,
      after: { ...created, deterministic_signals: deterministicSignals },
    });

    return created;
  });

/**
 * CONFIRMED_SAME registra a duplicidade; não funde, não apaga e não remove
 * observações de nenhum dos lados.
 */
export const resolvePropertyMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resolveMatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);

    const { data: matchId, error } = await supabase.rpc("resolve_property_match", {
      _match_id: data.matchId,
      _status: data.status,
      _notes: data.notes ?? null,
    } as never);

    if (error) throw new Error(error.message);

    return { matchId };
  });
