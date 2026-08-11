import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  AgeBuckets,
  AttributeCoverageTable,
  DistributionRow,
  HashLine,
  IssueBadges,
  IssueTypeLabel,
  MetricTile,
  PeriodLine,
  ReadinessBadge,
} from "@/components/app/IntelligenceBits";
import { EmptyState, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canReview, canWrite } from "@/hooks/use-workspace";
import { formatDate, formatDateTime, formatDistance, formatMoney } from "@/lib/domain/derivation";
import {
  FUNNEL_ORDER,
  FUNNEL_STAGE_LABELS,
  RESEARCH_GAP_LABELS,
  whyLostLabel,
} from "@/lib/domain/intelligence";
import {
  acknowledgeMarketDataIssue,
  acknowledgeReadinessWarnings,
  assessSampleReadiness,
  completeSampleSelection,
  createMarketEvidenceSnapshot,
  getMarketIntelligence,
  refreshMarketDataIssues,
  resolveMarketDataIssue,
  startSampleSelection,
  verifySnapshotIntegrity,
} from "@/lib/market-intelligence.functions";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/intelligence")({
  component: IntelligencePage,
});

const CLOSED_STATUSES = ["COMPLETED", "ARCHIVED"];

function IntelligencePage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const queryClient = useQueryClient();
  const fetchReport = useServerFn(getMarketIntelligence);

  const query = useQuery({
    queryKey: ["market-intelligence", caseId],
    queryFn: () => fetchReport({ data: { caseId } }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["market-intelligence", caseId] });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Diagnóstico indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const { report, role, caseStatus, policies, snapshots, selectionRuns, selectionSnapshots, issues, readiness } =
    query.data;
  const writable = canWrite(role) && !CLOSED_STATUSES.includes(caseStatus);
  const reviewable = canReview(role) && !CLOSED_STATUSES.includes(caseStatus);
  const header = report.header as Record<string, number | null>;
  const latestReadiness = readiness[0];

  return (
    <div className="space-y-10">
      <SectionTitle
        title="Inteligência de mercado"
        description="Retrato factual do acervo deste caso: o que foi observado, de quantas fontes independentes, com que idade, a que distância e com que lacunas."
      />

      <GovernanceNote>
        Este painel é descritivo. Não há cálculo de valor, ajuste, fator, saneamento estatístico ou
        descarte automático de observação. Quartis e cercas exploratórias apenas sinalizam
        &quot;possível observação extrema&quot; para leitura humana; nada é removido do acervo.
      </GovernanceNote>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="Observações" value={report.funnel["market_observations"] ?? 0} />
        <MetricTile
          label="Imóveis físicos independentes"
          value={report.funnel["independent_properties"] ?? 0}
          hint="após agrupamento de identidade confirmado"
        />
        <MetricTile label="Fontes distintas" value={String(header["source_count"] ?? "—")} />
        <MetricTile label="Domínios distintos" value={report.domains.length} />
        <MetricTile
          label="Transações verificadas"
          value={
            report.research_gaps.some((g) => g.code === "NO_VERIFIED_TRANSACTION")
              ? "0"
              : String(header["transaction_observation_count"] ?? "—")
          }
          hint="preço pedido nunca é preço transacionado"
        />
        <MetricTile label="Divergências abertas" value={report.conflict_map.length} />
        <MetricTile label="Duplicidades não resolvidas" value={report.unresolved_identity.length} />
        <MetricTile
          label="Data de referência"
          value={formatDate(report.valuation_reference_date)}
          hint={`diagnóstico ${report.diagnostics_version}`}
        />
      </section>

      {/* ------------------------------------------------ matriz de evidência */}
      <section className="space-y-3">
        <SectionTitle
          step="01"
          title="Matriz de evidência de mercado"
          description="Uma linha por imóvel físico independente. Múltiplos anúncios do mesmo imóvel aparecem agrupados, nunca contados duas vezes."
        />
        {report.matrix.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum imóvel de mercado neste caso.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="label-meta py-2">Imóvel</th>
                  <th className="label-meta py-2">Obs.</th>
                  <th className="label-meta py-2">Fontes</th>
                  <th className="label-meta py-2">Pedido</th>
                  <th className="label-meta py-2">Transação</th>
                  <th className="label-meta py-2">Pedido/m²</th>
                  <th className="label-meta py-2">Distância</th>
                  <th className="label-meta py-2">Última data</th>
                  <th className="label-meta py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {report.matrix.map((row) => (
                  <tr key={row.identity_key} className="border-b border-border/60 align-top">
                    <td className="py-2">
                      <p className="text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.district ?? "bairro não informado"}
                        {row.is_clustered ? ` · ${row.market_property_count} registros agrupados` : ""}
                      </p>
                    </td>
                    <td className="mono-value py-2">{row.observation_count}</td>
                    <td className="mono-value py-2">{row.source_count}</td>
                    <td className="mono-value py-2">{formatMoney(row.latest_asking_price)}</td>
                    <td className="mono-value py-2">{formatMoney(row.transaction_price)}</td>
                    <td className="mono-value py-2">{formatMoney(row.asking_price_sqm)}</td>
                    <td className="mono-value py-2">{formatDistance(row.distance_m)}</td>
                    <td className="mono-value py-2">{formatDate(row.latest_date)}</td>
                    <td className="py-2">
                      <span className="flex flex-wrap gap-1">
                        {row.conflict_count > 0 ? (
                          <Badge variant="destructive">{row.conflict_count} divergência(s)</Badge>
                        ) : null}
                        {row.unresolved_duplicate_count > 0 ? (
                          <Badge variant="outline">duplicidade pendente</Badge>
                        ) : null}
                        {(row.comparable_statuses ?? []).map((c) => (
                          <Badge key={c.candidate_id} variant="secondary">
                            {c.inclusion_status}
                          </Badge>
                        ))}
                        <span className="mono-value text-xs text-muted-foreground">
                          {row.verified_attribute_count}/{row.known_attribute_count} verif./conh.
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ fontes */}
      <section className="space-y-3">
        <SectionTitle
          step="02"
          title="Independência de fontes"
          description="Concentração de domínio e de fonte é declarada, não corrigida."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-meta py-2">Domínio</th>
                <th className="label-meta py-2">Observações</th>
                <th className="label-meta py-2">% observações</th>
                <th className="label-meta py-2">Imóveis independentes</th>
                <th className="label-meta py-2">% imóveis</th>
                <th className="label-meta py-2">Período</th>
                <th className="label-meta py-2">Artefatos</th>
              </tr>
            </thead>
            <tbody>
              {report.domains.map((d) => (
                <tr key={d.domain} className="border-b border-border/60">
                  <td className="py-2 break-all">{d.domain}</td>
                  <td className="mono-value py-2">{d.observation_count}</td>
                  <td className="mono-value py-2">{d.observation_share_pct ?? "—"}%</td>
                  <td className="mono-value py-2">{d.independent_property_count}</td>
                  <td className="mono-value py-2">{d.independent_property_share_pct ?? "—"}%</td>
                  <td className="py-2">
                    <PeriodLine from={d.first_observed} to={d.last_observed} />
                  </td>
                  <td className="mono-value py-2">{d.artifact_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------- temporal */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3 p-5">
          <SectionTitle step="03" title="Distribuição temporal" />
          <PeriodLine from={report.temporal.oldest_observation} to={report.temporal.latest_observation} />
          <AgeBuckets buckets={report.temporal.age_buckets} />
          <p className="text-xs text-muted-foreground">
            {report.temporal.without_date} observação(ões) sem qualquer data — permanecem no acervo
            com data desconhecida, jamais preenchida por estimativa.
          </p>
        </div>
        <div className="panel space-y-3 p-5">
          <SectionTitle step="04" title="Diagnóstico espacial" />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="label-meta">com coordenada</p>
              <p className="mono-value">{report.spatial.with_geo}</p>
            </div>
            <div>
              <p className="label-meta">sem coordenada</p>
              <p className="mono-value">{report.spatial.without_geo}</p>
            </div>
            <div>
              <p className="label-meta">mediana da distância</p>
              <p className="mono-value">{formatDistance(report.spatial.median_distance_m)}</p>
            </div>
            <div>
              <p className="label-meta">máxima</p>
              <p className="mono-value">{formatDistance(report.spatial.max_distance_m)}</p>
            </div>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {report.spatial.developments.map((dev) => (
              <li key={dev.development_id}>
                {dev.name ?? dev.development_id}: {dev.independent_property_count} imóveis (
                {dev.share_pct ?? "—"}% do universo)
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- cobertura */}
      <section className="panel space-y-3 p-5">
        <SectionTitle step="05" title="Cobertura de atributos" />
        <AttributeCoverageTable rows={report.attribute_coverage} />
      </section>

      {/* ----------------------------------------------------- distribuições */}
      <section className="space-y-3">
        <SectionTitle
          step="06"
          title="Distribuições de preço unitário"
          description="Preço pedido e preço transacionado nunca são misturados na mesma distribuição."
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <DistributionRow label="Preço pedido por m²" distribution={report.price_per_sqm.asking} unit="oferta" />
          <DistributionRow
            label="Preço transacionado por m²"
            distribution={report.price_per_sqm.transaction}
            unit="transação documentada"
          />
        </div>
        {report.possible_extreme_observations.length > 0 ? (
          <div className="panel space-y-2 p-4">
            <p className="label-meta">Possíveis observações extremas</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {report.possible_extreme_observations.map((o) => (
                <li key={o.observation_id} className="mono-value break-all">
                  {o.identity_key} · {formatMoney(o.value)} (cercas {formatMoney(o.lower_fence)} a{" "}
                  {formatMoney(o.upper_fence)})
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Sinalização exploratória para leitura humana. Nada foi excluído do acervo.
            </p>
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ funil */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-2 p-5">
          <SectionTitle step="07" title="Funil de evidência" />
          <ul className="space-y-1 text-sm">
            {FUNNEL_ORDER.map((stage) => (
              <li key={stage} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{FUNNEL_STAGE_LABELS[stage]}</span>
                <span className="mono-value">{report.funnel[stage] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="panel space-y-2 p-5">
          <SectionTitle step="08" title="Onde a evidência foi perdida" />
          {report.why_lost.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma perda registrada.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {report.why_lost.map((row) => (
                <li key={`${row.stage}-${row.reason}`} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{whyLostLabel(row.stage, row.reason)}</span>
                  <span className="mono-value">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="pt-2">
            <p className="label-meta">Lacunas de pesquisa</p>
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {report.research_gaps.length === 0 ? (
                <li>Nenhuma lacuna estrutural detectada.</li>
              ) : (
                report.research_gaps.map((gap) => (
                  <li key={gap.code}>
                    {RESEARCH_GAP_LABELS[gap.code] ?? gap.code}: {gap.count} — {gap.description}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- retratos */}
      <section className="space-y-3">
        <SectionTitle
          step="09"
          title="Retratos do universo de mercado"
          description="Cada retrato congela o universo com manifesto e impressão digital SHA-256 verificável."
        />
        {writable ? <SnapshotForm caseId={caseId} onDone={invalidate} /> : null}
        {snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum retrato criado.</p>
        ) : (
          <ul className="space-y-3">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id} className="panel space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    v{snapshot.version_number} · {snapshot.description ?? "sem descrição"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(snapshot.created_at)}
                  </span>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-4">
                  <span className="mono-value">{snapshot.observation_count} observações</span>
                  <span className="mono-value">{snapshot.independent_property_count} independentes</span>
                  <span className="mono-value">{snapshot.source_count} fontes</span>
                  <span className="mono-value">{snapshot.domain_count} domínios</span>
                </div>
                <HashLine label={`impressão digital (${snapshot.hash_algorithm})`} value={snapshot.snapshot_hash} />
                <IntegrityButton caseId={caseId} kind="MARKET_EVIDENCE" snapshotId={snapshot.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------------------------------------- amostra */}
      <section className="space-y-3">
        <SectionTitle
          step="10"
          title="Seleção de amostra"
          description="Seleção é decisão humana registrada. Exclusão exige código de motivo e justificativa técnica."
        />
        {writable && snapshots.length > 0 ? (
          <SelectionForm caseId={caseId} snapshots={snapshots} onDone={invalidate} />
        ) : null}
        {selectionRuns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma rodada de seleção iniciada.</p>
        ) : (
          <ul className="space-y-3">
            {selectionRuns.map((run) => (
              <li key={run.id} className="panel space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">{run.purpose}</p>
                  <Badge variant={run.status === "COMPLETED" ? "default" : "outline"}>{run.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Política de seleção {run.selection_policy_version} · aberta em{" "}
                  {formatDateTime(run.created_at)}
                </p>
                {writable && run.status === "IN_PROGRESS" ? (
                  <CompleteSelectionForm caseId={caseId} runId={run.id} onDone={invalidate} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {selectionSnapshots.length > 0 ? (
          <ul className="space-y-2">
            {selectionSnapshots.map((snapshot) => (
              <li key={snapshot.id} className="panel space-y-2 p-4">
                <p className="text-sm">
                  Retrato de amostra v{snapshot.version_number} · {snapshot.selected_count} selecionadas ·{" "}
                  {snapshot.excluded_count} excluídas
                </p>
                <HashLine label="impressão digital" value={snapshot.snapshot_hash} />
                <IntegrityButton caseId={caseId} kind="SAMPLE_SELECTION" snapshotId={snapshot.id} />
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ---------------------------------------------------- ocorrências */}
      <section className="space-y-3">
        <SectionTitle
          step="11"
          title="Qualidade do acervo"
          description="Ocorrências abrem e fecham por regra versionada; a trilha de cada mudança é imutável."
        />
        {writable && policies.length > 0 ? (
          <RefreshIssuesForm caseId={caseId} policies={policies} onDone={invalidate} />
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma política de diagnóstico disponível para esta organização.
          </p>
        )}
        {issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
        ) : (
          <ul className="space-y-3">
            {issues.map((issue) => (
              <li key={issue.id} className="panel space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <IssueTypeLabel type={issue.issue_type} />
                  </p>
                  <IssueBadges severity={issue.severity} status={issue.status} />
                </div>
                <p className="text-sm text-muted-foreground">{issue.detail}</p>
                <p className="text-xs text-muted-foreground">
                  Regra {issue.rule_version} · aberta em {formatDateTime(issue.opened_at)}
                  {issue.resolution_notes ? ` · ${issue.resolution_notes}` : ""}
                </p>
                {issue.status === "OPEN" && writable ? (
                  <IssueDecisionForm caseId={caseId} issueId={issue.id} mode="ACK" onDone={invalidate} />
                ) : null}
                {(issue.status === "OPEN" || issue.status === "ACKNOWLEDGED") && reviewable ? (
                  <IssueDecisionForm caseId={caseId} issueId={issue.id} mode="RESOLVE" onDone={invalidate} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------ readiness */}
      <section className="space-y-3">
        <SectionTitle
          step="12"
          title="Prontidão da amostra"
          description="Prontidão é estrutural: declara impedimentos e ressalvas. Não é opinião de valor nem aprovação metodológica."
        />
        {writable && snapshots.length > 0 && selectionSnapshots.length > 0 && policies.length > 0 ? (
          <ReadinessForm
            caseId={caseId}
            snapshots={snapshots}
            selectionSnapshots={selectionSnapshots}
            policies={policies}
            onDone={invalidate}
          />
        ) : null}
        {!latestReadiness ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação de prontidão registrada.</p>
        ) : (
          <div className="panel space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ReadinessBadge state={latestReadiness.readiness_state} />
              <span className="text-xs text-muted-foreground">
                v{latestReadiness.version_number} · política {latestReadiness.diagnostic_policy_version} ·{" "}
                {formatDateTime(latestReadiness.created_at)}
              </span>
            </div>
            <JsonList title="Impedimentos estruturais" value={latestReadiness.hard_blockers} />
            <JsonList title="Ressalvas" value={latestReadiness.warnings} />
            <JsonList title="Métricas" value={latestReadiness.metrics} />
            {latestReadiness.acknowledged_at ? (
              <p className="text-xs text-muted-foreground">
                Ressalvas assumidas em {formatDateTime(latestReadiness.acknowledged_at)} —{" "}
                {latestReadiness.acknowledgement_notes}
              </p>
            ) : reviewable && latestReadiness.readiness_state === "READY_WITH_WARNINGS" ? (
              <AcknowledgeReadinessForm
                caseId={caseId}
                assessmentId={latestReadiness.id}
                onDone={invalidate}
              />
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================ subformas == */

function JsonList({ title, value }: { title: string; value: unknown }) {
  const entries = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ code: k, detail: v }))
      : [];
  return (
    <div>
      <p className="label-meta">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">nenhum</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {entries.map((entry, index) => (
            <li key={index} className="mono-value break-all">
              {JSON.stringify(entry)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function useAction<TInput>(fn: (args: { data: TInput }) => Promise<unknown>, success: string, onDone: () => void) {
  return useMutation({
    mutationFn: (input: TInput) => fn({ data: input }),
    onSuccess: () => {
      toast.success(success);
      onDone();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Operação recusada pelo banco."),
  });
}

function SnapshotForm({ caseId, onDone }: { caseId: string; onDone: () => void }) {
  const [description, setDescription] = useState("");
  const action = useAction(useServerFn(createMarketEvidenceSnapshot), "Retrato criado.", onDone);
  return (
    <form
      className="panel space-y-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, description });
      }}
    >
      <Label htmlFor="snapshot-description">Finalidade do retrato</Label>
      <Textarea
        id="snapshot-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={2}
      />
      <Button type="submit" disabled={action.isPending || description.trim().length < 10}>
        Criar retrato do universo
      </Button>
    </form>
  );
}

function IntegrityButton({
  caseId,
  kind,
  snapshotId,
}: {
  caseId: string;
  kind: "MARKET_EVIDENCE" | "SAMPLE_SELECTION";
  snapshotId: string;
}) {
  const verify = useServerFn(verifySnapshotIntegrity);
  const [result, setResult] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => verify({ data: { caseId, kind, snapshotId } }),
    onSuccess: (data) => setResult(String((data as Record<string, unknown>)["result"])),
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Verificação recusada."),
  });
  return (
    <div className="flex items-center gap-3">
      <Button type="button" size="sm" variant="outline" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        Verificar integridade
      </Button>
      {result ? (
        <Badge variant={result === "VALID" ? "default" : "destructive"}>
          {result === "VALID" ? "manifesto íntegro" : "manifesto divergente"}
        </Badge>
      ) : null}
    </div>
  );
}

function SelectionForm({
  caseId,
  snapshots,
  onDone,
}: {
  caseId: string;
  snapshots: { id: string; version_number: number }[];
  onDone: () => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [snapshotId, setSnapshotId] = useState(snapshots[0]?.id ?? "");
  const action = useAction(useServerFn(startSampleSelection), "Rodada de seleção aberta.", onDone);
  return (
    <form
      className="panel space-y-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, marketEvidenceSnapshotId: snapshotId, purpose, notes: "" });
      }}
    >
      <Label htmlFor="selection-purpose">Finalidade da seleção</Label>
      <Textarea
        id="selection-purpose"
        rows={2}
        value={purpose}
        onChange={(event) => setPurpose(event.target.value)}
      />
      <Label htmlFor="selection-snapshot">Retrato base</Label>
      <select
        id="selection-snapshot"
        className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        value={snapshotId}
        onChange={(event) => setSnapshotId(event.target.value)}
      >
        {snapshots.map((snapshot) => (
          <option key={snapshot.id} value={snapshot.id}>
            v{snapshot.version_number}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={action.isPending || purpose.trim().length < 10 || !snapshotId}>
        Iniciar seleção
      </Button>
    </form>
  );
}

function CompleteSelectionForm({
  caseId,
  runId,
  onDone,
}: {
  caseId: string;
  runId: string;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const action = useAction(useServerFn(completeSampleSelection), "Seleção encerrada e retratada.", onDone);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, runId, notes });
      }}
    >
      <Input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Nota de encerramento"
      />
      <Button type="submit" size="sm" disabled={action.isPending || notes.trim().length < 10}>
        Encerrar e congelar amostra
      </Button>
    </form>
  );
}

function RefreshIssuesForm({
  caseId,
  policies,
  onDone,
}: {
  caseId: string;
  policies: { id: string; name: string; version: string }[];
  onDone: () => void;
}) {
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const action = useAction(useServerFn(refreshMarketDataIssues), "Diagnóstico recalculado.", onDone);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, policyId });
      }}
    >
      <select
        aria-label="Política de diagnóstico"
        className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        value={policyId}
        onChange={(event) => setPolicyId(event.target.value)}
      >
        {policies.map((policy) => (
          <option key={policy.id} value={policy.id}>
            {policy.name} · {policy.version}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={action.isPending || !policyId}>
        Recalcular ocorrências
      </Button>
    </form>
  );
}

function IssueDecisionForm({
  caseId,
  issueId,
  mode,
  onDone,
}: {
  caseId: string;
  issueId: string;
  mode: "ACK" | "RESOLVE";
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const fn = useServerFn(mode === "ACK" ? acknowledgeMarketDataIssue : resolveMarketDataIssue);
  const action = useAction(fn, mode === "ACK" ? "Ciência registrada." : "Ocorrência resolvida.", onDone);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, issueId, notes });
      }}
    >
      <Input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder={mode === "ACK" ? "Nota de ciência" : "Nota de resolução"}
        className="max-w-md"
      />
      <Button type="submit" size="sm" variant={mode === "ACK" ? "outline" : "default"} disabled={action.isPending || notes.trim().length < 10}>
        {mode === "ACK" ? "Registrar ciência" : "Resolver"}
      </Button>
    </form>
  );
}

function ReadinessForm({
  caseId,
  snapshots,
  selectionSnapshots,
  policies,
  onDone,
}: {
  caseId: string;
  snapshots: { id: string; version_number: number }[];
  selectionSnapshots: { id: string; version_number: number }[];
  policies: { id: string; name: string; version: string }[];
  onDone: () => void;
}) {
  const [marketId, setMarketId] = useState(snapshots[0]?.id ?? "");
  const [sampleId, setSampleId] = useState(selectionSnapshots[0]?.id ?? "");
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const action = useAction(useServerFn(assessSampleReadiness), "Prontidão avaliada.", onDone);
  return (
    <form
      className="panel flex flex-wrap items-end gap-2 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({
          caseId,
          marketEvidenceSnapshotId: marketId,
          sampleSelectionSnapshotId: sampleId,
          policyId,
        });
      }}
    >
      <select
        aria-label="Retrato do universo"
        className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        value={marketId}
        onChange={(event) => setMarketId(event.target.value)}
      >
        {snapshots.map((s) => (
          <option key={s.id} value={s.id}>
            universo v{s.version_number}
          </option>
        ))}
      </select>
      <select
        aria-label="Retrato de amostra"
        className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        value={sampleId}
        onChange={(event) => setSampleId(event.target.value)}
      >
        {selectionSnapshots.map((s) => (
          <option key={s.id} value={s.id}>
            amostra v{s.version_number}
          </option>
        ))}
      </select>
      <select
        aria-label="Política"
        className="rounded-sm border border-border bg-background px-2 py-1.5 text-sm"
        value={policyId}
        onChange={(event) => setPolicyId(event.target.value)}
      >
        {policies.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} · {p.version}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={action.isPending || !marketId || !sampleId || !policyId}>
        Avaliar prontidão
      </Button>
    </form>
  );
}

function AcknowledgeReadinessForm({
  caseId,
  assessmentId,
  onDone,
}: {
  caseId: string;
  assessmentId: string;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState("");
  const action = useAction(useServerFn(acknowledgeReadinessWarnings), "Ressalvas assumidas.", onDone);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        action.mutate({ caseId, assessmentId, notes });
      }}
    >
      <Textarea
        rows={2}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Justificativa técnica para prosseguir com ressalvas (mín. 30 caracteres)"
      />
      <Button type="submit" size="sm" disabled={action.isPending || notes.trim().length < 30}>
        Assumir ressalvas
      </Button>
    </form>
  );
}
