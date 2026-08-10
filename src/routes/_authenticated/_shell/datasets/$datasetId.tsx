import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { FrozenBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { canWrite } from "@/hooks/use-workspace";
import {
  addDatasetItem,
  freezeDataset,
  getDatasetDetail,
  removeDatasetItem,
} from "@/lib/datasets.functions";

export const Route = createFileRoute("/_authenticated/_shell/datasets/$datasetId")({
  component: DatasetDetailPage,
});

function DatasetDetailPage() {
  const { datasetId } = useParams({ from: "/_authenticated/_shell/datasets/$datasetId" });
  const queryClient = useQueryClient();
  const fetchDetail = useServerFn(getDatasetDetail);
  const addItem = useServerFn(addDatasetItem);
  const removeItem = useServerFn(removeDatasetItem);
  const freeze = useServerFn(freezeDataset);
  const [confirmation, setConfirmation] = useState("");

  const query = useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => fetchDetail({ data: { datasetId } }),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["dataset", datasetId] });
    void queryClient.invalidateQueries({ queryKey: ["datasets"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const addMutation = useMutation({
    mutationFn: (evidenceFieldId: string) =>
      addItem({ data: { datasetVersionId: datasetId, evidenceFieldId } }),
    onSuccess: () => {
      toast.success("Elemento incluído.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeItem({ data: { itemId } }),
    onSuccess: () => {
      toast.success("Elemento removido.");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const freezeMutation = useMutation({
    mutationFn: () =>
      freeze({ data: { datasetVersionId: datasetId, confirmation: "CONGELAR" as const } }),
    onSuccess: (result) => {
      toast.success(`Dataset congelado. Hash ${result.datasetHash.slice(0, 12)}…`);
      setConfirmation("");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Dataset indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/datasets">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const { dataset, items, eligibleFields, isFrozen, valuationCase, rejectedFieldCount, role } =
    query.data;
  const writable = canWrite(role) && !isFrozen;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Dataset v${String(dataset["version_number"])}`}
        title={String(dataset["name"])}
        description={
          (dataset["purpose"] as string | null) ??
          "Finalidade não informada para esta versão de dataset."
        }
        actions={<FrozenBadge frozen={isFrozen} />}
      />

      <div className="panel grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2">
        <DataField label="Caso" value={valuationCase ? valuationCase.case_code : null} />
        <DataField label="Elementos" value={String(items.length)} />
        <DataField label="Hash da composição" value={dataset["dataset_hash"] as string | null} mono />
        <DataField label="Congelado em" value={dataset["frozen_at"] as string | null} mono />
        <DataField label="Critérios de inclusão" value={dataset["inclusion_criteria"] as string | null} />
        <DataField label="Critérios de exclusão" value={dataset["exclusion_criteria"] as string | null} />
        <DataField label="Limitações conhecidas" value={dataset["known_limitations"] as string | null} />
        <DataField label="Campos rejeitados na organização" value={String(rejectedFieldCount)} />
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Composição"
          description="Apenas campos verificados compõem a base factual. A remoção é bloqueada após o congelamento."
        />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum elemento incluído.</p>
        ) : (
          <ul className="panel divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="mono-value text-sm">{item.field?.field_name ?? "campo removido"}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.field?.normalized_value ?? item.field?.raw_value ?? "não informado"}{" "}
                    {item.field?.unit ?? ""}
                  </p>
                </div>
                {writable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(item.id)}
                  >
                    Remover
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {writable ? (
        <section className="space-y-3">
          <SectionTitle
            title="Campos verificados disponíveis"
            description="Lista restrita a campos com verificação humana registrada."
          />
          {eligibleFields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum campo verificado disponível. Conclua a validação no motor de evidências.
            </p>
          ) : (
            <ul className="panel divide-y divide-border">
              {eligibleFields.map((field) => (
                <li key={field.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="mono-value text-sm">{field.field_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {field.normalized_value ?? field.raw_value ?? "não informado"} {field.unit ?? ""}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={addMutation.isPending}
                    onClick={() => addMutation.mutate(field.id)}
                  >
                    Incluir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {!isFrozen && canWrite(role) ? (
        <section className="panel space-y-3 p-5">
          <SectionTitle
            title="Congelar versão"
            description="O congelamento é irreversível: gera hash determinístico da composição e bloqueia alterações."
          />
          <div className="space-y-1.5">
            <Label htmlFor="freeze-confirm">Digite CONGELAR para confirmar</Label>
            <Input
              id="freeze-confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </div>
          <Button
            disabled={confirmation !== "CONGELAR" || freezeMutation.isPending}
            onClick={() => freezeMutation.mutate()}
          >
            Congelar dataset
          </Button>
        </section>
      ) : null}

      <GovernanceNote>
        Após o congelamento, qualquer correção exige a criação de uma nova versão. O histórico da
        versão anterior permanece disponível.
      </GovernanceNote>
    </div>
  );
}
