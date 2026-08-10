import type { Membership } from "@/lib/workspace.server";
import type { Db } from "@/lib/workspace.server";
import type {
  CreateMarketPropertyInput,
  UpdateMarketPropertyInput,
} from "@/lib/validation/market-schemas";

/**
 * Helpers exclusivos de servidor da camada de mercado.
 * Toda checagem aqui é conveniência de mensagem de erro: a imposição real está
 * em GRANT, RLS e trigger no PostgreSQL.
 */

export interface CaseScope {
  caseId: string;
  caseCode: string;
  title: string;
  status: string;
}

const CLOSED_CASE_STATUSES = ["COMPLETED", "ARCHIVED"];

export async function requireCaseInOrg(
  supabase: Db,
  caseId: string,
  membership: Membership,
): Promise<CaseScope> {
  const { data, error } = await supabase
    .from("valuation_cases")
    .select("id, case_code, title, status")
    .eq("id", caseId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Caso não encontrado nesta organização.");
  return { caseId: data.id, caseCode: data.case_code, title: data.title, status: data.status };
}

/** Caso concluído ou arquivado não recebe novo acervo de mercado. */
export function requireOpenCase(scope: CaseScope): CaseScope {
  if (CLOSED_CASE_STATUSES.includes(scope.status)) {
    throw new Error("Caso concluído ou arquivado: o acervo de mercado não aceita novas escritas.");
  }
  return scope;
}

export interface MarketPropertyScope {
  marketPropertyId: string;
  organizationId: string;
  caseId: string;
}

export async function requireMarketPropertyScope(
  supabase: Db,
  marketPropertyId: string,
  membership: Membership,
): Promise<MarketPropertyScope> {
  const { data, error } = await supabase
    .from("market_properties")
    .select("id, organization_id, valuation_case_id")
    .eq("id", marketPropertyId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Imóvel de mercado não encontrado nesta organização.");
  return {
    marketPropertyId: data.id,
    organizationId: data.organization_id,
    caseId: data.valuation_case_id,
  };
}

export interface ObservationScope {
  observationId: string;
  organizationId: string;
  caseId: string;
  marketPropertyId: string;
  observationType: string;
}

export async function requireObservationScope(
  supabase: Db,
  observationId: string,
  membership: Membership,
): Promise<ObservationScope> {
  const { data, error } = await supabase
    .from("market_observations")
    .select("id, organization_id, valuation_case_id, market_property_id, observation_type")
    .eq("id", observationId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Observação de mercado não encontrada nesta organização.");
  return {
    observationId: data.id,
    organizationId: data.organization_id,
    caseId: data.valuation_case_id,
    marketPropertyId: data.market_property_id,
    observationType: data.observation_type,
  };
}

/** Linhagem: nada de um caso entra na composição de outro caso. */
export function requireSameCase(expectedCaseId: string, actualCaseId: string, what: string): void {
  if (expectedCaseId !== actualCaseId) {
    throw new Error(`Linhagem inválida: ${what} pertence a outro caso de avaliação.`);
  }
}

const nullable = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

/**
 * Traduz o contrato Zod para colunas. Campo ausente vira NULL explícito — nunca
 * zero, nunca string vazia.
 */
export function marketPropertyColumns(
  input: CreateMarketPropertyInput | UpdateMarketPropertyInput,
) {
  return {
    development_id: nullable(input.developmentId),
    label: nullable(input.label),
    property_type_code: nullable(input.propertyTypeCode),
    address_raw: nullable(input.addressRaw),
    address_normalized: nullable(input.addressNormalized),
    address_normalization_status: input.addressNormalizationStatus ?? "NOT_ATTEMPTED",
    street_type: nullable(input.streetType),
    street_name: nullable(input.streetName),
    street_number: nullable(input.streetNumber),
    complement: nullable(input.complement),
    district: nullable(input.district),
    subdistrict: nullable(input.subdistrict),
    city: nullable(input.city),
    state: nullable(input.state),
    postal_code: nullable(input.postalCode),
    country_code: nullable(input.countryCode),
    latitude: nullable(input.latitude),
    longitude: nullable(input.longitude),
    private_area: nullable(input.privateArea),
    usable_area: nullable(input.usableArea),
    built_area: nullable(input.builtArea),
    total_area: nullable(input.totalArea),
    land_area: nullable(input.landArea),
    common_area: nullable(input.commonArea),
    bedrooms: nullable(input.bedrooms),
    suites: nullable(input.suites),
    bathrooms: nullable(input.bathrooms),
    half_bathrooms: nullable(input.halfBathrooms),
    parking_spaces: nullable(input.parkingSpaces),
    floor_number: nullable(input.floorNumber),
    total_floors: nullable(input.totalFloors),
    construction_year: nullable(input.constructionYear),
    renovation_year: nullable(input.renovationYear),
    condition_status: nullable(input.conditionStatus),
    occupancy_status: nullable(input.occupancyStatus),
    furnished_status: nullable(input.furnishedStatus),
    unit_identifier: nullable(input.unitIdentifier),
    description: nullable(input.description),
  };
}

export { nullable };
