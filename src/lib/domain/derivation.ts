import {
  AREA_BASIS_LABELS,
  type AreaBasis,
  type MarketObservationType,
  type PropertyTypeCode,
} from "@/lib/domain/constants";

/**
 * Apresentação e derivação factual.
 *
 * Nada aqui é metodologia de avaliação: não há fator, peso, homogeneização,
 * inferência ou estimativa. São apenas (a) formatação que preserva a distinção
 * entre desconhecido e zero e (b) uma divisão determinística cuja base é sempre
 * declarada na tela.
 */

/* ============================================================ formatação == */

export const NOT_INFORMED = "Não informado";
export const NOT_COMPUTABLE = "Não calculável";

/** UNKNOWN != ZERO: null/undefined vira "Não informado"; 0 permanece 0. */
export function formatCount(value: number | null | undefined, unit?: string): string {
  if (value === null || value === undefined) return NOT_INFORMED;
  return unit ? `${value} ${unit}` : String(value);
}

export function formatArea(value: number | null | undefined): string {
  if (value === null || value === undefined) return NOT_INFORMED;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)} m²`;
}

export function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined = "BRL",
): string {
  if (value === null || value === undefined) return NOT_INFORMED;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency && currency.length === 3 ? currency : "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUnitPrice(
  value: number | null | undefined,
  currency: string | null | undefined = "BRL",
): string {
  if (value === null || value === undefined) return NOT_COMPUTABLE;
  return `${new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency && currency.length === 3 ? currency : "BRL",
    maximumFractionDigits: 0,
  }).format(value)}/m²`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return NOT_INFORMED;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return NOT_INFORMED;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return NOT_INFORMED;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return NOT_INFORMED;
  return `${date.toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`;
}

/** Distância factual medida pelo PostGIS. Sem coordenada não há distância. */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return NOT_COMPUTABLE;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}

/* ================================================== origem do valor ======= */

export const VALUE_KINDS = ["OBSERVED", "DERIVED", "ADOPTED"] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const VALUE_KIND_LABELS: Record<ValueKind, string> = {
  OBSERVED: "Observado",
  DERIVED: "Derivado",
  ADOPTED: "Adotado",
};

/* ============================================ base de área declarada ===== */

const LAND_TYPES: readonly PropertyTypeCode[] = [
  "RESIDENTIAL_LAND",
  "URBAN_LAND",
  "RURAL_PROPERTY",
];

export interface AreaCarrier {
  property_type_code?: PropertyTypeCode | string | null;
  private_area?: number | null;
  built_area?: number | null;
  usable_area?: number | null;
  total_area?: number | null;
  land_area?: number | null;
}

export interface AreaReference {
  basis: AreaBasis;
  basisLabel: string;
  value: number | null;
}

/**
 * Regra de APRESENTAÇÃO (não é metodologia de avaliação):
 * imóvel de terreno usa a área do terreno; qualquer outra tipologia usa a área
 * privativa. Não há substituição silenciosa: se a área da base declarada estiver
 * ausente, o preço unitário fica explicitamente "Não calculável".
 */
export function resolveAreaReference(carrier: AreaCarrier): AreaReference {
  const isLand = LAND_TYPES.includes(carrier.property_type_code as PropertyTypeCode);
  const basis: AreaBasis = isLand ? "LAND_AREA" : "PRIVATE_AREA";
  const raw = isLand ? carrier.land_area : carrier.private_area;
  return {
    basis,
    basisLabel: AREA_BASIS_LABELS[basis],
    value: raw === null || raw === undefined ? null : raw,
  };
}

export interface UnitPriceDerivation {
  /** Preço unitário pedido. `null` quando não há preço ou não há a área da base. */
  askingPerArea: number | null;
  /** Preço unitário transacionado. Nunca derivado de preço pedido. */
  transactionPerArea: number | null;
  area: AreaReference;
}

export function deriveUnitPrices(
  carrier: AreaCarrier,
  prices: { asking_price?: number | null; transaction_price?: number | null },
): UnitPriceDerivation {
  const area = resolveAreaReference(carrier);
  const divide = (value: number | null | undefined): number | null => {
    if (value === null || value === undefined) return null;
    if (area.value === null || area.value <= 0) return null; // nunca dividir por zero
    return Math.round((value / area.value) * 100) / 100;
  };
  return {
    askingPerArea: divide(prices.asking_price ?? null),
    transactionPerArea: divide(prices.transaction_price ?? null),
    area,
  };
}

/* ================================================== completude de dados == */

export interface CompletenessItem {
  label: string;
  available: boolean;
  /** Atributo declarado inaplicável à tipologia: não conta no denominador. */
  notApplicable?: boolean;
}

export interface CompletenessResult {
  items: CompletenessItem[];
  available: number;
  total: number;
  /** Rótulo canônico. Completude NÃO é confiança, qualidade nem probabilidade. */
  label: string;
}

function summarize(items: CompletenessItem[]): CompletenessResult {
  const applicable = items.filter((item) => !item.notApplicable);
  const available = applicable.filter((item) => item.available).length;
  const total = applicable.length;
  return {
    items,
    available,
    total,
    label: `${available} / ${total} informações essenciais disponíveis`,
  };
}

const known = (value: unknown): boolean => value !== null && value !== undefined && value !== "";

export interface MarketPropertyCompletenessInput extends AreaCarrier {
  property_type_code?: PropertyTypeCode | string | null;
  address_raw?: string | null;
  address_normalized?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  parking_spaces?: number | null;
  development_id?: string | null;
}

export function marketPropertyCompleteness(
  property: MarketPropertyCompletenessInput,
  context: { hasLinkedSource: boolean },
): CompletenessResult {
  const isLand = LAND_TYPES.includes(property.property_type_code as PropertyTypeCode);
  const area = resolveAreaReference(property);
  return summarize([
    { label: "Tipologia conhecida", available: known(property.property_type_code) },
    {
      label: "Endereço conhecido",
      available: known(property.address_raw) || known(property.address_normalized),
    },
    {
      label: "Coordenadas conhecidas",
      available: known(property.latitude) && known(property.longitude),
    },
    { label: `Área conhecida (${area.basisLabel.toLowerCase()})`, available: area.value !== null },
    {
      label: "Dormitórios conhecidos",
      available: known(property.bedrooms),
      notApplicable: isLand,
    },
    {
      label: "Vagas conhecidas",
      available: known(property.parking_spaces),
      notApplicable: isLand,
    },
    { label: "Empreendimento identificado", available: known(property.development_id) },
    { label: "Fonte vinculada", available: context.hasLinkedSource },
  ]);
}

export interface MarketObservationCompletenessInput {
  observation_type?: MarketObservationType | string | null;
  asking_price?: number | null;
  transaction_price?: number | null;
  asking_monthly_rent?: number | null;
  contracted_monthly_rent?: number | null;
  observation_date?: string | null;
  transaction_date?: string | null;
  evidence_source_id?: string | null;
  primary_artifact_id?: string | null;
  market_property_id?: string | null;
}

function applicablePriceKnown(observation: MarketObservationCompletenessInput): boolean {
  switch (observation.observation_type) {
    case "CLOSED_SALE":
      return known(observation.transaction_price);
    case "CLOSED_RENT":
      return known(observation.contracted_monthly_rent);
    case "RENT_LISTING":
      return known(observation.asking_monthly_rent);
    default:
      return known(observation.asking_price) || known(observation.asking_monthly_rent);
  }
}

export function marketObservationCompleteness(
  observation: MarketObservationCompletenessInput,
): CompletenessResult {
  return summarize([
    { label: "Tipo de observação conhecido", available: known(observation.observation_type) },
    { label: "Preço aplicável ao tipo conhecido", available: applicablePriceKnown(observation) },
    {
      label: "Data conhecida",
      available: known(observation.observation_date) || known(observation.transaction_date),
    },
    { label: "Fonte identificada", available: known(observation.evidence_source_id) },
    { label: "Artefato de evidência vinculado", available: known(observation.primary_artifact_id) },
    { label: "Imóvel de mercado vinculado", available: known(observation.market_property_id) },
  ]);
}

/* ================================================ divergência factual ==== */

export interface AttributeObservationLike {
  attribute_name: string;
  numeric_value?: number | null;
  normalized_value?: string | null;
  raw_value?: string | null;
}

/**
 * Divergência é detectada, nunca resolvida: dois valores distintos para o mesmo
 * atributo marcam o grupo como DIVERGENTE e ambos permanecem visíveis.
 */
export function hasDivergence(observations: readonly AttributeObservationLike[]): boolean {
  const distinct = new Set(
    observations.map((observation) =>
      observation.numeric_value !== null && observation.numeric_value !== undefined
        ? `n:${observation.numeric_value}`
        : `t:${(observation.normalized_value ?? observation.raw_value ?? "").trim().toLowerCase()}`,
    ),
  );
  distinct.delete("t:");
  return distinct.size > 1;
}

export function groupByAttribute<T extends AttributeObservationLike>(
  observations: readonly T[],
): { attributeName: string; observations: T[]; divergent: boolean }[] {
  const map = new Map<string, T[]>();
  for (const observation of observations) {
    const list = map.get(observation.attribute_name) ?? [];
    list.push(observation);
    map.set(observation.attribute_name, list);
  }
  return [...map.entries()]
    .map(([attributeName, list]) => ({
      attributeName,
      observations: list,
      divergent: hasDivergence(list),
    }))
    .sort((a, b) => a.attributeName.localeCompare(b.attributeName, "pt-BR"));
}
