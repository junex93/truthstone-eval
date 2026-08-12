/**
 * Vocabulário único da camada metodológica (Fase 6).
 * Nenhuma regra normativa vive aqui: apenas rótulos e contratos de leitura.
 * Toda invariante é imposta em GRANT, RLS, trigger ou RPC no PostgreSQL.
 */

export const METHODOLOGY_SOURCE_TYPES = [
  "TECHNICAL_STANDARD",
  "LAW",
  "REGULATION",
  "PROFESSIONAL_STANDARD",
  "PROFESSIONAL_GUIDANCE",
  "COURT_OR_OFFICIAL_RULE",
  "ACADEMIC_PAPER",
  "BOOK",
  "TECHNICAL_ARTICLE",
  "COURSE_MATERIAL",
  "INTERNAL_POLICY",
  "OTHER",
] as const;

export const METHODOLOGY_AUTHORITY_LEVELS = [
  "PRIMARY_NORMATIVE",
  "PRIMARY_REGULATORY",
  "PROFESSIONAL_STANDARD",
  "AUTHORITATIVE_GUIDANCE",
  "PEER_REVIEWED_RESEARCH",
  "ESTABLISHED_TECHNICAL_LITERATURE",
  "SECONDARY_GUIDANCE",
  "INTERNAL_SPECIFICATION",
] as const;

export const METHODOLOGY_ACCESS_STATUSES = [
  "METADATA_ONLY",
  "PUBLICLY_ACCESSIBLE",
  "USER_PROVIDED_COPY",
  "LICENSED_COPY",
  "INTERNAL_AUTHORIZED_COPY",
] as const;

export const METHODOLOGY_SOURCE_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "SUPERSEDED",
  "REVOKED",
  "ARCHIVED",
  "PENDING_METADATA_REVIEW",
] as const;

export const METHODOLOGY_JURISDICTIONS = [
  "BRAZIL",
  "INTERNATIONAL",
  "STATE",
  "MUNICIPAL",
  "ORGANIZATIONAL",
  "NOT_SPECIFIED",
] as const;

export const METHODOLOGY_VERIFICATION_TYPES = [
  "METADATA_VERIFIED",
  "CONTENT_VERIFIED",
  "LOCATOR_VERIFIED",
] as const;

export const METHODOLOGY_LOCATOR_TYPES = [
  "CLAUSE",
  "SECTION",
  "PAGE",
  "CHAPTER",
  "FIGURE",
  "TABLE",
  "ANNEX",
  "EXTERNAL_ANCHOR",
  "OTHER",
] as const;

export const METHODOLOGY_RULE_TYPES = [
  "APPLICABILITY",
  "REQUIREMENT",
  "INPUT_REQUIREMENT",
  "TRANSFORMATION",
  "FORMULA",
  "VALIDATION",
  "DIAGNOSTIC",
  "WARNING",
  "BLOCKER",
  "OUTPUT",
  "REPORTING",
  "PROHIBITION",
  "HUMAN_DECISION",
  "OTHER",
] as const;

export const METHODOLOGY_NORMATIVE_STRENGTHS = [
  "MANDATORY",
  "RECOMMENDED",
  "PERMITTED",
  "PROHIBITED",
  "INTERNAL_CONTROL",
] as const;

export const METHODOLOGY_SOURCE_RELATIONSHIPS = [
  "DIRECT_REQUIREMENT",
  "DIRECT_PROHIBITION",
  "TECHNICAL_SUPPORT",
  "INTERPRETATION",
  "BACKGROUND",
  "INTERNAL_DESIGN",
] as const;

export const METHOD_SPEC_SECTION_KEYS = [
  "PURPOSE",
  "INTENDED_USE",
  "APPLICABILITY",
  "NON_APPLICABILITY",
  "REQUIRED_INPUTS",
  "OPTIONAL_INPUTS",
  "DATA_REQUIREMENTS",
  "RULES",
  "FORMULAS",
  "ASSUMPTIONS",
  "DIAGNOSTICS",
  "LIMITATIONS",
  "OUTPUTS",
  "UNCERTAINTY",
  "REPORTING_REQUIREMENTS",
  "SOURCE_REFERENCES",
  "TEST_REQUIREMENTS",
  "KNOWN_RISKS",
] as const;

export const METHOD_SPEC_STATUSES = [
  "DRAFT",
  "UNDER_REVIEW",
  "APPROVED",
  "SUPERSEDED",
  "SUSPENDED",
  "REJECTED",
] as const;

export const METHOD_TEST_TYPES = [
  "UNIT",
  "BOUNDARY",
  "NEGATIVE",
  "COMPLIANCE",
  "REPRODUCIBILITY",
  "NUMERIC",
  "AUDITABILITY",
] as const;

export const METHODOLOGY_OUTPUT_TYPES = [
  "ESTIMATED_VALUE",
  "VALUE_INTERVAL",
  "UNIT_VALUE",
  "DIAGNOSTICS",
  "WARNINGS",
  "ASSUMPTIONS",
  "USED_EVIDENCE",
  "EXCLUDED_EVIDENCE",
  "UNCERTAINTY",
  "COMPLIANCE",
] as const;

export const METHODOLOGY_DATA_TYPES = [
  "NUMBER",
  "INTEGER",
  "PERCENT",
  "RATIO",
  "MONEY",
  "DATE",
  "BOOLEAN",
  "TEXT",
  "ENUM",
  "COUNT",
] as const;

export const METHOD_APPLICABILITY_RESULTS = [
  "METHOD_APPLICABLE",
  "METHOD_APPLICABLE_WITH_CONDITIONS",
  "METHOD_NOT_APPLICABLE",
  "METHOD_REQUIRES_PROFESSIONAL_REVIEW",
] as const;

export const METHODOLOGY_CHANGE_TYPES = [
  "NEW_RULE",
  "MODIFY_RULE",
  "REMOVE_RULE",
  "NEW_SOURCE",
  "SOURCE_SUPERSEDED",
  "FORMULA_CHANGE",
  "PARAMETER_CHANGE",
  "SCOPE_CHANGE",
  "TEST_CHANGE",
  "BUG_FIX",
] as const;

export const METHODOLOGY_CONFLICT_STATUSES = [
  "OPEN",
  "UNDER_ANALYSIS",
  "RESOLVED",
  "NOT_A_CONFLICT",
] as const;

export type MethodologyVerificationType = (typeof METHODOLOGY_VERIFICATION_TYPES)[number];
export type MethodSpecStatus = (typeof METHOD_SPEC_STATUSES)[number];
export type MethodologyAccessStatus = (typeof METHODOLOGY_ACCESS_STATUSES)[number];

/** Rótulos de interface. Não são texto normativo. */
export const ACCESS_STATUS_LABEL: Record<string, string> = {
  METADATA_ONLY: "Somente metadados",
  PUBLICLY_ACCESSIBLE: "Publicamente acessível",
  USER_PROVIDED_COPY: "Cópia fornecida pelo usuário",
  LICENSED_COPY: "Cópia licenciada",
  INTERNAL_AUTHORIZED_COPY: "Cópia interna autorizada",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  METADATA_VERIFIED: "Metadados verificados",
  CONTENT_VERIFIED: "Conteúdo verificado",
  LOCATOR_VERIFIED: "Localizador verificado",
};

/**
 * METADATA_ONLY nunca sustenta afirmação normativa: o texto integral não está
 * legitimamente disponível. A UI usa isto apenas para não oferecer ação
 * impossível; a recusa efetiva está no banco.
 */
export function allowsContentVerification(accessStatus: string): boolean {
  return accessStatus !== "METADATA_ONLY";
}

export interface CompletenessReport {
  specification_id: string;
  status: string;
  is_complete: boolean;
  is_approvable: boolean;
  completed_requirements: string[];
  missing_requirements: string[];
  blockers: string[];
  warnings: string[];
}

export interface IntegrityReport {
  specification_id: string;
  result: "VALID" | "INVALID" | "NOT_SEALED";
  stored_hash?: string | null;
  recomputed_hash?: string | null;
  hash_algorithm?: string | null;
  manifest_schema_version?: string | null;
  manifest_equal?: boolean;
  status?: string;
}

/* ===================================================================== */
/* Contratos de leitura explícitos (sem `any`).                          */
/* Espelham as colunas reais do PostgreSQL. O banco continua autoridade. */
/* ===================================================================== */

export type MethodologySourceType = (typeof METHODOLOGY_SOURCE_TYPES)[number];
export type MethodologyAuthorityLevel = (typeof METHODOLOGY_AUTHORITY_LEVELS)[number];
export type MethodologySourceStatus = (typeof METHODOLOGY_SOURCE_STATUSES)[number];
export type MethodologyJurisdiction = (typeof METHODOLOGY_JURISDICTIONS)[number];
export type MethodologyLocatorType = (typeof METHODOLOGY_LOCATOR_TYPES)[number];
export type MethodologyRuleType = (typeof METHODOLOGY_RULE_TYPES)[number];
export type MethodologyNormativeStrength = (typeof METHODOLOGY_NORMATIVE_STRENGTHS)[number];
export type MethodologySourceRelationship = (typeof METHODOLOGY_SOURCE_RELATIONSHIPS)[number];
export type MethodSpecSectionKey = (typeof METHOD_SPEC_SECTION_KEYS)[number];
export type MethodTestType = (typeof METHOD_TEST_TYPES)[number];
export type MethodologyOutputType = (typeof METHODOLOGY_OUTPUT_TYPES)[number];
export type MethodologyDataType = (typeof METHODOLOGY_DATA_TYPES)[number];
export type MethodApplicabilityResult = (typeof METHOD_APPLICABILITY_RESULTS)[number];
export type MethodologyChangeType = (typeof METHODOLOGY_CHANGE_TYPES)[number];
export type MethodologyConflictStatus = (typeof METHODOLOGY_CONFLICT_STATUSES)[number];

export interface MethodologySource {
  id: string;
  organization_id: string | null;
  title: string;
  short_title: string | null;
  source_type: MethodologySourceType;
  issuing_body: string | null;
  authors: string | null;
  edition: string | null;
  publication_year: number | null;
  publication_date: string | null;
  effective_from: string | null;
  effective_until: string | null;
  jurisdiction: MethodologyJurisdiction;
  jurisdiction_detail: string | null;
  language: string | null;
  identifier: string | null;
  isbn: string | null;
  doi: string | null;
  external_url: string | null;
  access_status: MethodologyAccessStatus;
  authority_level: MethodologyAuthorityLevel;
  status: MethodologySourceStatus;
  supersedes_source_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceArtifact {
  id: string;
  organization_id: string;
  source_id: string;
  evidence_artifact_id: string;
  access_basis: MethodologyAccessStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SourceLocator {
  id: string;
  organization_id: string | null;
  source_id: string;
  artifact_id: string | null;
  locator_type: MethodologyLocatorType;
  section: string | null;
  clause: string | null;
  page: string | null;
  chapter: string | null;
  figure: string | null;
  table_reference: string | null;
  external_anchor: string | null;
  support_excerpt: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceVerification {
  id: string;
  organization_id: string;
  source_id: string;
  locator_id: string | null;
  verification_type: MethodologyVerificationType;
  notes: string | null;
  verified_by: string;
  verified_at: string;
}

export interface SourceConflict {
  id: string;
  organization_id: string;
  source_a_id: string;
  source_b_id: string;
  subject: string;
  description: string | null;
  is_critical: boolean;
  resolution_status: MethodologyConflictStatus;
  professional_resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValuationMethod {
  id: string;
  organization_id: string | null;
  code: string;
  name: string;
  family_code: string;
  description: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodSpecification {
  id: string;
  organization_id: string | null;
  valuation_method_id: string;
  version: string;
  title: string;
  purpose: string | null;
  scope: string | null;
  jurisdiction: MethodologyJurisdiction;
  status: MethodSpecStatus;
  effective_from: string | null;
  effective_until: string | null;
  specification_manifest: unknown;
  specification_hash: string | null;
  hash_algorithm: string | null;
  manifest_schema_version: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  submitted_for_review_at: string | null;
  submitted_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  review_notes: string | null;
  supersedes_specification_id: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

export interface SpecificationSection {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  section_key: MethodSpecSectionKey;
  content: string | null;
  ordinal: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodologyRule {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  rule_code: string;
  title: string;
  rule_type: MethodologyRuleType;
  description: string | null;
  normative_strength: MethodologyNormativeStrength;
  status: string;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RuleSource {
  id: string;
  organization_id: string | null;
  rule_id: string;
  source_id: string;
  source_locator_id: string | null;
  support_excerpt: string | null;
  relationship_type: MethodologySourceRelationship;
  interpretation_notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MethodologyFormula {
  id: string;
  organization_id: string | null;
  rule_id: string;
  formula_code: string;
  name: string;
  expression: string;
  expression_language: "SYMBOLIC";
  description: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormulaVariable {
  id: string;
  organization_id: string | null;
  formula_id: string;
  variable_code: string;
  name: string;
  description: string | null;
  data_type: MethodologyDataType;
  unit_code: string | null;
  input_semantic: string | null;
  required: boolean;
  constraints: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodologyParameter {
  id: string;
  organization_id: string | null;
  method_specification_id: string | null;
  parameter_code: string;
  name: string;
  data_type: MethodologyDataType;
  unit_code: string | null;
  default_value: number | null;
  min_value: number | null;
  max_value: number | null;
  source_required: boolean;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParameterSet {
  id: string;
  organization_id: string;
  method_specification_id: string;
  set_code: string;
  version: string;
  scope_description: string | null;
  effective_from: string | null;
  effective_until: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicabilityRule {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  criterion_code: string;
  criterion_description: string;
  expected_result: MethodApplicabilityResult;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodTestCase {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  test_code: string;
  title: string;
  test_type: MethodTestType;
  input_fixture: unknown;
  expected_result: unknown;
  expected_status: string | null;
  source_reference: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MethodOutputContract {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  output_type: MethodologyOutputType;
  description: string | null;
  unit_code: string | null;
  required: boolean;
  created_at: string;
  updated_at: string;
}

export interface MethodImplementation {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  implementation_code: string;
  version: string;
  status: string;
  runtime: string | null;
  checksum: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface MethodChangeRequest {
  id: string;
  organization_id: string;
  target_type: string;
  target_id: string | null;
  change_type: MethodologyChangeType;
  description: string;
  reason: string;
  proposed_by: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceRequirementChecklist {
  id: string;
  organization_id: string | null;
  method_specification_id: string;
  requirement_code: string;
  description: string;
  satisfied_by_source_id: string | null;
  is_satisfied: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SpecificationCompleteness = CompletenessReport;
export type SpecificationIntegrity = IntegrityReport;

/* ============================ rótulos e leituras factuais ============ */

export const NORMATIVE_STRENGTH_LABEL: Record<string, string> = {
  MANDATORY: "Obrigatório",
  RECOMMENDED: "Recomendado",
  PERMITTED: "Permitido",
  PROHIBITED: "Proibido",
  INTERNAL_CONTROL: "Controle interno da plataforma",
};

export const RELATIONSHIP_LABEL: Record<string, string> = {
  DIRECT_REQUIREMENT: "Exigência direta da fonte",
  DIRECT_PROHIBITION: "Proibição direta da fonte",
  TECHNICAL_SUPPORT: "Suporte técnico",
  INTERPRETATION: "Interpretação",
  BACKGROUND: "Contexto",
  INTERNAL_DESIGN: "Desenho interno da plataforma",
};

export const SPEC_SECTION_LABEL: Record<MethodSpecSectionKey, string> = {
  PURPOSE: "Finalidade",
  INTENDED_USE: "Uso pretendido",
  APPLICABILITY: "Aplicabilidade",
  NON_APPLICABILITY: "Não aplicabilidade",
  REQUIRED_INPUTS: "Insumos obrigatórios",
  OPTIONAL_INPUTS: "Insumos opcionais",
  DATA_REQUIREMENTS: "Requisitos de dados",
  RULES: "Regras",
  FORMULAS: "Fórmulas",
  ASSUMPTIONS: "Pressupostos",
  DIAGNOSTICS: "Diagnósticos",
  LIMITATIONS: "Limitações",
  OUTPUTS: "Saídas",
  UNCERTAINTY: "Incerteza",
  REPORTING_REQUIREMENTS: "Requisitos de relato",
  SOURCE_REFERENCES: "Referências de fonte",
  TEST_REQUIREMENTS: "Requisitos de teste",
  KNOWN_RISKS: "Riscos conhecidos",
};

/** Seções exigidas pelo diagnóstico determinístico do banco. */
export const REQUIRED_SPEC_SECTIONS: readonly MethodSpecSectionKey[] = [
  "PURPOSE",
  "INTENDED_USE",
  "APPLICABILITY",
  "NON_APPLICABILITY",
  "REQUIRED_INPUTS",
  "DATA_REQUIREMENTS",
  "RULES",
  "LIMITATIONS",
  "TEST_REQUIREMENTS",
  "OUTPUTS",
] as const;

/** Contagem factual de seções preenchidas. Nunca "percentual de confiança". */
export function countFilledSections(sections: readonly SpecificationSection[]): {
  filled: number;
  total: number;
} {
  const total = METHOD_SPEC_SECTION_KEYS.length;
  const filled = sections.filter((s) => (s.content ?? "").trim().length > 0).length;
  return { filled, total };
}

/** Uma especificação APPROVED/SUPERSEDED/REJECTED nunca é editável pelo cliente. */
export function isSpecificationEditable(status: MethodSpecStatus): boolean {
  return status === "DRAFT";
}

/** Afirmação normativa externa direta. INTERNAL_DESIGN nunca é norma externa. */
export function isExternalNormativeClaim(relationship: MethodologySourceRelationship): boolean {
  return relationship === "DIRECT_REQUIREMENT" || relationship === "DIRECT_PROHIBITION";
}

/**
 * Texto de fórmula é REGISTRO SIMBÓLICO, nunca código executável.
 * Nenhuma camada deste produto avalia expressão (`eval`, `new Function`, SQL dinâmico).
 * Este detector existe apenas para recusar payload executável na entrada.
 */
const EXECUTABLE_PAYLOAD = /(\beval\b|new\s+Function|=>|\bimport\b|\brequire\b|`|;|\$\{|\bprocess\b|\bwindow\b|\bglobalThis\b|\bfetch\b|--|\/\*|\bselect\b\s|\bdrop\b\s)/i;

export function looksExecutable(expression: string): boolean {
  return EXECUTABLE_PAYLOAD.test(expression);
}

/** Diagnóstico de prontidão de fonte (RPC `methodology_source_readiness`). */
export interface SourceReadinessReport {
  source_id: string;
  scope: "GLOBAL_METADATA" | "ORGANIZATION";
  global_access_status: string;
  organization_access_basis: string | null;
  artifacts_in_organization: number;
  metadata_verified: boolean;
  content_verified: boolean;
  locators_total: number;
  locators_verified: number;
  state:
    | "BLOCKED_BY_USER_ARTIFACT"
    | "PENDING_METADATA_VERIFICATION"
    | "PENDING_CONTENT_VERIFICATION"
    | "SOURCE_READY_FOR_RULE_REVIEW";
  locator_backed_claims_allowed: boolean;
  blockers: string[];
}

export const SOURCE_READINESS_LABEL: Record<string, string> = {
  BLOCKED_BY_USER_ARTIFACT: "Bloqueada — sem documento autorizado nesta organização",
  PENDING_METADATA_VERIFICATION: "Pendente de verificação de metadados",
  PENDING_CONTENT_VERIFICATION: "Pendente de verificação de conteúdo",
  SOURCE_READY_FOR_RULE_REVIEW: "Pronta para revisão de regras",
};

export const READINESS_BLOCKER_LABEL: Record<string, string> = {
  NO_AUTHORIZED_ARTIFACT_IN_THIS_ORGANIZATION:
    "Nenhum documento autorizado com base de acesso legítima nesta organização",
  METADATA_NOT_VERIFIED: "Metadados ainda não conferidos por humano",
  CONTENT_NOT_VERIFIED: "Conteúdo ainda não conferido contra o documento",
  NO_VERIFIED_LOCATOR: "Nenhum localizador verificado (seção/cláusula/página)",
};
