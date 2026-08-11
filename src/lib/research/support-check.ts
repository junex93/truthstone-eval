/**
 * Deterministic support check. The system — not the model — decides whether a
 * claimed value is actually supported by the captured content.
 *
 * Rules enforced here:
 *  - the cited excerpt must exist in the captured content (exact or normalized);
 *  - the extracted number must appear inside the cited excerpt;
 *  - a field name outside the closed allowlist is discarded;
 *  - conflicting values for the same field are preserved as DIVERGENT, never
 *    silently resolved;
 *  - text in the source that tries to instruct the model is flagged.
 *
 * A FAILED check can never become VERIFIED — the database enforces that too
 * (trigger guard_support_check_before_verification).
 */

import type {
  ExtractionSupportStatus,
  ResearchFieldDefinition,
  ResearchIssueType,
  SupportCheckStatus,
} from "@/lib/domain/research";
import { findResearchField, SUPPORT_STATUS_TO_FIELD_STATE } from "@/lib/domain/research";
import type { FieldState } from "@/lib/domain/constants";
import {
  digitsOf,
  foldForCompare,
  normalizeWhitespace,
  parseArea,
  parseBrlMoney,
  parsePtBrDate,
  parsePtBrNumber,
} from "@/lib/research/normalize";

export interface RawExtractedField {
  fieldName: string;
  rawValue: string | null;
  supportStatus: ExtractionSupportStatus;
  sourceExcerpt: string | null;
  sourceLocator: string | null;
  /**
   * Number DECLARED by the model. Never trusted: it exists only so the system
   * can compare it against its own deterministic parse and record a conflict.
   */
  aiNumericValue?: number | null;
}


export interface CheckedField {
  fieldName: string;
  definition: ResearchFieldDefinition;
  rawValue: string | null;
  normalizedValue: string | null;
  numericValue: number | null;
  unit: string | null;
  fieldState: FieldState;
  aiSupportStatus: ExtractionSupportStatus;
  supportCheckStatus: SupportCheckStatus;
  sourceExcerpt: string | null;
  sourceLocator: string | null;
  details: Record<string, unknown>;
  issues: ResearchIssue[];
}

export interface ResearchIssue {
  issueType: ResearchIssueType;
  detail: string;
  payload?: Record<string, unknown>;
}

export interface DiscardedField {
  fieldName: string;
  issue: ResearchIssue;
}

export interface SupportCheckResult {
  fields: CheckedField[];
  discarded: DiscardedField[];
  issues: ResearchIssue[];
}

const ADVERSARIAL_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ignore (as |todas as )?instru(c|ç)(o|õ)es/i, label: "instrução para ignorar regras" },
  { pattern: /ignore (all |previous |prior )?instructions/i, label: "prompt injection (en)" },
  { pattern: /you are (now )?(an? )?(ai|assistant|system)/i, label: "tentativa de redefinir papel" },
  { pattern: /system prompt/i, label: "referência a system prompt" },
  { pattern: /disregard (the )?(above|previous)/i, label: "instrução para desconsiderar contexto" },
  { pattern: /responda (apenas|somente) (com|que)/i, label: "instrução de resposta forçada" },
  { pattern: /considere (este|esse) im(ó|o)vel como/i, label: "instrução de classificação forçada" },
];

export function detectAdversarialContent(content: string): ResearchIssue[] {
  const found = ADVERSARIAL_PATTERNS.filter((p) => p.pattern.test(content));
  if (found.length === 0) return [];
  return [
    {
      issueType: "ADVERSARIAL_CONTENT_SUSPECTED",
      detail: `Conteúdo capturado contém padrões de instrução: ${found
        .map((f) => f.label)
        .join("; ")}. Trate a fonte como hostil.`,
      payload: { patterns: found.map((f) => f.label) },
    },
  ];
}

export interface ExcerptCheck {
  status: "EXACT_MATCH" | "NORMALIZED_MATCH" | "FAILED";
  reason?: string;
}

/** Does the cited excerpt really exist in the captured bytes we stored? */
export function checkExcerptInContent(content: string, excerpt: string): ExcerptCheck {
  const trimmed = normalizeWhitespace(excerpt);
  if (trimmed.length < 3) return { status: "FAILED", reason: "trecho vazio ou muito curto" };
  if (content.includes(excerpt.trim())) return { status: "EXACT_MATCH" };
  if (foldForCompare(content).includes(foldForCompare(excerpt))) {
    return { status: "NORMALIZED_MATCH" };
  }
  return { status: "FAILED", reason: "trecho não localizado no conteúdo capturado" };
}

function numberAppearsInExcerpt(numeric: number, excerpt: string): boolean {
  const excerptDigits = digitsOf(excerpt);
  const asInteger = digitsOf(String(Math.trunc(Math.abs(numeric))));
  if (asInteger !== "" && excerptDigits.includes(asInteger)) return true;
  const asFull = digitsOf(String(Math.abs(numeric)));
  return asFull !== "" && excerptDigits.includes(asFull);
}

function parseByKind(definition: ResearchFieldDefinition, raw: string | null) {
  switch (definition.kind) {
    case "MONEY": {
      const parsed = parseBrlMoney(raw);
      return { numeric: parsed.value, unit: "BRL", reason: parsed.reason ?? null };
    }
    case "NUMBER": {
      if (definition.unit === "m2") {
        const parsed = parseArea(raw);
        return { numeric: parsed.value, unit: parsed.unit, reason: parsed.reason ?? null };
      }
      const parsed = parsePtBrNumber(raw);
      return { numeric: parsed.value, unit: definition.unit ?? null, reason: parsed.reason ?? null };
    }
    case "DATE": {
      const parsed = parsePtBrDate(raw);
      return { numeric: null, unit: null, reason: parsed.reason ?? null, isoDate: parsed.value };
    }
    default:
      return { numeric: null, unit: null, reason: null };
  }
}

/**
 * Runs the full deterministic gate over the model's raw output for ONE captured
 * source. Nothing here writes to the database; the caller persists candidates.
 */
export function checkExtractedFields(
  content: string,
  rawFields: readonly RawExtractedField[],
): SupportCheckResult {
  const issues: ResearchIssue[] = [...detectAdversarialContent(content)];
  const discarded: DiscardedField[] = [];
  const fields: CheckedField[] = [];

  for (const raw of rawFields) {
    const definition = findResearchField(raw.fieldName);
    if (!definition) {
      discarded.push({
        fieldName: raw.fieldName,
        issue: {
          issueType: "FIELD_NAME_OUTSIDE_ALLOWLIST",
          detail: `Campo "${raw.fieldName}" não pertence ao vocabulário permitido e foi descartado.`,
        },
      });
      continue;
    }

    const fieldIssues: ResearchIssue[] = [];
    const details: Record<string, unknown> = {};
    let supportCheckStatus: SupportCheckStatus = "NOT_APPLICABLE";
    let fieldState: FieldState = SUPPORT_STATUS_TO_FIELD_STATE[raw.supportStatus];

    const claimsTextSupport =
      raw.supportStatus === "EXPLICIT_TEXT" || raw.supportStatus === "EXPLICIT_STRUCTURED_DATA";

    if (raw.supportStatus === "VISUAL_EVIDENCE") {
      supportCheckStatus = "VISUAL_ONLY";
      details["note"] = "Suporte declarado como visual; não é conferível em texto.";
    } else if (claimsTextSupport) {
      const excerpt = raw.sourceExcerpt ?? "";
      const check = checkExcerptInContent(content, excerpt);
      details["excerpt_check"] = check.status;
      if (check.status === "FAILED") {
        supportCheckStatus = "FAILED";
        fieldState = "NOT_VERIFIABLE";
        fieldIssues.push({
          issueType: "EXCERPT_NOT_FOUND_IN_SOURCE",
          detail: `Trecho citado para "${raw.fieldName}" não existe no conteúdo capturado (${
            check.reason ?? "sem detalhe"
          }).`,
          payload: { field_name: raw.fieldName, excerpt },
        });
      } else {
        supportCheckStatus = check.status;
      }
    } else {
      // AMBIGUOUS / NOT_FOUND / UNSUPPORTED: explicit absence, never a value.
      supportCheckStatus = "NOT_APPLICABLE";
      if (raw.supportStatus === "AMBIGUOUS") {
        fieldIssues.push({
          issueType: "AMBIGUOUS_SUPPORT",
          detail: `Campo "${raw.fieldName}" declarado como ambíguo pela extração.`,
        });
      }
    }

    const parsed = parseByKind(definition, raw.rawValue);
    let numericValue = parsed.numeric;
    let normalizedValue: string | null = null;

    if (definition.kind === "DATE") {
      normalizedValue = (parsed as { isoDate?: string | null }).isoDate ?? null;
    } else if (definition.kind === "TEXT") {
      normalizedValue = raw.rawValue === null ? null : normalizeWhitespace(raw.rawValue);
    } else {
      normalizedValue = numericValue === null ? null : String(numericValue);
    }

    if (fieldState === "PRESENT" && raw.rawValue !== null && parsed.reason !== null) {
      fieldIssues.push({
        issueType: "UNPARSABLE_VALUE",
        detail: `Valor de "${raw.fieldName}" não foi interpretado deterministicamente: ${parsed.reason}.`,
        payload: { raw_value: raw.rawValue },
      });
      fieldState = "NOT_VERIFIABLE";
    }

    // The number must appear inside the cited excerpt, otherwise the citation
    // does not support the value even if the excerpt itself exists in the page.
    if (
      numericValue !== null &&
      claimsTextSupport &&
      supportCheckStatus !== "FAILED" &&
      raw.sourceExcerpt !== null &&
      !numberAppearsInExcerpt(numericValue, raw.sourceExcerpt)
    ) {
      supportCheckStatus = "FAILED";
      fieldState = "NOT_VERIFIABLE";
      numericValue = null;
      fieldIssues.push({
        issueType: "NUMERIC_VALUE_NOT_IN_EXCERPT",
        detail: `Número extraído para "${raw.fieldName}" não aparece no trecho citado.`,
        payload: { field_name: raw.fieldName, excerpt: raw.sourceExcerpt },
      });
    }

    // The model's own number is compared against the deterministic parse. A
    // divergence is never resolved in favour of the model: the value becomes
    // DIVERGENT and the conflict is recorded for human decision.
    const aiNumeric = raw.aiNumericValue ?? null;
    if (
      aiNumeric !== null &&
      numericValue !== null &&
      Math.abs(aiNumeric - numericValue) > Math.max(0.01, Math.abs(numericValue) * 1e-9)
    ) {
      details["parser_numeric"] = numericValue;
      details["ai_numeric"] = aiNumeric;
      fieldState = "DIVERGENT";
      supportCheckStatus = "FAILED";
      fieldIssues.push({
        issueType: "NUMERIC_CONFLICT_WITH_PARSER",
        detail: `A IA declarou ${aiNumeric} para "${raw.fieldName}", mas o parser determinístico leu ${numericValue} a partir do valor bruto. A divergência é preservada.`,
        payload: { field_name: raw.fieldName, ai_numeric: aiNumeric, parser_numeric: numericValue },
      });
    }



    fields.push({
      fieldName: raw.fieldName,
      definition,
      rawValue: raw.rawValue,
      normalizedValue,
      numericValue,
      unit: parsed.unit,
      fieldState,
      aiSupportStatus: raw.supportStatus,
      supportCheckStatus,
      sourceExcerpt: raw.sourceExcerpt,
      sourceLocator: raw.sourceLocator,
      details,
      issues: fieldIssues,
    });
  }

  // Divergence inside the SAME source is preserved, never resolved silently.
  const byName = new Map<string, CheckedField[]>();
  for (const field of fields) {
    const list = byName.get(field.fieldName) ?? [];
    list.push(field);
    byName.set(field.fieldName, list);
  }
  for (const [fieldName, group] of byName) {
    if (group.length < 2) continue;
    const distinct = new Set(group.map((f) => f.normalizedValue ?? f.rawValue ?? ""));
    if (distinct.size <= 1) continue;
    for (const field of group) {
      field.fieldState = "DIVERGENT";
      field.issues.push({
        issueType: "CONFLICTING_VALUES_IN_SOURCE",
        detail: `A mesma fonte apresenta valores divergentes para "${fieldName}". A divergência é preservada para decisão humana.`,
        payload: { values: Array.from(distinct) },
      });
    }
  }

  // A transacted price can never be supported by an ASKING price excerpt, even
  // when the excerpt really exists in the page. Offer never becomes transaction.
  for (const field of fields) {
    if (!TRANSACTION_FIELD_NAMES.includes(field.fieldName)) continue;
    if (field.fieldState !== "PRESENT") continue;
    const excerpt = foldForCompare(field.sourceExcerpt ?? "");
    const matched = ASKING_PRICE_LANGUAGE.find((p) => p.test(excerpt));
    if (!matched) continue;
    field.fieldState = "NOT_VERIFIABLE";
    field.supportCheckStatus = "FAILED";
    field.issues.push({
      issueType: "TRANSACTION_CLAIM_FROM_ASKING_PRICE",
      detail: `O trecho citado para "${field.fieldName}" descreve preço pedido/anunciado, não preço transacionado. A alegação de transação não é aceita.`,
      payload: { field_name: field.fieldName, excerpt: field.sourceExcerpt },
    });
  }


  for (const field of fields) issues.push(...field.issues);
  for (const item of discarded) issues.push(item.issue);

  return { fields, discarded, issues };
}
