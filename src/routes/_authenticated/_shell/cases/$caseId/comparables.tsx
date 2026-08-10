import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  CandidateStatusBadge,
  InlineNote,
  ObservationStatusBadge,
  ObservationTypeBadge,
  StatusCaveat,
} from "@/components/app/MarketBits";
import { EmptyState, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  COMPARABLE_CANDIDATE_STATUSES,
  COMPARABLE_CANDIDATE_STATUS_LABELS,
  COMPARABLE_INCLUSION_STATUSES,
  COMPARABLE_INCLUSION_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  type ComparableCandidateStatus,
  type ComparableInclusionStatus,
  type PropertyTypeCode,
} from "@/lib/domain/constants";
import {
  deriveUnitPrices,
  formatArea,
  formatCount,
  formatDate,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatUnitPrice,
  NOT_INFORMED,
} from "@/lib/domain/derivation";
import { createComparableCandidate, decideComparable, listComparableDecisionHistory, listComparables } from "@/lib/comparables.functions";
import { decideComparableSchema } from "@/lib/validation/market-schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/comparables")({
  component: ComparablesPage,
});

const CLOSED_STATUSES = ["COMPLETED", "ARCHIVED"];

function ComparablesPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchList = useServerFn(listComparables);
  const query = useQuery({
    queryKey: ["comparables", caseId],
    queryFn: () => fetchList({ data: { caseId } }),
  });
  const [inclusionFilter, setInclusionFilter] = useState<string>("ALL");

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Comparáveis indisponíveis"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const {
    candidates,
    observations,
    properties,
    exclusionReasons,
    subjectProperty,
    distances,
    role,
    caseStatus,
  } = query.data;
  const writable = canWrite(role) && !CLOSED_STATUSES.includes(caseStatus);
  const reviewable = canReview(role) && !CLOSED_STATUSES.includes(caseStatus);

  const observationById = new Map(observations.map((o) => [o.id, o]));
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const candidateObservationIds = new Set(candidates.map((c) => c.market_observation_id));
  const pending = observations.filter((o) => !candidateObservationIds.has(o.id));

  const counts = {
    total: candidates.length,
    eligible: candidates.filter((c) => c.candidate_status === "ELIGIBLE").length,
    included: candidates.filter((c) => c.inclusion_status === "INCLUDED").length,
    excluded: candidates.filter((c) => c.inclusion_status === "EXCLUDED").length,
  };

  const visible =
    inclusionFilter === "ALL"
      ? candidates
      : candidates.filter((c) => c.inclusion_status === inclusionFilter);

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Comparáveis"
        description="Descoberto, elegível e incluído são estados distintos. Cada mudança exige decisão humana registrada; a exclusão exige motivo da taxonomia."
      />

      <GovernanceNote>
        A plataforma não calcula valor, não aplica fator, não pondera e não sugere quais observações
        devem ser incluídas. Excluir um comparável não o apaga: a linha e todo o histórico
        permanecem legíveis.
      </GovernanceNote>

      <div className="panel flex flex-wrap gap-6 p-4 text-sm">
        <span>
          Fila total: <span className="mono-value">{counts.total}</span>
        </span>
        <span>
          Elegíveis: <span className="mono-value">{counts.eligible}</span>
        </span>
        <span>
          Incluídos: <span className="mono-value">{counts.included}</span>
        </span>
        <span>
          Excluídos: <span className="mono-value">{counts.excluded}</span>
        </span>
      </div>

      {subjectProperty === null ? (
        <EmptyState
          title="Imóvel avaliando não cadastrado"
          description="A comparação exige a ficha do imóvel avaliando."
          action={
            <Button asChild variant="outline">
              <Link to="/cases/$caseId/property" params={{ caseId }}>
                Cadastrar imóvel avaliando
              </Link>
            </Button>
          }
        />
      ) : null}

      {/* ======================= fila de observações ainda não avaliadas ============== */}
      {writable && pending.length > 0 ? (
        <div className="space-y-3">
          <SectionTitle
            title="Observações fora da fila"
            description="Enviar à fila registra a observação como DESCOBERTO. Isso não a torna elegível nem incluída."
          />
          <ul className="panel divide-y divide-border">
            {pending.map((observation) => {
              const property = propertyById.get(observation.market_property_id);
              return (
                <li
                  key={observation.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm">{property?.label ?? "Imóvel sem rótulo"}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <ObservationTypeBadge type={observation.observation_type} />
                      <ObservationStatusBadge status={observation.status} />
                      <span className="text-xs text-muted-foreground">
                        {observation.transaction_price !== null
                          ? `Transacionado ${formatMoney(observation.transaction_price, observation.currency_code)}`
                          : `Pedido ${formatMoney(observation.asking_price, observation.currency_code)}`}
                      </span>
                    </div>
                  </div>
                  <AddToQueueButton caseId={caseId} observationId={observation.id} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* ================================ fila de comparáveis ========================= */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle title="Fila de comparáveis" />
          <div className="w-56 space-y-1.5">
            <Label>Filtrar por inclusão</Label>
            <Select value={inclusionFilter} onValueChange={setInclusionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {COMPARABLE_INCLUSION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {COMPARABLE_INCLUSION_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum candidato nesta seleção.</p>
        ) : (
          <ul className="space-y-4">
            {visible.map((candidate) => {
              const observation = observationById.get(candidate.market_observation_id);
              const property = propertyById.get(candidate.market_property_id);
              const unit =
                property && observation
                  ? deriveUnitPrices(property, {
                      asking_price: observation.asking_price,
                      transaction_price: observation.transaction_price,
                    })
                  : null;
              const subjectUnitBasis = subjectProperty
                ? deriveUnitPrices(subjectProperty, {}).area
                : null;

              return (
                <li key={candidate.id} className="panel space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{property?.label ?? "Imóvel sem rótulo"}</p>
                      <p className="text-sm text-muted-foreground">
                        {property?.address_normalized ?? property?.address_raw ?? NOT_INFORMED}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {observation ? (
                          <>
                            <ObservationTypeBadge type={observation.observation_type} />
                            <ObservationStatusBadge status={observation.status} />
                          </>
                        ) : null}
                        <CandidateStatusBadge
                          candidateStatus={candidate.candidate_status}
                          inclusionStatus={candidate.inclusion_status}
                        />
                      </div>
                    </div>
                    {property ? (
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to="/cases/$caseId/market/$marketPropertyId"
                          params={{ caseId, marketPropertyId: property.id }}
                        >
                          Abrir imóvel
                        </Link>
                      </Button>
                    ) : null}
                  </div>

                  {observation ? <StatusCaveat status={observation.status} /> : null}

                  {/* comparação lado a lado, sem homogeneização */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-4">Atributo</th>
                          <th className="py-2 pr-4">Imóvel avaliando</th>
                          <th className="py-2">Comparável</th>
                        </tr>
                      </thead>
                      <tbody>
                        <ComparisonRow
                          label="Tipologia"
                          subject={
                            subjectProperty?.property_type_code
                              ? (PROPERTY_TYPE_LABELS[
                                  subjectProperty.property_type_code as PropertyTypeCode
                                ] ?? subjectProperty.property_type_code)
                              : NOT_INFORMED
                          }
                          comparable={
                            property?.property_type_code
                              ? (PROPERTY_TYPE_LABELS[
                                  property.property_type_code as PropertyTypeCode
                                ] ?? property.property_type_code)
                              : NOT_INFORMED
                          }
                        />
                        <ComparisonRow
                          label="Área privativa"
                          subject={formatArea(subjectProperty?.private_area)}
                          comparable={formatArea(property?.private_area)}
                        />
                        <ComparisonRow
                          label="Área do terreno"
                          subject={formatArea(subjectProperty?.land_area)}
                          comparable={formatArea(property?.land_area)}
                        />
                        <ComparisonRow
                          label="Dormitórios"
                          subject={formatCount(subjectProperty?.bedrooms)}
                          comparable={formatCount(property?.bedrooms)}
                        />
                        <ComparisonRow
                          label="Suítes"
                          subject={formatCount(subjectProperty?.suites)}
                          comparable={formatCount(property?.suites)}
                        />
                        <ComparisonRow
                          label="Vagas"
                          subject={formatCount(subjectProperty?.parking_spaces)}
                          comparable={formatCount(property?.parking_spaces)}
                        />
                        <ComparisonRow
                          label="Ano de construção"
                          subject={formatCount(subjectProperty?.construction_year)}
                          comparable={formatCount(property?.construction_year)}
                        />
                        <ComparisonRow
                          label="Distância"
                          subject="—"
                          comparable={formatDistance(
                            property ? (distances[property.id] ?? null) : null,
                          )}
                        />
                        <ComparisonRow
                          label="Data da observação"
                          subject="—"
                          comparable={formatDate(
                            observation?.transaction_date ?? observation?.observation_date,
                          )}
                        />
                        <ComparisonRow
                          label={`Preço unitário (base: ${unit?.area.basisLabel ?? subjectUnitBasis?.basisLabel ?? "não definida"})`}
                          subject="—"
                          comparable={formatUnitPrice(
                            unit
                              ? (unit.transactionPerArea ?? unit.askingPerArea)
                              : null,
                            observation?.currency_code,
                          )}
                        />
                      </tbody>
                    </table>
                  </div>

                  <InlineNote>
                    Nenhum valor desta tabela é homogeneizado, ajustado ou ponderado. A comparação é
                    apresentação factual lado a lado.
                  </InlineNote>

                  {candidate.exclusion_reason_code ? (
                    <div className="rounded-md border border-border p-3 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Motivo da exclusão
                      </p>
                      <p>
                        {exclusionReasons.find((r) => r.code === candidate.exclusion_reason_code)
                          ?.label ?? candidate.exclusion_reason_code}
                      </p>
                      {candidate.exclusion_notes ? (
                        <p className="text-xs text-muted-foreground">{candidate.exclusion_notes}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {reviewable ? (
                    <DecisionForm
                      caseId={caseId}
                      candidateId={candidate.id}
                      exclusionReasons={exclusionReasons}
                    />
                  ) : (
                    <InlineNote>
                      Seu papel atual não permite decidir elegibilidade ou inclusão.
                    </InlineNote>
                  )}

                  <DecisionHistory candidateId={candidate.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  subject,
  comparable,
}: {
  label: string;
  subject: string;
  comparable: string;
}) {
  return (
    <tr className="border-b border-border/60">
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      <td className="py-2 pr-4">{subject}</td>
      <td className="py-2">{comparable}</td>
    </tr>
  );
}

function AddToQueueButton({ caseId, observationId }: { caseId: string; observationId: string }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createComparableCandidate);
  const mutation = useMutation({
    mutationFn: () => create({ data: { caseId, marketObservationId: observationId } }),
    onSuccess: () => {
      toast.success("Observação enviada à fila como DESCOBERTO.");
      void queryClient.invalidateQueries({ queryKey: ["comparables", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });
  return (
    <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      Enviar à fila
    </Button>
  );
}

type ExclusionReason = { code: string; label: string; description: string | null };

function DecisionForm({
  caseId,
  candidateId,
  exclusionReasons,
}: {
  caseId: string;
  candidateId: string;
  exclusionReasons: ExclusionReason[];
}) {
  const queryClient = useQueryClient();
  const decide = useServerFn(decideComparable);
  const [candidateStatus, setCandidateStatus] = useState("");
  const [inclusionStatus, setInclusionStatus] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = decideComparableSchema.parse({
        candidateId,
        candidateStatus: candidateStatus || undefined,
        inclusionStatus: inclusionStatus || undefined,
        reasonCode,
        notes,
      });
      return decide({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Decisão registrada com histórico imutável.");
      setCandidateStatus("");
      setInclusionStatus("");
      setReasonCode("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["comparables", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["comparable-history", candidateId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Registrar decisão</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Elegibilidade</Label>
          <Select value={candidateStatus} onValueChange={setCandidateStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Sem alteração" />
            </SelectTrigger>
            <SelectContent>
              {COMPARABLE_CANDIDATE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {COMPARABLE_CANDIDATE_STATUS_LABELS[status as ComparableCandidateStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Inclusão</Label>
          <Select value={inclusionStatus} onValueChange={setInclusionStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Sem alteração" />
            </SelectTrigger>
            <SelectContent>
              {COMPARABLE_INCLUSION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {COMPARABLE_INCLUSION_STATUS_LABELS[status as ComparableInclusionStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {inclusionStatus === "EXCLUDED" ? (
          <div className="space-y-1.5">
            <Label>Motivo da exclusão (taxonomia)</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {exclusionReasons.map((reason) => (
                  <SelectItem key={reason.code} value={reason.code}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`decision-notes-${candidateId}`}>Justificativa técnica</Label>
        <Textarea
          id={`decision-notes-${candidateId}`}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <InlineNote>
        A exclusão exige motivo da taxonomia; o motivo “Outro” exige descrição textual. Excluir não
        apaga: a observação e sua evidência permanecem no acervo.
      </InlineNote>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar decisão
      </Button>
    </div>
  );
}

function DecisionHistory({ candidateId }: { candidateId: string }) {
  const fetchHistory = useServerFn(listComparableDecisionHistory);
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["comparable-history", candidateId],
    queryFn: () => fetchHistory({ data: { candidateId } }),
    enabled: open,
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Ver histórico de decisões
      </Button>
    );
  }

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Histórico de decisões (append-only)
      </p>
      {query.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : query.data && query.data.history.length > 0 ? (
        <ul className="divide-y divide-border">
          {query.data.history.map((entry) => (
            <li key={entry.id} className="py-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  {entry.previous_candidate_status ?? "—"} → {entry.new_candidate_status ?? "—"} ·{" "}
                  {entry.previous_inclusion_status ?? "—"} → {entry.new_inclusion_status ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.created_at)}
                </span>
              </div>
              {entry.reason_code ? (
                <Badge variant="outline" className="mt-1">
                  {entry.reason_code}
                </Badge>
              ) : null}
              {entry.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma decisão registrada.</p>
      )}
    </div>
  );
}
