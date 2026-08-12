import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { AccessStatusBadge, SpecStatusBadge } from "@/components/app/MethodologyBits";
import { EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
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
  METHODOLOGY_ACCESS_STATUSES,
  METHODOLOGY_AUTHORITY_LEVELS,
  METHODOLOGY_JURISDICTIONS,
  METHODOLOGY_SOURCE_TYPES,
  ACCESS_STATUS_LABEL,
} from "@/lib/domain/methodology";
import { createMethodologySource, listMethodologySources } from "@/lib/methodology.functions";
import { createMethodologySourceSchema } from "@/lib/validation/methodology-schemas";

export const Route = createFileRoute("/_authenticated/_shell/methodology/sources/")({
  component: SourcesPage,
});

function SourcesPage() {
  const fetchSources = useServerFn(listMethodologySources);
  const query = useQuery({
    queryKey: ["methodology", "sources"],
    queryFn: () => fetchSources({}),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar a biblioteca de fontes"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const { sources, verifications, role } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Metodologia · Fontes"
        title="Biblioteca normativa e bibliográfica"
        description="Registro de normas, livros, artigos e orientações técnicas. Metadado registrado não é conteúdo verificado: fontes METADATA_ONLY nunca sustentam citação de conteúdo."
        actions={
          <Button asChild variant="outline">
            <Link to="/methodology">Voltar ao registro</Link>
          </Button>
        }
      />

      {writable ? <NewSourceForm /> : null}

      <section>
        <SectionTitle
          title="Fontes"
          description="Somente fontes com cópia legítima admitem verificação de conteúdo e localizador."
        />
        {sources.length === 0 ? (
          <EmptyState
            title="Nenhuma fonte registrada"
            description="Cadastre a primeira norma ou obra de referência."
          />
        ) : (
          <ul className="panel divide-y divide-border">
            {sources.map((source) => {
              const own = verifications.filter((v) => v.source_id === source.id);
              return (
                <li key={source.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.issuing_body ?? source.authors ?? "autoria não informada"} ·{" "}
                        {source.publication_year ?? "ano não informado"} · {source.jurisdiction}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {source.organization_id === null ? (
                        <Badge variant="secondary">global</Badge>
                      ) : null}
                      <AccessStatusBadge status={source.access_status} />
                      <SpecStatusBadge status={source.status} />
                      <Badge variant="outline">{own.length} verificação(ões)</Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to="/methodology/sources/$sourceId"
                          params={{ sourceId: source.id }}
                        >
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <GovernanceNote>
        Nenhum texto normativo é reproduzido integralmente na plataforma. Registramos metadado,
        localizador (seção, cláusula, página) e trecho de apoio estritamente necessário à
        rastreabilidade da regra declarada.
      </GovernanceNote>
    </div>
  );
}

function NewSourceForm() {
  const queryClient = useQueryClient();
  const create = useServerFn(createMethodologySource);
  const [form, setForm] = useState({
    title: "",
    shortTitle: "",
    sourceType: "TECHNICAL_STANDARD",
    issuingBody: "",
    authors: "",
    edition: "",
    publicationYear: "",
    jurisdiction: "BR",
    identifier: "",
    externalUrl: "",
    accessStatus: "METADATA_ONLY",
    authorityLevel: "NATIONAL_TECHNICAL_STANDARD",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: createMethodologySourceSchema.parse({
          ...form,
          shortTitle: form.shortTitle || null,
          issuingBody: form.issuingBody || null,
          authors: form.authors || null,
          edition: form.edition || null,
          identifier: form.identifier || null,
          externalUrl: form.externalUrl || null,
          notes: form.notes || null,
          publicationYear: form.publicationYear === "" ? null : Number(form.publicationYear),
        }),
      }),
    onSuccess: () => {
      toast.success("Fonte registrada como PENDING_METADATA_REVIEW.");
      setForm((f) => ({ ...f, title: "", identifier: "", notes: "" }));
      void queryClient.invalidateQueries({ queryKey: ["methodology", "sources"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel space-y-4 p-5">
      <SectionTitle
        title="Registrar fonte"
        description="A fonte nasce pendente de revisão de metadado. A verificação é uma operação separada, feita por quem tem autoridade de revisão."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="src-title">Título</Label>
          <Input
            id="src-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-short">Título curto</Label>
          <Input
            id="src-short"
            value={form.shortTitle}
            onChange={(e) => setForm((f) => ({ ...f, shortTitle: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select
            value={form.sourceType}
            onValueChange={(value) => setForm((f) => ({ ...f, sourceType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_SOURCE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-body">Órgão emissor</Label>
          <Input
            id="src-body"
            value={form.issuingBody}
            onChange={(e) => setForm((f) => ({ ...f, issuingBody: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-authors">Autoria</Label>
          <Input
            id="src-authors"
            value={form.authors}
            onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-edition">Edição</Label>
          <Input
            id="src-edition"
            value={form.edition}
            onChange={(e) => setForm((f) => ({ ...f, edition: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-year">Ano</Label>
          <Input
            id="src-year"
            inputMode="numeric"
            value={form.publicationYear}
            onChange={(e) => setForm((f) => ({ ...f, publicationYear: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="src-identifier">Identificador (ex.: NBR 14653-2)</Label>
          <Input
            id="src-identifier"
            value={form.identifier}
            onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Jurisdição</Label>
          <Select
            value={form.jurisdiction}
            onValueChange={(value) => setForm((f) => ({ ...f, jurisdiction: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_JURISDICTIONS.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nível de autoridade</Label>
          <Select
            value={form.authorityLevel}
            onValueChange={(value) => setForm((f) => ({ ...f, authorityLevel: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_AUTHORITY_LEVELS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Situação de acesso</Label>
          <Select
            value={form.accessStatus}
            onValueChange={(value) => setForm((f) => ({ ...f, accessStatus: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_ACCESS_STATUSES.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACCESS_STATUS_LABEL[a] ?? a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="src-url">URL pública (quando houver)</Label>
          <Input
            id="src-url"
            value={form.externalUrl}
            onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="src-notes">Observações</Label>
          <Textarea
            id="src-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <Button disabled={mutation.isPending || form.title.trim().length < 3} onClick={() => mutation.mutate()}>
        Registrar fonte
      </Button>
    </div>
  );
}
