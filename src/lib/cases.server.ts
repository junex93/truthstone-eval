import type { PropertyInput } from "@/lib/validation/schemas";

/**
 * Helper exclusivo de servidor para a ficha do imóvel avaliando.
 * Traduz o contrato Zod para colunas: campo ausente vira NULL explícito —
 * nunca zero, nunca string vazia.
 */

const nullable = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

export function propertyColumns(input: PropertyInput) {
  return {
    // Identificação e tipologia
    property_type: nullable(input.propertyType),
    property_type_code: nullable(input.propertyTypeCode),
    development_id: nullable(input.developmentId),
    // Endereço
    address_line: nullable(input.addressLine),
    address_number: nullable(input.addressNumber),
    complement: nullable(input.complement),
    district: nullable(input.district),
    subdistrict: nullable(input.subdistrict),
    city: nullable(input.city),
    state: nullable(input.state),
    postal_code: nullable(input.postalCode),
    country: input.country ?? "BR",
    country_code: nullable(input.countryCode),
    street_type: nullable(input.streetType),
    street_name: nullable(input.streetName),
    street_number: nullable(input.streetNumber),
    address_raw: nullable(input.addressRaw),
    address_normalized: nullable(input.addressNormalized),
    address_normalization_status: input.addressNormalizationStatus ?? "NOT_ATTEMPTED",
    // Georreferência
    latitude: nullable(input.latitude),
    longitude: nullable(input.longitude),
    // Áreas
    private_area: nullable(input.privateArea),
    built_area: nullable(input.builtArea),
    land_area: nullable(input.landArea),
    usable_area: nullable(input.usableArea),
    total_area: nullable(input.totalArea),
    common_area: nullable(input.commonArea),
    // Programa
    bedrooms: nullable(input.bedrooms),
    suites: nullable(input.suites),
    bathrooms: nullable(input.bathrooms),
    half_bathrooms: nullable(input.halfBathrooms),
    parking_spaces: nullable(input.parkingSpaces),
    // Edificação
    floor_number: nullable(input.floorNumber),
    total_floors: nullable(input.totalFloors),
    units_per_floor: nullable(input.unitsPerFloor),
    building_units: nullable(input.buildingUnits),
    elevators: nullable(input.elevators),
    construction_year: nullable(input.constructionYear),
    renovation_year: nullable(input.renovationYear),
    ceiling_height: nullable(input.ceilingHeight),
    // Terreno
    frontage: nullable(input.frontage),
    depth: nullable(input.depth),
    topography: nullable(input.topography),
    // Estado e ocupação
    condition_status: nullable(input.conditionStatus),
    occupancy_status: nullable(input.occupancyStatus),
    furnished_status: nullable(input.furnishedStatus),
    view_type: nullable(input.viewType),
    orientation: nullable(input.orientation),
    position_in_building: nullable(input.positionInBuilding),
    // Descrição técnica
    description: nullable(input.description),
  };
}
