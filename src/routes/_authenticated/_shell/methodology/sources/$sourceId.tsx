import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Batch01Panel, SourceClaimsPanel } from "@/components/app/ClaimBits";
import { ReviewerGatePanel } from "@/components/app/ReviewerGate";
import { SourceVerificationCheckpoint } from "@/components/app/SourceVerificationCheckpoint";
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
  ACCESS_STATUS_LABEL,
  METHODOLOGY_LOCATOR_TYPES,
  METHODOLOGY_VERIFICATION_TYPES,
  READINESS_BLOCKER_LABEL,
  SOURCE_READINESS_LABEL,
} from "@/lib/domain/methodology";
import type { SourceReadinessReport } from "@/lib/domain/methodology";
import {
  createMethodologySourceLocator,
  getMethodologyDocumentUrl,
  getMethodologySource,
  getMethodologySourceReadiness,
  registerMethodologySourceDocument,
  verifyMethodologySource,
} from "@/lib/methodology.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AUTHORIZED_ACCESS_BASES,
  createSourceLocatorSchema,
  registerSourceDocumentSchema,
  verifyMethodologySourceSchema,
} from "@/lib/validation/methodology-schemas";

export const Route = createFileRoute("/_authenticated/_shell/methodology/sources/$sourceId")({
  component: SourceDetailPage,
});

function SourceDetailPage() {
  const { sourceId } = Route.useParams();
  const fetchSource = useServerFn(getMethodologySource);
  const fetchReadiness = useServerFn(getMethodologySourceReadiness);
  const query = useQuery({
    queryKey: ["methodology", "source", sourceId],
    queryFn: () => fetchSource({ data: { sourceId } }),
  });
  const readinessQuery = useQuery({
    queryKey: ["methodology", "source", sourceId, "readiness"],
    queryFn: () => fetchReadiness({ data: { sourceId } }),
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
  const verifierNames = query.data.verifierNames ?? {};
  const readiness = readinessQuery.data?.readiness;
  // O gate é do banco: a interface apenas reflete o diagnóstico da RPC.
  const contentAllowed = readiness ? readiness.organization_access_basis !== null : false;

  /**
   * Checkpoint humano do Batch 01: proposta de claim candidata só é oferecida
   * depois de metadado E conteúdo conferidos por humano autorizado nesta fonte.
   * O banco continua sendo quem recusa o atalho; aqui apenas não convidamos a ele.
   */
  const verificationTypes = new Set(verifications.map((v) => v.verification_type));
  const humanCheckpointDone =
    verificationTypes.has("METADATA_VERIFIED") && verificationTypes.has("CONTENT_VERIFIED");

  /** Ordem dos campos igual à do material de conferência (src/lib/domain/source-identity.ts). */
  const registeredIdentity = [
    { label: "Número da norma", value: source.identifier ?? "—" },
    { label: "Parte", value: source.short_title ?? source.identifier ?? "—" },
    { label: "Título", value: source.title },
    { label: "Emissor", value: source.issuing_body ?? source.authors ?? "—" },
    { label: "Edição", value: source.edition ?? "—" },
    {
      label: "Data de publicação",
      value: source.publication_date ?? (source.publication_year ? String(source.publication_year) : "—"),
    },
    { label: "Versão corrigida / vigência", value: source.effective_from ?? "—" },
    { label: "Idioma", value: source.language ?? "—" },
  ];

  const artifactFiles = artifacts.map((a) => ({
    file_name: a.evidence_artifacts?.file_name ?? "—",
    sha256_hash: a.evidence_artifacts?.sha256_hash ?? null,
    hash_computed_by: a.evidence_artifacts?.hash_computed_by ?? null,
    storage_bucket: a.evidence_artifacts?.storage_bucket ?? null,
    file_size: a.evidence_artifacts?.file_size ?? null,
  }));


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

      <ReadinessPanel readiness={readiness} pending={readinessQuery.isPending} />

      {!contentAllowed ? (
        <GovernanceNote>
          Esta organização não possui documento autorizado desta fonte: ela permanece como metadado
          declarado. Verificação de conteúdo e de localizador está bloqueada no banco, e nenhuma
          regra pode declarar citação textual apoiada nela. Uma cópia enviada por outra organização
          nunca satisfaz este requisito.
        </GovernanceNote>
      ) : null}

      <section>
        <SectionTitle
          step="00"
          title="Documento autorizado"
          description="Cópia privada da organização. O SHA-256 é calculado no servidor, lendo os bytes armazenados."
        />
        <ArtifactList artifacts={artifacts} />
        {canWrite(role) ? <DocumentIngestionForm sourceId={sourceId} /> : null}
      </section>

      <SourceVerificationCheckpoint
        sourceId={sourceId}
        identifier={source.identifier}
        registered={registeredIdentity}
        artifactFiles={artifactFiles}
        verifications={verifications}
        verifierNames={verifierNames}
        canReview={canReview(role)}
        contentAllowed={contentAllowed}
      />

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
        {canWrite(role) ? (
          <NewLocatorForm sourceId={sourceId} artifacts={artifacts} />
        ) : null}
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
                  {v.verified_by
                    ? ` · ${verifierNames[v.verified_by] ?? v.verified_by}`
                    : ""}
                  {v.notes ? ` — ${v.notes}` : ""}
                </span>
                <VerificationBadge type={v.verification_type} />
              </li>
            ))}
          </ul>
        )}
        {/* Metadado e conteúdo são assinados no checkpoint acima, na ordem obrigatória.
            Aqui resta apenas a conferência de localizador, que exige localizador existente. */}
        {canReview(role) && contentAllowed && locators.length > 0 ? (
          <VerifyForm sourceId={sourceId} locators={locators} />
        ) : null}
      </section>

      <ReviewerGatePanel />

      <Batch01Panel
        sourceId={sourceId}
        canPropose={canWrite(role) && humanCheckpointDone}
        checkpointDone={humanCheckpointDone}
      />

      <SourceClaimsPanel sourceId={sourceId} />

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

function ReadinessPanel({
  readiness,
  pending,
}: {
  readiness: SourceReadinessReport | undefined;
  pending: boolean;
}) {
  if (pending) return <Skeleton className="h-24 w-full" />;
  if (!readiness) return null;
  return (
    <div className="panel space-y-3 p-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <DataField
          label="Estado da fonte"
          value={SOURCE_READINESS_LABEL[readiness.state] ?? readiness.state}
        />
        <DataField
          label="Base de acesso nesta organização"
          value={
            readiness.organization_access_basis
              ? (ACCESS_STATUS_LABEL[readiness.organization_access_basis] ??
                readiness.organization_access_basis)
              : "Nenhuma"
          }
        />
        <DataField
          label="Escopo do registro"
          value={readiness.scope === "GLOBAL_METADATA" ? "Metadado global" : "Organização"}
        />
        <DataField
          label="Localizadores verificados"
          value={`${readiness.locators_verified} de ${readiness.locators_total}`}
        />
      </div>
      {readiness.blockers.length > 0 ? (
        <ul className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {readiness.blockers.map((b) => (
            <li key={b} className="mono-value">
              · {READINESS_BLOCKER_LABEL[b] ?? b}
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          Fonte pronta para revisão de regras. Isto habilita citação com localizador; não valida
          nenhuma fórmula nem parâmetro.
        </p>
      )}
    </div>
  );
}

interface ArtifactRow {
  id: string;
  evidence_artifact_id: string;
  access_basis: string;
  notes: string | null;
  created_at: string;
}

function ArtifactList({ artifacts }: { artifacts: ArtifactRow[] }) {
  const getUrl = useServerFn(getMethodologyDocumentUrl);
  const open = useMutation({
    mutationFn: (evidenceArtifactId: string) => getUrl({ data: { evidenceArtifactId } }),
    onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer"),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (artifacts.length === 0) {
    return (
      <div className="panel px-4 py-6 text-sm text-muted-foreground">
        Nenhum documento autorizado registrado nesta organização.
      </div>
    );
  }
  return (
    <ul className="panel divide-y divide-border">
      {artifacts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <span>
            <span className="mono-value text-xs text-muted-foreground">
              {ACCESS_STATUS_LABEL[a.access_basis] ?? a.access_basis}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {new Date(a.created_at).toLocaleString("pt-BR")}
            </span>
            {a.notes ? <p className="mt-0.5 text-xs text-muted-foreground">{a.notes}</p> : null}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={open.isPending}
            onClick={() => open.mutate(a.evidence_artifact_id)}
          >
            Abrir documento
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DocumentIngestionForm({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const register = useServerFn(registerMethodologySourceDocument);
  const [file, setFile] = useState<File | null>(null);
  const [accessBasis, setAccessBasis] = useState<string>("USER_PROVIDED_COPY");
  const [justification, setJustification] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o documento autorizado.");
      const { data: session } = await supabase.auth.getUser();
      const { data: member, error: memberError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", session.user?.id ?? "")
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (memberError) throw new Error(memberError.message);
      if (!member) throw new Error("Nenhuma organização ativa vinculada a este usuário.");

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const storagePath = `${member.organization_id}/${sourceId}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage
        .from("methodology-sources")
        .upload(storagePath, file, { upsert: false });
      if (upload.error) throw new Error(upload.error.message);

      return register({
        data: registerSourceDocumentSchema.parse({
          sourceId,
          storagePath,
          fileName: file.name,
          mimeType: file.type || null,
          accessBasis,
          accessJustification: justification,
        }),
      });
    },
    onSuccess: (result) => {
      toast.success(`Documento registrado. SHA-256 ${result.sha256?.slice(0, 12)}…`);
      setFile(null);
      setJustification("");
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", sourceId] });
      void queryClient.invalidateQueries({
        queryKey: ["methodology", "source", sourceId, "readiness"],
      });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel mt-3 space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-file">Arquivo</Label>
          <Input
            id="doc-file"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Base de acesso</Label>
          <Select value={accessBasis} onValueChange={setAccessBasis}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTHORIZED_ACCESS_BASES.map((b) => (
                <SelectItem key={b} value={b}>
                  {ACCESS_STATUS_LABEL[b] ?? b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-just">Justificativa da autorização</Label>
          <Input
            id="doc-just"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Ex.: exemplar adquirido pela organização"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        O documento fica em bucket privado, isolado por organização. Nenhuma outra organização passa
        a ter acesso ao conteúdo por causa deste envio.
      </p>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar documento autorizado
      </Button>
    </div>
  );
}

function NewLocatorForm({
  sourceId,
  artifacts,
}: {
  sourceId: string;
  artifacts: ArtifactRow[];
}) {
  const queryClient = useQueryClient();
  const create = useServerFn(createMethodologySourceLocator);
  const [form, setForm] = useState({
    locatorType: "SECTION",
    section: "",
    clause: "",
    page: "",
    supportExcerpt: "",
    artifactId: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: createSourceLocatorSchema.parse({
          sourceId,
          locatorType: form.locatorType,
          section: form.section || null,
          clause: form.clause || null,
          page: form.page === "" ? null : form.page,
          supportExcerpt: form.supportExcerpt || null,
          artifactId: form.artifactId === "" ? null : form.artifactId,
        }),
      }),
    onSuccess: () => {
      toast.success("Localizador registrado.");
      setForm((f) => ({ ...f, section: "", clause: "", page: "", supportExcerpt: "" }));
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", sourceId] });
      void queryClient.invalidateQueries({
        queryKey: ["methodology", "source", sourceId, "readiness"],
      });
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Documento de apoio</Label>
          <Select
            value={form.artifactId}
            onValueChange={(value) => setForm((f) => ({ ...f, artifactId: value }))}
            disabled={artifacts.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={artifacts.length === 0 ? "Nenhum documento" : "Nenhum"} />
            </SelectTrigger>
            <SelectContent>
              {artifacts.map((a) => (
                <SelectItem key={a.evidence_artifact_id} value={a.evidence_artifact_id}>
                  {ACCESS_STATUS_LABEL[a.access_basis] ?? a.access_basis} ·{" "}
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
  locators,
}: {
  sourceId: string;
  locators: Array<{ id: string; locator_type: string; section: string | null }>;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyMethodologySource);
  const [form, setForm] = useState({
    verificationType: "LOCATOR_VERIFIED",
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
      void queryClient.invalidateQueries({
        queryKey: ["methodology", "source", sourceId, "readiness"],
      });
      void queryClient.invalidateQueries({ queryKey: ["methodology", "sources"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const options = METHODOLOGY_VERIFICATION_TYPES.filter((t) => t === "LOCATOR_VERIFIED");

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
