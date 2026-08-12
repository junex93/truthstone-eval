import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  AccessStatusBadge,
  SpecStatusBadge,
  VerificationBadge,
} from "@/components/app/MethodologyBits";
import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
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
import { canReview, canWrite } from "@/hooks/use-workspace";
import {
  METHODOLOGY_LOCATOR_TYPES,
  METHODOLOGY_VERIFICATION_TYPES,
  allowsContentVerification,
} from "@/lib/domain/methodology";
import {
  createMethodologySourceLocator,
  getMethodologySource,
  verifyMethodologySource,
} from "@/lib/methodology.functions";
import {
  createSourceLocatorSchema,
  verifyMethodologySourceSchema,
} from "@/lib/validation/methodology-schemas";

export const Route = createFileRoute("/_authenticated/_shell/methodology/sources/$sourceId")({
  component: SourceDetailPage,
});

function SourceDetailPage() {
  const { sourceId } = Route.useParams();
  const fetchSource = useServerFn(getMethodologySource);
  const query = useQuery({
    queryKey: ["methodology", "source", sourceId],
    queryFn: () => fetchSource({ data: { sourceId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError || !query.data.source) {
    return (
      <EmptyState
        title="Fonte indisponível"
        description={query.error instanceof Error ? query.error.message : "Fora do escopo."}
        action={
          <Button asChild variant="outline">
            <Link to="/methodology/sources">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const { source, locators, verifications, artifacts, ruleSources, conflicts, role } = query.data;
  const contentAllowed = allowsContentVerification(source.access_status);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Metodologia · Fonte"
        title={source.title}
        description={`${source.identifier ?? "sem identificador"} · ${source.source_type} · ${source.jurisdiction}`}
        actions={
          <Button asChild variant="outline">
            <Link to="/methodology/sources">Voltar</Link>
          </Button>
        }
      />

      <div className="panel grid gap-4 p-5 sm:grid-cols-3">
        <DataField label="Situação" value={<SpecStatusBadge status={source.status} />} />
        <DataField label="Acesso" value={<AccessStatusBadge status={source.access_status} />} />
        <DataField label="Autoridade" value={source.authority_level} />
        <DataField label="Órgão / autoria" value={source.issuing_body ?? source.authors ?? "—"} />
        <DataField label="Edição / ano" value={`${source.edition ?? "—"} · ${source.publication_year ?? "—"}`} />
        <DataField label="Artefatos anexados" value={String(artifacts.length)} />
      </div>

      {!contentAllowed ? (
        <GovernanceNote>
          Esta fonte está registrada como METADATA_ONLY: a plataforma não possui cópia legítima do
          conteúdo. Verificação de conteúdo e de localizador está bloqueada, e nenhuma regra pode
          declarar citação textual apoiada nela.
        </GovernanceNote>
      ) : null}

      <section>
        <SectionTitle
          step="01"
          title="Localizadores"
          description="Seção, cláusula, página ou tabela — o endereço exato da regra dentro da fonte."
        />
        {locators.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhum localizador registrado.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {locators.map((loc) => (
              <li key={loc.id} className="px-4 py-3 text-sm">
                <p className="mono-value text-xs text-muted-foreground">{loc.locator_type}</p>
                <p className="mt-0.5">
                  {[loc.section, loc.clause, loc.chapter, loc.table_reference, loc.figure]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                  {loc.page !== null ? ` · p. ${loc.page}` : ""}
                </p>
                {loc.support_excerpt ? (
                  <p className="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground">
                    {loc.support_excerpt}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canWrite(role) ? <NewLocatorForm sourceId={sourceId} /> : null}
      </section>

      <section>
        <SectionTitle
          step="02"
          title="Verificações"
          description="Registro de conferência humana. Autor e data vêm do token, na mesma transação."
        />
        {verifications.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhuma verificação registrada — a fonte permanece como metadado declarado.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {verifications.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(v.verified_at).toLocaleString("pt-BR")}
                  {v.notes ? ` — ${v.notes}` : ""}
                </span>
                <VerificationBadge type={v.verification_type} />
              </li>
            ))}
          </ul>
        )}
        {canReview(role) ? (
          <VerifyForm sourceId={sourceId} contentAllowed={contentAllowed} locators={locators} />
        ) : null}
      </section>

      <section>
        <SectionTitle
          step="03"
          title="Regras que citam esta fonte"
          description="Rastreabilidade reversa: nenhuma regra normativa existe sem fonte identificada."
        />
        {ruleSources.length === 0 ? (
          <div className="panel px-4 py-6 text-sm text-muted-foreground">
            Nenhuma regra vinculada.
          </div>
        ) : (
          <ul className="panel divide-y divide-border">
            {ruleSources.map((rs) => (
              <li key={rs.id} className="px-4 py-3 text-sm">
                <span className="mono-value text-xs text-muted-foreground">
                  {rs.methodology_rules?.rule_code ?? "—"}
                </span>{" "}
                {rs.methodology_rules?.title ?? "regra removida"}
                <span className="ml-2 text-xs text-muted-foreground">({rs.relationship_type})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {conflicts.length > 0 ? (
        <section>
          <SectionTitle step="04" title="Conflitos registrados" />
          <ul className="panel divide-y divide-border">
            {conflicts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>{c.subject}</span>
                <SpecStatusBadge status={c.resolution_status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NewLocatorForm({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const create = useServerFn(createMethodologySourceLocator);
  const [form, setForm] = useState({
    locatorType: "SECTION",
    section: "",
    clause: "",
    page: "",
    supportExcerpt: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: createSourceLocatorSchema.parse({
          sourceId,
          locatorType: form.locatorType,
          section: form.section || null,
          clause: form.clause || null,
          page: form.page === "" ? null : Number(form.page),
          supportExcerpt: form.supportExcerpt || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Localizador registrado.");
      setForm((f) => ({ ...f, section: "", clause: "", page: "", supportExcerpt: "" }));
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", sourceId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel mt-3 space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select
            value={form.locatorType}
            onValueChange={(value) => setForm((f) => ({ ...f, locatorType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODOLOGY_LOCATOR_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-section">Seção</Label>
          <Input
            id="loc-section"
            value={form.section}
            onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-clause">Cláusula</Label>
          <Input
            id="loc-clause"
            value={form.clause}
            onChange={(e) => setForm((f) => ({ ...f, clause: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="loc-page">Página</Label>
          <Input
            id="loc-page"
            inputMode="numeric"
            value={form.page}
            onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-4">
          <Label htmlFor="loc-excerpt">Trecho de apoio (mínimo necessário)</Label>
          <Textarea
            id="loc-excerpt"
            rows={2}
            value={form.supportExcerpt}
            onChange={(e) => setForm((f) => ({ ...f, supportExcerpt: e.target.value }))}
          />
        </div>
      </div>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Adicionar localizador
      </Button>
    </div>
  );
}

function VerifyForm({
  sourceId,
  contentAllowed,
  locators,
}: {
  sourceId: string;
  contentAllowed: boolean;
  locators: Array<{ id: string; locator_type: string; section: string | null }>;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyMethodologySource);
  const [form, setForm] = useState({
    verificationType: "METADATA_VERIFIED",
    locatorId: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      verify({
        data: verifyMethodologySourceSchema.parse({
          sourceId,
          verificationType: form.verificationType,
          locatorId: form.locatorId === "" ? null : form.locatorId,
          notes: form.notes || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Verificação registrada.");
      setForm((f) => ({ ...f, notes: "" }));
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", sourceId] });
      void queryClient.invalidateQueries({ queryKey: ["methodology", "sources"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const options = contentAllowed
    ? METHODOLOGY_VERIFICATION_TYPES
    : METHODOLOGY_VERIFICATION_TYPES.filter((t) => t === "METADATA_VERIFIED");

  return (
    <div className="panel mt-3 space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Tipo de verificação</Label>
          <Select
            value={form.verificationType}
            onValueChange={(value) => setForm((f) => ({ ...f, verificationType: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Localizador (exigido para conteúdo)</Label>
          <Select
            value={form.locatorId}
            onValueChange={(value) => setForm((f) => ({ ...f, locatorId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              {locators.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.locator_type} {l.section ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ver-notes">Justificativa</Label>
          <Input
            id="ver-notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar verificação
      </Button>
    </div>
  );
}
