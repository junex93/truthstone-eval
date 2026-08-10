import { createFileRoute } from "@tanstack/react-router";

import { GovernanceNote, PageHeader } from "@/components/app/Primitives";
import { EVIDENCE_QUALITY_DIMENSIONS } from "@/lib/domain/constants";

export const Route = createFileRoute("/_authenticated/_shell/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Relatórios"
        title="Laudos e relatórios"
        description="Módulo previsto para fases posteriores. Nenhum laudo, valor ou resultado de avaliação é gerado nesta fase."
      />

      <div className="panel p-5">
        <p className="label-meta">Pré-requisitos técnicos</p>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
          <li>Dataset congelado com hash de composição registrado</li>
          <li>Especificação técnica documentada da metodologia aplicada</li>
          <li>Motor de cálculo versionado e reprodutível</li>
          <li>Registro de convergência entre metodologias independentes</li>
        </ul>
      </div>

      <div className="panel p-5">
        <p className="label-meta">Dimensões previstas para o Evidence Confidence Score</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Estas dimensões estão previstas na arquitetura, mas nenhuma nota final é calculada: pesos,
          regras e calibração ainda não foram formalmente definidos.
        </p>
        <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {EVIDENCE_QUALITY_DIMENSIONS.map((dimension) => (
            <li key={dimension} className="mono-value text-muted-foreground">
              {dimension}
            </li>
          ))}
        </ul>
      </div>

      <GovernanceNote>
        Nenhum percentual de confiança gerado por modelo de linguagem é exibido ou armazenado como
        verdade.
      </GovernanceNote>
    </div>
  );
}
