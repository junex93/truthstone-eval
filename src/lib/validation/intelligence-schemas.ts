import { z } from "zod";

/**
 * Contratos Zod da camada MARKET EVIDENCE INTELLIGENCE & SAMPLE READINESS.
 * Os mesmos schemas valem no cliente e no servidor. Justificativa técnica é
 * campo obrigatório em toda decisão humana.
 */

const uuid = z.string().uuid();
const reason = z.string().trim().min(20, "Justificativa técnica com no mínimo 20 caracteres.");
const notes = z.string().trim().min(10, "Registre uma nota técnica com no mínimo 10 caracteres.");

export const caseScopeSchema = z.object({ caseId: uuid });

export const createDiagnosticPolicySchema = z.object({
  caseId: uuid,
  name: z.string().trim().min(3).max(120),
  version: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9._/-]+$/, "Use apenas letras, números, ponto, barra, hífen ou underscore."),
  configuration: z.record(z.unknown()),
});

export const createMarketEvidenceSnapshotSchema = z.object({
  caseId: uuid,
  description: z.string().trim().min(10, "Descreva a finalidade deste retrato.").max(500),
});

export const verifySnapshotSchema = z.object({
  caseId: uuid,
  kind: z.enum(["MARKET_EVIDENCE", "SAMPLE_SELECTION"]),
  snapshotId: uuid,
});

export const confirmIdentityClusterSchema = z.object({
  caseId: uuid,
  marketPropertyIds: z.array(uuid).min(2, "Um agrupamento de identidade exige ao menos 2 imóveis."),
  representativeMarketPropertyId: uuid,
  reason,
});

export const buildFeatureSnapshotSchema = z.object({
  caseId: uuid,
  candidateId: uuid,
});

export const startSampleSelectionSchema = z.object({
  caseId: uuid,
  marketEvidenceSnapshotId: uuid,
  purpose: z.string().trim().min(10, "Declare a finalidade da seleção.").max(300),
  notes: z.string().trim().max(1000).optional().default(""),
});

export const decideSampleItemSchema = z
  .object({
    caseId: uuid,
    runId: uuid,
    marketObservationId: uuid,
    finalState: z.enum(["SELECTED", "EXCLUDED", "REVIEWING"]),
    reasonCode: z.string().trim().max(60).optional().default(""),
    reason: z.string().trim().max(1000).optional().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.finalState === "EXCLUDED") {
      if (value.reasonCode.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reasonCode"],
          message: "Exclusão exige código de motivo catalogado.",
        });
      }
      if (value.reason.trim().length < 20) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Exclusão exige justificativa técnica com no mínimo 20 caracteres.",
        });
      }
    }
  });

export const completeSampleSelectionSchema = z.object({
  caseId: uuid,
  runId: uuid,
  notes: z.string().trim().min(10, "Registre a nota de encerramento.").max(1000),
});

export const refreshIssuesSchema = z.object({
  caseId: uuid,
  policyId: uuid,
});

export const issueDecisionSchema = z.object({
  caseId: uuid,
  issueId: uuid,
  notes,
});

export const assessReadinessSchema = z.object({
  caseId: uuid,
  marketEvidenceSnapshotId: uuid,
  sampleSelectionSnapshotId: uuid,
  policyId: uuid,
});

export const acknowledgeReadinessSchema = z.object({
  caseId: uuid,
  assessmentId: uuid,
  notes: z
    .string()
    .trim()
    .min(30, "Ressalva assumida exige justificativa técnica com no mínimo 30 caracteres.")
    .max(2000),
});

export type CreateDiagnosticPolicyInput = z.infer<typeof createDiagnosticPolicySchema>;
export type CreateMarketEvidenceSnapshotInput = z.infer<typeof createMarketEvidenceSnapshotSchema>;
export type ConfirmIdentityClusterInput = z.infer<typeof confirmIdentityClusterSchema>;
export type StartSampleSelectionInput = z.infer<typeof startSampleSelectionSchema>;
export type DecideSampleItemInput = z.infer<typeof decideSampleItemSchema>;
export type AssessReadinessInput = z.infer<typeof assessReadinessSchema>;
