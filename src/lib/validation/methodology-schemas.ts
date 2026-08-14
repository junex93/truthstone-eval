/**
 * Zod da camada metodológica (Fase 6).
 *
 * ERGONOMIA E FORMATO, NÃO SEGURANÇA. Toda invariante metodológica
 * (imutabilidade, separação autor/aprovador, proveniência de afirmação
 * normativa, selo SHA-256) é imposta em GRANT, RLS, trigger e RPC no
 * PostgreSQL. Se esta validação fosse removida, nenhuma invariante cairia.
 */
import { z } from "zod";

import {
  CLAIM_EXTRACTION_METHODS,
  METHOD_APPLICABILITY_RESULTS,
  METHOD_SPEC_SECTION_KEYS,
  METHOD_TEST_TYPES,
  METHODOLOGY_ACCESS_STATUSES,
  METHODOLOGY_AUTHORITY_LEVELS,
  METHODOLOGY_CHANGE_TYPES,
  METHODOLOGY_CLAIM_DECISIONS,
  METHODOLOGY_CLAIM_KINDS,
  METHODOLOGY_CLAIM_RULE_ASSESSMENTS,
  METHODOLOGY_CONFLICT_STATUSES,
  METHODOLOGY_DATA_TYPES,
  METHODOLOGY_JURISDICTIONS,
  METHODOLOGY_LOCATOR_TYPES,
  METHODOLOGY_NORMATIVE_STRENGTHS,
  METHODOLOGY_OUTPUT_TYPES,
  METHODOLOGY_RULE_TYPES,
  METHODOLOGY_SOURCE_RELATIONSHIPS,
  METHODOLOGY_SOURCE_STATUSES,
  METHODOLOGY_SOURCE_TYPES,
  METHODOLOGY_VERIFICATION_TYPES,
  looksExecutable,
} from "@/lib/domain/methodology";

const uuid = z.string().uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : (v ?? null)));

export const idScopeSchema = z.object({ id: uuid });
export const sourceScopeSchema = z.object({ sourceId: uuid });
export const methodScopeSchema = z.object({ methodId: uuid });
export const specScopeSchema = z.object({ specificationId: uuid });
export const ruleScopeSchema = z.object({ ruleId: uuid });
export const formulaScopeSchema = z.object({ formulaId: uuid });

/* ================================================== fontes metodológicas */

export const createMethodologySourceSchema = z.object({
  title: text(4, 400),
  shortTitle: optionalText(120),
  sourceType: z.enum(METHODOLOGY_SOURCE_TYPES),
  issuingBody: optionalText(240),
  authors: optionalText(400),
  edition: optionalText(80),
  publicationYear: z.number().int().min(1500).max(2200).optional().nullable(),
  jurisdiction: z.enum(METHODOLOGY_JURISDICTIONS),
  jurisdictionDetail: optionalText(160),
  language: optionalText(20),
  identifier: optionalText(160),
  isbn: optionalText(40),
  doi: optionalText(120),
  externalUrl: z.string().trim().url().max(2000).optional().nullable(),
  accessStatus: z.enum(METHODOLOGY_ACCESS_STATUSES),
  authorityLevel: z.enum(METHODOLOGY_AUTHORITY_LEVELS),
  effectiveFrom: z.string().date().optional().nullable(),
  effectiveUntil: z.string().date().optional().nullable(),
  notes: optionalText(2000),
});

export const updateDraftMethodologySourceSchema = createMethodologySourceSchema
  .partial()
  .extend({ sourceId: uuid, status: z.enum(METHODOLOGY_SOURCE_STATUSES).optional() });

export const attachSourceArtifactSchema = z.object({
  sourceId: uuid,
  evidenceArtifactId: uuid,
  accessBasis: z.enum(METHODOLOGY_ACCESS_STATUSES),
  notes: optionalText(1000),
});

/**
 * Base de acesso legítima de um documento autorizado. METADATA_ONLY não é base
 * de acesso: fonte sem cópia legítima nunca sustenta verificação de conteúdo.
 */
export const AUTHORIZED_ACCESS_BASES = [
  "USER_PROVIDED_COPY",
  "LICENSED_COPY",
  "INTERNAL_AUTHORIZED_COPY",
  "PUBLICLY_ACCESSIBLE",
] as const;

/** Ingestão de documento normativo já enviado ao bucket privado. */
export const registerSourceDocumentSchema = z.object({
  sourceId: uuid,
  storagePath: z.string().trim().min(3).max(1024),
  fileName: text(1, 300),
  mimeType: optionalText(160),
  accessBasis: z.enum(AUTHORIZED_ACCESS_BASES),
  accessJustification: text(10, 2000),
  notes: optionalText(1000),
});

export const methodologyArtifactScopeSchema = z.object({ evidenceArtifactId: uuid });

export const createSourceLocatorSchema = z.object({
  sourceId: uuid,
  locatorType: z.enum(METHODOLOGY_LOCATOR_TYPES),
  section: optionalText(120),
  clause: optionalText(120),
  page: optionalText(40),
  chapter: optionalText(120),
  figure: optionalText(120),
  tableReference: optionalText(120),
  externalAnchor: optionalText(2000),
  supportExcerpt: optionalText(4000),
  notes: optionalText(1000),
  /** Artefato que sustenta o localizador; validado em banco quanto à linhagem. */
  artifactId: uuid.optional().nullable(),
});

export const verifyMethodologySourceSchema = z.object({
  sourceId: uuid,
  verificationType: z.enum(METHODOLOGY_VERIFICATION_TYPES),
  locatorId: uuid.optional().nullable(),
  notes: optionalText(2000),
});

export const createSourceConflictSchema = z.object({
  sourceAId: uuid,
  sourceBId: uuid,
  subject: text(5, 300),
  description: optionalText(4000),
  isCritical: z.boolean(),
});

export const resolveSourceConflictSchema = z.object({
  conflictId: uuid,
  resolutionStatus: z.enum(METHODOLOGY_CONFLICT_STATUSES),
  professionalResolution: text(20, 4000),
});

/* ==================================================== especificações */

export const createMethodSpecificationSchema = z.object({
  valuationMethodId: uuid,
  version: text(1, 40),
  title: text(4, 300),
  purpose: optionalText(4000),
  scope: optionalText(4000),
  jurisdiction: z.enum(METHODOLOGY_JURISDICTIONS),
  supersedesSpecificationId: uuid.optional().nullable(),
});

export const createNewSpecificationVersionSchema = z.object({
  specificationId: uuid,
  version: text(1, 40),
  title: text(4, 300),
  copyStructure: z.boolean().default(true),
});

export const updateDraftSpecificationSchema = z.object({
  specificationId: uuid,
  title: text(4, 300).optional(),
  purpose: optionalText(4000),
  scope: optionalText(4000),
  effectiveFrom: z.string().date().optional().nullable(),
  effectiveUntil: z.string().date().optional().nullable(),
});

export const updateDraftSectionSchema = z.object({
  specificationId: uuid,
  sectionKey: z.enum(METHOD_SPEC_SECTION_KEYS),
  content: z.string().max(20000),
});

export const submitSpecificationSchema = z.object({
  specificationId: uuid,
  notes: optionalText(2000),
});

export const approveSpecificationSchema = z.object({
  specificationId: uuid,
  notes: optionalText(2000),
});

export const rejectSpecificationSchema = z.object({
  specificationId: uuid,
  reason: text(10, 4000),
});

/* ============================================================ regras */

export const createMethodologyRuleSchema = z.object({
  specificationId: uuid,
  ruleCode: text(2, 60),
  title: text(4, 300),
  ruleType: z.enum(METHODOLOGY_RULE_TYPES),
  description: optionalText(6000),
  normativeStrength: z.enum(METHODOLOGY_NORMATIVE_STRENGTHS),
  priority: z.number().int().min(0).max(1000).default(100),
});

export const updateDraftMethodologyRuleSchema = createMethodologyRuleSchema
  .partial()
  .extend({ ruleId: uuid });

export const attachRuleSourceSchema = z.object({
  ruleId: uuid,
  sourceId: uuid,
  sourceLocatorId: uuid.optional().nullable(),
  relationshipType: z.enum(METHODOLOGY_SOURCE_RELATIONSHIPS),
  supportExcerpt: optionalText(4000),
  interpretationNotes: optionalText(4000),
});

/* =========================================================== fórmulas */

/**
 * Expressão simbólica. Rejeitamos payload que aparente código executável;
 * mesmo assim, nenhuma camada avalia esta string em tempo de execução.
 */
export const createMethodologyFormulaSchema = z.object({
  ruleId: uuid,
  formulaCode: text(2, 60),
  name: text(3, 200),
  expression: text(1, 2000).refine((v) => !looksExecutable(v), {
    message:
      "Expressão simbólica inválida: conteúdo com aparência de código executável não é aceito no registro metodológico.",
  }),
  description: optionalText(4000),
});

export const createFormulaVariableSchema = z.object({
  formulaId: uuid,
  variableCode: text(1, 60),
  name: text(1, 200),
  description: optionalText(2000),
  dataType: z.enum(METHODOLOGY_DATA_TYPES),
  unitCode: optionalText(40),
  inputSemantic: optionalText(400),
  required: z.boolean().default(true),
  constraints: optionalText(1000),
});

/* ========================================================= parâmetros */

export const createMethodologyParameterSchema = z.object({
  specificationId: uuid,
  parameterCode: text(1, 60),
  name: text(1, 200),
  dataType: z.enum(METHODOLOGY_DATA_TYPES),
  unitCode: optionalText(40),
  defaultValue: z.number().optional().nullable(),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  sourceRequired: z.boolean(),
  description: optionalText(2000),
});

/* ====================================================== aplicabilidade */

export const createApplicabilityRuleSchema = z.object({
  specificationId: uuid,
  criterionCode: text(1, 60),
  criterionDescription: text(4, 2000),
  expectedResult: z.enum(METHOD_APPLICABILITY_RESULTS),
  notes: optionalText(2000),
});

/* ============================================================= testes */

export const createMethodTestCaseSchema = z.object({
  specificationId: uuid,
  testCode: text(1, 60),
  title: text(3, 300),
  testType: z.enum(METHOD_TEST_TYPES),
  expectedStatus: optionalText(60),
  sourceReference: optionalText(400),
});

/* ============================================== contrato de saída */

export const createOutputContractSchema = z.object({
  specificationId: uuid,
  outputType: z.enum(METHODOLOGY_OUTPUT_TYPES),
  description: optionalText(2000),
  unitCode: optionalText(40),
  required: z.boolean().default(true),
});

/* ================================================== change requests */

export const createChangeRequestSchema = z.object({
  targetType: text(2, 80),
  targetId: uuid.optional().nullable(),
  changeType: z.enum(METHODOLOGY_CHANGE_TYPES),
  description: text(10, 6000),
  reason: text(10, 6000),
});

export const reviewChangeRequestSchema = z.object({
  changeRequestId: uuid,
  status: z.enum(["UNDER_REVIEW", "APPROVED", "REJECTED", "WITHDRAWN"]),
  reviewNotes: text(10, 4000),
});

/* ========================================= FASE 7E — claims candidatas === */

/**
 * Claim é CANDIDATO. Nenhum campo de decisão, autoria de revisão ou
 * "satisfação de tema" entra por aqui: isso é operação oficial do banco.
 */
export const createSourceClaimSchema = z.object({
  sourceId: uuid,
  locatorId: uuid,
  specificationId: uuid,
  requirementCode: text(3, 80),
  claimCode: text(2, 60),
  claimKind: z.enum(METHODOLOGY_CLAIM_KINDS),
  statement: text(10, 4000),
  verbatimExcerpt: optionalText(6000),
  numericPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  deferredTarget: optionalText(300),
  extractionMethod: z.enum(CLAIM_EXTRACTION_METHODS),
  reviewerAlerts: z.array(text(3, 400)).max(20).default([]),
  notes: optionalText(2000),
});

export const reviewSourceClaimSchema = z.object({
  claimId: uuid,
  decision: z.enum(METHODOLOGY_CLAIM_DECISIONS),
  justification: text(20, 4000),
});

export const createClaimRuleAssessmentSchema = z.object({
  claimId: uuid,
  ruleId: uuid.optional().nullable(),
  assessment: z.enum(METHODOLOGY_CLAIM_RULE_ASSESSMENTS),
  proposedRelationship: z.enum(METHODOLOGY_SOURCE_RELATIONSHIPS).optional().nullable(),
  proposedNormativeStrength: z.enum(METHODOLOGY_NORMATIVE_STRENGTHS).optional().nullable(),
  rationale: text(20, 4000),
});

export const claimDossierSchema = z.object({
  specificationId: uuid,
  requirementCodes: z.array(text(3, 80)).max(64).optional().nullable(),
});

export const satisfyRequirementSchema = z.object({
  requirementId: uuid,
  claimId: uuid,
  justification: text(20, 4000),
});
