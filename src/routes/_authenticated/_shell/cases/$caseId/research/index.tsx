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
import { canWrite } from "@/hooks/use-workspace";
import {
  RESEARCH_BUDGET_LIMITS,
  RESEARCH_RUN_STATUS_LABELS,
  RESEARCH_TYPES,
  RESEARCH_TYPE_LABELS,
  type ResearchRunStatus,
  type ResearchType,
} from "@/lib/domain/research";
import { createResearchRun, listResearchRuns } from "@/lib/research.functions";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/research/")({
  component: ResearchIndexPage,
  head: () => ({
    meta: [
      { title: "Pesquisa assistida por IA | Inteligência pericial" },
      {
        name: "description",
        content:
          "Planejamento de consultas, captura de fontes e extração de candidatos com conferência determinística e verificação humana.",
      },
      { property: "og:title", content: "Pesquisa assistida por IA" },
      {
        property: "og:description",
        content:
          "A IA sugere e localiza fontes. A conferência é determinística e a verificação é humana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CLOSED_STATUSES = ["COMPLETED", "ARCHIVED"];

export function RunStatusBadge({ status }: { status: ResearchRunStatus }) {
  const tone =
    status === "COMPLETED"
      ? "border-success/40 text-success"
      : status === "FAILED" || status === "CANCELLED"
        ? "border-destructive/40 text-destructive"
        : status === "REVIEW_REQUIRED"
          ? "border-warning/40 text-warning"
          : "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={tone}>
      {RESEARCH_RUN_STATUS_LABELS[status]}
    </Badge>
  );
}

function ResearchIndexPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const queryClient = useQueryClient();
  const fetchRuns = useServerFn(listResearchRuns);
  const createRun = useServerFn(createResearchRun);

  const query = useQuery({
    queryKey: ["research-runs", caseId],
    queryFn: () => fetchRuns({ data: { caseId } }),
  });

  const [researchType, setResearchType] = useState<ResearchType>("COMPARABLE_DISCOVERY");
  const [objective, setObjective] = useState("");
  const [maxSearchUses, setMaxSearchUses] = useState(4);
  const [maxSources, setMaxSources] = useState(12);
  const [maxFetches, setMaxFetches] = useState(6);
  const [maxExtractions, setMaxExtractions] = useState(6);

  const mutation = useMutation({
    mutationFn: () =>
      createRun({
        data: {
          caseId,
          researchType,
          objective,
          maxSearchUses,
          maxSources,
          maxFetches,
          maxExtractions,
        },
      }),
    onSuccess: (result) => {
      toast.success(
        `Pesquisa criada com ${result.contextFactCount} fato(s) verificado(s) no contexto enviado.`,
      );
      setObjective("");
      void queryClient.invalidateQueries({ queryKey: ["research-runs", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Erro desconhecido."),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Pesquisas indisponíveis"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const { runs, role, providerMode, providerId } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-8">
      <GovernanceNote>
        A IA <strong>propõe consultas e localiza fontes</strong>. Ela não verifica, não conclui e não
        atribui valor. Todo campo extraído nasce como candidato, passa por conferência determinística
        de trecho e só entra no acervo após verificação humana registrada.
      </GovernanceNote>

      <div className="panel px-4 py-3 text-xs text-muted-foreground">
        Provedor ativo:{" "}
        <span className="mono-value text-foreground">
          {providerId} · {providerMode === "FIXTURE" ? "modo determinístico (fixtures)" : "modo real"}
        </span>
        {providerMode === "FIXTURE" ? (
          <span>
            {" "}
            — nenhuma chamada externa é feita. O fluxo, as travas e a trilha de auditoria são
            idênticos aos do modo real.
          </span>
        ) : null}
      </div>

      {writable ? (
        <section>
          <SectionTitle
            step="01"
            title="Nova pesquisa"
            description="O contexto enviado ao provedor é congelado no momento da criação e limitado a fatos verificados."
          />
          <form
            className="panel space-y-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (objective.trim().length < 10) {
                toast.error("Descreva o objetivo da pesquisa com ao menos 10 caracteres.");
                return;
              }
              mutation.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="research-type">Tipo de pesquisa</Label>
                <Select
                  value={researchType}
                  onValueChange={(value) => setResearchType(value as ResearchType)}
                >
                  <SelectTrigger id="research-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESEARCH_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {RESEARCH_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <BudgetInput
                  id="max-search"
                  label="Buscas"
                  value={maxSearchUses}
                  max={RESEARCH_BUDGET_LIMITS.maxSearchUses}
                  onChange={setMaxSearchUses}
                />
                <BudgetInput
                  id="max-sources"
                  label="Fontes"
                  value={maxSources}
                  max={RESEARCH_BUDGET_LIMITS.maxSources}
                  onChange={setMaxSources}
                />
                <BudgetInput
                  id="max-fetches"
                  label="Capturas"
                  value={maxFetches}
                  max={RESEARCH_BUDGET_LIMITS.maxFetches}
                  onChange={setMaxFetches}
                />
                <BudgetInput
                  id="max-extractions"
                  label="Extrações"
                  value={maxExtractions}
                  max={RESEARCH_BUDGET_LIMITS.maxExtractions}
                  onChange={setMaxExtractions}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="objective">Objetivo</Label>
              <Textarea
                id="objective"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                rows={3}
                placeholder="Ex.: localizar ofertas de apartamentos comparáveis no mesmo bairro, com área privativa entre 100 e 140 m²."
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando…" : "Criar pesquisa"}
            </Button>
          </form>
        </section>
      ) : null}

      <section>
        <SectionTitle step="02" title="Pesquisas do caso" />
        {runs.length === 0 ? (
          <EmptyState
            title="Nenhuma pesquisa registrada"
            description="Crie uma pesquisa para propor consultas, capturar fontes e extrair candidatos."
          />
        ) : (
          <ul className="space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="panel flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {RESEARCH_TYPE_LABELS[run.research_type]}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{run.objective}</p>
                  <p className="label-meta mt-2">
                    buscas {run.search_uses_actual}/{run.max_search_uses} · capturas{" "}
                    {run.fetches_actual}/{run.max_fetches} · extrações {run.extractions_actual}/
                    {run.max_extractions} · chamadas de IA {run.ai_calls_actual}
                  </p>
                </div>
                <RunStatusBadge status={run.status} />
                <Button asChild variant="outline" size="sm">
                  <Link
                    to="/cases/$caseId/research/$runId"
                    params={{ caseId, runId: run.id }}
                  >
                    Abrir
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BudgetInput({
  id,
  label,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label} (máx. {max})
      </Label>
      <Input
        id={id}
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export { CLOSED_STATUSES };
