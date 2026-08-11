import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

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
import { canReview, canWrite } from "@/hooks/use-workspace";
import {
  MARKET_OBSERVATION_STATUSES,
  MARKET_OBSERVATION_STATUS_LABELS,
  MARKET_OBSERVATION_TYPES,
  MARKET_OBSERVATION_TYPE_LABELS,
  type MarketObservationStatus,
  type MarketObservationType,
} from "@/lib/domain/constants";
import {
  EXTRACTION_SUPPORT_STATUS_LABELS,
  RESEARCH_CANDIDATE_STATUS_LABELS,
  RESEARCH_CANDIDATE_TYPE_LABELS,
  RESEARCH_CAPTURE_STATUS_LABELS,
  RESEARCH_ISSUE_TYPE_LABELS,
  RESEARCH_TYPE_LABELS,
  SUPPORT_CHECK_STATUS_LABELS,
  type ExtractionSupportStatus,
  type ResearchIssueType,
  type SupportCheckStatus,
} from "@/lib/domain/research";
import { verifyEvidenceField } from "@/lib/evidence.functions";
import {
  addManualSourceUrl,
  cancelResearchRun,
  captureResearchSource,
  discardResearchQuery,
  executeResearchQuery,
  extractResearchSource,
  generateResearchPlan,
  getResearchRun,
  promoteResearchCandidate,
  rejectResearchCandidate,
  saveResearchQuery,
  setResultSelection,
} from "@/lib/research.functions";
import { RunStatusBadge } from "./index";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/research/$runId")({
  component: ResearchRunPage,
  head: () => ({
    meta: [
      { title: "Console de pesquisa assistida | Inteligência pericial" },
      {
        name: "description",
        content:
          "Console da máquina de estados: consultas, fontes capturadas, candidatos extraídos e inconsistências detectadas.",
      },
      { property: "og:title", content: "Console de pesquisa assistida" },
      {
        property: "og:description",
        content: "Cada etapa é curta, retomável e auditável. Nada é verificado automaticamente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SupportBadge({
  ai,
  system,
}: {
  ai: ExtractionSupportStatus | null;
  system: SupportCheckStatus | null;
}) {
  const failed = system === "FAILED";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="border-border text-muted-foreground">
        IA: {ai ? EXTRACTION_SUPPORT_STATUS_LABELS[ai] : "não declarado"}
      </Badge>
      <Badge
        variant="outline"
        className={
          failed
            ? "border-destructive/50 text-destructive"
            : system === "EXACT_MATCH" || system === "NORMALIZED_MATCH"
              ? "border-success/40 text-success"
              : "border-warning/40 text-warning"
        }
      >
        Sistema: {system ? SUPPORT_CHECK_STATUS_LABELS[system] : "não conferido"}
      </Badge>
    </span>
  );
}

function ResearchRunPage() {
  const { caseId, runId } = useParams({
    from: "/_authenticated/_shell/cases/$caseId/research/$runId",
  });
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["research-run", runId] });

  const fetchRun = useServerFn(getResearchRun);
  const query = useQuery({
    queryKey: ["research-run", runId],
    queryFn: () => fetchRun({ data: { runId } }),
  });

  const planFn = useServerFn(generateResearchPlan);
  const saveQueryFn = useServerFn(saveResearchQuery);
  const discardQueryFn = useServerFn(discardResearchQuery);
  const executeFn = useServerFn(executeResearchQuery);
  const selectFn = useServerFn(setResultSelection);
  const manualUrlFn = useServerFn(addManualSourceUrl);
  const captureFn = useServerFn(captureResearchSource);
  const extractFn = useServerFn(extractResearchSource);
  const verifyFn = useServerFn(verifyEvidenceField);
  const rejectCandidateFn = useServerFn(rejectResearchCandidate);
  const promoteFn = useServerFn(promoteResearchCandidate);
  const cancelFn = useServerFn(cancelResearchRun);

  const [manualUrl, setManualUrl] = useState("");
  const [newQuery, setNewQuery] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});

  const run = (input: () => Promise<unknown>, success: string) => async () => {
    try {
      await input();
      toast.success(success);
      await invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro desconhecido.");
    }
  };

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: () => void invalidate(),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro desconhecido."),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Pesquisa indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/cases/$caseId/research" params={{ caseId }}>
              Voltar às pesquisas
            </Link>
          </Button>
        }
      />
    );
  }

  const data = query.data;
  const runRow = data.run;
  const writable = canWrite(data.role) && !["COMPLETED", "FAILED", "CANCELLED"].includes(runRow.status);
  const reviewable = canReview(data.role);
  const snapshot = data.contextSnapshots[0];
  const contextFacts = Array.isArray(snapshot?.facts)
    ? (snapshot.facts as Array<{ label?: string; value?: string; origin?: string }>)
    : [];

  const fieldsByCandidate = new Map<string, typeof data.candidateFields>();
  for (const link of data.candidateFields) {
    const list = fieldsByCandidate.get(link.candidate_id) ?? [];
    list.push(link);
    fieldsByCandidate.set(link.candidate_id, list);
  }

  const issuesByField = new Map<string, typeof data.issues>();
  for (const issue of data.issues) {
    if (!issue.evidence_field_id) continue;
    const list = issuesByField.get(issue.evidence_field_id) ?? [];
    list.push(issue);
    issuesByField.set(issue.evidence_field_id, list);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-meta">{RESEARCH_TYPE_LABELS[runRow.research_type]}</p>
          <p className="mt-1 max-w-3xl text-sm text-foreground">{runRow.objective}</p>
          <p className="label-meta mt-2">
            provedor {runRow.provider} · buscas {runRow.search_uses_actual}/{runRow.max_search_uses}{" "}
            · capturas {runRow.fetches_actual}/{runRow.max_fetches} · extrações{" "}
            {runRow.extractions_actual}/{runRow.max_extractions}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RunStatusBadge status={runRow.status} />
          {writable ? (
            <Button
              variant="outline"
              size="sm"
              onClick={run(() => cancelFn({ data: { runId } }), "Pesquisa cancelada.")}
            >
              Cancelar pesquisa
            </Button>
          ) : null}
        </div>
      </div>

      <GovernanceNote>
        Cada etapa é uma operação curta e retomável. O contexto enviado ao provedor está congelado no
        instantâneo abaixo: apenas fatos verificados saem da plataforma. Nenhum campo é verificado por
        IA — a conferência de trecho é determinística e a verificação é humana.
      </GovernanceNote>

      <section>
        <SectionTitle
          step="00"
          title="Contexto enviado ao provedor"
          description={
            snapshot
              ? `Instantâneo imutável de ${new Date(snapshot.captured_at).toLocaleString("pt-BR")} (${snapshot.schema_version}).`
              : "Nenhum instantâneo registrado."
          }
        />
        {contextFacts.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">
            Nenhum fato verificado disponível. As consultas serão necessariamente mais genéricas — a
            IA não preenche fatos ausentes.
          </p>
        ) : (
          <ul className="panel divide-y divide-border p-0">
            {contextFacts.map((fact, index) => (
              <li key={index} className="flex flex-wrap gap-2 px-4 py-2 text-sm">
                <span className="label-meta w-48">{fact.label ?? "—"}</span>
                <span className="mono-value text-foreground">{fact.value ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{fact.origin ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="01"
          title="Consultas"
          description="A IA propõe. O humano edita, adiciona, descarta e decide o que executar."
        />
        {writable ? (
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate(async () => {
                  const result = await planFn({ data: { runId, maxQueries: 5 } });
                  toast.success(`${result.queryCount} consulta(s) proposta(s).`);
                })
              }
            >
              Gerar plano de consultas
            </Button>
            <form
              className="flex flex-1 flex-wrap gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (newQuery.trim().length < 5) {
                  toast.error("Consulta muito curta.");
                  return;
                }
                mutation.mutate(async () => {
                  await saveQueryFn({ data: { runId, queryText: newQuery } });
                  setNewQuery("");
                  toast.success("Consulta adicionada.");
                });
              }}
            >
              <Input
                aria-label="Nova consulta"
                value={newQuery}
                onChange={(event) => setNewQuery(event.target.value)}
                placeholder="Adicionar consulta manualmente"
                className="min-w-64 flex-1"
              />
              <Button type="submit" variant="outline" size="sm">
                Adicionar
              </Button>
            </form>
          </div>
        ) : null}

        {data.queries.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
        ) : (
          <ul className="space-y-2">
            {data.queries.map((queryRow) => {
              const editable =
                writable && (queryRow.status === "PROPOSED" || queryRow.status === "APPROVED");
              const value = editing[queryRow.id] ?? queryRow.query_text;
              return (
                <li key={queryRow.id} className="panel space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {queryRow.generated_by === "AI" ? "Proposta pela IA" : "Criada pelo usuário"}
                    </Badge>
                    <Badge variant="outline" className="border-border text-muted-foreground">
                      {queryRow.status}
                    </Badge>
                    {queryRow.result_count > 0 ? (
                      <span className="label-meta">{queryRow.result_count} resultado(s)</span>
                    ) : null}
                  </div>
                  {editable ? (
                    <Textarea
                      aria-label="Texto da consulta"
                      rows={2}
                      value={value}
                      onChange={(event) =>
                        setEditing((prev) => ({ ...prev, [queryRow.id]: event.target.value }))
                      }
                    />
                  ) : (
                    <p className="mono-value text-foreground">{queryRow.query_text}</p>
                  )}
                  {queryRow.purpose ? (
                    <p className="text-xs text-muted-foreground">{queryRow.purpose}</p>
                  ) : null}
                  {editable ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={run(
                          () =>
                            saveQueryFn({
                              data: { runId, queryId: queryRow.id, queryText: value },
                            }),
                          "Consulta salva.",
                        )}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        onClick={run(
                          () => executeFn({ data: { queryId: queryRow.id } }),
                          "Consulta executada.",
                        )}
                      >
                        Executar busca
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={run(
                          () => discardQueryFn({ data: { queryId: queryRow.id } }),
                          "Consulta descartada.",
                        )}
                      >
                        Descartar
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="02"
          title="Fontes retornadas"
          description="Somente fontes explicitamente selecionadas por um humano podem ser capturadas."
        />
        {writable ? (
          <form
            className="mb-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(async () => {
                await manualUrlFn({ data: { runId, url: manualUrl } });
                setManualUrl("");
                toast.success("URL adicionada como fonte selecionada.");
              });
            }}
          >
            <Input
              aria-label="URL de fonte"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
              placeholder="https://… (adicionar fonte manualmente)"
              className="min-w-72 flex-1"
            />
            <Button type="submit" variant="outline" size="sm">
              Adicionar URL
            </Button>
          </form>
        ) : null}

        {data.results.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">
            Nenhuma fonte retornada. URLs mencionadas apenas no texto do modelo são descartadas e não
            aparecem aqui.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.results.map((result) => (
              <li key={result.id} className="panel space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {result.domain}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {RESEARCH_CAPTURE_STATUS_LABELS[result.capture_status]}
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground">
                    {result.selection_status}
                  </Badge>
                  <span className="label-meta">origem {result.provider}</span>
                </div>
                <p className="text-sm font-medium text-foreground">{result.title ?? "sem título"}</p>
                <p className="mono-value break-all text-xs text-muted-foreground">
                  {result.canonical_url}
                </p>
                {result.snippet ? (
                  <p className="text-xs text-muted-foreground">{result.snippet}</p>
                ) : null}
                {result.capture_failure_reason ? (
                  <p className="text-xs text-destructive">{result.capture_failure_reason}</p>
                ) : null}
                {writable ? (
                  <div className="flex flex-wrap gap-2">
                    {result.selection_status !== "SELECTED" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={run(
                          () =>
                            selectFn({
                              data: { resultId: result.id, selectionStatus: "SELECTED" },
                            }),
                          "Fonte selecionada.",
                        )}
                      >
                        Selecionar
                      </Button>
                    ) : null}
                    {result.selection_status !== "REJECTED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={run(
                          () =>
                            selectFn({
                              data: { resultId: result.id, selectionStatus: "REJECTED" },
                            }),
                          "Fonte descartada.",
                        )}
                      >
                        Descartar
                      </Button>
                    ) : null}
                    {result.selection_status === "SELECTED" &&
                    result.capture_status !== "CAPTURED" ? (
                      <Button
                        size="sm"
                        onClick={run(
                          () => captureFn({ data: { resultId: result.id } }),
                          "Captura concluída.",
                        )}
                      >
                        Capturar conteúdo
                      </Button>
                    ) : null}
                    {result.capture_status === "CAPTURED" ? (
                      <Button
                        size="sm"
                        onClick={run(
                          () => extractFn({ data: { resultId: result.id } }),
                          "Extração concluída. Candidatos aguardam revisão humana.",
                        )}
                      >
                        Extrair candidatos
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="03"
          title="Candidatos extraídos"
          description="Cada campo mostra o que a IA declarou e o que o sistema conferiu. Conferência falha não pode ser verificada."
        />
        {data.candidates.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">Nenhum candidato extraído.</p>
        ) : (
          <ul className="space-y-4">
            {data.candidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                links={fieldsByCandidate.get(candidate.id) ?? []}
                issuesByField={issuesByField}
                reviewable={reviewable}
                writable={writable}
                onVerify={async (fieldId, notes) => {
                  await verifyFn({ data: { fieldId, verificationNotes: notes } });
                  await invalidate();
                }}
                onReject={async (reason) => {
                  await rejectCandidateFn({ data: { candidateId: candidate.id, reason } });
                  await invalidate();
                }}
                onPromote={async (input) => {
                  await promoteFn({
                    data: {
                      candidateId: candidate.id,
                      fieldIds: input.fieldIds,
                      observationType: input.observationType,
                      observationStatus: input.observationStatus,
                    },
                  });
                  await invalidate();
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="04"
          title="Inconsistências detectadas"
          description="Registro permanente do que o sistema recusou. Nada aqui é apagado."
        />
        {data.issues.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">
            Nenhuma inconsistência registrada nesta pesquisa.
          </p>
        ) : (
          <ul className="panel divide-y divide-border p-0">
            {data.issues.map((issue) => (
              <li key={issue.id} className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  {RESEARCH_ISSUE_TYPE_LABELS[issue.issue_type as ResearchIssueType] ??
                    issue.issue_type}
                </p>
                {issue.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{issue.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle step="05" title="Consumo registrado" />
        {data.usage.length === 0 ? (
          <p className="panel p-4 text-sm text-muted-foreground">Nenhum consumo registrado.</p>
        ) : (
          <ul className="panel divide-y divide-border p-0 text-xs">
            {data.usage.map((event, index) => (
              <li key={index} className="flex flex-wrap gap-3 px-4 py-2 text-muted-foreground">
                <span className="mono-value text-foreground">{event.usage_type}</span>
                <span>{event.provider ?? "—"}</span>
                <span>{event.model ?? "—"}</span>
                <span>entrada {event.input_tokens ?? "—"}</span>
                <span>saída {event.output_tokens ?? "—"}</span>
                <span>ferramentas {event.server_tool_uses ?? "—"}</span>
                <span>{new Date(event.created_at).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface CandidateRow {
  id: string;
  candidate_type: keyof typeof RESEARCH_CANDIDATE_TYPE_LABELS;
  status: keyof typeof RESEARCH_CANDIDATE_STATUS_LABELS;
  rejection_reason: string | null;
}

interface FieldLink {
  id: string;
  candidate_id: string;
  evidence_field_id: string;
  evidence_fields: {
    id: string;
    field_name: string;
    raw_value: string | null;
    normalized_value: string | null;
    numeric_value: number | null;
    unit: string | null;
    field_state: string;
    validation_status: string;
    ai_support_status: ExtractionSupportStatus | null;
    support_check_status: SupportCheckStatus | null;
    source_excerpt: string | null;
  };
}

function CandidateCard({
  candidate,
  links,
  issuesByField,
  reviewable,
  writable,
  onVerify,
  onReject,
  onPromote,
}: {
  candidate: CandidateRow;
  links: FieldLink[];
  issuesByField: Map<string, Array<{ id: string; issue_type: string; detail: string | null }>>;
  reviewable: boolean;
  writable: boolean;
  onVerify: (fieldId: string, notes: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onPromote: (input: {
    fieldIds: string[];
    observationType: MarketObservationType;
    observationStatus: MarketObservationStatus;
  }) => Promise<void>;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [observationType, setObservationType] = useState<MarketObservationType>("SALE_LISTING");
  const [observationStatus, setObservationStatus] = useState<MarketObservationStatus>("ACTIVE");
  const [busy, setBusy] = useState(false);

  const verifiedFieldIds = links
    .filter((link) => link.evidence_fields.validation_status === "VERIFIED")
    .map((link) => link.evidence_field_id);

  const guard = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro desconhecido.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-border text-foreground">
          {RESEARCH_CANDIDATE_TYPE_LABELS[candidate.candidate_type]}
        </Badge>
        <Badge variant="outline" className="border-border text-muted-foreground">
          {RESEARCH_CANDIDATE_STATUS_LABELS[candidate.status]}
        </Badge>
      </div>
      {candidate.rejection_reason ? (
        <p className="text-xs text-destructive">Rejeitado: {candidate.rejection_reason}</p>
      ) : null}

      <ul className="divide-y divide-border">
        {links.map((link) => {
          const field = link.evidence_fields;
          const fieldIssues = issuesByField.get(field.id) ?? [];
          const blocked = field.support_check_status === "FAILED";
          const verified = field.validation_status === "VERIFIED";
          return (
            <li key={link.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="label-meta w-44">{field.field_name}</span>
                <span className="mono-value text-foreground">
                  {field.normalized_value ?? field.raw_value ?? "—"}
                  {field.unit ? ` ${field.unit}` : ""}
                </span>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {field.field_state}
                </Badge>
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {field.validation_status}
                </Badge>
              </div>
              <SupportBadge ai={field.ai_support_status} system={field.support_check_status} />
              {field.source_excerpt ? (
                <p className="border-l-2 border-border pl-2 text-xs text-muted-foreground italic">
                  “{field.source_excerpt}”
                </p>
              ) : null}
              {fieldIssues.map((issue) => (
                <p key={issue.id} className="text-xs text-destructive">
                  {issue.detail ?? issue.issue_type}
                </p>
              ))}
              {blocked ? (
                <p className="text-xs text-destructive">
                  Conferência determinística falhou: este campo não pode ser verificado.
                </p>
              ) : null}
              {reviewable && !verified && !blocked ? (
                <div className="flex flex-wrap gap-2">
                  <Input
                    aria-label={`Base da verificação de ${field.field_name}`}
                    value={notes[field.id] ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [field.id]: event.target.value }))
                    }
                    placeholder="Base da verificação (obrigatória)"
                    className="min-w-64 flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void guard(async () => {
                        await onVerify(field.id, notes[field.id] ?? "");
                        toast.success("Campo verificado.");
                      })
                    }
                  >
                    Verificar
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {writable && candidate.status !== "PROMOTED" && candidate.status !== "REJECTED" ? (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de observação</Label>
              <Select
                value={observationType}
                onValueChange={(value) => setObservationType(value as MarketObservationType)}
              >
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
              <Label className="text-xs">Situação</Label>
              <Select
                value={observationStatus}
                onValueChange={(value) => setObservationStatus(value as MarketObservationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
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
            <div className="flex items-end">
              <Button
                size="sm"
                disabled={busy || verifiedFieldIds.length === 0}
                onClick={() =>
                  void guard(async () => {
                    await onPromote({
                      fieldIds: verifiedFieldIds,
                      observationType,
                      observationStatus,
                    });
                    toast.success("Candidato promovido ao acervo de mercado.");
                  })
                }
              >
                Promover ({verifiedFieldIds.length} campo(s) verificado(s))
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            A promoção usa exclusivamente campos verificados. Uma oferta nunca é promovida como
            transação: a operação no banco recusa a conversão.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Motivo da rejeição do candidato"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Motivo da rejeição"
              className="min-w-64 flex-1"
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void guard(async () => {
                  await onReject(rejectReason);
                  toast.success("Candidato rejeitado.");
                })
              }
            >
              Rejeitar candidato
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
