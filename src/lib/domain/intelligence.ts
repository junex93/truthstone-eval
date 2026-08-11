/**
 * Vocabulário e contratos de leitura da camada MARKET EVIDENCE INTELLIGENCE.
 *
 * Nada aqui calcula valor, ajusta preço, aplica fator ou infere estatística
 * inferencial. Todo número é contagem, distância, data, distribuição descritiva
 * ou diferença factual entre atributos observados. Distribuição exploratória
 * (quartis, cerca de 1,5·IQR) é sinalizada como "possível observação extrema" —
 * nunca como outlier a ser removido automaticamente.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export const DIAGNOSTICS_VERSION = "valuation.market.diagnostics/1";

/* =============================================================== enums == */

export const MARKET_DATA_ISSUE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  ACKNOWLEDGED: "Ciente",
  RESOLVED: "Resolvida",
  AUTO_CLOSED: "Fechada automaticamente",
};

export const MARKET_DATA_ISSUE_SEVERITY_LABELS: Record<string, string> = {
  INFO: "Informativa",
  WARNING: "Atenção",
  BLOCKER: "Impeditiva",
};

export const MARKET_DATA_ISSUE_TYPE_LABELS: Record<string, string> = {
  MISSING_CRITICAL_ATTRIBUTE: "Atributo crítico ausente",
  CONFLICTING_ATTRIBUTE: "Atributo divergente",
  UNRESOLVED_DUPLICATE: "Duplicidade não resolvida",
  STALE_OBSERVATION: "Observação antiga",
  SOURCE_CONCENTRATION: "Concentração de fonte",
  DEVELOPMENT_CONCENTRATION: "Concentração de empreendimento",
  MISSING_GEO: "Localização ausente",
  MISSING_AREA: "Área ausente",
  NO_TRANSACTION_EVIDENCE: "Sem evidência de transação",
  INSUFFICIENT_INDEPENDENT_PROPERTIES: "Imóveis independentes insuficientes",
  PRICE_WITHOUT_SOURCE: "Preço sem fonte",
  UNSUPPORTED_TRANSACTION_CLAIM: "Alegação de transação sem suporte",
};

export const READINESS_STATE_LABELS: Record<string, string> = {
  NOT_ASSESSED: "Não avaliado",
  READY_FOR_METHOD_REVIEW: "Pronto para revisão metodológica",
  READY_WITH_WARNINGS: "Pronto com ressalvas",
  NOT_READY: "Não pronto",
};

export const SAMPLE_SELECTION_STATE_LABELS: Record<string, string> = {
  AVAILABLE: "Disponível",
  REVIEWING: "Em análise",
  SELECTED: "Selecionada",
  EXCLUDED: "Excluída",
};

export const SAMPLE_RUN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  ABANDONED: "Abandonada",
};

export const RESEARCH_GAP_LABELS: Record<string, string> = {
  MISSING_PRIVATE_AREA: "Área privativa ausente",
  MISSING_GEO: "Coordenada ausente",
  MISSING_DATE: "Observação sem data",
  UNRESOLVED_DUPLICATE: "Duplicidade não resolvida",
  NO_VERIFIED_TRANSACTION: "Nenhuma transação verificada",
  ATTRIBUTE_CONFLICT: "Divergência de atributo",
};

export const FUNNEL_STAGE_LABELS: Record<string, string> = {
  search_results: "Resultados de busca",
  captured: "Fontes capturadas",
  extracted: "Candidatos extraídos",
  verified_fields: "Campos verificados",
  promoted: "Candidatos promovidos",
  market_observations: "Observações de mercado",
  independent_properties: "Imóveis físicos independentes",
  comparable_candidates: "Candidatos a comparável",
  eligible: "Elegíveis",
  included: "Incluídos",
};

export const FUNNEL_ORDER = [
  "search_results",
  "captured",
  "extracted",
  "verified_fields",
  "promoted",
  "market_observations",
  "independent_properties",
  "comparable_candidates",
  "eligible",
  "included",
] as const;

export const ATTRIBUTE_LABELS: Record<string, string> = {
  property_type: "Tipologia",
  district: "Bairro",
  geo: "Coordenada",
  development: "Empreendimento",
  private_area: "Área privativa",
  bedrooms: "Dormitórios",
  parking_spaces: "Vagas",
  floor: "Pavimento",
  construction_year: "Ano de construção",
  asking_price: "Preço pedido",
  transaction_price: "Preço transacionado",
  observation_date: "Data de observação",
  publication_date: "Data de publicação",
  source: "Fonte identificada",
  artifact: "Artefato preservado",
};

export const AGE_BUCKET_LABELS: Record<string, string> = {
  "0-30": "até 30 dias",
  "31-90": "31 a 90 dias",
  "91-180": "91 a 180 dias",
  "181-365": "181 a 365 dias",
  ">365": "mais de 365 dias",
  UNKNOWN: "sem data",
};

/* ============================================================== report == */

export interface ReportDistribution {
  count: number | null;
  min: number | null;
  q1: number | null;
  median: number | null;
  q3: number | null;
  max: number | null;
}

export interface MatrixObservation {
  observation_id: string;
  market_property_id: string;
  observation_type: string;
  status: string;
  transaction_evidence_status: string | null;
  asking_price: number | null;
  transaction_price: number | null;
  asking_monthly_rent: number | null;
  asking_price_sqm: number | null;
  transaction_price_sqm: number | null;
  effective_date: string | null;
  age_days: number | null;
  domain: string;
  listing_url: string | null;
  evidence_source_id: string | null;
  primary_artifact_id: string | null;
  price_history:
    | {
        observed_at: string;
        asking_price: number | null;
        asking_monthly_rent: number | null;
        observation_status: string | null;
      }[]
    | null;
}

export interface MatrixRow {
  identity_key: string;
  cluster_id: string | null;
  is_clustered: boolean;
  label: string;
  market_property_ids: string[];
  market_property_count: number;
  property_type_code: string | null;
  district: string | null;
  development_id: string | null;
  private_area: number | null;
  distance_m: number | null;
  observation_count: number;
  source_count: number;
  domains: string[] | null;
  latest_asking_price: number | null;
  transaction_price: number | null;
  asking_price_sqm: number | null;
  transaction_price_sqm: number | null;
  latest_date: string | null;
  known_attribute_count: number;
  attribute_slots: number;
  verified_attribute_count: number;
  conflict_count: number;
  unresolved_duplicate_count: number;
  comparable_statuses:
    | {
        candidate_id: string;
        candidate_status: string;
        inclusion_status: string;
        exclusion_reason_code: string | null;
      }[]
    | null;
  selection_states: string[] | null;
  observations: MatrixObservation[] | null;
}

export interface MarketIntelligenceReport {
  valuation_case_id: string;
  valuation_reference_date: string;
  subject_property_id: string | null;
  diagnostics_version: string;
  generated_at: string;
  header: JsonObject;
  matrix: MatrixRow[];
  domains: {
    domain: string;
    observation_count: number;
    observation_share_pct: number | null;
    independent_property_count: number;
    independent_property_share_pct: number | null;
    first_observed: string | null;
    last_observed: string | null;
    source_count: number;
    artifact_count: number;
  }[];
  source_types: { source_type: string; observation_count: number }[];
  source_quality: {
    assessment_id: string;
    market_observation_id: string;
    source_reliability: string;
    temporal_relevance: string;
    spatial_relevance: string;
    data_completeness: string;
    cross_source_confirmation: string;
    notes: string | null;
    assessed_by: string | null;
    assessed_at: string | null;
  }[];
  temporal: {
    oldest_observation: string | null;
    latest_observation: string | null;
    without_date: number;
    monthly: { month: string; observation_type: string; count: number }[];
    age_buckets: { bucket: string; count: number }[];
  };
  price_history: {
    observation_id: string;
    identity_key: string | null;
    first_asking: number | null;
    latest_asking: number | null;
    absolute_change: number | null;
    percentage_change: number | null;
    change_count: number;
    first_seen: string | null;
    last_seen: string | null;
  }[];
  asking_to_transaction: {
    identity_key: string;
    last_verified_asking: number;
    verified_transaction: number;
    absolute_delta: number;
    percentage_delta: number | null;
  }[];
  spatial: {
    with_geo: number;
    without_geo: number;
    subject_has_geo: boolean | null;
    min_distance_m: number | null;
    q1_distance_m: number | null;
    median_distance_m: number | null;
    q3_distance_m: number | null;
    max_distance_m: number | null;
    same_district: number;
    districts: { district: string; independent_property_count: number; observation_count: number }[];
    developments: {
      development_id: string;
      name: string | null;
      independent_property_count: number;
      share_pct: number | null;
    }[];
  };
  attribute_coverage: {
    attribute: string;
    total: number;
    known: number;
    verified: number;
    unknown: number;
    conflicting: number;
  }[];
  conflict_map: {
    attribute: string;
    properties_affected: number;
    observation_count: number;
    open_issues: number;
  }[];
  price_per_sqm: { asking: ReportDistribution | null; transaction: ReportDistribution | null };
  possible_extreme_observations: {
    observation_id: string;
    identity_key: string;
    metric: string;
    value: number;
    lower_fence: number | null;
    upper_fence: number | null;
    flag: string;
  }[];
  funnel: Record<string, number>;
  why_lost: { stage: string; reason: string; count: number }[];
  identity_clusters: {
    cluster_id: string;
    label: string | null;
    representative_market_property_id: string | null;
    confirmation_reason: string | null;
    confirmed_by: string | null;
    confirmed_at: string | null;
    members: {
      market_property_id: string;
      label: string | null;
      source_match_candidate_id: string | null;
    }[];
    observation_count: number;
    source_count: number;
    first_observed: string | null;
    last_observed: string | null;
  }[];
  unresolved_identity: {
    match_id: string;
    left_market_property_id: string;
    right_market_property_id: string;
    match_status: string;
    similarity_score: number | null;
  }[];
  research_gaps: { code: string; count: number; description: string }[];
}

/* ============================================================= helpers == */

export function coveragePercent(known: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((1000 * known) / total) / 10;
}

/** Rótulo humano de uma etapa/motivo de perda do funil. */
export function whyLostLabel(stage: string, reason: string): string {
  const stages: Record<string, string> = {
    SEARCH: "Busca",
    CAPTURE: "Captura",
    EXTRACTION: "Extração",
    EVIDENCE: "Evidência",
    IDENTITY: "Identidade",
    COMPARABLE: "Comparável",
  };
  return `${stages[stage] ?? stage} — ${reason}`;
}
