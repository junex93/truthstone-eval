import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  AddressStatusBadge,
  CompletenessPanel,
  InlineNote,
  ObservationStatusBadge,
  ObservationTypeBadge,
} from "@/components/app/MarketBits";
import { EmptyState, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
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
import {
  CONDITION_STATUSES,
  CONDITION_STATUS_LABELS,
  FURNISHED_STATUSES,
  FURNISHED_STATUS_LABELS,
  OCCUPANCY_STATUSES,
  OCCUPANCY_STATUS_LABELS,
  PROPERTY_TYPE_CODES,
  PROPERTY_TYPE_LABELS,
  type PropertyTypeCode,
} from "@/lib/domain/constants";
import {
  deriveUnitPrices,
  formatArea,
  formatCount,
  formatMoney,
  formatUnitPrice,
  marketPropertyCompleteness,
  NOT_INFORMED,
} from "@/lib/domain/derivation";
import { createMarketProperty, listMarketProperties } from "@/lib/market.functions";
import { createMarketPropertySchema } from "@/lib/validation/market-schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/market/")({
  component: MarketPage,
});

const CLOSED_STATUSES = ["COMPLETED", "ARCHIVED"];

function MarketPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchList = useServerFn(listMarketProperties);
  const query = useQuery({
    queryKey: ["market", caseId],
    queryFn: () => fetchList({ data: { caseId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Acervo de mercado indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const { properties, observations, role, caseStatus } = query.data;
  const writable = canWrite(role) && !CLOSED_STATUSES.includes(caseStatus);

  const byProperty = new Map<string, typeof observations>();
  for (const observation of observations) {
    const list = byProperty.get(observation.market_property_id) ?? [];
    list.push(observation);
    byProperty.set(observation.market_property_id, list);
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Acervo de mercado"
        description="Imóvel físico, anúncio e transação são registros distintos. Um imóvel de mercado pode acumular várias observações ao longo do tempo, e nenhuma delas é apagada."
      />

      <GovernanceNote>
        Preço pedido não é preço transacionado. Anúncio removido não é venda. Campo em branco
        permanece “não informado” e nunca é convertido em zero.
      </GovernanceNote>

      {writable ? <CreateMarketPropertyForm caseId={caseId} /> : null}

      {properties.length === 0 ? (
        <EmptyState
          title="Nenhum imóvel de mercado registrado"
          description="Cadastre os imóveis observados no mercado antes de compor a fila de comparáveis."
        />
      ) : (
        <ul className="space-y-3">
          {properties.map((property) => {
            const propertyObservations = byProperty.get(property.id) ?? [];
            const completeness = marketPropertyCompleteness(property, {
              hasLinkedSource: propertyObservations.some((o) => o.evidence_source_id !== null),
            });
            const latest = propertyObservations[0];
            const unit = latest
              ? deriveUnitPrices(property, {
                  asking_price: latest.asking_price,
                  transaction_price: latest.transaction_price,
                })
              : null;

            return (
              <li key={property.id} className="panel space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{property.label ?? "Imóvel sem rótulo"}</p>
                      <Badge variant="outline">
                        {property.property_type_code
                          ? (PROPERTY_TYPE_LABELS[
                              property.property_type_code as PropertyTypeCode
                            ] ?? property.property_type_code)
                          : "Tipologia não informada"}
                      </Badge>
                      <AddressStatusBadge status={property.address_normalization_status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {property.address_normalized ?? property.address_raw ?? NOT_INFORMED}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Área privativa: {formatArea(property.private_area)} · Terreno:{" "}
                      {formatArea(property.land_area)} · Dormitórios:{" "}
                      {formatCount(property.bedrooms)} · Vagas:{" "}
                      {formatCount(property.parking_spaces)}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to="/cases/$caseId/market/$marketPropertyId"
                      params={{ caseId, marketPropertyId: property.id }}
                    >
                      Abrir imóvel
                    </Link>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Observações: {propertyObservations.length}
                  </span>
                  {latest ? (
                    <>
                      <ObservationTypeBadge type={latest.observation_type} />
                      <ObservationStatusBadge status={latest.status} />
                      <span>
                        {latest.transaction_price !== null
                          ? `Transacionado: ${formatMoney(latest.transaction_price, latest.currency_code)}`
                          : `Pedido: ${formatMoney(latest.asking_price, latest.currency_code)}`}
                      </span>
                      {unit ? (
                        <span className="text-xs text-muted-foreground">
                          {formatUnitPrice(
                            latest.transaction_price !== null
                              ? unit.transactionPerArea
                              : unit.askingPerArea,
                            latest.currency_code,
                          )}{" "}
                          · base: {unit.area.basisLabel}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <InlineNote>Nenhuma observação de mercado registrada.</InlineNote>
                  )}
                </div>

                <CompletenessPanel result={completeness} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const TEXT_FIELDS = [
  { key: "label", label: "Rótulo interno" },
  { key: "unitIdentifier", label: "Identificação da unidade" },
  { key: "addressRaw", label: "Endereço como observado" },
  { key: "district", label: "Bairro" },
  { key: "city", label: "Município" },
  { key: "state", label: "UF" },
  { key: "postalCode", label: "CEP" },
  { key: "latitude", label: "Latitude" },
  { key: "longitude", label: "Longitude" },
  { key: "privateArea", label: "Área privativa (m²)" },
  { key: "usableArea", label: "Área útil (m²)" },
  { key: "builtArea", label: "Área construída (m²)" },
  { key: "totalArea", label: "Área total (m²)" },
  { key: "landArea", label: "Área do terreno (m²)" },
  { key: "commonArea", label: "Área comum (m²)" },
  { key: "bedrooms", label: "Dormitórios" },
  { key: "suites", label: "Suítes" },
  { key: "bathrooms", label: "Banheiros" },
  { key: "halfBathrooms", label: "Lavabos" },
  { key: "parkingSpaces", label: "Vagas" },
  { key: "floorNumber", label: "Pavimento" },
  { key: "totalFloors", label: "Total de pavimentos" },
  { key: "constructionYear", label: "Ano de construção" },
  { key: "renovationYear", label: "Ano de reforma" },
] as const;

function CreateMarketPropertyForm({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createMarketProperty);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createMarketPropertySchema.parse({ caseId, ...values });
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Imóvel de mercado registrado.");
      setValues({});
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["market", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Registrar imóvel de mercado
      </Button>
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <SectionTitle
        title="Novo imóvel de mercado"
        description="Registre o imóvel físico observado. O anúncio e o preço são registrados depois, como observações datadas."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipologia</Label>
          <Select
            value={values["propertyTypeCode"] ?? ""}
            onValueChange={set("propertyTypeCode")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Não informada" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPE_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {PROPERTY_TYPE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`mp-${field.key}`}>{field.label}</Label>
            <Input
              id={`mp-${field.key}`}
              placeholder={NOT_INFORMED}
              value={values[field.key] ?? ""}
              onChange={(e) => set(field.key)(e.target.value)}
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <Label>Estado de conservação</Label>
          <Select value={values["conditionStatus"] ?? ""} onValueChange={set("conditionStatus")}>
            <SelectTrigger>
              <SelectValue placeholder="Desconhecido" />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {CONDITION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ocupação</Label>
          <Select value={values["occupancyStatus"] ?? ""} onValueChange={set("occupancyStatus")}>
            <SelectTrigger>
              <SelectValue placeholder="Desconhecida" />
            </SelectTrigger>
            <SelectContent>
              {OCCUPANCY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {OCCUPANCY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mobiliado</Label>
          <Select value={values["furnishedStatus"] ?? ""} onValueChange={set("furnishedStatus")}>
            <SelectTrigger>
              <SelectValue placeholder="Desconhecido" />
            </SelectTrigger>
            <SelectContent>
              {FURNISHED_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {FURNISHED_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="mp-description">Descrição observada</Label>
          <Textarea
            id="mp-description"
            rows={3}
            value={values["description"] ?? ""}
            onChange={(e) => set("description")(e.target.value)}
          />
        </div>
      </div>

      <InlineNote>
        Campos em branco são gravados como “não informado”. Nenhum valor é estimado, arredondado ou
        preenchido automaticamente.
      </InlineNote>

      <div className="flex gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Registrar imóvel
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
