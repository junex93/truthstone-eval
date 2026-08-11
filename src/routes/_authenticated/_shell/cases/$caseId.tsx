import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { EmptyState, PageHeader } from "@/components/app/Primitives";
import { CaseStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCaseDetail } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId")({
  component: CaseLayout,
});

const CASE_TABS = [
  { to: "/cases/$caseId", label: "Resumo", exact: true },
  { to: "/cases/$caseId/property", label: "Imóvel avaliando", exact: false },
  { to: "/cases/$caseId/market", label: "Mercado", exact: false },
  { to: "/cases/$caseId/comparables", label: "Comparáveis", exact: false },
  { to: "/cases/$caseId/duplicates", label: "Duplicidades", exact: false },
  { to: "/cases/$caseId/research", label: "Pesquisa IA", exact: false },
] as const;

function CaseLayout() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchDetail = useServerFn(getCaseDetail);
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchDetail({ data: { caseId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Caso indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/cases">Voltar aos casos</Link>
          </Button>
        }
      />
    );
  }

  const { valuationCase } = query.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={valuationCase.case_code}
        title={valuationCase.title}
        description={valuationCase.purpose ?? "Finalidade não informada."}
        actions={<CaseStatusBadge status={valuationCase.status} />}
      />

      <nav
        aria-label="Seções do caso"
        className="flex flex-wrap gap-1 border-b border-border pb-px"
      >
        {CASE_TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ caseId }}
            activeOptions={{ exact: tab.exact }}
            className="rounded-t-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-b-2 data-[status=active]:border-primary data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
        <Link
          to="/evidence"
          className="rounded-t-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Evidências
        </Link>
        <Link
          to="/datasets"
          className="rounded-t-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Datasets
        </Link>
      </nav>

      <Outlet />
    </div>
  );
}
