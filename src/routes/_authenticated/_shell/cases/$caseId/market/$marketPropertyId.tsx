import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  CompletenessPanel,
  EvidenceStatusBadge,
  InlineNote,
  ObservationDates,
  ObservationStatusBadge,
  ObservationTypeBadge,
  PriceBlock,
  StatusCaveat,
  ValueOriginTag,
} from "@/components/app/MarketBits";
import { DataField, EmptyState, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
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
import { canReview, canWrite } from "@/hooks/use-workspace";
import {
  KNOWLEDGE_STATES,
  KNOWLEDGE_STATE_LABELS,
  MARKET_OBSERVATION_STATUSES,
  MARKET_OBSERVATION_STATUS_LABELS,
  MARKET_OBSERVATION_TYPES,
  MARKET_OBSERVATION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  SELLER_TYPES,
  SELLER_TYPE_LABELS,
  TRANSACTION_EVIDENCE_STATUSES,
  TRANSACTION_EVIDENCE_STATUS_LABELS,
  TRANSACTION_OBSERVATION_TYPES,
  VALUE_ORIGINS,
  VALUE_ORIGIN_LABELS,
  type MarketObservationType,
  type PropertyTypeCode,
} from "@/lib/domain/constants";
import {
  deriveUnitPrices,
  formatArea,
  formatCount,
  formatDateTime,
  formatDistance,
  formatMoney,
  groupByAttribute,
  marketObservationCompleteness,
  marketPropertyCompleteness,
  NOT_INFORMED,
} from "@/lib/domain/derivation";
import {
  adoptCanonicalFact,
  createAttributeObservation,
  createMarketObservation,
  getMarketPropertyDetail,
  recordPriceObservation,
} from "@/lib/market.functions";
import { createComparableCandidate } from "@/lib/comparables.functions";
import {
  adoptCanonicalFactSchema,
  createAttributeObservationSchema,
  createMarketObservationSchema,
  recordPriceObservationSchema,
} from "@/lib/validation/market-schemas";

export const Route = createFileRoute(
  "/_authenticated/_shell/cases/$caseId/market/$marketPropertyId",
)({
  component: MarketPropertyDetailPage,
});

function MarketPropertyDetailPage() {
  const { caseId, marketPropertyId } = useParams({
    from: "/_authenticated/_shell/cases/$caseId/market/$marketPropertyId",
  });
  const fetchDetail = useServerFn(getMarketPropertyDetail);
  const query = useQuery({
    queryKey: ["market-property", marketPropertyId],
    queryFn: () => fetchDetail({ data: { marketPropertyId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Imóvel de mercado indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/cases/$caseId/market" params={{ caseId }}>
              Voltar ao acervo
            </Link>
          </Button>
        }
      />
    );
  }

  const {
    property,
    observations,
    priceHistory,
    attributeObservations,
    canonicalFacts,
    sources,
    distanceMeters,
    role,
  } = query.data;
  const writable = canWrite(role);
  const reviewable = canReview(role);

  const completeness = marketPropertyCompleteness(property, {
    hasLinkedSource: observations.some((o) => o.evidence_source_id !== null),
  });
  const attributeGroups = groupByAttribute(attributeObservations);
  const activeFacts = canonicalFacts.filter((fact) => fact.superseded_at === null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          title={property.label ?? "Imóvel de mercado"}
          description={property.address_normalized ?? property.address_raw ?? NOT_INFORMED}
        />
        <Button asChild variant="ghost" size="sm">
          <Link to="/cases/$caseId/market" params={{ caseId }}>
            Voltar ao acervo
          </Link>
        </Button>
      </div>

      <div className="panel grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <DataField
          label="Tipologia"
          value={
            property.property_type_code
              ? (PROPERTY_TYPE_LABELS[property.property_type_code as PropertyTypeCode] ??
                property.property_type_code)
              : NOT_INFORMED
          }
        />
        <DataField label="Bairro" value={property.district ?? NOT_INFORMED} />
        <DataField label="Município" value={property.city ?? NOT_INFORMED} />
        <DataField label="Área privativa" value={formatArea(property.private_area)} />
        <DataField label="Área construída" value={formatArea(property.built_area)} />
        <DataField label="Área do terreno" value={formatArea(property.land_area)} />
        <DataField label="Dormitórios" value={formatCount(property.bedrooms)} />
        <DataField label="Suítes" value={formatCount(property.suites)} />
        <DataField label="Vagas" value={formatCount(property.parking_spaces)} />
        <DataField label="Pavimento" value={formatCount(property.floor_number)} />
        <DataField label="Ano de construção" value={formatCount(property.construction_year)} />
        <DataField
          label="Distância até o imóvel avaliando"
          value={formatDistance(distanceMeters)}
        />
      </div>

      <CompletenessPanel result={completeness} />

      <GovernanceNote>
        Distância é medida factual entre coordenadas registradas. A plataforma não define raio de
        busca, não pontua similaridade e não classifica o imóvel como comparável por proximidade.
      </GovernanceNote>

      {/* ============================ observações de mercado ============================ */}
      <div className="space-y-4">
        <SectionTitle
          title="Observações de mercado"
          description="Cada linha é uma leitura datada: oferta, cotação ou transação. Nenhuma substitui a outra."
        />

        {writable ? (
          <CreateObservationForm
            caseId={caseId}
            marketPropertyId={marketPropertyId}
            sources={sources}
          />
        ) : null}

        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma observação registrada.</p>
        ) : (
          <ul className="space-y-3">
            {observations.map((observation) => {
              const unit = deriveUnitPrices(property, {
                asking_price: observation.asking_price,
                transaction_price: observation.transaction_price,
              });
              const isTransaction = TRANSACTION_OBSERVATION_TYPES.includes(
                observation.observation_type as MarketObservationType,
              );
              const history = priceHistory.filter(
                (row) => row.market_observation_id === observation.id,
              );

              return (
                <li key={observation.id} className="panel space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <ObservationTypeBadge type={observation.observation_type} />
                    <ObservationStatusBadge status={observation.status} />
                    {isTransaction ? (
                      <EvidenceStatusBadge status={observation.transaction_evidence_status} />
                    ) : null}
                    {observation.portal_name ? (
                      <Badge variant="outline">{observation.portal_name}</Badge>
                    ) : null}
                  </div>

                  <PriceBlock
                    observation={observation}
                    askingPerArea={unit.askingPerArea}
                    transactionPerArea={unit.transactionPerArea}
                    areaBasisLabel={unit.area.basisLabel}
                  />
                  <ObservationDates observation={observation} />
                  <StatusCaveat status={observation.status} />

                  {observation.evidence_source_id === null ? (
                    <InlineNote>
                      Observação sem fonte vinculada: mantém-se como leitura não sustentada por
                      evidência arquivada.
                    </InlineNote>
                  ) : null}

                  <CompletenessPanel
                    result={marketObservationCompleteness(observation)}
                    title="Completude da observação"
                  />

                  {history.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Histórico de preço pedido (append-only)
                      </p>
                      <ul className="divide-y divide-border border-t border-border">
                        {history.map((row) => (
                          <li
                            key={row.id}
                            className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                          >
                            <span>
                              {formatMoney(row.asking_price, row.currency_code)}
                              {row.asking_monthly_rent !== null
                                ? ` · aluguel ${formatMoney(row.asking_monthly_rent, row.currency_code)}`
                                : ""}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(row.observed_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {writable && !isTransaction ? (
                    <RecordPriceForm observationId={observation.id} />
                  ) : null}

                  {writable ? (
                    <AddToComparablesButton caseId={caseId} observationId={observation.id} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ======================== observações de atributo / divergência ================ */}
      <div className="space-y-4">
        <SectionTitle
          title="Atributos observados e divergências"
          description="Valores conflitantes convivem no registro. A divergência é exibida, nunca resolvida automaticamente."
        />

        {writable ? (
          <CreateAttributeObservationForm
            caseId={caseId}
            marketPropertyId={marketPropertyId}
            sources={sources}
          />
        ) : null}

        {attributeGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma observação de atributo registrada.</p>
        ) : (
          <ul className="space-y-3">
            {attributeGroups.map((group) => {
              const adopted = activeFacts.find(
                (fact) => fact.attribute_name === group.attributeName,
              );
              return (
                <li key={group.attributeName} className="panel space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="mono-value text-sm">{group.attributeName}</p>
                    {group.divergent ? <Badge variant="destructive">Divergente</Badge> : null}
                    {adopted ? <Badge variant="default">Fato adotado</Badge> : null}
                  </div>

                  <ul className="divide-y divide-border border-t border-border">
                    {group.observations.map((observation) => (
                      <li key={observation.id} className="space-y-1 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-sm">
                            {observation.normalized_value ??
                              observation.raw_value ??
                              (observation.numeric_value !== null
                                ? String(observation.numeric_value)
                                : NOT_INFORMED)}
                            {observation.unit ? ` ${observation.unit}` : ""}
                          </span>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline">
                              {KNOWLEDGE_STATE_LABELS[
                                observation.knowledge_state as keyof typeof KNOWLEDGE_STATE_LABELS
                              ] ?? observation.knowledge_state}
                            </Badge>
                            <ValueOriginTag origin={observation.value_origin} />
                          </span>
                        </div>
                        {reviewable ? (
                          <AdoptFactForm
                            marketPropertyId={marketPropertyId}
                            observationId={observation.id}
                            attributeName={group.attributeName}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {adopted ? (
                    <InlineNote>
                      Valor adotado: {adopted.adopted_value ?? NOT_INFORMED} ·{" "}
                      {formatDateTime(adopted.adopted_at)} · motivo: {adopted.adoption_reason}.
                      Adotado não significa universalmente verdadeiro: é a decisão registrada deste
                      caso.
                    </InlineNote>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ================================================================ formulários */

type SourceOption = { id: string; source_name: string };

function CreateObservationForm({
  caseId,
  marketPropertyId,
  sources,
}: {
  caseId: string;
  marketPropertyId: string;
  sources: SourceOption[];
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createMarketObservation);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({ observationType: "SALE_LISTING" });

  const observationType = (values["observationType"] ?? "SALE_LISTING") as MarketObservationType;
  const isTransaction = TRANSACTION_OBSERVATION_TYPES.includes(observationType);
  const isRent = observationType === "RENT_LISTING" || observationType === "CLOSED_RENT";

  const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createMarketObservationSchema.parse({ caseId, marketPropertyId, ...values });
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Observação registrada.");
      setValues({ observationType: "SALE_LISTING" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["market-property", marketPropertyId] });
      void queryClient.invalidateQueries({ queryKey: ["market", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Registrar observação de mercado
      </Button>
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipo de observação</Label>
          <Select value={observationType} onValueChange={set("observationType")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MARKET_OBSERVATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {MARKET_OBSERVATION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Situação da observação</Label>
          <Select value={values["status"] ?? ""} onValueChange={set("status")}>
            <SelectTrigger>
              <SelectValue placeholder="Desconhecida" />
            </SelectTrigger>
            <SelectContent>
              {MARKET_OBSERVATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {MARKET_OBSERVATION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obs-currency">Moeda</Label>
          <Input
            id="obs-currency"
            placeholder="BRL"
            value={values["currencyCode"] ?? ""}
            onChange={(e) => set("currencyCode")(e.target.value.toUpperCase())}
          />
        </div>

        {!isTransaction && !isRent ? (
          <div className="space-y-1.5">
            <Label htmlFor="obs-asking">Preço pedido</Label>
            <Input
              id="obs-asking"
              value={values["askingPrice"] ?? ""}
              onChange={(e) => set("askingPrice")(e.target.value)}
            />
          </div>
        ) : null}
        {observationType === "RENT_LISTING" ? (
          <div className="space-y-1.5">
            <Label htmlFor="obs-rent">Aluguel pedido</Label>
            <Input
              id="obs-rent"
              value={values["askingMonthlyRent"] ?? ""}
              onChange={(e) => set("askingMonthlyRent")(e.target.value)}
            />
          </div>
        ) : null}
        {observationType === "CLOSED_SALE" ? (
          <div className="space-y-1.5">
            <Label htmlFor="obs-transaction">Preço transacionado</Label>
            <Input
              id="obs-transaction"
              value={values["transactionPrice"] ?? ""}
              onChange={(e) => set("transactionPrice")(e.target.value)}
            />
          </div>
        ) : null}
        {observationType === "CLOSED_RENT" ? (
          <div className="space-y-1.5">
            <Label htmlFor="obs-contracted">Aluguel contratado</Label>
            <Input
              id="obs-contracted"
              value={values["contractedMonthlyRent"] ?? ""}
              onChange={(e) => set("contractedMonthlyRent")(e.target.value)}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="obs-date">Data da observação</Label>
          <Input
            id="obs-date"
            placeholder="AAAA-MM-DD"
            value={values["observationDate"] ?? ""}
            onChange={(e) => set("observationDate")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-publication">Data de publicação</Label>
          <Input
            id="obs-publication"
            placeholder="AAAA-MM-DD"
            value={values["publicationDate"] ?? ""}
            onChange={(e) => set("publicationDate")(e.target.value)}
          />
        </div>

        {isTransaction ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="obs-tdate">Data da transação</Label>
              <Input
                id="obs-tdate"
                placeholder="AAAA-MM-DD"
                value={values["transactionDate"] ?? ""}
                onChange={(e) => set("transactionDate")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-doc">Documento da transação</Label>
              <Input
                id="obs-doc"
                value={values["transactionDocumentType"] ?? ""}
                onChange={(e) => set("transactionDocumentType")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs-registry">Referência de registro</Label>
              <Input
                id="obs-registry"
                value={values["registryReference"] ?? ""}
                onChange={(e) => set("registryReference")(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Situação da evidência de transação</Label>
              <Select
                value={values["transactionEvidenceStatus"] ?? ""}
                onValueChange={set("transactionEvidenceStatus")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Não verificada" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_EVIDENCE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TRANSACTION_EVIDENCE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="obs-portal">Portal / veículo</Label>
          <Input
            id="obs-portal"
            value={values["portalName"] ?? ""}
            onChange={(e) => set("portalName")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-listing">Identificador do anúncio</Label>
          <Input
            id="obs-listing"
            value={values["externalListingId"] ?? ""}
            onChange={(e) => set("externalListingId")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-url">URL do anúncio</Label>
          <Input
            id="obs-url"
            value={values["listingUrl"] ?? ""}
            onChange={(e) => set("listingUrl")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-broker">Corretor / imobiliária</Label>
          <Input
            id="obs-broker"
            value={values["brokerName"] ?? ""}
            onChange={(e) => set("brokerName")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Natureza do ofertante</Label>
          <Select value={values["sellerType"] ?? ""} onValueChange={set("sellerType")}>
            <SelectTrigger>
              <SelectValue placeholder="Desconhecida" />
            </SelectTrigger>
            <SelectContent>
              {SELLER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SELLER_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fonte de evidência</Label>
          <Select value={values["evidenceSourceId"] ?? ""} onValueChange={set("evidenceSourceId")}>
            <SelectTrigger>
              <SelectValue placeholder="Sem fonte vinculada" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.source_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="obs-notes">Observações técnicas</Label>
          <Textarea
            id="obs-notes"
            rows={3}
            value={values["notes"] ?? ""}
            onChange={(e) => set("notes")(e.target.value)}
          />
        </div>
      </div>

      <InlineNote>
        Uma oferta nunca recebe preço transacionado, e uma transação nunca recebe preço pedido: são
        registros distintos.
      </InlineNote>

      <div className="flex gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Registrar observação
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function RecordPriceForm({ observationId }: { observationId: string }) {
  const queryClient = useQueryClient();
  const record = useServerFn(recordPriceObservation);
  const [askingPrice, setAskingPrice] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = recordPriceObservationSchema.parse({
        observationId,
        askingPrice,
        observedAt,
        notes,
      });
      return record({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Nova leitura de preço registrada no histórico.");
      setAskingPrice("");
      setObservedAt("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["market-property"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Registrar nova leitura de preço pedido
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Novo preço pedido"
          value={askingPrice}
          onChange={(e) => setAskingPrice(e.target.value)}
        />
        <Input
          placeholder="Observado em (ISO)"
          value={observedAt}
          onChange={(e) => setObservedAt(e.target.value)}
        />
        <Input
          placeholder="Nota da leitura"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <InlineNote>
        O valor anterior não é sobrescrito: cada leitura entra como linha nova no histórico.
      </InlineNote>
      <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar leitura
      </Button>
    </div>
  );
}

function AddToComparablesButton({
  caseId,
  observationId,
}: {
  caseId: string;
  observationId: string;
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createComparableCandidate);

  const mutation = useMutation({
    mutationFn: () => create({ data: { caseId, marketObservationId: observationId } }),
    onSuccess: () => {
      toast.success("Observação adicionada à fila de comparáveis como DESCOBERTO.");
      void queryClient.invalidateQueries({ queryKey: ["comparables", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <Button variant="ghost" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      Enviar à fila de comparáveis
    </Button>
  );
}

function CreateAttributeObservationForm({
  caseId,
  marketPropertyId,
  sources,
}: {
  caseId: string;
  marketPropertyId: string;
  sources: SourceOption[];
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createAttributeObservation);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    knowledgeState: "KNOWN",
    valueOrigin: "MANUAL_USER_INPUT",
  });

  const set = (key: string) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createAttributeObservationSchema.parse({ caseId, marketPropertyId, ...values });
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Observação de atributo registrada.");
      setValues({ knowledgeState: "KNOWN", valueOrigin: "MANUAL_USER_INPUT" });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["market-property", marketPropertyId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Registrar observação de atributo
      </Button>
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="attr-name">Atributo</Label>
          <Input
            id="attr-name"
            value={values["attributeName"] ?? ""}
            onChange={(e) => set("attributeName")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attr-raw">Valor como observado</Label>
          <Input
            id="attr-raw"
            value={values["rawValue"] ?? ""}
            onChange={(e) => set("rawValue")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attr-numeric">Valor numérico (se aplicável)</Label>
          <Input
            id="attr-numeric"
            value={values["numericValue"] ?? ""}
            onChange={(e) => set("numericValue")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="attr-unit">Unidade</Label>
          <Input
            id="attr-unit"
            value={values["unit"] ?? ""}
            onChange={(e) => set("unit")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Estado de conhecimento</Label>
          <Select value={values["knowledgeState"] ?? ""} onValueChange={set("knowledgeState")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWLEDGE_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {KNOWLEDGE_STATE_LABELS[state]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Origem do valor</Label>
          <Select value={values["valueOrigin"] ?? ""} onValueChange={set("valueOrigin")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VALUE_ORIGINS.map((origin) => (
                <SelectItem key={origin} value={origin}>
                  {VALUE_ORIGIN_LABELS[origin]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fonte de evidência</Label>
          <Select value={values["evidenceSourceId"] ?? ""} onValueChange={set("evidenceSourceId")}>
            <SelectTrigger>
              <SelectValue placeholder="Sem fonte vinculada" />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.source_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Registrar observação
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function AdoptFactForm({
  marketPropertyId,
  observationId,
  attributeName,
}: {
  marketPropertyId: string;
  observationId: string;
  attributeName: string;
}) {
  const queryClient = useQueryClient();
  const adopt = useServerFn(adoptCanonicalFact);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = adoptCanonicalFactSchema.parse({
        marketPropertyId,
        observationId,
        attributeName,
        reason,
      });
      return adopt({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Fato canônico adotado com justificativa registrada.");
      setReason("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["market-property", marketPropertyId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Adotar como fato canônico
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label htmlFor={`adopt-${observationId}`}>Justificativa técnica da adoção</Label>
      <Textarea
        id={`adopt-${observationId}`}
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Adotar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
