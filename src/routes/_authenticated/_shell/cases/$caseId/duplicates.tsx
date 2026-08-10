import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { InlineNote } from "@/components/app/MarketBits";
import { EmptyState, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  MATCH_REASON_CODES,
  MATCH_REASON_CODE_LABELS,
  PROPERTY_MATCH_STATUSES,
  PROPERTY_MATCH_STATUS_LABELS,
  type MatchReasonCode,
  type PropertyMatchStatus,
} from "@/lib/domain/constants";
import { formatDateTime, formatDistance, NOT_INFORMED } from "@/lib/domain/derivation";
import {
  createMatchCandidate,
  listMarketProperties,
  listMatchCandidates,
  resolvePropertyMatch,
} from "@/lib/market.functions";
import { createMatchCandidateSchema, resolveMatchSchema } from "@/lib/validation/market-schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/duplicates")({
  component: DuplicatesPage,
});

const CLOSED_STATUSES = ["COMPLETED", "ARCHIVED"];

function DuplicatesPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchMarket = useServerFn(listMarketProperties);
  const fetchMatches = useServerFn(listMatchCandidates);

  const marketQuery = useQuery({
    queryKey: ["market", caseId],
    queryFn: () => fetchMarket({ data: { caseId } }),
  });
  const matchesQuery = useQuery({
    queryKey: ["matches", caseId],
    queryFn: () => fetchMatches({ data: { caseId } }),
  });

  if (marketQuery.isPending || matchesQuery.isPending) return <Skeleton className="h-96 w-full" />;
  if (marketQuery.isError || matchesQuery.isError) {
    return (
      <EmptyState
        title="Revisão de duplicidade indisponível"
        description="Não foi possível carregar o acervo de mercado deste caso."
      />
    );
  }

  const { properties, role, caseStatus } = marketQuery.data;
  const { matches } = matchesQuery.data;
  const writable = canWrite(role) && !CLOSED_STATUSES.includes(caseStatus);
  const reviewable = canReview(role) && !CLOSED_STATUSES.includes(caseStatus);

  const labelOf = (id: string) => {
    const property = properties.find((p) => p.id === id);
    return property?.label ?? property?.address_normalized ?? property?.address_raw ?? id;
  };

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Revisão de duplicidade"
        description="Vários anúncios podem descrever o mesmo imóvel físico. Tratar duplicidades como observações independentes contamina a base de comparação."
      />

      <GovernanceNote>
        Confirmar duplicidade é um registro de decisão, não uma fusão: nenhum imóvel é apagado,
        nenhuma observação é removida, nenhuma fonte é descartada e todo o histórico de preço
        permanece legível nos dois lados.
      </GovernanceNote>

      {writable ? <CreateMatchForm caseId={caseId} properties={properties} /> : null}

      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum par sob revisão de duplicidade neste caso.
        </p>
      ) : (
        <ul className="space-y-3">
          {matches.map((match) => (
            <li key={match.id} className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm">
                    {labelOf(match.left_market_property_id)} ·{" "}
                    {labelOf(match.right_market_property_id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Registrado em {formatDateTime(match.created_at)}
                  </p>
                </div>
                <Badge variant={match.match_status === "CONFIRMED_SAME" ? "default" : "outline"}>
                  {PROPERTY_MATCH_STATUS_LABELS[match.match_status as PropertyMatchStatus] ??
                    match.match_status}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {match.reason_codes.map((code) => (
                  <Badge key={code} variant="secondary">
                    {MATCH_REASON_CODE_LABELS[code as MatchReasonCode] ?? code}
                  </Badge>
                ))}
              </div>

              <DeterministicSignals signals={match.deterministic_signals} />

              {match.review_notes ? (
                <InlineNote>Nota de revisão: {match.review_notes}</InlineNote>
              ) : null}

              {reviewable && match.reviewed_at === null ? (
                <ResolveMatchForm caseId={caseId} matchId={match.id} />
              ) : match.reviewed_at !== null ? (
                <InlineNote>Revisado em {formatDateTime(match.reviewed_at)}.</InlineNote>
              ) : (
                <InlineNote>Seu papel atual não permite resolver duplicidades.</InlineNote>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DeterministicSignals({ signals }: { signals: unknown }) {
  if (signals === null || typeof signals !== "object") return null;
  const entries = Object.entries(signals as Record<string, unknown>).filter(
    ([key]) => key !== "signals_version",
  );
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Sinais determinísticos (comparação literal, sem escore)
      </p>
      <ul className="grid gap-1 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <li key={key} className="text-xs text-muted-foreground">
            <span className="mono-value mr-2">
              {key === "distance_meters"
                ? formatDistance(typeof value === "number" ? value : null)
                : value === true
                  ? "sim"
                  : value === false
                    ? "não"
                    : String(value ?? NOT_INFORMED)}
            </span>
            {key}
          </li>
        ))}
      </ul>
    </div>
  );
}

type PropertyOption = {
  id: string;
  label: string | null;
  address_raw: string | null;
  address_normalized: string | null;
};

function CreateMatchForm({
  caseId,
  properties,
}: {
  caseId: string;
  properties: PropertyOption[];
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createMatchCandidate);
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createMatchCandidateSchema.parse({
        caseId,
        leftMarketPropertyId: left,
        rightMarketPropertyId: right,
        reasonCodes: codes,
        notes,
      });
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Par registrado para revisão de duplicidade.");
      setLeft("");
      setRight("");
      setCodes([]);
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["matches", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const optionLabel = (property: PropertyOption) =>
    property.label ?? property.address_normalized ?? property.address_raw ?? property.id;

  return (
    <div className="panel space-y-4 p-5">
      <SectionTitle
        title="Registrar par sob suspeita"
        description="A suspeita é declarada com sinais objetivos. A plataforma não decide automaticamente que dois registros são o mesmo imóvel."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Primeiro imóvel</Label>
          <Select value={left} onValueChange={setLeft}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {optionLabel(property)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Segundo imóvel</Label>
          <Select value={right} onValueChange={setRight}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {optionLabel(property)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Sinais observados</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {MATCH_REASON_CODES.map((code) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={codes.includes(code)}
                onCheckedChange={(checked) =>
                  setCodes((current) =>
                    checked === true ? [...current, code] : current.filter((c) => c !== code),
                  )
                }
              />
              {MATCH_REASON_CODE_LABELS[code]}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="match-notes">Nota de revisão</Label>
        <Textarea
          id="match-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar par
      </Button>
    </div>
  );
}

function ResolveMatchForm({ caseId, matchId }: { caseId: string; matchId: string }) {
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolvePropertyMatch);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = resolveMatchSchema.parse({ matchId, status, notes });
      return resolve({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Duplicidade resolvida. Nenhum registro foi fundido ou removido.");
      setStatus("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: ["matches", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Decisão</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_MATCH_STATUSES.map((option) => (
                <SelectItem key={option} value={option}>
                  {PROPERTY_MATCH_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`resolve-notes-${matchId}`}>Justificativa</Label>
          <Textarea
            id={`resolve-notes-${matchId}`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <InlineNote>
        “Mesmo imóvel” marca a duplicidade para que a mesma unidade não seja contada duas vezes na
        comparação — sem apagar nenhum dos lados.
      </InlineNote>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar decisão
      </Button>
    </div>
  );
}
