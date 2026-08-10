import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, GovernanceNote, PageHeader } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { bootstrapWorkspace, getDashboardMetrics } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const fetchMetrics = useServerFn(getDashboardMetrics);
  const query = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchMetrics() });

  if (query.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar o painel"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  if (query.data === null) {
    return <OrganizationBootstrap />;
  }

  const metrics = query.data;
  const cards = [
    { label: "Casos ativos", value: metrics.activeCases },
    { label: "Evidências aguardando revisão", value: metrics.pendingFields },
    { label: "Datasets congelados", value: metrics.frozenDatasets },
    { label: "Casos concluídos", value: metrics.completedCases },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Painel"
        title="Situação operacional"
        description="Indicadores calculados exclusivamente a partir dos registros existentes no banco desta organização. Ausência de registros é exibida como zero."
        actions={
          <Button asChild size="sm">
            <Link to="/cases">Casos de avaliação</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="panel p-4">
            <p className="label-meta">{card.label}</p>
            <p className="mt-2 font-serif text-3xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel p-4">
          <p className="label-meta">Acervo de evidências</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Fontes cadastradas</dt>
              <dd className="mono-value">{metrics.sources}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Artefatos capturados</dt>
              <dd className="mono-value">{metrics.artifacts}</dd>
            </div>
          </dl>
        </div>

        <div className="panel p-4">
          <p className="label-meta">Últimos eventos de auditoria</p>
          {metrics.recentAudit.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum evento registrado até o momento.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {metrics.recentAudit.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="mono-value">{event.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <GovernanceNote>
        Nenhum indicador é estimado ou completado por inferência. Resultados de avaliação não são
        exibidos nesta fase: os motores metodológicos ainda não foram implementados.
      </GovernanceNote>
    </div>
  );
}

function OrganizationBootstrap() {
  const queryClient = useQueryClient();
  const bootstrap = useServerFn(bootstrapWorkspace);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");

  const mutation = useMutation({
    mutationFn: () => bootstrap({ data: { name, legalName } }),
    onSuccess: () => {
      toast.success("Organização criada.");
      void queryClient.invalidateQueries();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow="Primeiro acesso"
        title="Criar organização"
        description="Todos os dados da plataforma pertencem a uma organização. Você será registrado como titular (OWNER) e poderá conceder papéis a outros usuários."
      />
      <div className="panel space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Nome da organização</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-legal">Razão social (opcional)</Label>
          <Input id="org-legal" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <Button
          disabled={mutation.isPending || name.trim().length < 2}
          onClick={() => mutation.mutate()}
        >
          Criar organização
        </Button>
      </div>
    </div>
  );
}
