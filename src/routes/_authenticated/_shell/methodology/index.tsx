import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMethodologyChangeRequests, listValuationMethods } from "@/lib/methodology.functions";
import { SPEC_STATUS_TONE, SpecStatusBadge } from "@/components/app/MethodologyBits";

export const Route = createFileRoute("/_authenticated/_shell/methodology/")({
  component: MethodologyHome,
});

function MethodologyHome() {
  const fetchMethods = useServerFn(listValuationMethods);
  const fetchChangeRequests = useServerFn(listMethodologyChangeRequests);
  const methodsQuery = useQuery({
    queryKey: ["methodology", "methods"],
    queryFn: () => fetchMethods({}),
  });
  const crQuery = useQuery({
    queryKey: ["methodology", "change-requests"],
    queryFn: () => fetchChangeRequests({}),
  });

  if (methodsQuery.isPending) return <Skeleton className="h-96 w-full" />;
  if (methodsQuery.isError) {
    return (
      <EmptyState
        title="Falha ao carregar o registro metodológico"
        description={
          methodsQuery.error instanceof Error ? methodsQuery.error.message : "Erro desconhecido."
        }
        action={<Button onClick={() => void methodsQuery.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const { methods, specifications, implementations } = methodsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Metodologia"
        title="Registro metodológico e normativo"
        description="Cada método de avaliação existe primeiro como especificação declarada, versionada e rastreada até a fonte. Nenhum cálculo é executado nesta fase: implementações permanecem bloqueadas até haver especificação aprovada."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/methodology/sources">Biblioteca de fontes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/methodology/conflicts">Conflitos</Link>
            </Button>
          </>
        }
      />

      <section>
        <SectionTitle
          step="01"
          title="Métodos registrados"
          description="Shells de método. O status do método não autoriza cálculo: só a especificação aprovada define regras, fórmulas simbólicas e contratos de saída."
        />
        {methods.length === 0 ? (
          <EmptyState
            title="Nenhum método registrado"
            description="O registro de métodos é semeado por migração versionada."
          />
        ) : (
          <ul className="panel divide-y divide-border">
            {methods.map((method) => {
              const specs = specifications.filter((s) => s.valuation_method_id === method.id);
              const approved = specs.filter((s) => s.status === "APPROVED");
              return (
                <li key={method.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{method.name}</p>
                      <p className="mono-value text-xs text-muted-foreground">
                        {method.code} · {method.family_code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{method.status}</Badge>
                      <Badge variant={approved.length > 0 ? "default" : "secondary"}>
                        {approved.length > 0
                          ? `${approved.length} spec aprovada(s)`
                          : "sem spec aprovada"}
                      </Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/methodology/$methodId" params={{ methodId: method.id }}>
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  </div>
                  {specs.length > 0 ? (
                    <ul className="mt-3 space-y-1.5 border-l border-border pl-3">
                      {specs.map((spec) => (
                        <li
                          key={spec.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate">
                            <span className="mono-value">v{spec.version}</span> — {spec.title}
                          </span>
                          <span className="flex items-center gap-2">
                            <SpecStatusBadge status={spec.status} />
                            <Link
                              to="/methodology/specifications/$specId"
                              params={{ specId: spec.id }}
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              detalhar
                            </Link>
                          </span>
                        </li>
                      ))}
                    </ul>
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
          title="Implementações"
          description="Código executável permanece bloqueado nesta fase. Nenhuma implementação pode ser habilitada sem especificação aprovada e selada."
        />
        {implementations.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhuma implementação registrada — comportamento esperado nesta fase.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {implementations.map((impl) => (
              <li key={impl.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="mono-value">
                  {impl.implementation_code} v{impl.version}
                </span>
                <Badge variant={impl.status === "BLOCKED" ? "destructive" : "outline"}>
                  {impl.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle
          step="03"
          title="Solicitações de mudança metodológica"
          description="Toda alteração de regra, fórmula, parâmetro ou fonte passa por solicitação registrada. Quem propõe não decide."
        />
        {crQuery.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : crQuery.data && crQuery.data.changeRequests.length > 0 ? (
          <ul className="panel divide-y divide-border">
            {crQuery.data.changeRequests.map((cr) => (
              <li key={cr.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{cr.change_type}</p>
                  <Badge variant={SPEC_STATUS_TONE[cr.status] ?? "outline"}>{cr.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{cr.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhuma solicitação registrada.
          </div>
        )}
      </section>

      <GovernanceNote>
        Nenhuma fórmula, fator, limiar ou hipótese estatística pode existir apenas no código: precisa
        estar declarada em especificação com fonte identificada e localizador. Especificação aprovada
        é imutável — correção exige nova versão.
      </GovernanceNote>
    </div>
  );
}
