import { z } from "zod";

import {
  ADDRESS_NORMALIZATION_STATUSES,
  COMPARABLE_CANDIDATE_STATUSES,
  COMPARABLE_INCLUSION_STATUSES,
  CONDITION_STATUSES,
  DEVELOPMENT_TYPES,
  FURNISHED_STATUSES,
  KNOWLEDGE_STATES,
  MARKET_OBSERVATION_STATUSES,
  MARKET_OBSERVATION_TYPES,
  MATCH_REASON_CODES,
  OCCUPANCY_STATUSES,
  PROPERTY_MATCH_STATUSES,
  PROPERTY_TYPE_CODES,
  QUALITY_DIMENSION_STATES,
  SELLER_TYPES,
  TRANSACTION_EVIDENCE_STATUSES,
  VALUE_ORIGINS,
} from "@/lib/domain/constants";

/**
 * Contratos compartilhados da camada de mercado e comparáveis.
 *
 * Regra estrutural: campo em branco NUNCA vira zero. Todo numérico opcional
 * ausente é transformado em `undefined` e gravado como NULL — "desconhecido" e
 * "zero" são estados distintos e permanecem distintos até o banco.
 */

const trimmed = (max: number) => z.string().trim().max(max);

const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v));

/** Numérico opcional: string vazia => undefined (NULL), nunca 0. */
const optionalDecimal = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  });

const optionalInt = optionalDecimal.transform((v) =>
  v === undefined ? undefined : Math.trunc(v),
);

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)")
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalTimestamp = z
  .string()
  .trim()
  .min(4)
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalUuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal("").transform(() => undefined));

const optionalUrl = z
  .string()
  .trim()
  .url("URL inválida")
  .max(2000)
  .optional()
  .or(z.literal("").transform(() => undefined));

/** Enum opcional tolerante a `""` proveniente de <select> não preenchido. */
function optionalEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .enum(values)
    .optional()
    .or(z.literal("").transform(() => undefined));
}

/* ======================================================== developments ==== */

export const createDevelopmentSchema = z.object({
  caseId: z.string().uuid(),
  name: trimmed(200).min(2, "Informe o nome do empreendimento"),
  developmentType: z.enum(DEVELOPMENT_TYPES),
  addressRaw: optionalText(400),
  district: optionalText(120),
  city: optionalText(120),
  state: optionalText(40),
  postalCode: optionalText(20),
  latitude: optionalDecimal,
  longitude: optionalDecimal,
  constructionYear: optionalInt,
  numberOfFloors: optionalInt,
  numberOfUnits: optionalInt,
  developerName: optionalText(200),
  notes: optionalText(4000),
});
export type CreateDevelopmentInput = z.infer<typeof createDevelopmentSchema>;

export const updateDevelopmentSchema = createDevelopmentSchema
  .omit({ caseId: true })
  .extend({ developmentId: z.string().uuid() });

export const assignDevelopmentSchema = z
  .object({
    developmentId: optionalUuid,
    subjectPropertyId: optionalUuid,
    marketPropertyId: optionalUuid,
  })
  .refine((v) => Boolean(v.subjectPropertyId) !== Boolean(v.marketPropertyId), {
    message: "Informe exatamente uma entidade: imóvel avaliando OU imóvel de mercado.",
  });

/* ==================================================== market properties === */

const marketPropertyCore = {
  label: optionalText(200),
  propertyTypeCode: optionalEnum(PROPERTY_TYPE_CODES),
  developmentId: optionalUuid,
  addressRaw: optionalText(400),
  addressNormalized: optionalText(400),
  addressNormalizationStatus: optionalEnum(ADDRESS_NORMALIZATION_STATUSES),
  streetType: optionalText(40),
  streetName: optionalText(200),
  streetNumber: optionalText(30),
  complement: optionalText(120),
  district: optionalText(120),
  subdistrict: optionalText(120),
  city: optionalText(120),
  state: optionalText(40),
  postalCode: optionalText(20),
  countryCode: optionalText(3),
  latitude: optionalDecimal,
  longitude: optionalDecimal,
  privateArea: optionalDecimal,
  usableArea: optionalDecimal,
  builtArea: optionalDecimal,
  totalArea: optionalDecimal,
  landArea: optionalDecimal,
  commonArea: optionalDecimal,
  bedrooms: optionalInt,
  suites: optionalInt,
  bathrooms: optionalInt,
  halfBathrooms: optionalInt,
  parkingSpaces: optionalInt,
  floorNumber: optionalInt,
  totalFloors: optionalInt,
  constructionYear: optionalInt,
  renovationYear: optionalInt,
  conditionStatus: optionalEnum(CONDITION_STATUSES),
  occupancyStatus: optionalEnum(OCCUPANCY_STATUSES),
  furnishedStatus: optionalEnum(FURNISHED_STATUSES),
  unitIdentifier: optionalText(80),
  description: optionalText(4000),
};

export const createMarketPropertySchema = z.object({
  caseId: z.string().uuid(),
  ...marketPropertyCore,
});
export type CreateMarketPropertyInput = z.infer<typeof createMarketPropertySchema>;

export const updateMarketPropertySchema = z.object({
  marketPropertyId: z.string().uuid(),
  ...marketPropertyCore,
});
export type UpdateMarketPropertyInput = z.infer<typeof updateMarketPropertySchema>;

/* =================================================== market observations == */

const observationCore = {
  observationType: z.enum(MARKET_OBSERVATION_TYPES),
  status: z.enum(MARKET_OBSERVATION_STATUSES).optional(),
  currencyCode: optionalText(3),
  askingPrice: optionalDecimal,
  transactionPrice: optionalDecimal,
  askingMonthlyRent: optionalDecimal,
  contractedMonthlyRent: optionalDecimal,
  observationDate: optionalDate,
  publicationDate: optionalDate,
  transactionDate: optionalDate,
  transactionDocumentType: optionalText(160),
  registryReference: optionalText(200),
  transactionEvidenceStatus: optionalEnum(TRANSACTION_EVIDENCE_STATUSES),
  publisherName: optionalText(200),
  portalName: optionalText(160),
  externalListingId: optionalText(200),
  listingUrl: optionalUrl,
  brokerReference: optionalText(200),
  brokerName: optionalText(200),
  sellerType: optionalEnum(SELLER_TYPES),
  notes: optionalText(4000),
  evidenceSourceId: optionalUuid,
  primaryArtifactId: optionalUuid,
};

/**
 * Nenhum preço é escrito em coluna alheia ao tipo da observação. Uma oferta
 * jamais carrega preço transacionado; uma transação jamais carrega preço pedido.
 */
function assertPriceColumnsMatchType(value: {
  observationType: string;
  askingPrice?: number | undefined;
  transactionPrice?: number | undefined;
  askingMonthlyRent?: number | undefined;
  contractedMonthlyRent?: number | undefined;
}): string | null {
  const t = value.observationType;
  const isTransaction = t === "CLOSED_SALE" || t === "CLOSED_RENT";
  if (!isTransaction && value.transactionPrice !== undefined) {
    return "Somente uma venda concretizada admite preço transacionado.";
  }
  if (!isTransaction && value.contractedMonthlyRent !== undefined) {
    return "Somente uma locação contratada admite aluguel contratado.";
  }
  if (t === "CLOSED_SALE" && value.askingPrice !== undefined) {
    return "Preço pedido não pertence a uma venda concretizada: registre outra observação.";
  }
  if (t === "CLOSED_RENT" && value.askingMonthlyRent !== undefined) {
    return "Aluguel pedido não pertence a uma locação contratada: registre outra observação.";
  }
  if (t === "SALE_LISTING" && value.askingMonthlyRent !== undefined) {
    return "Oferta de venda não admite aluguel pedido.";
  }
  if (t === "RENT_LISTING" && value.askingPrice !== undefined) {
    return "Oferta de locação não admite preço de venda pedido.";
  }
  return null;
}

export const createMarketObservationSchema = z
  .object({
    caseId: z.string().uuid(),
    marketPropertyId: z.string().uuid(),
    ...observationCore,
  })
  .superRefine((value, ctx) => {
    const problem = assertPriceColumnsMatchType(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });
export type CreateMarketObservationInput = z.infer<typeof createMarketObservationSchema>;

/**
 * Campos editáveis de uma observação já registrada. `observationType`,
 * `market_property_id`, `valuation_case_id` e os preços pedidos ficam fora por
 * imposição de trigger no banco: preço pedido só muda por record_price_observation.
 */
export const updateMarketObservationSchema = z.object({
  observationId: z.string().uuid(),
  status: z.enum(MARKET_OBSERVATION_STATUSES).optional(),
  observationDate: optionalDate,
  publicationDate: optionalDate,
  transactionDate: optionalDate,
  transactionDocumentType: optionalText(160),
  registryReference: optionalText(200),
  transactionEvidenceStatus: optionalEnum(TRANSACTION_EVIDENCE_STATUSES),
  publisherName: optionalText(200),
  portalName: optionalText(160),
  externalListingId: optionalText(200),
  listingUrl: optionalUrl,
  brokerReference: optionalText(200),
  brokerName: optionalText(200),
  sellerType: optionalEnum(SELLER_TYPES),
  notes: optionalText(4000),
  evidenceSourceId: optionalUuid,
  primaryArtifactId: optionalUuid,
});
export type UpdateMarketObservationInput = z.infer<typeof updateMarketObservationSchema>;

/* ======================================================== price history === */

export const recordPriceObservationSchema = z
  .object({
    observationId: z.string().uuid(),
    askingPrice: optionalDecimal,
    askingMonthlyRent: optionalDecimal,
    observedAt: optionalTimestamp,
    status: z.enum(MARKET_OBSERVATION_STATUSES).optional(),
    evidenceSourceId: optionalUuid,
    evidenceFieldId: optionalUuid,
    notes: optionalText(2000),
  })
  .refine((v) => v.askingPrice !== undefined || v.askingMonthlyRent !== undefined, {
    message: "Informe o preço pedido ou o aluguel pedido observado.",
  });
export type RecordPriceObservationInput = z.infer<typeof recordPriceObservationSchema>;

/* ============================================== attribute observations ==== */

export const createAttributeObservationSchema = z
  .object({
    caseId: z.string().uuid(),
    subjectPropertyId: optionalUuid,
    marketPropertyId: optionalUuid,
    attributeName: trimmed(120).min(1, "Informe o atributo observado"),
    rawValue: optionalText(2000),
    normalizedValue: optionalText(2000),
    numericValue: optionalDecimal,
    unit: optionalText(40),
    knowledgeState: z.enum(KNOWLEDGE_STATES),
    valueOrigin: z.enum(VALUE_ORIGINS),
    evidenceFieldId: optionalUuid,
    evidenceSourceId: optionalUuid,
    observedAt: optionalTimestamp,
    notes: optionalText(2000),
  })
  .refine((v) => Boolean(v.subjectPropertyId) !== Boolean(v.marketPropertyId), {
    message: "Informe exatamente uma entidade: imóvel avaliando OU imóvel de mercado.",
  });
export type CreateAttributeObservationInput = z.infer<typeof createAttributeObservationSchema>;

/* ==================================================== canonical facts ==== */

export const adoptCanonicalFactSchema = z
  .object({
    observationId: z.string().uuid(),
    attributeName: trimmed(120).min(1),
    subjectPropertyId: optionalUuid,
    marketPropertyId: optionalUuid,
    reason: trimmed(2000).min(3, "Descreva a base técnica da adoção"),
  })
  .refine((v) => Boolean(v.subjectPropertyId) !== Boolean(v.marketPropertyId), {
    message: "Informe exatamente uma entidade: imóvel avaliando OU imóvel de mercado.",
  });
export type AdoptCanonicalFactInput = z.infer<typeof adoptCanonicalFactSchema>;

/* ======================================================= duplicidades ==== */

export const createMatchCandidateSchema = z
  .object({
    caseId: z.string().uuid(),
    leftMarketPropertyId: z.string().uuid(),
    rightMarketPropertyId: z.string().uuid(),
    reasonCodes: z.array(z.enum(MATCH_REASON_CODES)).min(1, "Informe ao menos um sinal"),
    notes: optionalText(2000),
  })
  .refine((v) => v.leftMarketPropertyId !== v.rightMarketPropertyId, {
    message: "Um imóvel não é duplicidade de si mesmo.",
  });
export type CreateMatchCandidateInput = z.infer<typeof createMatchCandidateSchema>;

export const resolveMatchSchema = z
  .object({
    matchId: z.string().uuid(),
    status: z.enum(PROPERTY_MATCH_STATUSES),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    const decisive = v.status === "CONFIRMED_SAME" || v.status === "CONFIRMED_DIFFERENT";
    if (decisive && (!v.notes || v.notes.trim().length < 3)) {
      ctx.addIssue({ code: "custom", message: "Decisão de duplicidade exige justificativa." });
    }
  });
export type ResolveMatchInput = z.infer<typeof resolveMatchSchema>;

/* ========================================================= comparáveis === */

export const createComparableCandidateSchema = z.object({
  caseId: z.string().uuid(),
  marketObservationId: z.string().uuid(),
});
export type CreateComparableCandidateInput = z.infer<typeof createComparableCandidateSchema>;

export const decideComparableSchema = z
  .object({
    candidateId: z.string().uuid(),
    candidateStatus: z.enum(COMPARABLE_CANDIDATE_STATUSES).optional(),
    inclusionStatus: z.enum(COMPARABLE_INCLUSION_STATUSES).optional(),
    reasonCode: optionalText(80),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (!v.candidateStatus && !v.inclusionStatus) {
      ctx.addIssue({ code: "custom", message: "Informe a decisão a registrar." });
    }
    if (v.inclusionStatus === "EXCLUDED") {
      if (!v.reasonCode) {
        ctx.addIssue({ code: "custom", message: "A exclusão exige código de motivo." });
      }
      if (v.reasonCode === "OTHER" && (!v.notes || v.notes.trim().length < 3)) {
        ctx.addIssue({
          code: "custom",
          message: 'O motivo "Outro" exige descrição textual do motivo real.',
        });
      }
    }
  });
export type DecideComparableInput = z.infer<typeof decideComparableSchema>;

/* ============================================= qualidade qualitativa ===== */

export const sourceQualityAssessmentSchema = z.object({
  marketObservationId: z.string().uuid(),
  sourceReliability: z.enum(QUALITY_DIMENSION_STATES),
  temporalRelevance: z.enum(QUALITY_DIMENSION_STATES),
  spatialRelevance: z.enum(QUALITY_DIMENSION_STATES),
  dataCompleteness: z.enum(QUALITY_DIMENSION_STATES),
  crossSourceConfirmation: z.enum(QUALITY_DIMENSION_STATES),
  notes: optionalText(2000),
});
export type SourceQualityAssessmentInput = z.infer<typeof sourceQualityAssessmentSchema>;
