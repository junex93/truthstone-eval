import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { FieldStateBadge, ValidationStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canReview, canWrite } from "@/hooks/use-workspace";
import {
  createExtraction,
  createEvidenceField,
  getArtifactSignedUrl,
  getEvidenceSourceDetail,
  registerEvidenceArtifact,
  rejectEvidenceField,
  verifyEvidenceField,
} from "@/lib/evidence.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_shell/evidence/$sourceId")({
  component: SourceDetailPage,
});

function SourceDetailPage() {
  const { sourceId } = useParams({ from: "/_authenticated/_shell/evidence/$sourceId" });
  const fetchDetail = useServerFn(getEvidenceSourceDetail);
  const signUrl = useServerFn(getArtifactSignedUrl);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["evidence-source", sourceId],
    queryFn: () => fetchDetail({ data: { sourceId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Fonte indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/evidence">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const { source, artifacts, extractions, fields, reviews, audit, role } = query.data;
  const writable = canWrite(role);
  const reviewer = canReview(role);
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["evidence-source", sourceId] });

  async function openArtifact(artifactId: string) {
    try {
      const result = await signUrl({ data: { artifactId } });
      window.open(result.url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar link");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cadeia de proveniência"
        title={String(source["source_name"] ?? "Fonte")}
        description="Origem → artefato original → extração → dados candidatos → validação humana → histórico."
      />

      <div className="panel grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2">
        <DataField label="Tipo" value={String(source["source_type"] ?? "")} />
        <DataField label="Publicador" value={source["publisher_or_owner"] as string | null} />
        <DataField label="URL" value={source["source_url"] as string | null} mono />
        <DataField label="Acesso registrado" value={source["accessed_at"] as string | null} mono />
      </div>

      <section className="space-y-3">
        <SectionTitle
          title="Artefatos originais"
          description="O hash SHA-256 é calculado no servidor a partir dos bytes efetivamente armazenados."
        />
        {artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artefato capturado.</p>
        ) : (
          <ul className="panel divide-y divide-border">
            {artifacts.map((artifact) => (
              <li key={artifact.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{String(artifact["file_name"])}</p>
                  <Button variant="ghost" size="sm" onClick={() => void openArtifact(artifact.id)}>
                    Abrir original
                  </Button>
                </div>
                <p className="mono-value break-all text-xs text-muted-foreground">
                  sha256: {String(artifact["sha256_hash"])}
                </p>
                {writable ? (
                  <ExtractionForm artifactId={artifact.id} onDone={invalidate} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {writable ? (
          <UploadArtifact
            sourceId={sourceId}
            organizationId={String(source["organization_id"])}
            caseId={source["valuation_case_id"] as string | null}
            onDone={invalidate}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <SectionTitle
          title="Extrações e dados candidatos"
          description="Nenhum valor é promovido a fato sem verificação humana com justificativa."
        />
        {extractions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma extração registrada.</p>
        ) : (
          extractions.map((extraction) => (
            <div key={extraction.id} className="panel space-y-3 p-4">
              <p className="text-sm">
                Extração v{String(extraction["version_number"])} ·{" "}
                <span className="mono-value">{String(extraction["processor_type"])}</span>
              </p>
              <ul className="divide-y divide-border">
                {fields
                  .filter((field) => field["extraction_id"] === extraction.id)
                  .map((field) => (
                    <li key={field.id} className="space-y-2 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="mono-value text-sm">{String(field["field_name"])}</span>
                        <div className="flex items-center gap-2">
                          <FieldStateBadge state={String(field["field_state"])} />
                          <ValidationStatusBadge status={String(field["validation_status"])} />
                        </div>
                      </div>
                      <p className="text-sm">
                        {(field["normalized_value"] as string | null) ??
                          (field["raw_value"] as string | null) ??
                          "não informado"}{" "}
                        {(field["unit"] as string | null) ?? ""}
                      </p>
                      {field["source_excerpt"] ? (
                        <p className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
                          “{String(field["source_excerpt"])}”
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Sem trecho de evidência: a verificação será recusada pelo servidor.
                        </p>
                      )}
                      {reviewer && String(field["validation_status"]) !== "VERIFIED" ? (
                        <ReviewActions fieldId={field.id} onDone={invalidate} />
                      ) : null}
                    </li>
                  ))}
              </ul>
              {writable ? <FieldForm extractionId={extraction.id} onDone={invalidate} /> : null}
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Histórico e revisões" />
        <div className="panel divide-y divide-border">
          {[...reviews].map((review) => (
            <p key={review.id} className="px-4 py-2 text-sm">
              <span className="mono-value">{String(review["decision"])}</span> ·{" "}
              {String(review["notes"] ?? "")}
            </p>
          ))}
          {audit.map((event) => (
            <p key={event.id} className="px-4 py-2 text-xs text-muted-foreground">
              <span className="mono-value">{event.event_type}</span> ·{" "}
              {new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC
            </p>
          ))}
        </div>
      </section>

      <GovernanceNote>
        Registros de auditoria são append-only. Reprovações permanecem visíveis: o histórico não é
        limpo.
      </GovernanceNote>
    </div>
  );
}

function UploadArtifact({
  sourceId,
  organizationId,
  caseId,
  onDone,
}: {
  sourceId: string;
  organizationId: string;
  caseId: string | null;
  onDone: () => void;
}) {
  const register = useServerFn(registerEvidenceArtifact);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const path = `${organizationId}/${caseId ?? "sem-caso"}/${crypto.randomUUID()}-${file.name}`;
      const upload = await supabase.storage.from("evidence-originals").upload(path, file);
      if (upload.error) throw new Error(upload.error.message);
      await register({
        data: { sourceId, storagePath: path, fileName: file.name, mimeType: file.type || undefined },
      });
      toast.success("Artefato capturado e hash calculado no servidor.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel space-y-2 p-4">
      <Label htmlFor="artifact-file">Capturar artefato original</Label>
      <Input
        id="artifact-file"
        type="file"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

function ExtractionForm({ artifactId, onDone }: { artifactId: string; onDone: () => void }) {
  const create = useServerFn(createExtraction);
  const mutation = useMutation({
    mutationFn: () =>
      create({ data: { artifactId, processorType: "MANUAL", extractionType: "Leitura manual" } }),
    onSuccess: () => {
      toast.success("Extração manual criada.");
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      Nova extração manual
    </Button>
  );
}

function FieldForm({ extractionId, onDone }: { extractionId: string; onDone: () => void }) {
  const create = useServerFn(createEvidenceField);
  const [form, setForm] = useState({
    fieldName: "",
    rawValue: "",
    normalizedValue: "",
    unit: "",
    sourceExcerpt: "",
    sourceLocator: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({ data: { extractionId, fieldState: "PRESENT", ...form } }),
    onSuccess: () => {
      toast.success("Dado candidato registrado (pendente de verificação).");
      setForm({
        fieldName: "",
        rawValue: "",
        normalizedValue: "",
        unit: "",
        sourceExcerpt: "",
        sourceLocator: "",
      });
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["fieldName", "Nome do campo"],
            ["rawValue", "Valor bruto"],
            ["normalizedValue", "Valor normalizado"],
            ["unit", "Unidade"],
            ["sourceLocator", "Localizador (página, seção)"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`${extractionId}-${key}`}>{label}</Label>
            <Input
              id={`${extractionId}-${key}`}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`${extractionId}-excerpt`}>Trecho literal da fonte</Label>
          <Textarea
            id={`${extractionId}-excerpt`}
            rows={2}
            value={form.sourceExcerpt}
            onChange={(e) => setForm((f) => ({ ...f, sourceExcerpt: e.target.value }))}
          />
        </div>
      </div>
      <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        Registrar dado candidato
      </Button>
    </div>
  );
}

function ReviewActions({ fieldId, onDone }: { fieldId: string; onDone: () => void }) {
  const verify = useServerFn(verifyEvidenceField);
  const reject = useServerFn(rejectEvidenceField);
  const [notes, setNotes] = useState("");

  const verifyMutation = useMutation({
    mutationFn: () => verify({ data: { fieldId, verificationNotes: notes } }),
    onSuccess: () => {
      toast.success("Campo verificado.");
      setNotes("");
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => reject({ data: { fieldId, rejectionReason: notes } }),
    onSuccess: () => {
      toast.success("Campo rejeitado com motivo registrado.");
      setNotes("");
      onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-2 rounded-sm border border-border p-3">
      <Label htmlFor={`review-${fieldId}`}>Justificativa da decisão</Label>
      <Textarea
        id={`review-${fieldId}`}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={verifyMutation.isPending || notes.trim().length < 3}
          onClick={() => verifyMutation.mutate()}
        >
          Verificar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rejectMutation.isPending || notes.trim().length < 3}
          onClick={() => rejectMutation.mutate()}
        >
          Rejeitar
        </Button>
      </div>
    </div>
  );
}
