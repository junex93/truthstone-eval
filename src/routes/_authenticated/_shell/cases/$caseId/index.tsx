import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DataField, GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { FrozenBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canWrite } from "@/hooks/use-workspace";
import { changeCaseStatus, getCaseDetail } from "@/lib/cases.functions";
import { CASE_STATUS_LABELS, type CaseStatus } from "@/lib/domain/constants";
import { formatDate, formatDateTime } from "@/lib/domain/derivation";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId/")({
  component: CaseOverviewPage,
});

function CaseOverviewPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchDetail = useServerFn(getCaseDetail);
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchDetail({ data: { caseId } }),
  });

  if (query.isPending) return <Skeleton className="h-72 w-full" />;
  if (query.isError) return null;

  const { valuationCase, sourceCount, datasets, audit, allowedTransitions, role } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-8">
      <div className="panel grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2">
        <DataField
          label="Situação"
          value={CASE_STATUS_LABELS[valuationCase.status as CaseStatus]}
        />
        <DataField label="Data de referência" value={formatDate(valuationCase.valuation_date)} />
        <DataField label="Fontes de evidência" value={String(sourceCount)} />
        <DataField label="Versões de dataset" value={String(datasets.length)} />
        <DataField label="Criado em" value={formatDateTime(valuationCase.created_at)} />
        <DataField label="Identificador" value={valuationCase.id} mono />
      </div>

      <div className="space-y-3">
        <SectionTitle
          title="Datasets deste caso"
          description="Um dataset congelado é pré-requisito para qualquer cálculo metodológico."
        />
        <Button asChild variant="outline" size="sm">
          <Link to="/datasets">Gerenciar datasets</Link>
        </Button>
        {datasets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma versão de dataset criada.</p>
        ) : (
          <ul className="panel divide-y divide-border">
            {datasets.map((dataset) => (
              <li key={dataset.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm">
                  v{dataset.version_number} · {dataset.name}
                </p>
                <div className="flex items-center gap-3">
                  <FrozenBadge frozen={dataset.frozen_at !== null} />
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/datasets/$datasetId" params={{ datasetId: dataset.id }}>
                      Abrir
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <SectionTitle
          title="Transições permitidas"
          description="O servidor recusa qualquer transição fora da máquina de estados, inclusive quando solicitada diretamente pela API."
        />
        {!writable ? (
          <p className="text-sm text-muted-foreground">
            Seu papel atual não permite alterar a situação do caso.
          </p>
        ) : allowedTransitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não há transições disponíveis a partir da situação atual.
          </p>
        ) : (
          <StatusTransitions caseId={caseId} transitions={allowedTransitions as CaseStatus[]} />
        )}
        <GovernanceNote>
          A transição para “Dataset congelado” exige a existência de pelo menos um dataset
          efetivamente congelado neste caso.
        </GovernanceNote>
      </div>

      <div className="space-y-3">
        <SectionTitle
          title="Trilha de auditoria"
          description="Registros append-only. Não podem ser editados nem removidos pela aplicação."
        />
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ul className="panel divide-y divide-border">
            {audit.map((event) => (
              <li key={event.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="mono-value">{event.event_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.entity_type} · {event.entity_id}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusTransitions({
  caseId,
  transitions,
}: {
  caseId: string;
  transitions: CaseStatus[];
}) {
  const queryClient = useQueryClient();
  const change = useServerFn(changeCaseStatus);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (nextStatus: CaseStatus) =>
      change({ data: { caseId, nextStatus, reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Situação atualizada.");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel space-y-4 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="transition-reason">Justificativa (registrada na auditoria)</Label>
        <Textarea
          id="transition-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {transitions.map((status) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(status)}
          >
            {CASE_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}
