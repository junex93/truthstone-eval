import { z } from "zod";

import {
  CASE_STATUSES,
  FIELD_STATES,
  PROCESSOR_TYPES,
  SOURCE_TYPES,
} from "@/lib/domain/constants";

/**
 * Shared schemas. Used by the UI for UX and re-executed server-side inside every
 * server function: external input is untrusted by default.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

const optionalDecimal = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  });

const optionalInt = optionalDecimal.transform((v) =>
  v === undefined ? undefined : Math.trunc(v),
);

export const organizationSchema = z.object({
  name: trimmed(160).min(2, "Informe o nome da organização"),
  legalName: optionalText(200),
});

export const profileSchema = z.object({
  fullName: optionalText(160),
  professionalRegistration: optionalText(80),
});

export const createCaseSchema = z.object({
  caseCode: trimmed(40).min(2, "Informe o código do caso"),
  title: trimmed(200).min(3, "Informe o título"),
  purpose: optionalText(2000),
  valuationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateCaseSchema = z.object({
  caseId: z.string().uuid(),
  title: trimmed(200).min(3),
  purpose: optionalText(2000),
  valuationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const changeCaseStatusSchema = z.object({
  caseId: z.string().uuid(),
  nextStatus: z.enum(CASE_STATUSES),
  reason: optionalText(1000),
});

export const propertySchema = z.object({
  caseId: z.string().uuid(),
  propertyType: optionalText(80),
  addressLine: optionalText(240),
  addressNumber: optionalText(30),
  complement: optionalText(120),
  district: optionalText(120),
  city: optionalText(120),
  state: optionalText(40),
  postalCode: optionalText(20),
  country: optionalText(60),
  latitude: optionalDecimal,
  longitude: optionalDecimal,
  privateArea: optionalDecimal,
  builtArea: optionalDecimal,
  landArea: optionalDecimal,
  bedrooms: optionalInt,
  bathrooms: optionalInt,
  parkingSpaces: optionalInt,
  constructionYear: optionalInt,
  floorNumber: optionalInt,
  description: optionalText(4000),
});
export type PropertyInput = z.infer<typeof propertySchema>;

export const createSourceSchema = z.object({
  caseId: z.string().uuid().optional(),
  sourceType: z.enum(SOURCE_TYPES),
  sourceName: trimmed(200).min(2, "Informe o nome da fonte"),
  sourceUrl: z
    .string()
    .trim()
    .url("URL inválida")
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publisherOrOwner: optionalText(200),
  publicationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  accessedAt: optionalText(40),
  notes: optionalText(4000),
});
export type CreateSourceInput = z.infer<typeof createSourceSchema>;

export const registerArtifactSchema = z.object({
  sourceId: z.string().uuid(),
  storagePath: trimmed(500).min(3),
  fileName: trimmed(260).min(1),
  mimeType: optionalText(160),
});

export const createExtractionSchema = z.object({
  artifactId: z.string().uuid(),
  extractionType: optionalText(120),
  processorType: z.enum(PROCESSOR_TYPES),
  processorName: optionalText(160),
  processorVersion: optionalText(80),
  promptVersion: optionalText(80),
  notes: optionalText(2000),
});

export const createFieldSchema = z.object({
  extractionId: z.string().uuid(),
  fieldName: trimmed(120).min(1, "Informe o nome do campo"),
  rawValue: optionalText(2000),
  normalizedValue: optionalText(2000),
  unit: optionalText(40),
  fieldState: z.enum(FIELD_STATES),
  sourceExcerpt: optionalText(4000),
  sourceLocator: optionalText(1000),
});
export type CreateFieldInput = z.infer<typeof createFieldSchema>;

export const verifyFieldSchema = z.object({
  fieldId: z.string().uuid(),
  verificationNotes: trimmed(2000).min(3, "Descreva a base da verificação"),
});

export const rejectFieldSchema = z.object({
  fieldId: z.string().uuid(),
  rejectionReason: trimmed(2000).min(3, "Informe o motivo da rejeição"),
});

export const createDatasetSchema = z.object({
  caseId: z.string().uuid(),
  name: trimmed(160).min(2, "Informe o nome do dataset"),
  purpose: optionalText(2000),
  description: optionalText(4000),
  inclusionCriteria: optionalText(4000),
  exclusionCriteria: optionalText(4000),
  knownLimitations: optionalText(4000),
  geographicScope: optionalText(500),
  temporalScope: optionalText(500),
});

export const datasetItemSchema = z.object({
  datasetVersionId: z.string().uuid(),
  evidenceFieldId: z.string().uuid(),
  roleInDataset: optionalText(120),
});

export const freezeDatasetSchema = z.object({
  datasetVersionId: z.string().uuid(),
  confirmation: z.literal("CONGELAR"),
});
