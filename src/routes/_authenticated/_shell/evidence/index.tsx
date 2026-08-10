import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
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
import { SOURCE_TYPES, SOURCE_TYPE_LABELS, type SourceType } from "@/lib/domain/constants";
import { createEvidenceSource, listEvidenceSources } from "@/lib/evidence.functions";
import { createSourceSchema } from "@/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/_shell/evidence/")({
  component: EvidencePage,
});

function EvidencePage() {
  const fetchSources = useServerFn(listEvidenceSources);
  const query = useQuery({ queryKey: ["evidence-sources"], queryFn: () => fetchSources({}) });

  if (query.isPending) return <Skeleton className="h-80 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar evidências"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const { sources, cases, role } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Motor de evidências"
        title="Fontes e artefatos"
        description="Toda informação factual precisa nascer de uma fonte declarada e de um artefato original armazenado, com hash calculado no servidor."
      />

      {writable ? <NewSourceForm cases={cases} /> : null}

      <div className="space-y-3">
        <SectionTitle title="Fontes registradas" />
        {sources.length === 0 ? (
          <EmptyState
            title="Nenhuma fonte registrada"
            description="Cadastre a primeira fonte para começar a capturar artefatos originais."
          />
        ) : (
          <ul className="panel divide-y divide-border">
            {sources.map((source) => (
              <li key={source.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.source_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {SOURCE_TYPE_LABELS[source.source_type as SourceType] ?? source.source_type}
                    {source.case ? ` · ${source.case.case_code}` : " · sem caso vinculado"} ·{" "}
                    {source.artifacts.length} artefato(s)
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/evidence/$sourceId" params={{ sourceId: source.id }}>
                    Abrir cadeia
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <GovernanceNote>
        Um campo extraído nasce como candidato. Sem verificação humana registrada, ele não pode
        compor dataset nem sustentar conclusão técnica.
      </GovernanceNote>
    </div>
  );
}

function NewSourceForm({ cases }: { cases: Array<{ id: string; case_code: string; title: string }> }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createEvidenceSource);
  const [form, setForm] = useState({
    caseId: "",
    sourceType: "OTHER" as SourceType,
    sourceName: "",
    sourceUrl: "",
    publisherOrOwner: "",
    publicationDate: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createSourceSchema.parse({
        ...form,
        caseId: form.caseId === "" ? undefined : form.caseId,
      });
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Fonte registrada.");
      setForm((f) => ({ ...f, sourceName: "", sourceUrl: "", publisherOrOwner: "", notes: "" }));
      void queryClient.invalidateQueries({ queryKey: ["evidence-sources"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel space-y-4 p-5">
      <SectionTitle
        title="Registrar fonte"
        description="Declare de onde a informação vem antes de anexar qualquer arquivo."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Tipo de fonte</Label>
          <Select
            value={form.sourceType}
            onValueChange={(value) => setForm((f) => ({ ...f, sourceType: value as SourceType }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SOURCE_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Caso vinculado</Label>
          <Select
            value={form.caseId === "" ? "none" : form.caseId}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, caseId: value === "none" ? "" : value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem vínculo</SelectItem>
              {cases.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.case_code} — {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-name">Nome da fonte</Label>
          <Input
            id="source-name"
            value={form.sourceName}
            onChange={(e) => setForm((f) => ({ ...f, sourceName: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-url">URL (se aplicável)</Label>
          <Input
            id="source-url"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-owner">Publicador / responsável</Label>
          <Input
            id="source-owner"
            value={form.publisherOrOwner}
            onChange={(e) => setForm((f) => ({ ...f, publisherOrOwner: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="source-date">Data de publicação</Label>
          <Input
            id="source-date"
            type="date"
            value={form.publicationDate}
            onChange={(e) => setForm((f) => ({ ...f, publicationDate: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="source-notes">Observações técnicas</Label>
          <Textarea
            id="source-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar fonte
      </Button>
    </div>
  );
}
