import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createExtractionSchema,
  createFieldSchema,
  createSourceSchema,
  registerArtifactSchema,
  rejectFieldSchema,
  verifyFieldSchema,
} from "@/lib/validation/schemas";
import {
  requireMembership,
  requireReviewAccess,
  requireWriteAccess,
  sha256Hex,
  writeAudit,
} from "@/lib/workspace.server";

export const listEvidenceSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    let query = supabase
      .from("evidence_sources")
      .select(
        "id, source_type, source_name, source_url, publisher_or_owner, accessed_at, publication_date, created_at, valuation_case_id, is_archived",
      )
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false });

    if (data.caseId) query = query.eq("valuation_case_id", data.caseId);

    const { data: sources, error } = await query;
    if (error) throw new Error(error.message);

    const sourceIds = (sources ?? []).map((s) => s.id);
    const { data: artifacts } = await supabase
      .from("evidence_artifacts")
      .select("id, evidence_source_id, file_name, sha256_hash, captured_at, mime_type, file_size")
      .in("evidence_source_id", sourceIds.length > 0 ? sourceIds : [
        "00000000-0000-0000-0000-000000000000",
      ]);

    const { data: cases } = await supabase
      .from("valuation_cases")
      .select("id, case_code, title")
      .eq("organization_id", membership.organizationId);

    return {
      role: membership.role,
      cases: cases ?? [],
      sources: (sources ?? []).map((s) => ({
        ...s,
        artifacts: (artifacts ?? []).filter((a) => a.evidence_source_id === s.id),
        case: (cases ?? []).find((c) => c.id === s.valuation_case_id) ?? null,
      })),
    };
  });

export const createEvidenceSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSourceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    if (data.caseId) {
      const { data: found } = await supabase
        .from("valuation_cases")
        .select("id")
        .eq("id", data.caseId)
        .eq("organization_id", membership.organizationId)
        .maybeSingle();
      if (!found) throw new Error("Caso informado não pertence a esta organização.");
    }

    const { data: created, error } = await supabase
      .from("evidence_sources")
      .insert({
        organization_id: membership.organizationId,
        valuation_case_id: data.caseId ?? null,
        source_type: data.sourceType,
        source_name: data.sourceName,
        source_url: data.sourceUrl ?? null,
        publisher_or_owner: data.publisherOrOwner ?? null,
        publication_date: data.publicationDate ?? null,
        accessed_at: new Date().toISOString(),
        notes: data.notes ?? null,
        created_by: userId,
      })
      .select("id, source_name")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: data.caseId ?? null,
      eventType: "EVIDENCE_SOURCE_CREATED",
      entityType: "evidence_source",
      entityId: created.id,
      after: { source_name: created.source_name, source_type: data.sourceType },
    });

    return created;
  });

/**
 * Registers an artifact already uploaded to the private bucket and computes the
 * SHA-256 hash on the SERVER by reading the stored bytes back. A browser-computed
 * hash is never accepted as an integrity mechanism.
 */
export const registerEvidenceArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => registerArtifactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: source, error: sourceError } = await supabase
      .from("evidence_sources")
      .select("id, organization_id, valuation_case_id")
      .eq("id", data.sourceId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    if (!source) throw new Error("Fonte não encontrada nesta organização.");

    // Storage path is canonical: <organization_id>/<valuation_case_id>/<file>.
    // Both segments are checked against the database record, not just the path text.
    const segments = data.storagePath.split("/");
    if (segments[0] !== membership.organizationId) {
      throw new Error("Caminho de armazenamento fora do escopo da organização.");
    }
    if (!source.valuation_case_id) {
      throw new Error("Vincule a fonte a um caso antes de capturar artefatos.");
    }
    if (segments[1] !== source.valuation_case_id) {
      throw new Error("Caminho de armazenamento não corresponde ao caso da fonte.");
    }

    const download = await supabase.storage.from("evidence-originals").download(data.storagePath);
    if (download.error || !download.data) {
      throw new Error(
        `Não foi possível ler o arquivo armazenado para calcular o hash: ${
          download.error?.message ?? "arquivo ausente"
        }`,
      );
    }
    const bytes = await download.data.arrayBuffer();
    const hash = await sha256Hex(bytes);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin
      .from("evidence_artifacts")
      .insert({
        organization_id: membership.organizationId,
        evidence_source_id: source.id,
        storage_bucket: "evidence-originals",
        storage_path: data.storagePath,
        file_name: data.fileName,
        mime_type: data.mimeType ?? download.data.type ?? null,
        file_size: bytes.byteLength,
        sha256_hash: hash,
        hash_computed_by: "SERVER",
        created_by: userId,
      })
      .select("id, file_name, sha256_hash, file_size, captured_at")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      caseId: source.valuation_case_id,
      eventType: "ARTIFACT_CAPTURED",
      entityType: "evidence_artifact",
      entityId: created.id,
      after: { file_name: created.file_name, sha256_hash: created.sha256_hash },
    });

    return created;
  });

export const getEvidenceSourceDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sourceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: source, error } = await supabase
      .from("evidence_sources")
      .select("*")
      .eq("id", data.sourceId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!source) throw new Error("Fonte não encontrada.");

    const { data: artifacts } = await supabase
      .from("evidence_artifacts")
      .select("*")
      .eq("evidence_source_id", source.id)
      .order("captured_at", { ascending: true });

    const artifactIds = (artifacts ?? []).map((a) => a.id);
    const fallback = ["00000000-0000-0000-0000-000000000000"];

    const { data: extractions } = await supabase
      .from("evidence_extractions")
      .select("*")
      .in("artifact_id", artifactIds.length > 0 ? artifactIds : fallback)
      .order("created_at", { ascending: true });

    const extractionIds = (extractions ?? []).map((e) => e.id);

    const { data: fields } = await supabase
      .from("evidence_fields")
      .select("*")
      .in("extraction_id", extractionIds.length > 0 ? extractionIds : fallback)
      .order("created_at", { ascending: true });

    const fieldIds = (fields ?? []).map((f) => f.id);

    const [{ data: revisions }, { data: reviews }] = await Promise.all([
      supabase
        .from("evidence_field_revisions")
        .select("*")
        .in("field_id", fieldIds.length > 0 ? fieldIds : fallback)
        .order("created_at", { ascending: false }),
      supabase
        .from("evidence_reviews")
        .select("*")
        .in("field_id", fieldIds.length > 0 ? fieldIds : fallback)
        .order("created_at", { ascending: false }),
    ]);

    const { data: audit } = await supabase
      .from("audit_log")
      .select("id, event_type, entity_type, entity_id, created_at, actor_user_id, metadata")
      .eq("organization_id", membership.organizationId)
      .in("entity_id", [source.id, ...artifactIds, ...extractionIds, ...fieldIds])
      .order("created_at", { ascending: false });

    return {
      role: membership.role,
      source,
      artifacts: artifacts ?? [],
      extractions: extractions ?? [],
      fields: fields ?? [],
      revisions: revisions ?? [],
      reviews: reviews ?? [],
      audit: audit ?? [],
    };
  });

export const getArtifactSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ artifactId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data: artifact, error } = await supabase
      .from("evidence_artifacts")
      .select("id, storage_bucket, storage_path")
      .eq("id", data.artifactId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!artifact) throw new Error("Artefato não encontrado.");

    const signed = await supabase.storage
      .from(artifact.storage_bucket)
      .createSignedUrl(artifact.storage_path, 300);
    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message ?? "Não foi possível gerar o link assinado.");
    }
    return { url: signed.data.signedUrl, expiresInSeconds: 300 };
  });

export const createExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createExtractionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: artifact, error: artifactError } = await supabase
      .from("evidence_artifacts")
      .select("id, organization_id, evidence_source_id")
      .eq("id", data.artifactId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (artifactError) throw new Error(artifactError.message);
    if (!artifact) throw new Error("Artefato não encontrado.");

    const { data: previous } = await supabase
      .from("evidence_extractions")
      .select("version_number")
      .eq("artifact_id", artifact.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNumber = (previous?.version_number ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("evidence_extractions")
      .insert({
        organization_id: membership.organizationId,
        artifact_id: artifact.id,
        version_number: versionNumber,
        extraction_type: data.extractionType ?? null,
        processor_type: data.processorType,
        processor_name: data.processorName ?? null,
        processor_version: data.processorVersion ?? null,
        prompt_version: data.promptVersion ?? null,
        status: data.processorType === "MANUAL" ? "COMPLETED" : "PENDING",
        raw_output: data.notes ? { manual_notes: data.notes } : null,
        created_by: userId,
      })
      .select("id, version_number, processor_type, status")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "EXTRACTION_CREATED",
      entityType: "evidence_extraction",
      entityId: created.id,
      after: created,
      metadata: { artifact_id: artifact.id },
    });

    return created;
  });

export const createEvidenceField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireWriteAccess(supabase, userId);

    const { data: extraction, error: extractionError } = await supabase
      .from("evidence_extractions")
      .select("id, organization_id")
      .eq("id", data.extractionId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (extractionError) throw new Error(extractionError.message);
    if (!extraction) throw new Error("Extração não encontrada.");

    const numeric = data.normalizedValue
      ? Number(data.normalizedValue.replace(/\s/g, "").replace(",", "."))
      : NaN;

    const { data: created, error } = await supabase
      .from("evidence_fields")
      .insert({
        organization_id: membership.organizationId,
        extraction_id: extraction.id,
        field_name: data.fieldName,
        raw_value: data.rawValue ?? null,
        normalized_value: data.normalizedValue ?? null,
        numeric_value: Number.isFinite(numeric) ? numeric : null,
        unit: data.unit ?? null,
        field_state: data.fieldState,
        source_excerpt: data.sourceExcerpt ?? null,
        source_locator: data.sourceLocator ? { locator: data.sourceLocator } : null,
        validation_status: "PENDING_REVIEW",
        created_by: userId,
      })
      .select("id, field_name, validation_status")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "FIELD_CREATED",
      entityType: "evidence_field",
      entityId: created.id,
      after: { field_name: created.field_name, field_state: data.fieldState },
    });

    return created;
  });

export const listFieldsForReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data, error } = await supabase
      .from("evidence_fields")
      .select(
        "id, field_name, raw_value, normalized_value, unit, field_state, validation_status, source_excerpt, source_locator, created_at, extraction_id",
      )
      .eq("organization_id", membership.organizationId)
      .in("validation_status", ["EXTRACTED", "PENDING_REVIEW"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return { role: membership.role, fields: data ?? [] };
  });

export const verifyEvidenceField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => verifyFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);

    const { data: field, error: readError } = await supabase
      .from("evidence_fields")
      .select("*")
      .eq("id", data.fieldId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!field) throw new Error("Campo não encontrado.");
    if (field.validation_status === "VERIFIED") throw new Error("Campo já verificado.");
    if (field.validation_status === "REJECTED")
      throw new Error("Campo rejeitado não pode ser verificado; crie nova extração.");

    const hasEvidence =
      (field.source_excerpt ?? "").trim().length > 0 || field.source_locator !== null;
    if (!hasEvidence) {
      throw new Error(
        "Sem trecho de evidência ou localizador, o campo não pode ser marcado como VERIFICADO.",
      );
    }

    const { error } = await supabase.rpc("verify_evidence_field", {
      _field_id: field.id,
      _notes: data.verificationNotes,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const rejectEvidenceField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rejectFieldSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireReviewAccess(supabase, userId);

    const { data: field, error: readError } = await supabase
      .from("evidence_fields")
      .select("*")
      .eq("id", data.fieldId)
      .eq("organization_id", membership.organizationId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!field) throw new Error("Campo não encontrado.");

    const { error } = await supabase.rpc("reject_evidence_field", {
      _field_id: field.id,
      _reason: data.rejectionReason,
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
