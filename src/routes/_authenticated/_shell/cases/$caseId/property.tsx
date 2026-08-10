import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { CaseStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canWrite } from "@/hooks/use-workspace";
import { getCaseDetail, saveProperty } from "@/lib/cases.functions";
import {
  ADDRESS_NORMALIZATION_STATUS_LABELS,
  ADDRESS_NORMALIZATION_STATUSES,
  CONDITION_STATUS_LABELS,
  CONDITION_STATUSES,
  FURNISHED_STATUS_LABELS,
  FURNISHED_STATUSES,
  OCCUPANCY_STATUS_LABELS,
  OCCUPANCY_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPE_CODES,
} from "@/lib/domain/constants";
import { adoptCanonicalFact, listSubjectAttributeObservations } from "@/lib/market.functions";
import { marketPropertyCompleteness, groupByAttribute, NOT_INFORMED } from "@/lib/domain/derivation";
import { propertySchema } from "@/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/property")({
  component: SubjectPropertyPage,
});

function SubjectPropertyPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId/property" });
  const fetchDetail = useServerFn(getCaseDetail);
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchDetail({ data: { caseId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Imóvel avaliando indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const { valuationCase, property, role } = query.data;
  const writable =
    canWrite(role) && valuationCase.status !== "COMPLETED" && valuationCase.status !== "ARCHIVED";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={valuationCase.case_code}
        title="Imóvel avaliando"
        description="Ficha técnica do objeto da avaliação. Campo em branco significa não informado — nenhum valor é inferido ou estimado."
        actions={<CaseStatusBadge status={valuationCase.status} />}
      />

      <GovernanceNote>
        Campo em branco significa "não informado". Nenhum valor desta ficha é inferido, estimado ou
        preenchido automaticamente a partir de outra fonte.
      </GovernanceNote>

      <CompletenessPanel property={property} />

      <PropertyForm caseId={caseId} property={property} writable={writable} />

      {property?.["id"] ? (
        <DivergencePanel subjectPropertyId={property["id"] as string} writable={writable} />
      ) : null}
    </div>
  );
}

/* ============================================================ completude === */

function CompletenessPanel({ property }: { property: Record<string, unknown> | null }) {
  const result = marketPropertyCompleteness(
    {
      property_type_code: (property?.["property_type_code"] as string | null) ?? null,
      private_area: (property?.["private_area"] as number | null) ?? null,
      built_area: (property?.["built_area"] as number | null) ?? null,
      usable_area: (property?.["usable_area"] as number | null) ?? null,
      total_area: (property?.["total_area"] as number | null) ?? null,
      land_area: (property?.["land_area"] as number | null) ?? null,
      address_raw: (property?.["address_raw"] as string | null) ?? null,
      address_normalized: (property?.["address_normalized"] as string | null) ?? null,
      latitude: (property?.["latitude"] as number | null) ?? null,
      longitude: (property?.["longitude"] as number | null) ?? null,
      bedrooms: (property?.["bedrooms"] as number | null) ?? null,
      parking_spaces: (property?.["parking_spaces"] as number | null) ?? null,
      development_id: (property?.["development_id"] as string | null) ?? null,
    },
    { hasLinkedSource: false },
  );

  return (
    <div className="panel space-y-3 p-5">
      <SectionTitle
        title="Completude do cadastro"
        description='Contagem de informações essenciais presentes. Isto é completude de informação — não é confiança, qualidade nem probabilidade.'
      />
      <p className="mono-value text-foreground">{result.label}</p>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {result.items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className={
                item.notApplicable
                  ? "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"
                  : item.available
                    ? "h-1.5 w-1.5 rounded-full bg-success"
                    : "h-1.5 w-1.5 rounded-full bg-destructive"
              }
            />
            <span className="text-muted-foreground">
              {item.label}
              {item.notApplicable ? " (não aplicável)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================ divergência = */

function DivergencePanel({
  subjectPropertyId,
  writable,
}: {
  subjectPropertyId: string;
  writable: boolean;
}) {
  const fetchObservations = useServerFn(listSubjectAttributeObservations);
  const query = useQuery({
    queryKey: ["subject-attribute-observations", subjectPropertyId],
    queryFn: () => fetchObservations({ data: { subjectPropertyId } }),
  });

  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data) return null;

  const groups = groupByAttribute(query.data.observations).filter((g) => g.divergent);

  return (
    <div className="space-y-3">
      <SectionTitle
        title="Divergências de atributo"
        description="Valores conflitantes para o mesmo atributo permanecem todos visíveis. Nenhuma divergência é resolvida automaticamente."
      />
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma divergência registrada para este imóvel avaliando.
        </p>
      ) : (
        <ul className="panel divide-y divide-border">
          {groups.map((group) => (
            <DivergenceGroup
              key={group.attributeName}
              attributeName={group.attributeName}
              observations={group.observations}
              subjectPropertyId={subjectPropertyId}
              writable={writable}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DivergenceGroup({
  attributeName,
  observations,
  subjectPropertyId,
  writable,
}: {
  attributeName: string;
  observations: Array<Record<string, unknown>>;
  subjectPropertyId: string;
  writable: boolean;
}) {
  const queryClient = useQueryClient();
  const adopt = useServerFn(adoptCanonicalFact);
  const [reason, setReason] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (observationId: string) =>
      adopt({
        data: {
          observationId,
          attributeName,
          subjectPropertyId,
          reason: reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Fato canônico adotado.");
      setReason("");
      setSelectedId(null);
      void queryClient.invalidateQueries({
        queryKey: ["subject-attribute-observations", subjectPropertyId],
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <li className="space-y-3 px-4 py-3">
      <p className="text-sm font-medium text-foreground">{attributeName}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {observations.map((observation) => (
          <div key={observation["id"] as string} className="rounded-sm border border-border p-2 text-xs">
            <p className="mono-value text-foreground">
              {observation["normalized_value"] as string} {observation["unit"] ? `(${observation["unit"]})` : ""}
            </p>
            <p className="mt-1 text-muted-foreground">
              Origem: {observation["value_origin"] as string}
            </p>
            {writable ? (
              <Button
                variant={selectedId === observation["id"] ? "default" : "outline"}
                size="sm"
                className="mt-2"
                onClick={() => setSelectedId(observation["id"] as string)}
              >
                Selecionar
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {writable ? (
        <div className="space-y-1.5">
          <Label>Justificativa da adoção como fato canônico</Label>
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Base técnica para adotar o valor selecionado."
          />
          <Button
            size="sm"
            disabled={!selectedId || reason.trim().length < 3 || mutation.isPending}
            onClick={() => selectedId && mutation.mutate(selectedId)}
          >
            Adotar como fato canônico
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/* ==================================================================== form == */

type PropertyRecord = Record<string, unknown> | null;

function textOf(property: PropertyRecord, column: string): string {
  const raw = property ? property[column] : null;
  return raw === null || raw === undefined ? "" : String(raw);
}

function PropertyForm({
  caseId,
  property,
  writable,
}: {
  caseId: string;
  property: PropertyRecord;
  writable: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveProperty);
  const [values, setValues] = useState<Record<string, string>>({});

  const TEXT_FIELDS: [string, string][] = [
    ["addressLine", "address_line"],
    ["addressNumber", "address_number"],
    ["complement", "complement"],
    ["district", "district"],
    ["subdistrict", "subdistrict"],
    ["city", "city"],
    ["state", "state"],
    ["postalCode", "postal_code"],
    ["country", "country"],
    ["countryCode", "country_code"],
    ["streetType", "street_type"],
    ["streetName", "street_name"],
    ["streetNumber", "street_number"],
    ["addressRaw", "address_raw"],
    ["addressNormalized", "address_normalized"],
    ["latitude", "latitude"],
    ["longitude", "longitude"],
    ["privateArea", "private_area"],
    ["builtArea", "built_area"],
    ["landArea", "land_area"],
    ["usableArea", "usable_area"],
    ["totalArea", "total_area"],
    ["commonArea", "common_area"],
    ["bedrooms", "bedrooms"],
    ["suites", "suites"],
    ["bathrooms", "bathrooms"],
    ["halfBathrooms", "half_bathrooms"],
    ["parkingSpaces", "parking_spaces"],
    ["floorNumber", "floor_number"],
    ["totalFloors", "total_floors"],
    ["unitsPerFloor", "units_per_floor"],
    ["buildingUnits", "building_units"],
    ["elevators", "elevators"],
    ["constructionYear", "construction_year"],
    ["renovationYear", "renovation_year"],
    ["ceilingHeight", "ceiling_height"],
    ["frontage", "frontage"],
    ["depth", "depth"],
    ["topography", "topography"],
    ["viewType", "view_type"],
    ["orientation", "orientation"],
    ["positionInBuilding", "position_in_building"],
  ];

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const [key, column] of TEXT_FIELDS) initial[key] = textOf(property, column);
    initial["propertyType"] = textOf(property, "property_type");
    initial["propertyTypeCode"] = textOf(property, "property_type_code");
    initial["addressNormalizationStatus"] = textOf(property, "address_normalization_status");
    initial["conditionStatus"] = textOf(property, "condition_status");
    initial["occupancyStatus"] = textOf(property, "occupancy_status");
    initial["furnishedStatus"] = textOf(property, "furnished_status");
    initial["description"] = textOf(property, "description");
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property]);

  const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = propertySchema.parse({ caseId, ...values });
      return save({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Ficha do imóvel avaliando gravada.");
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const val = (key: string) => values[key] ?? "";

  return (
    <div className="space-y-4">
      <FormSection title="Identificação e tipologia">
        <SelectField
          label="Tipo de imóvel"
          value={val("propertyTypeCode")}
          onChange={set("propertyTypeCode")}
          options={PROPERTY_TYPE_CODES.map((code) => [code, PROPERTY_TYPE_LABELS[code]])}
          writable={writable}
        />
        <TextField
          label="Tipologia (texto livre)"
          value={val("propertyType")}
          onChange={set("propertyType")}
          writable={writable}
        />
      </FormSection>

      <FormSection title="Endereço">
        <TextField label="Logradouro" value={val("addressLine")} onChange={set("addressLine")} writable={writable} />
        <TextField label="Número" value={val("addressNumber")} onChange={set("addressNumber")} writable={writable} />
        <TextField label="Complemento" value={val("complement")} onChange={set("complement")} writable={writable} />
        <TextField label="Bairro" value={val("district")} onChange={set("district")} writable={writable} />
        <TextField label="Subdistrito" value={val("subdistrict")} onChange={set("subdistrict")} writable={writable} />
        <TextField label="Município" value={val("city")} onChange={set("city")} writable={writable} />
        <TextField label="UF" value={val("state")} onChange={set("state")} writable={writable} />
        <TextField label="CEP" value={val("postalCode")} onChange={set("postalCode")} writable={writable} />
        <TextField label="País" value={val("country")} onChange={set("country")} writable={writable} />
        <TextField label="Código do país (ISO)" value={val("countryCode")} onChange={set("countryCode")} writable={writable} />
        <TextField label="Tipo de logradouro" value={val("streetType")} onChange={set("streetType")} writable={writable} />
        <TextField label="Nome do logradouro" value={val("streetName")} onChange={set("streetName")} writable={writable} />
        <TextField label="Número do logradouro" value={val("streetNumber")} onChange={set("streetNumber")} writable={writable} />
        <TextField label="Endereço bruto" value={val("addressRaw")} onChange={set("addressRaw")} writable={writable} />
        <TextField label="Endereço normalizado" value={val("addressNormalized")} onChange={set("addressNormalized")} writable={writable} />
        <SelectField
          label="Situação da normalização"
          value={val("addressNormalizationStatus")}
          onChange={set("addressNormalizationStatus")}
          options={ADDRESS_NORMALIZATION_STATUSES.map((s) => [s, ADDRESS_NORMALIZATION_STATUS_LABELS[s]])}
          writable={writable}
        />
      </FormSection>

      <FormSection title="Georreferência">
        <TextField label="Latitude" value={val("latitude")} onChange={set("latitude")} writable={writable} />
        <TextField label="Longitude" value={val("longitude")} onChange={set("longitude")} writable={writable} />
      </FormSection>

      <FormSection title="Áreas">
        <TextField label="Área privativa (m²)" value={val("privateArea")} onChange={set("privateArea")} writable={writable} />
        <TextField label="Área útil (m²)" value={val("usableArea")} onChange={set("usableArea")} writable={writable} />
        <TextField label="Área construída (m²)" value={val("builtArea")} onChange={set("builtArea")} writable={writable} />
        <TextField label="Área total (m²)" value={val("totalArea")} onChange={set("totalArea")} writable={writable} />
        <TextField label="Área do terreno (m²)" value={val("landArea")} onChange={set("landArea")} writable={writable} />
        <TextField label="Área comum (m²)" value={val("commonArea")} onChange={set("commonArea")} writable={writable} />
      </FormSection>

      <FormSection title="Programa">
        <TextField label="Dormitórios" value={val("bedrooms")} onChange={set("bedrooms")} writable={writable} />
        <TextField label="Suítes" value={val("suites")} onChange={set("suites")} writable={writable} />
        <TextField label="Banheiros" value={val("bathrooms")} onChange={set("bathrooms")} writable={writable} />
        <TextField label="Lavabos" value={val("halfBathrooms")} onChange={set("halfBathrooms")} writable={writable} />
        <TextField label="Vagas" value={val("parkingSpaces")} onChange={set("parkingSpaces")} writable={writable} />
      </FormSection>

      <FormSection title="Edificação">
        <TextField label="Pavimento" value={val("floorNumber")} onChange={set("floorNumber")} writable={writable} />
        <TextField label="Total de pavimentos" value={val("totalFloors")} onChange={set("totalFloors")} writable={writable} />
        <TextField label="Unidades por andar" value={val("unitsPerFloor")} onChange={set("unitsPerFloor")} writable={writable} />
        <TextField label="Total de unidades do prédio" value={val("buildingUnits")} onChange={set("buildingUnits")} writable={writable} />
        <TextField label="Elevadores" value={val("elevators")} onChange={set("elevators")} writable={writable} />
        <TextField label="Ano de construção" value={val("constructionYear")} onChange={set("constructionYear")} writable={writable} />
        <TextField label="Ano de reforma" value={val("renovationYear")} onChange={set("renovationYear")} writable={writable} />
        <TextField label="Pé-direito (m)" value={val("ceilingHeight")} onChange={set("ceilingHeight")} writable={writable} />
      </FormSection>

      <FormSection title="Terreno">
        <TextField label="Frente (m)" value={val("frontage")} onChange={set("frontage")} writable={writable} />
        <TextField label="Profundidade (m)" value={val("depth")} onChange={set("depth")} writable={writable} />
        <TextField label="Topografia" value={val("topography")} onChange={set("topography")} writable={writable} />
      </FormSection>

      <FormSection title="Estado e ocupação">
        <SelectField
          label="Estado de conservação"
          value={val("conditionStatus")}
          onChange={set("conditionStatus")}
          options={CONDITION_STATUSES.map((s) => [s, CONDITION_STATUS_LABELS[s]])}
          writable={writable}
        />
        <SelectField
          label="Situação de ocupação"
          value={val("occupancyStatus")}
          onChange={set("occupancyStatus")}
          options={OCCUPANCY_STATUSES.map((s) => [s, OCCUPANCY_STATUS_LABELS[s]])}
          writable={writable}
        />
        <SelectField
          label="Mobília"
          value={val("furnishedStatus")}
          onChange={set("furnishedStatus")}
          options={FURNISHED_STATUSES.map((s) => [s, FURNISHED_STATUS_LABELS[s]])}
          writable={writable}
        />
        <TextField label="Vista" value={val("viewType")} onChange={set("viewType")} writable={writable} />
        <TextField label="Orientação solar" value={val("orientation")} onChange={set("orientation")} writable={writable} />
        <TextField label="Posição na edificação" value={val("positionInBuilding")} onChange={set("positionInBuilding")} writable={writable} />
      </FormSection>

      <FormSection title="Descrição técnica">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="prop-description">Descrição</Label>
          <Textarea
            id="prop-description"
            rows={4}
            disabled={!writable}
            value={val("description")}
            onChange={(e) => set("description")(e.target.value)}
            placeholder={NOT_INFORMED}
          />
        </div>
      </FormSection>

      {writable ? (
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Gravar ficha do imóvel avaliando
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seu papel atual, ou a situação do caso, permite apenas consulta.
        </p>
      )}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <SectionTitle title={title} />
      <div className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  writable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  writable: boolean;
}) {
  const id = `prop-${label}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        disabled={!writable}
        value={value}
        placeholder={NOT_INFORMED}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  writable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  writable: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={!writable}>
        <SelectTrigger>
          <SelectValue placeholder={NOT_INFORMED} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([code, optionLabel]) => (
            <SelectItem key={code} value={code}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
