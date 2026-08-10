import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { FrozenBadge } from "@/components/app/StatusBadge";
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
import { createDataset, listDatasets } from "@/lib/datasets.functions";
import { createDatasetSchema } from "@/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/_shell/datasets/")({
  component: DatasetsPage,
});

function DatasetsPage() {
  const fetchDatasets = useServerFn(listDatasets);
  const query = useQuery({ queryKey: ["datasets"], queryFn: () => fetchDatasets({}) });

  if (query.isPending) return <Skeleton className="h-80 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar datasets"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const { datasets, cases, role } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Datasets"
        title="Versões de dataset"
        description="Um dataset é a composição explícita de campos verificados usada em uma avaliação. Ao ser congelado, recebe hash determinístico e torna-se imutável."
      />

      {writable ? <NewDatasetForm cases={cases} /> : null}

      {datasets.length === 0 ? (
        <EmptyState
          title="Nenhum dataset criado"
          description="Crie uma versão de dataset vinculada a um caso para compor a base factual da avaliação."
        />
      ) : (
        <ul className="panel divide-y divide-border">
          {datasets.map((dataset) => (
            <li key={dataset.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  v{dataset.version_number} · {dataset.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dataset.case ? dataset.case.case_code : "caso removido"} · {dataset.itemCount}{" "}
                  elemento(s)
                </p>
              </div>
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

      <GovernanceNote>
        Somente campos com situação VERIFICADO podem entrar em um dataset. O congelamento é bloqueado
        se qualquer elemento perder essa condição.
      </GovernanceNote>
    </div>
  );
}

function NewDatasetForm({
  cases,
}: {
  cases: Array<{ id: string; case_code: string; title: string }>;
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createDataset);
  const [form, setForm] = useState({
    caseId: "",
    name: "",
    purpose: "",
    inclusionCriteria: "",
    exclusionCriteria: "",
    knownLimitations: "",
  });

  const mutation = useMutation({
    mutationFn: () => create({ data: createDatasetSchema.parse(form) }),
    onSuccess: () => {
      toast.success("Versão de dataset criada.");
      setForm((f) => ({ ...f, name: "", purpose: "" }));
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (cases.length === 0) {
    return (
      <EmptyState
        title="Nenhum caso disponível"
        description="Crie um caso de avaliação antes de compor datasets."
        action={
          <Button asChild variant="outline">
            <Link to="/cases">Ir para casos</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="panel space-y-4 p-5">
      <SectionTitle
        title="Nova versão de dataset"
        description="Critérios de inclusão, exclusão e limitações conhecidas são parte obrigatória da documentação técnica."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Caso</Label>
          <Select
            value={form.caseId}
            onValueChange={(value) => setForm((f) => ({ ...f, caseId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o caso" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.case_code} — {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dataset-name">Nome</Label>
          <Input
            id="dataset-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        {(
          [
            ["purpose", "Finalidade"],
            ["inclusionCriteria", "Critérios de inclusão"],
            ["exclusionCriteria", "Critérios de exclusão"],
            ["knownLimitations", "Limitações conhecidas"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`dataset-${key}`}>{label}</Label>
            <Textarea
              id={`dataset-${key}`}
              rows={2}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button
        disabled={mutation.isPending || form.caseId === ""}
        onClick={() => mutation.mutate()}
      >
        Criar versão
      </Button>
    </div>
  );
}
