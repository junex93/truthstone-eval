import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { SpecStatusBadge } from "@/components/app/MethodologyBits";
import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getValuationMethod } from "@/lib/methodology.functions";

export const Route = createFileRoute("/_authenticated/_shell/methodology/$methodId")({
  component: MethodDetailPage,
});

function MethodDetailPage() {
  const { methodId } = Route.useParams();
  const fetchMethod = useServerFn(getValuationMethod);
  const query = useQuery({
    queryKey: ["methodology", "method", methodId],
    queryFn: () => fetchMethod({ data: { methodId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Método indisponível"
        description={query.error instanceof Error ? query.error.message : "Fora do escopo."}
        action={
          <Button asChild variant="outline">
            <Link to="/methodology">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const { method, specifications, sourceRequirements, implementations } = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Metodologia · Método"
        title={method.name}
        description={method.description ?? "Shell de método registrado. Nenhum cálculo é executado nesta fase."}
        actions={
          <Button asChild variant="outline">
            <Link to="/methodology">Voltar</Link>
          </Button>
        }
      />

      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <DataField label="Código" value={method.code} mono />
        <DataField label="Família" value={method.family_code} />
        <DataField label="Situação" value={<Badge variant="outline">{method.status}</Badge>} />
      </div>

      <section>
        <SectionTitle
          step="01"
          title="Especificações"
          description="Somente a especificação aprovada e selada define o comportamento do método."
        />
        {specifications.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhuma especificação registrada.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {specifications.map((spec) => (
              <li key={spec.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <span className="mono-value">v{spec.version}</span> — {spec.title}
                  </p>
                  <p className="mono-value truncate text-[11px] text-muted-foreground">
                    {spec.specification_hash ?? "sem selo de integridade"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SpecStatusBadge status={spec.status} />
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/methodology/specifications/$specId" params={{ specId: spec.id }}>
                      Abrir
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="02"
          title="Requisitos de fonte"
          description="Checklist de proveniência exigido antes da aprovação. Satisfação nunca é herdada entre versões."
        />
        {sourceRequirements.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhum requisito registrado.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {sourceRequirements.map((req) => (
              <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="mono-value text-xs text-muted-foreground">
                    {req.requirement_code}
                  </span>{" "}
                  {req.description}
                </span>
                <Badge variant={req.is_satisfied ? "default" : "secondary"}>
                  {req.is_satisfied ? "atendido" : "pendente"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GovernanceNote>
        {implementations.length === 0
          ? "Nenhuma implementação executável registrada — comportamento esperado: cálculo permanece fora de escopo nesta fase."
          : "Implementações registradas permanecem bloqueadas até haver especificação aprovada e selada."}
      </GovernanceNote>
    </div>
  );
}
