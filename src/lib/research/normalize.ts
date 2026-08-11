/**
 * Deterministic pt-BR normalization. Pure functions, no AI, no network.
 *
 * The model never returns a normalized value that the system trusts: the model
 * returns raw text, and THIS code derives the numeric/date value. A value that
 * cannot be parsed deterministically is not silently dropped — it is reported
 * as an issue (UNPARSABLE_VALUE) and the field is created without a number.
 */

export function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

/** Accent-folded, case-folded, whitespace-collapsed form used for comparisons. */
export function foldForCompare(value: string): string {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—−]/g, "-")
    .toLowerCase();
}

export interface ParsedNumber {
  value: number | null;
  reason?: string;
}

/**
 * Parses pt-BR numerals: "1.234,56", "1234,56", "1234.56", "120 m²", "R$ 850.000".
 * Ambiguity is resolved by the LAST separator: it decides the decimal mark.
 */
export function parsePtBrNumber(raw: string | null | undefined): ParsedNumber {
  if (raw == null) return { value: null, reason: "valor ausente" };
  const cleaned = normalizeWhitespace(raw)
    .replace(/r\$/gi, "")
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (cleaned === "" || !/\d/.test(cleaned)) {
    return { value: null, reason: "nenhum dígito no valor" };
  }

  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "");
  const lastComma = body.lastIndexOf(",");
  const lastDot = body.lastIndexOf(".");
  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    normalized = body;
  } else if (lastComma > lastDot) {
    normalized = body.replace(/\./g, "").replace(",", ".");
  } else {
    const decimals = body.length - lastDot - 1;
    // "1.234" with 3 decimals is a thousands separator in pt-BR, not a decimal.
    normalized = decimals === 3 ? body.replace(/\./g, "") : body.replace(/,/g, "");
  }

  if (normalized.split(".").length > 2) return { value: null, reason: "formato numérico ambíguo" };
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, reason: "valor numérico inválido" };
  return { value: negative ? -parsed : parsed };
}

/** Money in BRL. Rejects a value that carries a foreign currency marker. */
export function parseBrlMoney(raw: string | null | undefined): ParsedNumber {
  if (raw == null) return { value: null, reason: "valor ausente" };
  const text = normalizeWhitespace(raw);
  if (/(us\$|usd|eur|€|£)/i.test(text)) {
    return { value: null, reason: "moeda estrangeira declarada; conversão nunca é presumida" };
  }
  if (/\b(mil|milh(ão|ões))\b/i.test(text)) {
    return { value: null, reason: "valor por extenso não é interpretado automaticamente" };
  }
  return parsePtBrNumber(text);
}

export interface ParsedArea {
  value: number | null;
  unit: string | null;
  reason?: string;
}

/** Area with explicit unit. A unit that is not m² is never converted silently. */
export function parseArea(raw: string | null | undefined): ParsedArea {
  if (raw == null) return { value: null, unit: null, reason: "valor ausente" };
  const text = normalizeWhitespace(raw);
  if (/\b(ha|hectares?)\b/i.test(text)) {
    return { value: null, unit: "ha", reason: "unidade hectare exige decisão humana" };
  }
  if (/\b(alqueire|alqueires)\b/i.test(text)) {
    return { value: null, unit: "alqueire", reason: "unidade agrária exige decisão humana" };
  }
  const parsed = parsePtBrNumber(text);
  return { value: parsed.value, unit: parsed.value === null ? null : "m2", reason: parsed.reason };
}

const MONTHS_PT: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

export interface ParsedDate {
  value: string | null;
  reason?: string;
}

/** ISO date (YYYY-MM-DD) from pt-BR formats. Relative dates are never guessed. */
export function parsePtBrDate(raw: string | null | undefined): ParsedDate {
  if (raw == null) return { value: null, reason: "data ausente" };
  const text = foldForCompare(raw);

  if (/\b(hoje|ontem|há|ha)\b/.test(text) || /\bdias?\b/.test(text)) {
    return { value: null, reason: "data relativa não é convertida em data factual" };
  }

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return validateDateParts(iso[1]!, iso[2]!, iso[3]!);

  const dmy = text.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/);
  if (dmy) {
    const year = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]!;
    return validateDateParts(year, dmy[2]!.padStart(2, "0"), dmy[1]!.padStart(2, "0"));
  }

  const long = text.match(/\b(\d{1,2}) de ([a-z]+) de (\d{4})\b/);
  if (long) {
    const month = MONTHS_PT[long[2]!];
    if (!month) return { value: null, reason: "mês não reconhecido" };
    return validateDateParts(long[3]!, month, long[1]!.padStart(2, "0"));
  }

  const monthYear = text.match(/\b([a-z]+) de (\d{4})\b/);
  if (monthYear && MONTHS_PT[monthYear[1]!]) {
    return { value: null, reason: "data incompleta (mês/ano) não é completada por presunção" };
  }

  return { value: null, reason: "formato de data não reconhecido" };
}

function validateDateParts(year: string, month: string, day: string): ParsedDate {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) {
    return { value: null, reason: "data fora de faixa plausível" };
  }
  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const check = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(check.getTime()) || check.getUTCDate() !== d) {
    return { value: null, reason: "data inexistente no calendário" };
  }
  return { value: iso };
}

/** Digits-only projection used to look for a number inside free text. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}
