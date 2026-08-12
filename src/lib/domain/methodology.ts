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
