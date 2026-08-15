/**
 * Operações da camada metodológica expostas ao cliente (Fase 6).
 *
 * REGRA: este arquivo NUNCA reproduz invariante do banco.
 * - Aprovar/submeter/rejeitar/verificar/resolver → SEMPRE via RPC oficial.
 * - Nenhum campo de autoria (`approved_by`, `verified_by`, `rejected_by`,
 *   `resolved_by`) é aceito do cliente: a identidade vem do token, no servidor.
 * - Edição só existe para DRAFT; o trigger do banco recusa o resto.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  METHODOLOGY_SOURCE_BUCKET,
  readReviewerSegregationGate,
  asJsonObject,
  asStringArray,
  assertMethodologyStoragePath,
  ensureMethodologyLibrarySource,
  requireDraftSpecification,
  requireFormulaInDraftSpecification,
  requireRuleInDraftSpecification,
  requireSourceInScope,
  requireSpecificationInScope,
} from "@/lib/methodology.server";
import type {
  ClaimDossierReport,
  CompletenessReport,
  IntegrityReport,
  SourceReadinessReport,
} from "@/lib/domain/methodology";
import {
  approveSpecificationSchema,
  attachRuleSourceSchema,
  claimDossierSchema,
  createClaimRuleAssessmentSchema,
  createSourceClaimSchema,
  reviewSourceClaimSchema,
  satisfyRequirementSchema,
  attachSourceArtifactSchema,
  createApplicabilityRuleSchema,
  createChangeRequestSchema,
  createFormulaVariableSchema,
  createMethodSpecificationSchema,
  createMethodTestCaseSchema,
  createMethodologyFormulaSchema,
  createMethodologyParameterSchema,
  createMethodologyRuleSchema,
  createMethodologySourceSchema,
  createNewSpecificationVersionSchema,
  createOutputContractSchema,
  createSourceConflictSchema,
  createSourceLocatorSchema,
  methodScopeSchema,
  methodologyArtifactScopeSchema,
  registerSourceDocumentSchema,
  rejectSpecificationSchema,
  resolveSourceConflictSchema,
  reviewChangeRequestSchema,
  ruleScopeSchema,
  sourceScopeSchema,
  specScopeSchema,
  submitSpecificationSchema,
  updateDraftMethodologyRuleSchema,
  updateDraftMethodologySourceSchema,
  updateDraftSectionSchema,
  updateDraftSpecificationSchema,
  verifyMethodologySourceSchema,
} from "@/lib/validation/methodology-schemas";
import {
  requireMembership,
  requireReviewAccess,
  requireWriteAccess,
  sha256Hex,
  writeAudit,
} from "@/lib/workspace.server";

const orgFilter = (organizationId: string) =>
  `organization_id.eq.${organizationId},organization_id.is.null`;

/* ====================================================== FONTES: leitura == */

export const listMethodologySources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const [sources, verifications] = await Promise.all([
      supabase
        .from("methodology_sources")
        .select("*")
        .or(orgFilter(membership.organizationId))
        .order("title", { ascending: true }),
      supabase
        .from("methodology_source_verifications")
        .select("source_id, verification_type, verified_at"),
    ]);
    if (sources.error) throw new Error(sources.error.message);
    if (verifications.error) throw new Error(verifications.error.message);

    return {
      sources: sources.data ?? [],
      verifications: verifications.data ?? [],
      role: membership.role,
    };
  });

export const getMethodologySource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const [source, artifacts, locators, verifications, ruleSources, crosswalks, conflicts] =
      await Promise.all([
        supabase.from("methodology_sources").select("*").eq("id", data.sourceId).single(),
        supabase.from("methodology_source_artifacts").select("*").eq("source_id", data.sourceId),
        supabase
          .from("methodology_source_locators")
          .select("*")
          .eq("source_id", data.sourceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("methodology_source_verifications")
          .select("*")
          .eq("source_id", data.sourceId)
          .order("verified_at", { ascending: false }),
        supabase
          .from("methodology_rule_sources")
          .select(
            "id, relationship_type, source_locator_id, interpretation_notes, rule_id, methodology_rules(id, rule_code, title, normative_strength, method_specification_id)",
          )
          .eq("source_id", data.sourceId),
        supabase
          .from("methodology_crosswalks")
          .select("*")
          .or(`left_source_id.eq.${data.sourceId},right_source_id.eq.${data.sourceId}`),
        supabase
          .from("methodology_source_conflicts")
          .select("*")
          .or(`source_a_id.eq.${data.sourceId},source_b_id.eq.${data.sourceId}`),
      ]);

    for (const r of [
      source,
      artifacts,
      locators,
      verifications,
      ruleSources,
      crosswalks,
      conflicts,
    ]) {
      if (r.error) throw new Error(r.error.message);
    }

    return {
      source: source.data,
      artifacts: artifacts.data ?? [],
      locators: locators.data ?? [],
      verifications: verifications.data ?? [],
      ruleSources: ruleSources.data ?? [],
      crosswalks: crosswalks.data ?? [],
      conflicts: conflicts.data ?? [],
      role: membership.role,
    };
  });

/* ====================================================== FONTES: escrita == */

export const createMethodologySource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodologySourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: row, error } = await supabase
      .from("methodology_sources")
      .insert({
        organization_id: membership.organizationId,
        title: data.title,
        short_title: data.shortTitle,
        source_type: data.sourceType,
        issuing_body: data.issuingBody,
        authors: data.authors,
        edition: data.edition,
        publication_year: data.publicationYear ?? null,
        jurisdiction: data.jurisdiction,
        jurisdiction_detail: data.jurisdictionDetail,
        language: data.language,
        identifier: data.identifier,
        isbn: data.isbn,
        doi: data.doi,
        external_url: data.externalUrl ?? null,
        access_status: data.accessStatus,
        authority_level: data.authorityLevel,
        effective_from: data.effectiveFrom ?? null,
        effective_until: data.effectiveUntil ?? null,
        // Fonte nasce PENDING_METADATA_REVIEW: metadado registrado != metadado verificado.
        status: "PENDING_METADATA_REVIEW",
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_CREATED",
      entityType: "methodology_sources",
      entityId: row.id,
      after: { title: data.title, access_status: data.accessStatus },
    });
    return { sourceId: row.id };
  });

export const updateDraftMethodologySource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateDraftMethodologySourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = await requireSourceInScope(supabase, data.sourceId, membership);
    if (scope.organizationId === null) {
      throw new Error(
        "Fonte da biblioteca global não é editável pela organização. Registre um Change Request.",
      );
    }

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.shortTitle !== undefined) patch["short_title"] = data.shortTitle;
    if (data.issuingBody !== undefined) patch["issuing_body"] = data.issuingBody;
    if (data.edition !== undefined) patch["edition"] = data.edition;
    if (data.publicationYear !== undefined) patch["publication_year"] = data.publicationYear;
    if (data.externalUrl !== undefined) patch["external_url"] = data.externalUrl;
    if (data.accessStatus !== undefined) patch["access_status"] = data.accessStatus;
    if (data.authorityLevel !== undefined) patch["authority_level"] = data.authorityLevel;
    if (data.jurisdictionDetail !== undefined)
      patch["jurisdiction_detail"] = data.jurisdictionDetail;
    if (data.identifier !== undefined) patch["identifier"] = data.identifier;
    if (data.notes !== undefined) patch["notes"] = data.notes;
    if (data.status !== undefined) patch["status"] = data.status;
    if (Object.keys(patch).length === 0) return { sourceId: data.sourceId };

    const { error } = await supabase
      .from("methodology_sources")
      .update(patch as never)
      .eq("id", data.sourceId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_UPDATED",
      entityType: "methodology_sources",
      entityId: data.sourceId,
      after: patch,
    });
    return { sourceId: data.sourceId };
  });

export const attachMethodologySourceArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attachSourceArtifactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    if (data.accessBasis === "METADATA_ONLY") {
      throw new Error(
        "METADATA_ONLY não é base de acesso: um artefato exige base legítima (cópia do usuário, licenciada, interna autorizada ou fonte pública).",
      );
    }

    const { data: row, error } = await supabase
      .from("methodology_source_artifacts")
      .insert({
        organization_id: membership.organizationId,
        source_id: data.sourceId,
        evidence_artifact_id: data.evidenceArtifactId,
        access_basis: data.accessBasis,
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_ARTIFACT_ATTACHED",
      entityType: "methodology_source_artifacts",
      entityId: row.id,
      after: { source_id: data.sourceId, access_basis: data.accessBasis },
    });
    return { artifactLinkId: row.id };
  });

/**
 * Ingestão de documento normativo autorizado (Fase 7C).
 *
 * O arquivo já está no bucket privado `methodology-sources`. Aqui o servidor
 * lê os bytes de volta e calcula o SHA-256 — hash vindo do cliente nunca é
 * aceito. A cópia é SEMPRE da organização: uma fonte global permanece
 * METADATA_ONLY para todas as demais organizações.
 */
export const registerMethodologySourceDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => registerSourceDocumentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const scope = await requireSourceInScope(supabase, data.sourceId, membership);

    assertMethodologyStoragePath(data.storagePath, membership.organizationId, scope.id);

    const download = await supabase.storage
      .from(METHODOLOGY_SOURCE_BUCKET)
      .download(data.storagePath);
    if (download.error || !download.data) {
      throw new Error(
        `Não foi possível ler o documento armazenado para calcular o hash: ${
          download.error?.message ?? "arquivo ausente"
        }`,
      );
    }
    const bytes = await download.data.arrayBuffer();
    const hash = await sha256Hex(bytes);

    const evidenceSourceId = await ensureMethodologyLibrarySource(supabase, membership, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const artifact = await supabaseAdmin
      .from("evidence_artifacts")
      .insert({
        organization_id: membership.organizationId,
        evidence_source_id: evidenceSourceId,
        storage_bucket: METHODOLOGY_SOURCE_BUCKET,
        storage_path: data.storagePath,
        file_name: data.fileName,
        mime_type: data.mimeType ?? download.data.type ?? null,
        file_size: bytes.byteLength,
        sha256_hash: hash,
        hash_computed_by: "SERVER",
        created_by: userId,
      })
      .select("id, sha256_hash, file_size")
      .single();
    if (artifact.error) throw new Error(artifact.error.message);

    const link = await supabase
      .from("methodology_source_artifacts")
      .insert({
        organization_id: membership.organizationId,
        source_id: scope.id,
        evidence_artifact_id: artifact.data.id,
        access_basis: data.accessBasis,
        notes: [data.accessJustification, data.notes].filter(Boolean).join(" — "),
        created_by: userId,
      })
      .select("id")
      .single();
    if (link.error) throw new Error(link.error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_ARTIFACT_ATTACHED",
      entityType: "methodology_source_artifacts",
      entityId: link.data.id,
      after: {
        source_id: scope.id,
        evidence_artifact_id: artifact.data.id,
        access_basis: data.accessBasis,
        sha256_hash: artifact.data.sha256_hash,
        hash_computed_by: "SERVER",
      },
    });

    return {
      artifactLinkId: link.data.id,
      evidenceArtifactId: artifact.data.id,
      sha256: artifact.data.sha256_hash,
      fileSize: artifact.data.file_size,
    };
  });

/** URL assinada de curta duração para conferência humana do documento. */
export const getMethodologyDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => methodologyArtifactScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: artifact, error } = await supabase
      .from("evidence_artifacts")
      .select("id, storage_bucket, storage_path, organization_id")
      .eq("id", data.evidenceArtifactId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!artifact) throw new Error("Documento fora do escopo desta organização.");

    const signed = await supabase.storage
      .from(artifact.storage_bucket)
      .createSignedUrl(artifact.storage_path, 300);
    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message ?? "Não foi possível gerar o acesso temporário.");
    }
    return { url: signed.data.signedUrl };
  });

/** Diagnóstico determinístico: o estado vem da RPC, nunca da interface. */
export const getMethodologySourceReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const { data: report, error } = await supabase.rpc("methodology_source_readiness", {
      _source_id: data.sourceId,
    });
    if (error) throw new Error(error.message);
    return { readiness: asJsonObject(report) as unknown as SourceReadinessReport };
  });

export const createMethodologySourceLocator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSourceLocatorSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const { data: row, error } = await supabase
      .from("methodology_source_locators")
      .insert({
        organization_id: membership.organizationId,
        source_id: data.sourceId,
        locator_type: data.locatorType,
        section: data.section,
        clause: data.clause,
        page: data.page,
        chapter: data.chapter,
        figure: data.figure,
        table_reference: data.tableReference,
        external_anchor: data.externalAnchor,
        support_excerpt: data.supportExcerpt,
        notes: data.notes,
        artifact_id: data.artifactId ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_LOCATOR_CREATED",
      entityType: "methodology_source_locators",
      entityId: row.id,
      after: {
        source_id: data.sourceId,
        locator_type: data.locatorType,
        artifact_id: data.artifactId ?? null,
      },
    });
    return { locatorId: row.id };
  });

/** Operação oficial: a verificação e seu autor são gravados pela RPC. */
export const verifyMethodologySource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyMethodologySourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const { data: verificationId, error } = await supabase.rpc("verify_methodology_source", {
      _source_id: data.sourceId,
      _verification_type: data.verificationType,
      ...(data.locatorId ? { _locator_id: data.locatorId } : {}),
      ...(data.notes ? { _notes: data.notes } : {}),
    });
    if (error) throw new Error(error.message);
    return { verificationId };
  });

export const listSourceVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);
    const { data: rows, error } = await supabase
      .from("methodology_source_verifications")
      .select("*")
      .eq("source_id", data.sourceId)
      .order("verified_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { verifications: rows ?? [] };
  });

/* ======================================================== CONFLITOS ====== */

export const listSourceConflicts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const [conflicts, sources] = await Promise.all([
      supabase
        .from("methodology_source_conflicts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("methodology_sources")
        .select("id, title, short_title")
        .or(orgFilter(membership.organizationId)),
    ]);
    if (conflicts.error) throw new Error(conflicts.error.message);
    if (sources.error) throw new Error(sources.error.message);
    return { conflicts: conflicts.data ?? [], sources: sources.data ?? [], role: membership.role };
  });

export const createSourceConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSourceConflictSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    if (data.sourceAId === data.sourceBId) {
      throw new Error("Conflito exige duas fontes distintas.");
    }
    await requireSourceInScope(supabase, data.sourceAId, membership);
    await requireSourceInScope(supabase, data.sourceBId, membership);

    const { data: row, error } = await supabase
      .from("methodology_source_conflicts")
      .insert({
        organization_id: membership.organizationId,
        source_a_id: data.sourceAId,
        source_b_id: data.sourceBId,
        subject: data.subject,
        description: data.description,
        is_critical: data.isCritical,
        resolution_status: "OPEN",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_SOURCE_CONFLICT_OPENED",
      entityType: "methodology_source_conflicts",
      entityId: row.id,
      after: { subject: data.subject, is_critical: data.isCritical },
    });
    return { conflictId: row.id };
  });

/** Operação oficial: resolução, autor e data vêm da RPC. Conflito nunca é apagado. */
export const resolveSourceConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resolveSourceConflictSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);
    const { error } = await supabase.rpc("resolve_methodology_source_conflict", {
      _conflict_id: data.conflictId,
      _resolution_status: data.resolutionStatus,
      _professional_resolution: data.professionalResolution,
    });
    if (error) throw new Error(error.message);
    return { conflictId: data.conflictId };
  });

/* ========================================================== MÉTODOS ====== */

export const listValuationMethods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const [methods, specs, families, implementations] = await Promise.all([
      supabase
        .from("valuation_methods")
        .select("*")
        .or(orgFilter(membership.organizationId))
        .order("name", { ascending: true }),
      supabase
        .from("method_specifications")
        .select(
          "id, valuation_method_id, version, title, status, specification_hash, created_at, approved_at",
        )
        .or(orgFilter(membership.organizationId))
        .order("created_at", { ascending: false }),
      supabase.from("methodology_families").select("*"),
      supabase
        .from("method_implementations")
        .select("id, method_specification_id, implementation_code, version, status"),
    ]);
    for (const r of [methods, specs, families, implementations]) {
      if (r.error) throw new Error(r.error.message);
    }
    return {
      methods: methods.data ?? [],
      specifications: specs.data ?? [],
      families: families.data ?? [],
      implementations: implementations.data ?? [],
      role: membership.role,
    };
  });

export const getValuationMethod = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => methodScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: method, error } = await supabase
      .from("valuation_methods")
      .select("*")
      .eq("id", data.methodId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!method) throw new Error("Método inexistente ou fora do escopo desta organização.");

    const { data: specs, error: specError } = await supabase
      .from("method_specifications")
      .select("*")
      .eq("valuation_method_id", data.methodId)
      .order("created_at", { ascending: false });
    if (specError) throw new Error(specError.message);

    const specIds = (specs ?? []).map((s) => s.id);
    const empty = specIds.length === 0;

    const [requirements, implementations, changeRequests] = await Promise.all([
      empty
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("method_specification_source_requirements")
            .select("*")
            .in("method_specification_id", specIds)
            .order("requirement_code", { ascending: true }),
      empty
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("method_implementations")
            .select("*")
            .in("method_specification_id", specIds),
      supabase
        .from("methodology_change_requests")
        .select("*")
        .eq("target_type", "valuation_method")
        .eq("target_id", data.methodId)
        .order("created_at", { ascending: false }),
    ]);
    for (const r of [requirements, implementations, changeRequests]) {
      if (r.error) throw new Error(r.error.message);
    }

    return {
      method,
      specifications: specs ?? [],
      sourceRequirements: requirements.data ?? [],
      implementations: implementations.data ?? [],
      changeRequests: changeRequests.data ?? [],
      role: membership.role,
    };
  });

/* =================================================== ESPECIFICAÇÕES ====== */

export const listMethodSpecifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const { data, error } = await supabase
      .from("method_specifications")
      .select("*")
      .or(orgFilter(membership.organizationId))
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { specifications: data ?? [], role: membership.role };
  });

export const getMethodSpecification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);

    const [
      spec,
      sections,
      rules,
      formulas,
      parameters,
      applicability,
      tests,
      outputs,
      requirements,
      implementations,
    ] = await Promise.all([
      supabase
        .from("method_specifications")
        .select("*, valuation_methods(id, code, name, family_code, status)")
        .eq("id", data.specificationId)
        .single(),
      supabase
        .from("method_specification_sections")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("ordinal", { ascending: true }),
      supabase
        .from("methodology_rules")
        .select("*, methodology_rule_sources(*)")
        .eq("method_specification_id", data.specificationId)
        .order("rule_code", { ascending: true }),
      supabase
        .from("methodology_formulas")
        .select("*, methodology_formula_variables(*)")
        .order("formula_code", { ascending: true }),
      supabase
        .from("methodology_parameters")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("parameter_code", { ascending: true }),
      supabase
        .from("method_applicability_rules")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("criterion_code", { ascending: true }),
      supabase
        .from("method_test_cases")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("test_code", { ascending: true }),
      supabase
        .from("method_output_contracts")
        .select("*")
        .eq("method_specification_id", data.specificationId),
      supabase
        .from("method_specification_source_requirements")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("requirement_code", { ascending: true }),
      supabase
        .from("method_implementations")
        .select("*")
        .eq("method_specification_id", data.specificationId),
    ]);

    for (const r of [
      spec,
      sections,
      rules,
      formulas,
      parameters,
      applicability,
      tests,
      outputs,
      requirements,
      implementations,
    ]) {
      if (r.error) throw new Error(r.error.message);
    }

    const ruleIds = new Set((rules.data ?? []).map((r) => r.id));
    const specFormulas = (formulas.data ?? []).filter((f) => ruleIds.has(f.rule_id));

    const sourceIds = Array.from(
      new Set(
        (rules.data ?? []).flatMap((r) =>
          (r.methodology_rule_sources ?? []).map((rs) => rs.source_id),
        ),
      ),
    );
    const sources =
      sourceIds.length === 0
        ? { data: [], error: null }
        : await supabase.from("methodology_sources").select("*").in("id", sourceIds);
    if (sources.error) throw new Error(sources.error.message);

    const verifications =
      sourceIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("methodology_source_verifications")
            .select("source_id, locator_id, verification_type")
            .in("source_id", sourceIds);
    if (verifications.error) throw new Error(verifications.error.message);

    return {
      specification: spec.data,
      sections: sections.data ?? [],
      rules: rules.data ?? [],
      formulas: specFormulas,
      parameters: parameters.data ?? [],
      applicability: applicability.data ?? [],
      tests: tests.data ?? [],
      outputContracts: outputs.data ?? [],
      sourceRequirements: requirements.data ?? [],
      implementations: implementations.data ?? [],
      sources: sources.data ?? [],
      verifications: verifications.data ?? [],
      role: membership.role,
      currentUserId: userId,
    };
  });

export const createMethodSpecification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodSpecificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: row, error } = await supabase
      .from("method_specifications")
      .insert({
        organization_id: membership.organizationId,
        valuation_method_id: data.valuationMethodId,
        version: data.version,
        title: data.title,
        purpose: data.purpose,
        scope: data.scope,
        jurisdiction: data.jurisdiction,
        status: "DRAFT",
        supersedes_specification_id: data.supersedesSpecificationId ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_SPECIFICATION_CREATED",
      entityType: "method_specifications",
      entityId: row.id,
      after: { version: data.version, status: "DRAFT" },
    });
    return { specificationId: row.id };
  });

/**
 * Nova versão a partir de uma especificação existente.
 * A versão anterior NÃO é alterada: a nova nasce DRAFT e referencia
 * `supersedes_specification_id`. Manifesto e hash da anterior permanecem.
 */
export const createNewSpecificationVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createNewSpecificationVersionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);

    const { data: base, error: baseError } = await supabase
      .from("method_specifications")
      .select("*")
      .eq("id", data.specificationId)
      .single();
    if (baseError) throw new Error(baseError.message);

    const { data: row, error } = await supabase
      .from("method_specifications")
      .insert({
        organization_id: membership.organizationId,
        valuation_method_id: base.valuation_method_id,
        version: data.version,
        title: data.title,
        purpose: base.purpose,
        scope: base.scope,
        jurisdiction: base.jurisdiction,
        status: "DRAFT",
        supersedes_specification_id: base.id,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.copyStructure) {
      const { data: sections } = await supabase
        .from("method_specification_sections")
        .select("section_key, content, ordinal")
        .eq("method_specification_id", base.id);
      if (sections && sections.length > 0) {
        const { error: copyError } = await supabase.from("method_specification_sections").insert(
          sections.map((s) => ({
            organization_id: membership.organizationId,
            method_specification_id: row.id,
            section_key: s.section_key,
            content: s.content,
            ordinal: s.ordinal,
            created_by: userId,
          })),
        );
        if (copyError) throw new Error(copyError.message);
      }
      const { data: requirements } = await supabase
        .from("method_specification_source_requirements")
        .select("requirement_code, description")
        .eq("method_specification_id", base.id);
      if (requirements && requirements.length > 0) {
        // Checklists reiniciam pendentes: satisfação não é herdada.
        const { error: reqError } = await supabase
          .from("method_specification_source_requirements")
          .insert(
            requirements.map((r) => ({
              organization_id: membership.organizationId,
              method_specification_id: row.id,
              requirement_code: r.requirement_code,
              description: r.description,
              is_satisfied: false,
              notes: "PENDENTE nesta versão: satisfação não é herdada da versão anterior.",
              created_by: userId,
            })),
          );
        if (reqError) throw new Error(reqError.message);
      }
    }

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_SPECIFICATION_VERSION_CREATED",
      entityType: "method_specifications",
      entityId: row.id,
      after: { version: data.version, supersedes_specification_id: base.id },
    });
    return { specificationId: row.id };
  });

export const updateDraftSpecification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateDraftSpecificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.purpose !== undefined) patch["purpose"] = data.purpose;
    if (data.scope !== undefined) patch["scope"] = data.scope;
    if (data.effectiveFrom !== undefined) patch["effective_from"] = data.effectiveFrom;
    if (data.effectiveUntil !== undefined) patch["effective_until"] = data.effectiveUntil;
    if (Object.keys(patch).length === 0) return { specificationId: data.specificationId };

    const { error } = await supabase
      .from("method_specifications")
      .update(patch as never)
      .eq("id", data.specificationId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_SPECIFICATION_UPDATED",
      entityType: "method_specifications",
      entityId: data.specificationId,
      after: patch,
    });
    return { specificationId: data.specificationId };
  });

export const listSpecificationSections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: rows, error } = await supabase
      .from("method_specification_sections")
      .select("*")
      .eq("method_specification_id", data.specificationId)
      .order("ordinal", { ascending: true });
    if (error) throw new Error(error.message);
    return { sections: rows ?? [] };
  });

export const updateDraftSpecificationSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateDraftSectionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: existing, error: readError } = await supabase
      .from("method_specification_sections")
      .select("id, ordinal")
      .eq("method_specification_id", data.specificationId)
      .eq("section_key", data.sectionKey)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    if (existing) {
      const { error } = await supabase
        .from("method_specification_sections")
        .update({ content: data.content })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("method_specification_sections").insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        section_key: data.sectionKey,
        content: data.content,
        ordinal: 0,
        created_by: userId,
      });
      if (error) throw new Error(error.message);
    }

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_SPECIFICATION_SECTION_UPDATED",
      entityType: "method_specification_sections",
      entityId: data.specificationId,
      after: { section_key: data.sectionKey, length: data.content.length },
    });
    return { specificationId: data.specificationId };
  });

/* =============================== diagnóstico, submissão, decisão ========= */

export const getSpecificationCompleteness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }): Promise<CompletenessReport> => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);

    const { data: report, error } = await supabase.rpc("specification_completeness", {
      _spec_id: data.specificationId,
    });
    if (error) throw new Error(error.message);
    const json = asJsonObject(report);
    return {
      specification_id: String(json["specification_id"]),
      status: String(json["status"]),
      is_complete: Boolean(json["is_complete"]),
      is_approvable: Boolean(json["is_approvable"]),
      completed_requirements: asStringArray(json["completed_requirements"]),
      missing_requirements: asStringArray(json["missing_requirements"]),
      blockers: asStringArray(json["blockers"]),
      warnings: asStringArray(json["warnings"]),
    };
  });

export const submitMethodSpecification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSpecificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWriteAccess(supabase, userId);
    const { error } = await supabase.rpc("submit_method_specification", {
      _spec_id: data.specificationId,
      ...(data.notes ? { _notes: data.notes } : {}),
    });
    if (error) throw new Error(error.message);
    return { specificationId: data.specificationId };
  });

/** Aprovação: papel, separação autor/aprovador, completude, manifesto e SHA-256 são do banco. */
export const approveMethodSpecification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => approveSpecificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);
    const { data: result, error } = await supabase.rpc("approve_method_specification", {
      _spec_id: data.specificationId,
      ...(data.notes ? { _notes: data.notes } : {}),
    });
    if (error) throw new Error(error.message);
    const json = asJsonObject(result);
    return {
      specificationId: String(json["specification_id"]),
      specificationHash: String(json["specification_hash"]),
      hashAlgorithm: String(json["hash_algorithm"]),
      manifestSchemaVersion: String(json["manifest_schema_version"]),
    };
  });

export const rejectMethodSpecification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rejectSpecificationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);
    const { error } = await supabase.rpc("reject_method_specification", {
      _spec_id: data.specificationId,
      _reason: data.reason,
    });
    if (error) throw new Error(error.message);
    return { specificationId: data.specificationId };
  });

export const verifySpecificationIntegrity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }): Promise<IntegrityReport> => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);

    const { data: report, error } = await supabase.rpc("verify_specification_integrity", {
      _spec_id: data.specificationId,
    });
    if (error) throw new Error(error.message);
    const json = asJsonObject(report);
    return {
      specification_id: String(json["specification_id"]),
      result: json["result"] as IntegrityReport["result"],
      stored_hash: (json["stored_hash"] as string | null) ?? null,
      recomputed_hash: (json["recomputed_hash"] as string | null) ?? null,
      hash_algorithm: (json["hash_algorithm"] as string | null) ?? null,
      manifest_schema_version: (json["manifest_schema_version"] as string | null) ?? null,
      manifest_equal: Boolean(json["manifest_equal"]),
      ...(typeof json["status"] === "string" ? { status: json["status"] } : {}),
    };
  });

/* ============================================================= REGRAS ==== */

export const listMethodologyRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: rows, error } = await supabase
      .from("methodology_rules")
      .select("*, methodology_rule_sources(*)")
      .eq("method_specification_id", data.specificationId)
      .order("rule_code", { ascending: true });
    if (error) throw new Error(error.message);
    return { rules: rows ?? [] };
  });

export const createMethodologyRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodologyRuleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: row, error } = await supabase
      .from("methodology_rules")
      .insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        rule_code: data.ruleCode,
        title: data.title,
        rule_type: data.ruleType,
        description: data.description,
        normative_strength: data.normativeStrength,
        status: "DRAFT",
        priority: data.priority,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_RULE_CREATED",
      entityType: "methodology_rules",
      entityId: row.id,
      after: { rule_code: data.ruleCode, normative_strength: data.normativeStrength },
    });
    return { ruleId: row.id };
  });

export const updateDraftMethodologyRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateDraftMethodologyRuleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireRuleInDraftSpecification(supabase, data.ruleId, membership);

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch["title"] = data.title;
    if (data.description !== undefined) patch["description"] = data.description;
    if (data.ruleType !== undefined) patch["rule_type"] = data.ruleType;
    if (data.normativeStrength !== undefined)
      patch["normative_strength"] = data.normativeStrength;
    if (data.priority !== undefined) patch["priority"] = data.priority;
    if (Object.keys(patch).length === 0) return { ruleId: data.ruleId };

    const { error } = await supabase.from("methodology_rules").update(patch as never).eq("id", data.ruleId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_RULE_UPDATED",
      entityType: "methodology_rules",
      entityId: data.ruleId,
      after: patch,
    });
    return { ruleId: data.ruleId };
  });

export const attachRuleSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => attachRuleSourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireRuleInDraftSpecification(supabase, data.ruleId, membership);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const { data: row, error } = await supabase
      .from("methodology_rule_sources")
      .insert({
        organization_id: membership.organizationId,
        rule_id: data.ruleId,
        source_id: data.sourceId,
        source_locator_id: data.sourceLocatorId ?? null,
        relationship_type: data.relationshipType,
        support_excerpt: data.supportExcerpt,
        interpretation_notes: data.interpretationNotes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_RULE_SOURCE_ATTACHED",
      entityType: "methodology_rule_sources",
      entityId: row.id,
      after: { rule_id: data.ruleId, relationship_type: data.relationshipType },
    });
    return { ruleSourceId: row.id };
  });

export const getRuleSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ruleScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireMembership(supabase, userId);
    const { data: rows, error } = await supabase
      .from("methodology_rule_sources")
      .select("*, methodology_sources(id, title, access_status, authority_level, status)")
      .eq("rule_id", data.ruleId);
    if (error) throw new Error(error.message);
    return { ruleSources: rows ?? [] };
  });

export const getSourceRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);
    const { data: rows, error } = await supabase
      .from("methodology_rule_sources")
      .select(
        "*, methodology_rules(id, rule_code, title, normative_strength, status, method_specification_id)",
      )
      .eq("source_id", data.sourceId);
    if (error) throw new Error(error.message);
    return { rules: rows ?? [] };
  });

/* =========================================================== FÓRMULAS ==== */

export const listMethodologyFormulas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);

    const { data: rules, error: ruleError } = await supabase
      .from("methodology_rules")
      .select("id")
      .eq("method_specification_id", data.specificationId);
    if (ruleError) throw new Error(ruleError.message);
    const ruleIds = (rules ?? []).map((r) => r.id);
    if (ruleIds.length === 0) return { formulas: [] };

    const { data: rows, error } = await supabase
      .from("methodology_formulas")
      .select("*, methodology_formula_variables(*)")
      .in("rule_id", ruleIds)
      .order("formula_code", { ascending: true });
    if (error) throw new Error(error.message);
    return { formulas: rows ?? [] };
  });

export const createMethodologyFormula = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodologyFormulaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireRuleInDraftSpecification(supabase, data.ruleId, membership);

    const { data: row, error } = await supabase
      .from("methodology_formulas")
      .insert({
        organization_id: membership.organizationId,
        rule_id: data.ruleId,
        formula_code: data.formulaCode,
        name: data.name,
        // Registro simbólico. Nunca avaliado em runtime.
        expression: data.expression,
        expression_language: "SYMBOLIC",
        description: data.description,
        status: "DRAFT",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_FORMULA_CREATED",
      entityType: "methodology_formulas",
      entityId: row.id,
      after: { formula_code: data.formulaCode },
    });
    return { formulaId: row.id };
  });

export const createFormulaVariable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createFormulaVariableSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireFormulaInDraftSpecification(supabase, data.formulaId, membership);

    const { data: row, error } = await supabase
      .from("methodology_formula_variables")
      .insert({
        organization_id: membership.organizationId,
        formula_id: data.formulaId,
        variable_code: data.variableCode,
        name: data.name,
        description: data.description,
        data_type: data.dataType,
        unit_code: data.unitCode,
        input_semantic: data.inputSemantic,
        required: data.required,
        constraints: data.constraints,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_FORMULA_VARIABLE_CREATED",
      entityType: "methodology_formula_variables",
      entityId: row.id,
      after: { variable_code: data.variableCode, unit_code: data.unitCode },
    });
    return { variableId: row.id };
  });

/* ========================================================= PARÂMETROS ==== */

export const listMethodologyParameters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const [parameters, sets, values] = await Promise.all([
      supabase
        .from("methodology_parameters")
        .select("*")
        .eq("method_specification_id", data.specificationId)
        .order("parameter_code", { ascending: true }),
      supabase
        .from("method_parameter_sets")
        .select("*")
        .eq("method_specification_id", data.specificationId),
      supabase.from("method_parameter_values").select("*"),
    ]);
    for (const r of [parameters, sets, values]) if (r.error) throw new Error(r.error.message);
    return {
      parameters: parameters.data ?? [],
      parameterSets: sets.data ?? [],
      parameterValues: values.data ?? [],
    };
  });

export const createMethodologyParameter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodologyParameterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: row, error } = await supabase
      .from("methodology_parameters")
      .insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        parameter_code: data.parameterCode,
        name: data.name,
        data_type: data.dataType,
        unit_code: data.unitCode,
        default_value: data.defaultValue ?? null,
        min_value: data.minValue ?? null,
        max_value: data.maxValue ?? null,
        source_required: data.sourceRequired,
        description: data.description,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_PARAMETER_CREATED",
      entityType: "methodology_parameters",
      entityId: row.id,
      after: { parameter_code: data.parameterCode, source_required: data.sourceRequired },
    });
    return { parameterId: row.id };
  });

/* ====================================================== APLICABILIDADE === */

export const listMethodApplicabilityRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: rows, error } = await supabase
      .from("method_applicability_rules")
      .select("*")
      .eq("method_specification_id", data.specificationId)
      .order("criterion_code", { ascending: true });
    if (error) throw new Error(error.message);
    return { applicability: rows ?? [] };
  });

export const createMethodApplicabilityRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createApplicabilityRuleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: row, error } = await supabase
      .from("method_applicability_rules")
      .insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        criterion_code: data.criterionCode,
        criterion_description: data.criterionDescription,
        expected_result: data.expectedResult,
        notes: data.notes,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_APPLICABILITY_RULE_CREATED",
      entityType: "method_applicability_rules",
      entityId: row.id,
      after: { criterion_code: data.criterionCode },
    });
    return { applicabilityId: row.id };
  });

/* ============================================================= TESTES ==== */

export const listMethodTestCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: rows, error } = await supabase
      .from("method_test_cases")
      .select("*")
      .eq("method_specification_id", data.specificationId)
      .order("test_code", { ascending: true });
    if (error) throw new Error(error.message);
    return { tests: rows ?? [] };
  });

export const createMethodTestCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createMethodTestCaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: row, error } = await supabase
      .from("method_test_cases")
      .insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        test_code: data.testCode,
        title: data.title,
        test_type: data.testType,
        expected_status: data.expectedStatus,
        source_reference: data.sourceReference,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_TEST_CASE_CREATED",
      entityType: "method_test_cases",
      entityId: row.id,
      after: { test_code: data.testCode, test_type: data.testType },
    });
    return { testCaseId: row.id };
  });

/* =============================================== CONTRATOS DE SAÍDA ====== */

export const getMethodOutputContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => specScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: rows, error } = await supabase
      .from("method_output_contracts")
      .select("*")
      .eq("method_specification_id", data.specificationId);
    if (error) throw new Error(error.message);
    return { outputContracts: rows ?? [] };
  });

export const createMethodOutputContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createOutputContractSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireDraftSpecification(supabase, data.specificationId, membership);

    const { data: row, error } = await supabase
      .from("method_output_contracts")
      .insert({
        organization_id: membership.organizationId,
        method_specification_id: data.specificationId,
        output_type: data.outputType,
        description: data.description,
        unit_code: data.unitCode,
        required: data.required,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHOD_OUTPUT_CONTRACT_CREATED",
      entityType: "method_output_contracts",
      entityId: row.id,
      after: { output_type: data.outputType },
    });
    return { outputContractId: row.id };
  });

/* ==================================================== CHANGE REQUESTS ==== */

export const listMethodologyChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const { data, error } = await supabase
      .from("methodology_change_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { changeRequests: data ?? [], role: membership.role };
  });

export const createMethodologyChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createChangeRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: row, error } = await supabase
      .from("methodology_change_requests")
      .insert({
        organization_id: membership.organizationId,
        target_type: data.targetType,
        target_id: data.targetId ?? null,
        change_type: data.changeType,
        description: data.description,
        reason: data.reason,
        // Autoria derivada do token, nunca do payload.
        proposed_by: userId,
        status: "OPEN",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_CHANGE_REQUEST_CREATED",
      entityType: "methodology_change_requests",
      entityId: row.id,
      after: { change_type: data.changeType, target_type: data.targetType },
    });
    return { changeRequestId: row.id };
  });

export const reviewMethodologyChangeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewChangeRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);

    const { data: current, error: readError } = await supabase
      .from("methodology_change_requests")
      .select("id, status, proposed_by")
      .eq("id", data.changeRequestId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Change Request inexistente ou fora do escopo.");
    if (["APPROVED", "REJECTED", "IMPLEMENTED", "WITHDRAWN"].includes(current.status)) {
      throw new Error("Change Request já encerrado: registre um novo em vez de reescrever.");
    }
    if (current.proposed_by === userId && data.status !== "WITHDRAWN") {
      throw new Error(
        "Separação de funções: quem propôs o Change Request não decide sobre ele (apenas pode retirá-lo).",
      );
    }

    const { error } = await supabase
      .from("methodology_change_requests")
      .update({
        status: data.status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: data.reviewNotes,
      })
      .eq("id", data.changeRequestId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_CHANGE_REQUEST_REVIEWED",
      entityType: "methodology_change_requests",
      entityId: data.changeRequestId,
      before: { status: current.status },
      after: { status: data.status, reviewed_by: userId },
    });
    return { changeRequestId: data.changeRequestId };
  });

/* ============================================ FASE 7E — CLAIMS CANDIDATAS */

/**
 * Claims candidatas de uma fonte. O gate (documento autorizado +
 * CONTENT_VERIFIED + LOCATOR_VERIFIED) é do banco; aqui só há leitura.
 */
export const listSourceClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => sourceScopeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const claims = await supabase
      .from("methodology_source_claims")
      .select("*")
      .eq("source_id", data.sourceId)
      .order("created_at", { ascending: false });
    if (claims.error) throw new Error(claims.error.message);

    const ids = (claims.data ?? []).map((c) => c.id);
    const [reviews, assessments] = await Promise.all([
      ids.length
        ? supabase
            .from("methodology_claim_reviews")
            .select("*")
            .in("claim_id", ids)
            .order("reviewed_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? supabase.from("methodology_claim_rule_assessments").select("*").in("claim_id", ids)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (reviews.error) throw new Error(reviews.error.message);
    if (assessments.error) throw new Error(assessments.error.message);

    const actorNames = await resolveActorNames(supabase, [
      ...(claims.data ?? []).map((c) => c.created_by),
      ...(reviews.data ?? []).map((r) => r.reviewed_by),
    ]);

    return {
      claims: claims.data ?? [],
      reviews: reviews.data ?? [],
      assessments: assessments.data ?? [],
      /** Autoria explícita: proponente e revisor nunca aparecem anônimos. */
      actorNames,
      role: membership.role,
    };
  });

/** Especificações DRAFT e seus temas: alvo possível de uma claim candidata. */
export const listClaimTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    const specs = await supabase
      .from("method_specifications")
      .select("id, version, title, status")
      .eq("status", "DRAFT")
      .or(orgFilter(membership.organizationId))
      .order("version");
    if (specs.error) throw new Error(specs.error.message);
    const specIds = (specs.data ?? []).map((s) => s.id);
    const requirements = specIds.length
      ? await supabase
          .from("method_specification_source_requirements")
          .select("id, method_specification_id, requirement_code, description, is_satisfied")
          .in("method_specification_id", specIds)
          .order("requirement_code")
      : { data: [], error: null };
    if (requirements.error) throw new Error(requirements.error.message);
    return { specifications: specs.data ?? [], requirements: requirements.data ?? [] };
  });

export const createSourceClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSourceClaimSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    await requireSourceInScope(supabase, data.sourceId, membership);

    const { data: row, error } = await supabase
      .from("methodology_source_claims")
      .insert({
        organization_id: membership.organizationId,
        source_id: data.sourceId,
        locator_id: data.locatorId,
        method_specification_id: data.specificationId,
        requirement_code: data.requirementCode,
        claim_code: data.claimCode,
        claim_kind: data.claimKind,
        statement: data.statement,
        verbatim_excerpt: data.verbatimExcerpt,
        numeric_payload: (data.numericPayload ?? null) as Json,
        deferred_target: data.deferredTarget,
        extraction_method: data.extractionMethod,
        reviewer_alerts: data.reviewerAlerts,
        notes: data.notes,
        supersedes_claim_id: data.supersedesClaimId ?? null,
        created_by: userId,

      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_CLAIM_PROPOSED",
      entityType: "methodology_source_claims",
      entityId: row.id,
      after: {
        claim_code: data.claimCode,
        requirement_code: data.requirementCode,
        claim_kind: data.claimKind,
        extraction_method: data.extractionMethod,
      },
    });
    return { claimId: row.id };
  });

/** Operação oficial: decisão e autor vêm da RPC, nunca do payload. */
export const reviewSourceClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewSourceClaimSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);
    const { data: reviewId, error } = await supabase.rpc("review_methodology_claim", {
      _claim_id: data.claimId,
      _decision: data.decision,
      _justification: data.justification,
    });
    if (error) throw new Error(error.message);
    return { reviewId };
  });

export const createClaimRuleAssessment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createClaimRuleAssessmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);
    const { data: row, error } = await supabase
      .from("methodology_claim_rule_assessments")
      .insert({
        organization_id: membership.organizationId,
        claim_id: data.claimId,
        rule_id: data.ruleId ?? null,
        assessment: data.assessment,
        proposed_relationship: data.proposedRelationship ?? null,
        proposed_normative_strength: data.proposedNormativeStrength ?? null,
        rationale: data.rationale,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "METHODOLOGY_CLAIM_RULE_ASSESSED",
      entityType: "methodology_claim_rule_assessments",
      entityId: row.id,
      after: { claim_id: data.claimId, assessment: data.assessment, rule_id: data.ruleId ?? null },
    });
    return { assessmentId: row.id };
  });

export const getClaimDossier = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => claimDossierSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    await requireSpecificationInScope(supabase, data.specificationId, membership);
    const { data: report, error } = await supabase.rpc("methodology_claim_dossier", {
      _specification_id: data.specificationId,
      ...(data.requirementCodes?.length ? { _requirement_codes: data.requirementCodes } : {}),
    });
    if (error) throw new Error(error.message);
    return { dossier: asJsonObject(report) as unknown as ClaimDossierReport };
  });

/** Operação oficial: tema só é satisfeito por claim ACEITA, com justificativa. */
export const satisfySpecificationRequirement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => satisfyRequirementSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireReviewAccess(supabase, userId);
    const { error } = await supabase.rpc("satisfy_specification_requirement", {
      _requirement_id: data.requirementId,
      _claim_id: data.claimId,
      _justification: data.justification,
    });
    if (error) throw new Error(error.message);
    return { requirementId: data.requirementId };
  });

/**
 * Fase 7G — leitura do gate de revisor independente.
 *
 * Somente diagnóstico. A segregação continua imposta pelo banco em
 * `review_methodology_claim` (revisor distinto de quem propôs) e nas RPCs de
 * verificação. Nenhum papel é criado, convidado ou elevado por esta função.
 */
export const getReviewerSegregationGate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);
    return { gate: await readReviewerSegregationGate(supabase, membership, userId) };
  });
