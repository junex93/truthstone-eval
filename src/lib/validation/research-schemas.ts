/**
 * Zod contracts for the research engine. Provider schema compliance does NOT
 * replace domain validation: everything the model returns is parsed again here.
 */

import { z } from "zod";

import {
  RESEARCH_BUDGET_LIMITS,
  RESEARCH_CANDIDATE_TYPES,
  RESEARCH_TYPES,
  EXTRACTION_SUPPORT_STATUSES,
} from "@/lib/domain/research";
import { MARKET_OBSERVATION_STATUSES, MARKET_OBSERVATION_TYPES } from "@/lib/domain/constants";

const uuid = z.string().uuid();

export const createResearchRunSchema = z.object({
  caseId: uuid,
  researchType: z.enum(RESEARCH_TYPES),
  objective: z.string().trim().min(10, "Descreva o objetivo da pesquisa.").max(2000),
  maxSearchUses: z.number().int().min(1).max(RESEARCH_BUDGET_LIMITS.maxSearchUses),
  maxSources: z.number().int().min(1).max(RESEARCH_BUDGET_LIMITS.maxSources),
  maxFetches: z.number().int().min(1).max(RESEARCH_BUDGET_LIMITS.maxFetches),
  maxExtractions: z.number().int().min(1).max(RESEARCH_BUDGET_LIMITS.maxExtractions),
});
export type CreateResearchRunInput = z.infer<typeof createResearchRunSchema>;

export const runIdSchema = z.object({ runId: uuid });

export const generatePlanSchema = z.object({ runId: uuid, maxQueries: z.number().int().min(1).max(10) });

export const upsertQuerySchema = z.object({
  runId: uuid,
  queryId: uuid.optional(),
  queryText: z.string().trim().min(5, "Consulta muito curta.").max(400),
  purpose: z.string().trim().max(500).optional(),
});

export const discardQuerySchema = z.object({ queryId: uuid, reason: z.string().trim().max(500).optional() });

export const executeQuerySchema = z.object({ queryId: uuid });

export const selectResultSchema = z.object({
  resultId: uuid,
  selectionStatus: z.enum(["UNREVIEWED", "SELECTED", "REJECTED"]),
});

export const addManualUrlSchema = z.object({
  runId: uuid,
  url: z.string().trim().url("Informe uma URL http(s) válida.").max(2000),
  title: z.string().trim().max(300).optional(),
});

export const captureResultSchema = z.object({ resultId: uuid });

export const extractArtifactSchema = z.object({ resultId: uuid });

export const candidateIdSchema = z.object({ candidateId: uuid });

export const rejectCandidateSchema = z.object({
  candidateId: uuid,
  reason: z.string().trim().min(5, "Informe o motivo da rejeição.").max(1000),
});

export const promoteCandidateSchema = z.object({
  candidateId: uuid,
  fieldIds: z.array(uuid).min(1, "Selecione ao menos um campo verificado."),
  observationType: z.enum(MARKET_OBSERVATION_TYPES),
  observationStatus: z.enum(MARKET_OBSERVATION_STATUSES),
  marketPropertyId: uuid.optional(),
  label: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const setDomainPolicySchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9.-]+$/i, "Informe apenas o domínio, sem esquema nem caminho."),
  policyStatus: z.enum(["ALLOWED", "REVIEW_REQUIRED", "BLOCKED"]),
  notes: z.string().trim().max(500).optional(),
});

/** Planner output, re-validated after the provider. */
export const plannedQuerySchema = z.object({
  query: z.string().trim().min(3).max(400),
  purpose: z.string().trim().max(500),
  input_fact_ids: z.array(z.string().trim().max(120)),
});

export const queryPlanOutputSchema = z.object({ queries: z.array(plannedQuerySchema) });

/**
 * Extraction output. field_name is a free string on purpose: an unknown name
 * must reach the domain layer so it can be recorded as an extraction issue
 * instead of silently disappearing inside the provider schema.
 */
export const rawExtractionFieldSchema = z.object({
  field_name: z.string().trim().min(1).max(120),
  support_status: z.enum(EXTRACTION_SUPPORT_STATUSES),
  raw_value: z.string().max(2000).nullable(),
  normalized_value: z.string().max(2000).nullable(),
  numeric_value: z.number().finite().nullable(),
  unit: z.string().max(40).nullable(),
  source_excerpt: z.string().max(4000).nullable(),
  source_locator: z.string().max(500).nullable(),
  ambiguity_reason: z.string().max(1000).nullable(),
});

export const rawExtractionOutputSchema = z.object({
  document_assessment: z.object({
    document_type: z.string().max(200),
    relevant_to_property: z.boolean(),
    prompt_injection_suspected: z.boolean(),
    notes: z.string().max(2000).nullable(),
  }),
  entity_candidates: z
    .array(
      z.object({
        candidate_type: z.enum(RESEARCH_CANDIDATE_TYPES),
        fields: z.array(rawExtractionFieldSchema).max(80),
      }),
    )
    .max(20),
  warnings: z.array(z.string().max(1000)).max(50),
});
