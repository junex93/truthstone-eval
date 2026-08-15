/**
 * Fase 7K — checkpoint humano de verificação de fonte primária.
 *
 * A tela apenas organiza dois atos humanos distintos e na ordem obrigatória:
 * Etapa 1 (metadados) e Etapa 2 (conteúdo). Nenhum ato é executado
 * automaticamente: a RPC `verify_methodology_source` grava autor e data a
 * partir do token da pessoa autenticada. Verificar fonte não aprova regra,
 * claim, fórmula nem metodologia.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTENT_CHECK_ITEMS,
  EXPECTED_SOURCE_IDENTITY,
} from "@/lib/domain/source-identity";
import { verifyMethodologySource } from "@/lib/methodology.functions";
import { verifyMethodologySourceSchema } from "@/lib/validation/methodology-schemas";

interface VerificationRow {
  id: string;
  verification_type: string;
  verified_by: string | null;
  verified_at: string;
  notes: string | null;
}

interface ArtifactFile {
  file_name: string;
  sha256_hash: string | null;
  hash_computed_by: string | null;
  storage_bucket: string | null;
  file_size: number | null;
}

export function SourceVerificationCheckpoint({
  sourceId,
  identifier,
  registered,
  artifactFiles,
  verifications,
  verifierNames,
  canReview,
  contentAllowed,
}: {
  sourceId: string;
  identifier: string | null;
  registered: { label: string; value: string }[];
  artifactFiles: ArtifactFile[];
  verifications: VerificationRow[];
  verifierNames: Record<string, string>;
  canReview: boolean;
  contentAllowed: boolean;
}) {
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyMethodologySource);
  const [metadataNotes, setMetadataNotes] = useState("");
  const [contentNotes, setContentNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const expected = identifier ? EXPECTED_SOURCE_IDENTITY[identifier] : undefined;
  const metadataDone = verifications.find((v) => v.verification_type === "METADATA_VERIFIED");
  const contentDone = verifications.find((v) => v.verification_type === "CONTENT_VERIFIED");
  const artifactPresent = artifactFiles.length > 0;
  const integrityValid = artifactFiles.every(
    (a) => Boolean(a.sha256_hash) && a.hash_computed_by === "SERVER",
  );
  const allChecked = CONTENT_CHECK_ITEMS.every((item) => checks[item.key]);

  const mutation = useMutation({
    mutationFn: (input: { type: "METADATA_VERIFIED" | "CONTENT_VERIFIED"; notes: string }) =>
      verify({
        data: verifyMethodologySourceSchema.parse({
          sourceId,
          verificationType: input.type,
          locatorId: null,
          notes: input.notes || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Conferência registrada com seu nome e a data do servidor.");
      setMetadataNotes("");
      setContentNotes("");
      setChecks({});
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", sourceId] });
      void queryClient.invalidateQueries({
        queryKey: ["methodology", "source", sourceId, "readiness"],
      });
      void queryClient.invalidateQueries({ queryKey: ["methodology", "sources"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  const who = (row: VerificationRow | undefined) =>
    row ? (row.verified_by ? (verifierNames[row.verified_by] ?? row.verified_by) : "—") : "—";
  const when = (row: VerificationRow | undefined) =>
    row ? new Date(row.verified_at).toLocaleString("pt-BR") : "—";

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Conferência humana do documento"
        description="Duas etapas em ordem obrigatória. Quem confere é a pessoa autenticada; nenhum processo automático pode assinar por ela."
      />

      <div className="panel space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={artifactPresent ? "default" : "destructive"}>
            {artifactPresent ? "Documento anexado" : "Sem documento"}
          </Badge>
          <Badge variant={integrityValid ? "default" : "destructive"}>
            {integrityValid ? "Integridade válida" : "Integridade não confirmada"}
          </Badge>
          <Badge variant={metadataDone ? "default" : "secondary"}>
            Etapa 1 — metadados {metadataDone ? "conferidos" : "pendentes"}
          </Badge>
          <Badge variant={contentDone ? "default" : "secondary"}>
            Etapa 2 — conteúdo {contentDone ? "conferido" : "pendente"}
          </Badge>
        </div>
        {artifactFiles.map((a) => (
          <div key={a.file_name} className="space-y-0.5 border-t border-border pt-2 text-xs">
            <p className="text-foreground">{a.file_name}</p>
            <p className="mono-value break-all text-muted-foreground">
              SHA-256 (servidor): {a.sha256_hash ?? "—"}
            </p>
            {expected && expected.expectedFileName !== a.file_name ? (
              <p className="text-destructive">
                Nome de arquivo diferente do esperado para esta norma — confira antes de assinar.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* ETAPA 1 */}
      <div className="panel space-y-4 p-5">
        <div>
          <p className="text-sm font-medium">Etapa 1 — Verificar metadados</p>
          <p className="text-xs text-muted-foreground">
            Confira se a identificação cadastrada corresponde ao documento aberto. Não registre
            nada que não esteja visível no arquivo.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Campo</th>
                <th className="p-2">Cadastrado na plataforma</th>
                <th className="p-2">Esperado no documento (material de conferência)</th>
              </tr>
            </thead>
            <tbody>
              {(expected?.fields ?? []).map((field, index) => (
                <tr key={field.label} className="border-t border-border align-top">
                  <td className="p-2 text-muted-foreground">{field.label}</td>
                  <td className="p-2">{registered[index]?.value ?? "—"}</td>
                  <td className="p-2">{field.expected}</td>
                </tr>
              ))}
              {expected ? null : (
                <tr className="border-t border-border">
                  <td className="p-2 text-muted-foreground" colSpan={3}>
                    Sem material de conferência pré-registrado para esta fonte: compare diretamente
                    com o documento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {expected?.note ? <GovernanceNote>{expected.note}</GovernanceNote> : null}

        {metadataDone ? (
          <p className="text-xs text-muted-foreground">
            Conferido por <span className="text-foreground">{who(metadataDone)}</span> em{" "}
            {when(metadataDone)}
            {metadataDone.notes ? ` — ${metadataDone.notes}` : ""}
          </p>
        ) : canReview ? (
          <div className="space-y-2">
            <Label htmlFor="metadata-notes">Observação da conferência (registrada na auditoria)</Label>
            <Textarea
              id="metadata-notes"
              rows={2}
              value={metadataNotes}
              onChange={(e) => setMetadataNotes(e.target.value)}
              placeholder="Ex.: identificação, edição e data conferidas na capa do documento."
            />
            <Button
              size="sm"
              disabled={mutation.isPending || !artifactPresent || metadataNotes.trim().length < 5}
              onClick={() =>
                mutation.mutate({ type: "METADATA_VERIFIED", notes: metadataNotes.trim() })
              }
            >
              Confirmar metadados
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Seu papel não permite assinar conferência de fonte.
          </p>
        )}
      </div>

      {/* ETAPA 2 */}
      <div className="panel space-y-4 p-5">
        <div>
          <p className="text-sm font-medium">Etapa 2 — Verificar conteúdo</p>
          <p className="text-xs text-muted-foreground">
            Confirme que este arquivo corresponde à norma identificada e está apto à revisão
            metodológica. Isto não aprova regra, claim, fórmula nem metodologia.
          </p>
        </div>

        {!metadataDone ? (
          <GovernanceNote>
            Etapa bloqueada: confira os metadados primeiro. A ordem é
            documento presente → integridade válida → metadados → conteúdo.
          </GovernanceNote>
        ) : contentDone ? (
          <p className="text-xs text-muted-foreground">
            Conferido por <span className="text-foreground">{who(contentDone)}</span> em{" "}
            {when(contentDone)}
            {contentDone.notes ? ` — ${contentDone.notes}` : ""}
          </p>
        ) : !contentAllowed ? (
          <GovernanceNote>
            Sem base de acesso autorizada registrada nesta organização, a conferência de conteúdo
            permanece recusada pelo banco.
          </GovernanceNote>
        ) : canReview ? (
          <div className="space-y-3">
            <ul className="space-y-2">
              {CONTENT_CHECK_ITEMS.map((item) => (
                <li key={item.key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    id={`check-${item.key}`}
                    checked={Boolean(checks[item.key])}
                    onCheckedChange={(value) =>
                      setChecks((c) => ({ ...c, [item.key]: value === true }))
                    }
                  />
                  <Label htmlFor={`check-${item.key}`} className="text-sm font-normal">
                    {item.label}
                  </Label>
                </li>
              ))}
            </ul>
            <Label htmlFor="content-notes">Observação da conferência</Label>
            <Textarea
              id="content-notes"
              rows={2}
              value={contentNotes}
              onChange={(e) => setContentNotes(e.target.value)}
              placeholder="Ex.: documento legível, parte correta, integridade conferida."
            />
            <Button
              size="sm"
              disabled={
                mutation.isPending ||
                !allChecked ||
                !integrityValid ||
                contentNotes.trim().length < 5
              }
              onClick={() =>
                mutation.mutate({ type: "CONTENT_VERIFIED", notes: contentNotes.trim() })
              }
            >
              Confirmar conteúdo
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Seu papel não permite assinar conferência de fonte.
          </p>
        )}
      </div>
    </section>
  );
}
