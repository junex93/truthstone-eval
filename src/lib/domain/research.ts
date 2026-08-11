/**
 * PHASE 4 — Property Intelligence Research Engine vocabulary.
 *
 * AI discovers. The source supports. The system checks deterministically.
 * A human verifies. Only then may a value reach the valuation domain.
 *
 * Nothing in this file assigns weight, score or confidence to a value.
 */

import type { FieldState } from "@/lib/domain/constants";

export const RESEARCH_TYPES = [
  "SUBJECT_PROPERTY_FACTS",
  "COMPARABLE_DISCOVERY",
  "TRANSACTION_DISCOVERY",
  "MARKET_DISCOVERY",
] as const;
export type ResearchType = (typeof RESEARCH_TYPES)[number];

export const RESEARCH_TYPE_LABELS: Record<ResearchType, string> = {
  SUBJECT_PROPERTY_FACTS: "Fatos do imóvel avaliando",
  COMPARABLE_DISCOVERY: "Descoberta de comparáveis (ofertas)",
  TRANSACTION_DISCOVERY: "Descoberta de transações",
  MARKET_DISCOVERY: "Contexto de mercado",
};

export const RESEARCH_RUN_STATUSES = [
  "DRAFT",
  "PLANNING",
  "PLAN_READY",
  "SEARCHING",
  "RESULTS_READY",
  "CAPTURING",
  "EXTRACTING",
  "REVIEW_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type ResearchRunStatus = (typeof RESEARCH_RUN_STATUSES)[number];

export const RESEARCH_RUN_STATUS_LABELS: Record<ResearchRunStatus, string> = {
  DRAFT: "Rascunho",
  PLANNING: "Planejando consultas",
  PLAN_READY: "Plano pronto",
  SEARCHING: "Buscando fontes",
  RESULTS_READY: "Resultados disponíveis",
  CAPTURING: "Capturando conteúdo",
  EXTRACTING: "Extraindo candidatos",
  REVIEW_REQUIRED: "Aguardando revisão humana",
  COMPLETED: "Concluída",
  FAILED: "Falhou",
  CANCELLED: "Cancelada",
};

export const RESEARCH_CANDIDATE_TYPES = [
  "MARKET_PROPERTY",
  "SALE_LISTING",
  "CLOSED_SALE",
  "RENT_LISTING",
  "CLOSED_RENT",
  "SUBJECT_PROPERTY_INFORMATION",
] as const;
export type ResearchCandidateType = (typeof RESEARCH_CANDIDATE_TYPES)[number];

export const RESEARCH_CANDIDATE_TYPE_LABELS: Record<ResearchCandidateType, string> = {
  MARKET_PROPERTY: "Imóvel de mercado",
  SALE_LISTING: "Oferta de venda",
  CLOSED_SALE: "Venda concretizada",
  RENT_LISTING: "Oferta de locação",
  CLOSED_RENT: "Locação contratada",
  SUBJECT_PROPERTY_INFORMATION: "Informação do imóvel avaliando",
};

export const RESEARCH_CANDIDATE_STATUSES = [
  "DISCOVERED",
  "CAPTURED",
  "EXTRACTED",
  "REVIEW_REQUIRED",
  "READY_TO_PROMOTE",
  "PROMOTED",
  "REJECTED",
] as const;
export type ResearchCandidateStatus = (typeof RESEARCH_CANDIDATE_STATUSES)[number];

export const RESEARCH_CANDIDATE_STATUS_LABELS: Record<ResearchCandidateStatus, string> = {
  DISCOVERED: "Localizado",
  CAPTURED: "Capturado",
  EXTRACTED: "Extraído",
  REVIEW_REQUIRED: "Requer revisão",
  READY_TO_PROMOTE: "Pronto para promoção",
  PROMOTED: "Promovido ao acervo",
  REJECTED: "Rejeitado",
};

export const RESEARCH_SELECTION_STATUSES = ["UNREVIEWED", "SELECTED", "REJECTED"] as const;
export type ResearchSelectionStatus = (typeof RESEARCH_SELECTION_STATUSES)[number];

export const RESEARCH_CAPTURE_STATUSES = [
  "NOT_CAPTURED",
  "CAPTURING",
  "CAPTURED",
  "FAILED",
  "ACCESS_RESTRICTED",
  "BLOCKED_BY_POLICY",
  "DUPLICATE",
] as const;
export type ResearchCaptureStatus = (typeof RESEARCH_CAPTURE_STATUSES)[number];

export const RESEARCH_CAPTURE_STATUS_LABELS: Record<ResearchCaptureStatus, string> = {
  NOT_CAPTURED: "Não capturado",
  CAPTURING: "Capturando",
  CAPTURED: "Capturado",
  FAILED: "Falha na captura",
  ACCESS_RESTRICTED: "Acesso restrito",
  BLOCKED_BY_POLICY: "Bloqueado por política",
  DUPLICATE: "Duplicado",
};

export const CAPTURE_METHODS = [
  "ANTHROPIC_WEB_SEARCH_RESULT",
  "ANTHROPIC_WEB_FETCH",
  "DIRECT_HTTP",
  "USER_UPLOAD",
  "EXTERNAL_API",
  "OTHER",
] as const;
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

export const CAPTURE_METHOD_LABELS: Record<CaptureMethod, string> = {
  ANTHROPIC_WEB_SEARCH_RESULT: "Resultado de busca do provedor",
  ANTHROPIC_WEB_FETCH: "Busca de página pelo provedor",
  DIRECT_HTTP: "Requisição HTTP direta",
  USER_UPLOAD: "Envio manual",
  EXTERNAL_API: "API externa",
  OTHER: "Outro",
};

export const DOMAIN_POLICY_STATUSES = ["ALLOWED", "REVIEW_REQUIRED", "BLOCKED"] as const;
export type DomainPolicyStatus = (typeof DOMAIN_POLICY_STATUSES)[number];

export const DOMAIN_POLICY_STATUS_LABELS: Record<DomainPolicyStatus, string> = {
  ALLOWED: "Permitido",
  REVIEW_REQUIRED: "Requer confirmação",
  BLOCKED: "Bloqueado",
};

/** What the model CLAIMS about the support of a value. Never trusted as-is. */
export const EXTRACTION_SUPPORT_STATUSES = [
  "EXPLICIT_TEXT",
  "EXPLICIT_STRUCTURED_DATA",
  "VISUAL_EVIDENCE",
  "AMBIGUOUS",
  "NOT_FOUND",
  "UNSUPPORTED",
] as const;
export type ExtractionSupportStatus = (typeof EXTRACTION_SUPPORT_STATUSES)[number];

export const EXTRACTION_SUPPORT_STATUS_LABELS: Record<ExtractionSupportStatus, string> = {
  EXPLICIT_TEXT: "Texto explícito",
  EXPLICIT_STRUCTURED_DATA: "Dado estruturado explícito",
  VISUAL_EVIDENCE: "Evidência visual",
  AMBIGUOUS: "Ambíguo",
  NOT_FOUND: "Não encontrado",
  UNSUPPORTED: "Sem suporte na fonte",
};

/** What the SYSTEM proved by re-reading the captured content. This is the authority. */
export const SUPPORT_CHECK_STATUSES = [
  "EXACT_MATCH",
  "NORMALIZED_MATCH",
  "VISUAL_ONLY",
  "FAILED",
  "NOT_APPLICABLE",
] as const;
export type SupportCheckStatus = (typeof SUPPORT_CHECK_STATUSES)[number];

export const SUPPORT_CHECK_STATUS_LABELS: Record<SupportCheckStatus, string> = {
  EXACT_MATCH: "Trecho conferido (idêntico)",
  NORMALIZED_MATCH: "Trecho conferido (normalizado)",
  VISUAL_ONLY: "Apenas evidência visual",
  FAILED: "Trecho NÃO localizado na fonte",
  NOT_APPLICABLE: "Não aplicável",
};

export const RESEARCH_ISSUE_TYPES = [
  "EXCERPT_NOT_FOUND_IN_SOURCE",
  "NUMERIC_VALUE_NOT_IN_EXCERPT",
  "NUMERIC_CONFLICT_WITH_PARSER",
  "FIELD_NAME_OUTSIDE_ALLOWLIST",
  "CONFLICTING_VALUES_IN_SOURCE",
  "AMBIGUOUS_SUPPORT",
  "ADVERSARIAL_CONTENT_SUSPECTED",
  "UNPARSABLE_VALUE",
  "TRANSACTION_CLAIM_WITHOUT_DOCUMENT",
  "TRANSACTION_CLAIM_FROM_ASKING_PRICE",
] as const;
export type ResearchIssueType = (typeof RESEARCH_ISSUE_TYPES)[number];

export const RESEARCH_ISSUE_TYPE_LABELS: Record<ResearchIssueType, string> = {
  EXCERPT_NOT_FOUND_IN_SOURCE: "Trecho citado não existe no conteúdo capturado",
  NUMERIC_VALUE_NOT_IN_EXCERPT: "Número extraído não aparece no trecho citado",
  NUMERIC_CONFLICT_WITH_PARSER: "Número declarado pela IA divergente do parser determinístico",
  FIELD_NAME_OUTSIDE_ALLOWLIST: "Campo fora do vocabulário permitido",
  CONFLICTING_VALUES_IN_SOURCE: "Valores divergentes na mesma fonte",
  AMBIGUOUS_SUPPORT: "Suporte declarado como ambíguo",
  ADVERSARIAL_CONTENT_SUSPECTED: "Suspeita de conteúdo adversarial na fonte",
  UNPARSABLE_VALUE: "Valor não interpretável de forma determinística",
  TRANSACTION_CLAIM_WITHOUT_DOCUMENT: "Alegação de transação sem documento de suporte",
  TRANSACTION_CLAIM_FROM_ASKING_PRICE: "Alegação de transação apoiada em preço pedido",
};

/** Data kinds drive the deterministic parser used for a field. */
export type ResearchFieldKind = "TEXT" | "NUMBER" | "MONEY" | "DATE";

export interface ResearchFieldDefinition {
  fieldName: string;
  kind: ResearchFieldKind;
  appliesTo: "PROPERTY" | "OBSERVATION";
  unit?: string;
  label: string;
}

export const RESEARCH_FIELD_TAXONOMY_VERSION = "valuation.research.fields/1";

/**
 * CLOSED allowlist. A model may only emit these field names. Anything else is
 * discarded and recorded as an extraction issue — the AI cannot invent schema.
 * Mirrors public.research_field_taxonomy (the database is the authority).
 */
export const RESEARCH_FIELD_DEFINITIONS: readonly ResearchFieldDefinition[] = [
  { fieldName: "property_type", kind: "TEXT", appliesTo: "PROPERTY", label: "Tipologia declarada" },
  {
    fieldName: "address_raw",
    kind: "TEXT",
    appliesTo: "PROPERTY",
    label: "Endereço como publicado",
  },
  { fieldName: "street_name", kind: "TEXT", appliesTo: "PROPERTY", label: "Logradouro" },
  { fieldName: "street_number", kind: "TEXT", appliesTo: "PROPERTY", label: "Número" },
  { fieldName: "complement", kind: "TEXT", appliesTo: "PROPERTY", label: "Complemento" },
  { fieldName: "district", kind: "TEXT", appliesTo: "PROPERTY", label: "Bairro" },
  { fieldName: "city", kind: "TEXT", appliesTo: "PROPERTY", label: "Cidade" },
  { fieldName: "state", kind: "TEXT", appliesTo: "PROPERTY", label: "UF" },
  { fieldName: "postal_code", kind: "TEXT", appliesTo: "PROPERTY", label: "CEP" },
  { fieldName: "development_name", kind: "TEXT", appliesTo: "PROPERTY", label: "Empreendimento" },
  {
    fieldName: "private_area",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    unit: "m2",
    label: "Área privativa",
  },
  {
    fieldName: "usable_area",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    unit: "m2",
    label: "Área útil",
  },
  {
    fieldName: "built_area",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    unit: "m2",
    label: "Área construída",
  },
  {
    fieldName: "total_area",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    unit: "m2",
    label: "Área total",
  },
  {
    fieldName: "land_area",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    unit: "m2",
    label: "Área do terreno",
  },
  { fieldName: "bedrooms", kind: "NUMBER", appliesTo: "PROPERTY", label: "Dormitórios" },
  { fieldName: "suites", kind: "NUMBER", appliesTo: "PROPERTY", label: "Suítes" },
  { fieldName: "bathrooms", kind: "NUMBER", appliesTo: "PROPERTY", label: "Banheiros" },
  { fieldName: "parking_spaces", kind: "NUMBER", appliesTo: "PROPERTY", label: "Vagas" },
  { fieldName: "floor_number", kind: "NUMBER", appliesTo: "PROPERTY", label: "Andar" },
  {
    fieldName: "construction_year",
    kind: "NUMBER",
    appliesTo: "PROPERTY",
    label: "Ano de construção",
  },
  { fieldName: "condition_status", kind: "TEXT", appliesTo: "PROPERTY", label: "Estado declarado" },
  {
    fieldName: "asking_price",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "Preço pedido",
  },
  {
    fieldName: "transaction_price",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "Preço transacionado",
  },
  {
    fieldName: "asking_monthly_rent",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "Aluguel pedido",
  },
  {
    fieldName: "contracted_monthly_rent",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "Aluguel contratado",
  },
  {
    fieldName: "publication_date",
    kind: "DATE",
    appliesTo: "OBSERVATION",
    label: "Data de publicação",
  },
  {
    fieldName: "transaction_date",
    kind: "DATE",
    appliesTo: "OBSERVATION",
    label: "Data da transação",
  },
  {
    fieldName: "condo_fee",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "Condomínio",
  },
  {
    fieldName: "property_tax",
    kind: "MONEY",
    appliesTo: "OBSERVATION",
    unit: "BRL",
    label: "IPTU",
  },
  { fieldName: "broker_name", kind: "TEXT", appliesTo: "OBSERVATION", label: "Anunciante" },
  {
    fieldName: "external_listing_id",
    kind: "TEXT",
    appliesTo: "OBSERVATION",
    label: "Código do anúncio",
  },
  {
    fieldName: "listing_status",
    kind: "TEXT",
    appliesTo: "OBSERVATION",
    label: "Situação do anúncio",
  },
] as const;

export const RESEARCH_FIELD_NAMES: readonly string[] = RESEARCH_FIELD_DEFINITIONS.map(
  (d) => d.fieldName,
);

export function findResearchField(fieldName: string): ResearchFieldDefinition | undefined {
  return RESEARCH_FIELD_DEFINITIONS.find((d) => d.fieldName === fieldName);
}

/** Fields that describe a transacted price. Never derivable from an offer. */
export const TRANSACTION_FIELD_NAMES: readonly string[] = [
  "transaction_price",
  "contracted_monthly_rent",
  "transaction_date",
];

/**
 * Maps the support status DECLARED by the model to the explicit absence state of
 * the field. A model that says "not found" produces an explicit NOT_FOUND
 * candidate — never a zero, never a guess.
 */
export const SUPPORT_STATUS_TO_FIELD_STATE: Record<ExtractionSupportStatus, FieldState> = {
  EXPLICIT_TEXT: "PRESENT",
  EXPLICIT_STRUCTURED_DATA: "PRESENT",
  VISUAL_EVIDENCE: "NOT_VERIFIABLE",
  AMBIGUOUS: "NOT_VERIFIABLE",
  NOT_FOUND: "NOT_FOUND",
  UNSUPPORTED: "NOT_VERIFIABLE",
};

/** Server-side hard ceilings. A client cannot ask for more than this. */
export const RESEARCH_BUDGET_LIMITS = {
  maxSearchUses: 10,
  maxSources: 50,
  maxFetches: 25,
  maxExtractions: 25,
  /** AI calls per user per rolling hour, across all runs. */
  aiCallsPerUserPerHour: 40,
  /** AI calls per organization per rolling hour. */
  aiCallsPerOrgPerHour: 120,
  /** Research runs started per user per rolling hour. */
  runsPerUserPerHour: 12,
} as const;

export const RESEARCH_USAGE_TYPES = [
  "PLAN_QUERIES",
  "SEARCH",
  "FETCH",
  "EXTRACT",
  "RUN_STARTED",
] as const;
export type ResearchUsageType = (typeof RESEARCH_USAGE_TYPES)[number];
