/**
 * Domain vocabulary. Single source of truth for labels and allowed transitions.
 * No valuation logic lives here — this phase only builds the evidence foundation.
 */

export const ORG_ROLES = ["OWNER", "ADMIN", "VALUER", "REVIEWER", "VIEWER"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: "Titular",
  ADMIN: "Administrador",
  VALUER: "Avaliador",
  REVIEWER: "Revisor",
  VIEWER: "Consulta",
};

export const CASE_STATUSES = [
  "DRAFT",
  "EVIDENCE_COLLECTION",
  "DATA_REVIEW",
  "DATASET_FROZEN",
  "VALUATION",
  "REVIEW",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Rascunho",
  EVIDENCE_COLLECTION: "Coleta de evidências",
  DATA_REVIEW: "Revisão de dados",
  DATASET_FROZEN: "Dataset congelado",
  VALUATION: "Avaliação",
  REVIEW: "Revisão técnica",
  COMPLETED: "Concluído",
  ARCHIVED: "Arquivado",
};

/** Server-side transition rules. The frontend is never the boundary. */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  DRAFT: ["EVIDENCE_COLLECTION", "ARCHIVED"],
  EVIDENCE_COLLECTION: ["DATA_REVIEW", "DRAFT", "ARCHIVED"],
  DATA_REVIEW: ["EVIDENCE_COLLECTION", "DATASET_FROZEN", "ARCHIVED"],
  DATASET_FROZEN: ["VALUATION", "DATA_REVIEW", "ARCHIVED"],
  VALUATION: ["REVIEW", "ARCHIVED"],
  REVIEW: ["VALUATION", "COMPLETED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  ARCHIVED: [],
};

export const SOURCE_TYPES = [
  "OFFICIAL_PUBLIC_SOURCE",
  "PUBLIC_REGISTRY",
  "PRIVATE_DOCUMENT",
  "TRANSACTION_EVIDENCE",
  "REAL_ESTATE_LISTING",
  "BROKER_INFORMATION",
  "USER_PROVIDED",
  "FIELD_INSPECTION",
  "OTHER",
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  OFFICIAL_PUBLIC_SOURCE: "Fonte pública oficial",
  PUBLIC_REGISTRY: "Registro público",
  PRIVATE_DOCUMENT: "Documento privado",
  TRANSACTION_EVIDENCE: "Evidência de transação",
  REAL_ESTATE_LISTING: "Anúncio imobiliário",
  BROKER_INFORMATION: "Informação de corretor",
  USER_PROVIDED: "Fornecido pelo usuário",
  FIELD_INSPECTION: "Inspeção em campo",
  OTHER: "Outra",
};

export const PROCESSOR_TYPES = [
  "MANUAL",
  "DETERMINISTIC_PARSER",
  "OCR",
  "LLM",
  "COMPUTER_VISION",
  "EXTERNAL_API",
] as const;
export type ProcessorType = (typeof PROCESSOR_TYPES)[number];

export const PROCESSOR_TYPE_LABELS: Record<ProcessorType, string> = {
  MANUAL: "Manual",
  DETERMINISTIC_PARSER: "Parser determinístico",
  OCR: "OCR",
  LLM: "LLM",
  COMPUTER_VISION: "Visão computacional",
  EXTERNAL_API: "API externa",
};

export const VALIDATION_STATUSES = [
  "CAPTURED",
  "EXTRACTED",
  "PENDING_REVIEW",
  "VERIFIED",
  "REJECTED",
] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const VALIDATION_STATUS_LABELS: Record<ValidationStatus, string> = {
  CAPTURED: "Capturado",
  EXTRACTED: "Extraído",
  PENDING_REVIEW: "Pendente de revisão",
  VERIFIED: "Verificado",
  REJECTED: "Rejeitado",
};

export const FIELD_STATES = [
  "PRESENT",
  "NOT_FOUND",
  "NOT_INFORMED",
  "NOT_VERIFIABLE",
  "DIVERGENT",
  "PENDING_VALIDATION",
] as const;
export type FieldState = (typeof FIELD_STATES)[number];

export const FIELD_STATE_LABELS: Record<FieldState, string> = {
  PRESENT: "Presente",
  NOT_FOUND: "Não encontrado",
  NOT_INFORMED: "Não informado",
  NOT_VERIFIABLE: "Não verificável",
  DIVERGENT: "Divergente",
  PENDING_VALIDATION: "Pendente de validação",
};

/** Dimensions reserved for a future Evidence Confidence Score. Not scored yet. */
export const EVIDENCE_QUALITY_DIMENSIONS = [
  "Qualidade da fonte",
  "Completude",
  "Atualidade",
  "Relevância espacial",
  "Relevância temporal",
  "Consistência interna",
  "Confirmação cruzada",
  "Qualidade da extração",
  "Validação humana",
] as const;

export const AUDIT_EVENT_TYPES = [
  "CASE_CREATED",
  "CASE_STATUS_CHANGED",
  "CASE_UPDATED",
  "PROPERTY_CREATED",
  "PROPERTY_UPDATED",
  "EVIDENCE_SOURCE_CREATED",
  "ARTIFACT_CAPTURED",
  "EXTRACTION_CREATED",
  "FIELD_CREATED",
  "FIELD_VERIFIED",
  "FIELD_REJECTED",
  "DATASET_CREATED",
  "DATASET_ITEM_ADDED",
  "DATASET_ITEM_REMOVED",
  "DATASET_FROZEN",
  "ORGANIZATION_CREATED",
  "USER_ROLE_CHANGED",
] as const;
export type AuditEventType =
  | (typeof AUDIT_EVENT_TYPES)[number]
  | "FIELD_REVISED"
  | MarketAuditEventType
  | ResearchAuditEventType
  | IntelligenceAuditEventType
  | MethodologyAuditEventType;


/* ==========================================================================
 * PHASE 3 — property & comparable intelligence vocabulary.
 * Classification only. No coefficient, weight or score is attached to any of
 * these values: taxonomy is not methodology.
 * ========================================================================== */

export const PROPERTY_TYPE_CODES = [
  "APARTMENT",
  "HOUSE",
  "CONDOMINIUM_HOUSE",
  "PENTHOUSE",
  "STUDIO",
  "RESIDENTIAL_LAND",
  "COMMERCIAL_ROOM",
  "OFFICE",
  "RETAIL",
  "WAREHOUSE",
  "LOGISTICS_PROPERTY",
  "INDUSTRIAL_PROPERTY",
  "COMMERCIAL_BUILDING",
  "MIXED_USE",
  "URBAN_LAND",
  "RURAL_PROPERTY",
  "OTHER",
] as const;
export type PropertyTypeCode = (typeof PROPERTY_TYPE_CODES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyTypeCode, string> = {
  APARTMENT: "Apartamento",
  HOUSE: "Casa",
  CONDOMINIUM_HOUSE: "Casa em condomínio",
  PENTHOUSE: "Cobertura",
  STUDIO: "Studio / kitnet",
  RESIDENTIAL_LAND: "Terreno residencial",
  COMMERCIAL_ROOM: "Sala comercial",
  OFFICE: "Escritório",
  RETAIL: "Loja / varejo",
  WAREHOUSE: "Galpão",
  LOGISTICS_PROPERTY: "Imóvel logístico",
  INDUSTRIAL_PROPERTY: "Imóvel industrial",
  COMMERCIAL_BUILDING: "Edifício comercial",
  MIXED_USE: "Uso misto",
  URBAN_LAND: "Terreno urbano",
  RURAL_PROPERTY: "Imóvel rural",
  OTHER: "Outro",
};

export const KNOWLEDGE_STATES = [
  "KNOWN",
  "UNKNOWN",
  "NOT_APPLICABLE",
  "CONFLICTING",
  "PENDING_VERIFICATION",
] as const;
export type KnowledgeState = (typeof KNOWLEDGE_STATES)[number];

export const KNOWLEDGE_STATE_LABELS: Record<KnowledgeState, string> = {
  KNOWN: "Conhecido",
  UNKNOWN: "Desconhecido",
  NOT_APPLICABLE: "Não aplicável",
  CONFLICTING: "Divergente",
  PENDING_VERIFICATION: "Pendente de verificação",
};

export const ADDRESS_NORMALIZATION_STATUSES = [
  "NOT_ATTEMPTED",
  "CANDIDATE",
  "VERIFIED",
  "AMBIGUOUS",
  "FAILED",
] as const;
export type AddressNormalizationStatus = (typeof ADDRESS_NORMALIZATION_STATUSES)[number];

export const ADDRESS_NORMALIZATION_STATUS_LABELS: Record<AddressNormalizationStatus, string> = {
  NOT_ATTEMPTED: "Não tentada",
  CANDIDATE: "Candidata",
  VERIFIED: "Verificada",
  AMBIGUOUS: "Ambígua",
  FAILED: "Falhou",
};

export const DEVELOPMENT_TYPES = [
  "BUILDING",
  "GATED_COMMUNITY",
  "CONDOMINIUM",
  "MIXED_USE_COMPLEX",
  "COMMERCIAL_COMPLEX",
  "INDUSTRIAL_COMPLEX",
  "OTHER",
] as const;
export type DevelopmentType = (typeof DEVELOPMENT_TYPES)[number];

export const DEVELOPMENT_TYPE_LABELS: Record<DevelopmentType, string> = {
  BUILDING: "Edifício",
  GATED_COMMUNITY: "Condomínio fechado",
  CONDOMINIUM: "Condomínio",
  MIXED_USE_COMPLEX: "Complexo de uso misto",
  COMMERCIAL_COMPLEX: "Complexo comercial",
  INDUSTRIAL_COMPLEX: "Complexo industrial",
  OTHER: "Outro",
};

export const MARKET_OBSERVATION_TYPES = [
  "SALE_LISTING",
  "CLOSED_SALE",
  "RENT_LISTING",
  "CLOSED_RENT",
  "BROKER_QUOTE",
  "APPRAISAL_REFERENCE",
  "OTHER",
] as const;
export type MarketObservationType = (typeof MARKET_OBSERVATION_TYPES)[number];

export const MARKET_OBSERVATION_TYPE_LABELS: Record<MarketObservationType, string> = {
  SALE_LISTING: "Oferta de venda",
  CLOSED_SALE: "Venda concretizada",
  RENT_LISTING: "Oferta de locação",
  CLOSED_RENT: "Locação contratada",
  BROKER_QUOTE: "Cotação de corretor",
  APPRAISAL_REFERENCE: "Referência de avaliação",
  OTHER: "Outra",
};

/** Observation types that carry an asking (offer) price. */
export const ASKING_OBSERVATION_TYPES: readonly MarketObservationType[] = [
  "SALE_LISTING",
  "RENT_LISTING",
  "BROKER_QUOTE",
  "APPRAISAL_REFERENCE",
  "OTHER",
];

/** Observation types that carry a transacted price. Never inferred from a listing. */
export const TRANSACTION_OBSERVATION_TYPES: readonly MarketObservationType[] = [
  "CLOSED_SALE",
  "CLOSED_RENT",
];

export const MARKET_OBSERVATION_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "REMOVED",
  "EXPIRED",
  "UNKNOWN",
] as const;
export type MarketObservationStatus = (typeof MARKET_OBSERVATION_STATUSES)[number];

/** REMOVED never means SOLD. There is deliberately no "SOLD" status here. */
export const MARKET_OBSERVATION_STATUS_LABELS: Record<MarketObservationStatus, string> = {
  ACTIVE: "Ativa",
  INACTIVE: "Inativa",
  REMOVED: "Retirada",
  EXPIRED: "Expirada",
  UNKNOWN: "Desconhecida",
};

export const TRANSACTION_EVIDENCE_STATUSES = [
  "DOCUMENTED",
  "MULTI_SOURCE_CONFIRMED",
  "DECLARED",
  "UNVERIFIED",
] as const;
export type TransactionEvidenceStatus = (typeof TRANSACTION_EVIDENCE_STATUSES)[number];

/** Provenance classification only. Not a degree of precision or confidence. */
export const TRANSACTION_EVIDENCE_STATUS_LABELS: Record<TransactionEvidenceStatus, string> = {
  DOCUMENTED: "Documentada",
  MULTI_SOURCE_CONFIRMED: "Confirmada por múltiplas fontes",
  DECLARED: "Declarada",
  UNVERIFIED: "Não verificada",
};

export const VALUE_ORIGINS = [
  "MANUAL_USER_INPUT",
  "EVIDENCE_EXTRACTION",
  "EXTERNAL_API",
  "DETERMINISTIC_DERIVATION",
  "FIELD_INSPECTION",
] as const;
export type ValueOrigin = (typeof VALUE_ORIGINS)[number];

export const VALUE_ORIGIN_LABELS: Record<ValueOrigin, string> = {
  MANUAL_USER_INPUT: "Informado manualmente",
  EVIDENCE_EXTRACTION: "Extração de evidência",
  EXTERNAL_API: "API externa",
  DETERMINISTIC_DERIVATION: "Derivação determinística",
  FIELD_INSPECTION: "Inspeção em campo",
};

export const PROPERTY_MATCH_STATUSES = [
  "CANDIDATE",
  "CONFIRMED_SAME",
  "CONFIRMED_DIFFERENT",
  "UNRESOLVED",
] as const;
export type PropertyMatchStatus = (typeof PROPERTY_MATCH_STATUSES)[number];

export const PROPERTY_MATCH_STATUS_LABELS: Record<PropertyMatchStatus, string> = {
  CANDIDATE: "Possível duplicidade",
  CONFIRMED_SAME: "Mesmo imóvel",
  CONFIRMED_DIFFERENT: "Imóveis diferentes",
  UNRESOLVED: "Ainda não sei",
};

/** Deterministic signals only. No probability, no percentage, no similarity score. */
export const MATCH_REASON_CODES = [
  "SAME_NORMALIZED_ADDRESS",
  "SAME_DEVELOPMENT",
  "SAME_UNIT_IDENTIFIER",
  "SAME_AREA",
  "SAME_FLOOR",
  "SAME_EXTERNAL_LISTING_ID",
  "SAME_BROKER_REFERENCE",
  "SAME_PHONE_HASH",
  "SAME_IMAGE_HASH",
  "OTHER",
] as const;
export type MatchReasonCode = (typeof MATCH_REASON_CODES)[number];

export const MATCH_REASON_CODE_LABELS: Record<MatchReasonCode, string> = {
  SAME_NORMALIZED_ADDRESS: "Mesmo endereço normalizado",
  SAME_DEVELOPMENT: "Mesmo empreendimento",
  SAME_UNIT_IDENTIFIER: "Mesma identificação de unidade",
  SAME_AREA: "Mesma área",
  SAME_FLOOR: "Mesmo pavimento",
  SAME_EXTERNAL_LISTING_ID: "Mesmo ID de anúncio",
  SAME_BROKER_REFERENCE: "Mesma referência de corretor",
  SAME_PHONE_HASH: "Mesmo hash de telefone",
  SAME_IMAGE_HASH: "Mesmo hash de imagem",
  OTHER: "Outro sinal",
};

export const COMPARABLE_CANDIDATE_STATUSES = [
  "DISCOVERED",
  "UNDER_REVIEW",
  "ELIGIBLE",
  "INELIGIBLE",
] as const;
export type ComparableCandidateStatus = (typeof COMPARABLE_CANDIDATE_STATUSES)[number];

export const COMPARABLE_CANDIDATE_STATUS_LABELS: Record<ComparableCandidateStatus, string> = {
  DISCOVERED: "Localizado",
  UNDER_REVIEW: "Em análise",
  ELIGIBLE: "Elegível",
  INELIGIBLE: "Inelegível",
};

export const COMPARABLE_INCLUSION_STATUSES = ["NOT_DECIDED", "INCLUDED", "EXCLUDED"] as const;
export type ComparableInclusionStatus = (typeof COMPARABLE_INCLUSION_STATUSES)[number];

export const COMPARABLE_INCLUSION_STATUS_LABELS: Record<ComparableInclusionStatus, string> = {
  NOT_DECIDED: "Não decidido",
  INCLUDED: "Incluído",
  EXCLUDED: "Excluído",
};

export const SELLER_TYPES = [
  "OWNER",
  "BROKER",
  "REAL_ESTATE_AGENCY",
  "DEVELOPER",
  "UNKNOWN",
] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  OWNER: "Proprietário",
  BROKER: "Corretor",
  REAL_ESTATE_AGENCY: "Imobiliária",
  DEVELOPER: "Incorporadora",
  UNKNOWN: "Desconhecido",
};

/** Qualitative dimensions. They carry NO mathematical weight in this phase. */
export const QUALITY_DIMENSION_STATES = [
  "NOT_ASSESSED",
  "LOW",
  "MEDIUM",
  "HIGH",
  "NOT_APPLICABLE",
] as const;
export type QualityDimensionState = (typeof QUALITY_DIMENSION_STATES)[number];

export const QUALITY_DIMENSION_STATE_LABELS: Record<QualityDimensionState, string> = {
  NOT_ASSESSED: "Não avaliado",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  NOT_APPLICABLE: "Não aplicável",
};

export const OCCUPANCY_STATUSES = [
  "UNKNOWN",
  "VACANT",
  "OWNER_OCCUPIED",
  "TENANT_OCCUPIED",
  "UNDER_CONSTRUCTION",
  "OTHER",
] as const;
export type OccupancyStatus = (typeof OCCUPANCY_STATUSES)[number];

export const OCCUPANCY_STATUS_LABELS: Record<OccupancyStatus, string> = {
  UNKNOWN: "Desconhecida",
  VACANT: "Desocupado",
  OWNER_OCCUPIED: "Ocupado pelo proprietário",
  TENANT_OCCUPIED: "Ocupado por locatário",
  UNDER_CONSTRUCTION: "Em construção",
  OTHER: "Outra",
};

export const FURNISHED_STATUSES = [
  "UNKNOWN",
  "UNFURNISHED",
  "PARTIALLY_FURNISHED",
  "FURNISHED",
] as const;
export type FurnishedStatus = (typeof FURNISHED_STATUSES)[number];

export const FURNISHED_STATUS_LABELS: Record<FurnishedStatus, string> = {
  UNKNOWN: "Desconhecida",
  UNFURNISHED: "Sem mobília",
  PARTIALLY_FURNISHED: "Parcialmente mobiliado",
  FURNISHED: "Mobiliado",
};

export const CONDITION_STATUSES = [
  "UNKNOWN",
  "NEW",
  "RENOVATED",
  "GOOD",
  "REGULAR",
  "POOR",
  "UNDER_RENOVATION",
  "RUIN",
] as const;
export type ConditionStatus = (typeof CONDITION_STATUSES)[number];

export const CONDITION_STATUS_LABELS: Record<ConditionStatus, string> = {
  UNKNOWN: "Desconhecido",
  NEW: "Novo",
  RENOVATED: "Reformado",
  GOOD: "Bom",
  REGULAR: "Regular",
  POOR: "Ruim",
  UNDER_RENOVATION: "Em reforma",
  RUIN: "Em ruína",
};

/** Area basis used by a derived value. Areas are never mixed silently. */
export const AREA_BASIS = ["PRIVATE_AREA", "BUILT_AREA", "USABLE_AREA", "TOTAL_AREA", "LAND_AREA"] as const;
export type AreaBasis = (typeof AREA_BASIS)[number];

export const AREA_BASIS_LABELS: Record<AreaBasis, string> = {
  PRIVATE_AREA: "Área privativa",
  BUILT_AREA: "Área construída",
  USABLE_AREA: "Área útil",
  TOTAL_AREA: "Área total",
  LAND_AREA: "Área do terreno",
};

export const MARKET_AUDIT_EVENT_TYPES = [
  "MARKET_PROPERTY_CREATED",
  "MARKET_PROPERTY_UPDATED",
  "MARKET_OBSERVATION_CREATED",
  "MARKET_OBSERVATION_UPDATED",
  "PRICE_OBSERVATION_ADDED",
  "ATTRIBUTE_OBSERVATION_CREATED",
  "CANONICAL_FACT_ADOPTED",
  "DUPLICATE_CANDIDATE_CREATED",
  "DUPLICATE_MATCH_CONFIRMED",
  "COMPARABLE_DISCOVERED",
  "COMPARABLE_MARKED_ELIGIBLE",
  "COMPARABLE_MARKED_INELIGIBLE",
  "COMPARABLE_INCLUDED",
  "COMPARABLE_EXCLUDED",
  "DEVELOPMENT_CREATED",
] as const;
export type MarketAuditEventType = (typeof MARKET_AUDIT_EVENT_TYPES)[number];

/* ==========================================================================
 * PHASE 4 — research engine audit vocabulary.
 * AI actions are auditable events like any other. None of them verifies data.
 * ========================================================================== */

export const RESEARCH_AUDIT_EVENT_TYPES = [
  "RESEARCH_RUN_CREATED",
  "RESEARCH_CONTEXT_SNAPSHOT_CREATED",
  "RESEARCH_PLAN_GENERATED",
  "RESEARCH_QUERY_EDITED",
  "RESEARCH_QUERY_ADDED",
  "RESEARCH_QUERY_DISCARDED",
  "RESEARCH_QUERY_EXECUTED",
  "RESEARCH_RESULT_SELECTION_CHANGED",
  "RESEARCH_MANUAL_URL_ADDED",
  "RESEARCH_SOURCE_CAPTURED",
  "RESEARCH_SOURCE_CAPTURE_FAILED",
  "RESEARCH_EXTRACTION_COMPLETED",
  "RESEARCH_CANDIDATE_REJECTED",
  "RESEARCH_CANDIDATE_PROMOTED",
  "RESEARCH_RUN_CANCELLED",
  "RESEARCH_DOMAIN_POLICY_SET",
] as const;
export type ResearchAuditEventType = (typeof RESEARCH_AUDIT_EVENT_TYPES)[number];

/* ==========================================================================
 * PHASE 5 — market evidence intelligence & sample readiness vocabulary.
 * Diagnóstico factual e governança de amostra. Nenhum destes eventos implica
 * cálculo de valor, ajuste, fator ou inferência estatística.
 * ========================================================================== */

export const INTELLIGENCE_AUDIT_EVENT_TYPES = [
  "DIAGNOSTIC_POLICY_CREATED",
  "MARKET_EVIDENCE_SNAPSHOT_CREATED",
  "MARKET_IDENTITY_CLUSTER_CONFIRMED",
  "COMPARABLE_FEATURE_SNAPSHOT_BUILT",
  "SAMPLE_SELECTION_STARTED",
  "SAMPLE_SELECTION_ITEM_DECIDED",
  "SAMPLE_SELECTION_COMPLETED",
  "MARKET_DATA_ISSUES_REFRESHED",
  "MARKET_DATA_ISSUE_ACKNOWLEDGED",
  "MARKET_DATA_ISSUE_RESOLVED",
  "SAMPLE_READINESS_ASSESSED",
  "SAMPLE_READINESS_WARNINGS_ACKNOWLEDGED",
  "SNAPSHOT_INTEGRITY_VERIFIED",
] as const;
export type IntelligenceAuditEventType = (typeof INTELLIGENCE_AUDIT_EVENT_TYPES)[number];

/* ==========================================================================
 * PHASE 6 — methodology governance audit vocabulary.
 * Eventos de criação/registro. Toda transição crítica (verificação de fonte,
 * submissão, aprovação, rejeição, resolução de conflito) grava seu próprio
 * evento DENTRO da RPC, na mesma transação.
 * ========================================================================== */

export const METHODOLOGY_AUDIT_EVENT_TYPES = [
  "METHODOLOGY_SOURCE_CREATED",
  "METHODOLOGY_SOURCE_UPDATED",
  "METHODOLOGY_SOURCE_ARTIFACT_ATTACHED",
  "METHODOLOGY_SOURCE_LOCATOR_CREATED",
  "METHODOLOGY_SOURCE_CONFLICT_OPENED",
  "METHOD_SPECIFICATION_CREATED",
  "METHOD_SPECIFICATION_UPDATED",
  "METHOD_SPECIFICATION_SECTION_UPDATED",
  "METHOD_SPECIFICATION_VERSION_CREATED",
  "METHODOLOGY_RULE_CREATED",
  "METHODOLOGY_RULE_UPDATED",
  "METHODOLOGY_RULE_SOURCE_ATTACHED",
  "METHODOLOGY_FORMULA_CREATED",
  "METHODOLOGY_FORMULA_VARIABLE_CREATED",
  "METHODOLOGY_PARAMETER_CREATED",
  "METHOD_APPLICABILITY_RULE_CREATED",
  "METHOD_TEST_CASE_CREATED",
  "METHOD_OUTPUT_CONTRACT_CREATED",
  "METHODOLOGY_CHANGE_REQUEST_CREATED",
  "METHODOLOGY_CHANGE_REQUEST_REVIEWED",
  /* Fase 7E — claims candidatas de fonte primária. A decisão humana
     (METHODOLOGY_CLAIM_REVIEWED) e a satisfação de tema
     (METHODOLOGY_REQUIREMENT_SATISFIED) são gravadas dentro da RPC. */
  "METHODOLOGY_CLAIM_PROPOSED",
  "METHODOLOGY_CLAIM_RULE_ASSESSED",
] as const;

export type MethodologyAuditEventType = (typeof METHODOLOGY_AUDIT_EVENT_TYPES)[number];
