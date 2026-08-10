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
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
