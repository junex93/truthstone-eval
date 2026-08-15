/**
 * Interface das claims candidatas de fonte primária (Fase 7E).
 *
 * Nada aqui autoriza nada: o banco impõe documento autorizado,
 * CONTENT_VERIFIED, localizador da mesma fonte, LOCATOR_VERIFIED para aceite e
 * separação entre quem propõe e quem aceita. A tela apenas expõe o estado real
 * e devolve a recusa do banco quando o atalho é tentado.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  CLAIM_DECISION_LABEL,
  CLAIM_EXTRACTION_METHOD_LABEL,
  CLAIM_KIND_LABEL,
} from "@/lib/domain/methodology";
import type { MethodologyClaimDecision, MethodologyClaimKind } from "@/lib/domain/methodology";
import {
  FACTORS_SPECIFICATION_ID,
  batch01ItemsForSource,
} from "@/lib/domain/factors-batch01";
import {
  createMethodologySourceLocator,
  createSourceClaim,
  getClaimDossier,
  listSourceClaims,
  reviewSourceClaim,
} from "@/lib/methodology.functions";
import {
  createSourceClaimSchema,
  createSourceLocatorSchema,
  reviewSourceClaimSchema,
} from "@/lib/validation/methodology-schemas";

/* ================================================= proposta assistida === */

export function Batch01Panel({
  sourceId,
  canPropose,
  checkpointDone = true,
}: {
  sourceId: string;
  canPropose: boolean;
  /** Metadado E conteúdo já conferidos por humano autorizado nesta fonte. */
  checkpointDone?: boolean;
}) {
  const items = batch01ItemsForSource(sourceId);
  if (items.length === 0) return null;

  return (
    <section>
      <SectionTitle
        title="Batch 01 — proposta assistida (T01 / T04 / T07)"
        description="Localizador e claim candidata na mesma ação. Cada trecho foi lido da cópia autorizada desta organização e permanece CANDIDATO até conferência humana."
      />
      {!checkpointDone ? (
        <p className="mt-3 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Checkpoint humano pendente nesta fonte: registre METADATA_VERIFIED e CONTENT_VERIFIED
          antes de propor claims candidatas. Até lá, T01, T04 e T07 permanecem
          PENDING_PRIMARY_SOURCE e a sugestão abaixo é apenas material de leitura para o revisor —
          não é conteúdo verificado nem requisito normativo.
        </p>
      ) : null}
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <Batch01Card key={item.claim.claimCode} item={item} canPropose={canPropose} />
        ))}
      </div>
    </section>
  );
}

function Batch01Card({
  item,
  canPropose,
}: {
  item: ReturnType<typeof batch01ItemsForSource>[number];
  canPropose: boolean;
}) {
  const queryClient = useQueryClient();
  const createLocator = useServerFn(createMethodologySourceLocator);
  const createClaim = useServerFn(createSourceClaim);

  const mutation = useMutation({
    mutationFn: async () => {
      const locator = await createLocator({
        data: createSourceLocatorSchema.parse({
          sourceId: item.sourceId,
          locatorType: item.locator.locatorType,
          section: item.locator.section ?? null,
          clause: item.locator.clause ?? null,
          page: item.locator.page ?? null,
          tableReference: item.locator.tableReference ?? null,
          supportExcerpt: item.locator.supportExcerpt,
          notes: item.locator.notes,
        }),
      });
      return createClaim({
        data: createSourceClaimSchema.parse({
          sourceId: item.sourceId,
          locatorId: locator.locatorId,
          specificationId: FACTORS_SPECIFICATION_ID,
          requirementCode: item.claim.requirementCode,
          claimCode: item.claim.claimCode,
          claimKind: item.claim.claimKind,
          statement: item.claim.statement,
          verbatimExcerpt: item.claim.verbatimExcerpt ?? null,
          numericPayload: item.claim.numericPayload ?? null,
          deferredTarget: item.claim.deferredTarget ?? null,
          extractionMethod: item.claim.extractionMethod,
          reviewerAlerts: item.claim.reviewerAlerts,
          notes: item.locator.notes,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Localizador e claim candidata registrados.");
      void queryClient.invalidateQueries({ queryKey: ["methodology", "source", item.sourceId] });
      void queryClient.invalidateQueries({ queryKey: ["methodology", "claims", item.sourceId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <article className="panel space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{item.claim.claimCode}</Badge>
        <Badge variant="secondary">{item.claim.requirementCode}</Badge>
        <span className="text-xs text-muted-foreground">
          {CLAIM_KIND_LABEL[item.claim.claimKind as MethodologyClaimKind]} ·{" "}
          {item.locator.clause ?? item.locator.tableReference ?? item.locator.section} · p.{" "}
          {item.locator.page ?? "—"}
        </span>
      </div>
      <p className="text-sm">{item.claim.statement}</p>
      <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
        {item.locator.supportExcerpt}
      </blockquote>
      <ul className="space-y-1 text-xs text-muted-foreground">
        <li>
          Obtenção: {CLAIM_EXTRACTION_METHOD_LABEL[item.claim.extractionMethod]}
        </li>
        {item.claim.reviewerAlerts.map((alert) => (
          <li key={alert}>Alerta ao revisor: {alert}</li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        disabled={!canPropose || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        Registrar localizador + claim candidata
      </Button>
    </article>
  );
}

/* ============================================== claims já registradas === */

export function SourceClaimsPanel({ sourceId }: { sourceId: string }) {
  const fetchClaims = useServerFn(listSourceClaims);
  const query = useQuery({
    queryKey: ["methodology", "claims", sourceId],
    queryFn: () => fetchClaims({ data: { sourceId } }),
  });

  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError) return null;

  const { claims, reviews, role } = query.data;
  const canReviewClaims = role === "OWNER" || role === "ADMIN" || role === "REVIEWER";

  return (
    <section>
      <SectionTitle
        title="Claims candidatas desta fonte"
        description="Registro append-only. Aceite exige localizador verificado e revisor distinto de quem propôs."
      />
      {claims.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma claim candidata registrada para esta fonte.
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {claims.map((claim) => {
            const latest = reviews.find((r) => r.claim_id === claim.id);
            return (
              <article key={claim.id} className="panel space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{claim.claim_code}</Badge>
                  <Badge variant="secondary">{claim.requirement_code}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {CLAIM_KIND_LABEL[claim.claim_kind as MethodologyClaimKind]}
                  </span>
                  {latest ? (
                    <Badge>{CLAIM_DECISION_LABEL[latest.decision as MethodologyClaimDecision]}</Badge>
                  ) : (
                    <Badge variant="outline">Candidata — sem decisão</Badge>
                  )}
                </div>
                <p className="text-sm">{claim.statement}</p>
                {claim.verbatim_excerpt ? (
                  <blockquote className="border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                    {claim.verbatim_excerpt}
                  </blockquote>
                ) : null}
                {latest ? (
                  <p className="text-xs text-muted-foreground">
                    Justificativa registrada: {latest.justification}
                  </p>
                ) : canReviewClaims ? (
                  <ClaimReviewForm claimId={claim.id} sourceId={sourceId} />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClaimReviewForm({ claimId, sourceId }: { claimId: string; sourceId: string }) {
  const queryClient = useQueryClient();
  const review = useServerFn(reviewSourceClaim);
  const [justification, setJustification] = useState("");

  const mutation = useMutation({
    mutationFn: (decision: MethodologyClaimDecision) =>
      review({ data: reviewSourceClaimSchema.parse({ claimId, decision, justification }) }),
    onSuccess: () => {
      toast.success("Decisão registrada.");
      setJustification("");
      void queryClient.invalidateQueries({ queryKey: ["methodology", "claims", sourceId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={`just-${claimId}`}>Justificativa profissional (mínimo 20 caracteres)</Label>
        <Textarea
          id={`just-${claimId}`}
          rows={2}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate("ACCEPTED")}>
          Aceitar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate("REJECTED")}
        >
          Rejeitar
        </Button>
      </div>
    </div>
  );
}

/* ===================================================== dossiê por tema == */

export function ClaimDossierPanel({ specificationId }: { specificationId: string }) {
  const fetchDossier = useServerFn(getClaimDossier);
  const query = useQuery({
    queryKey: ["methodology", "claim-dossier", specificationId],
    queryFn: () => fetchDossier({ data: { specificationId } }),
  });

  if (query.isPending) return <Skeleton className="h-32 w-full" />;
  if (query.isError || !query.data) return null;

  const rows = query.data.dossier.requirements.filter(
    (r) => r.claims_total > 0 || r.is_satisfied,
  );

  return (
    <section>
      <SectionTitle
        title="Dossiê de claims por tema"
        description="Contagem factual de claims candidatas, aceitas e pendentes. Ausência de claim é ausência declarada, nunca conteúdo presumido."
      />
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum tema possui claim candidata: todos permanecem pendentes de fonte primária.
        </p>
      ) : (
        <div className="panel mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Tema</th>
                <th className="p-3">Candidatas</th>
                <th className="p-3">Aceitas</th>
                <th className="p-3">Sem decisão</th>
                <th className="p-3">Satisfeito</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.requirement_code} className="border-t border-border">
                  <td className="p-3">{r.requirement_code}</td>
                  <td className="p-3">{r.claims_total}</td>
                  <td className="p-3">{r.claims_accepted}</td>
                  <td className="p-3">{r.claims_pending}</td>
                  <td className="p-3">{r.is_satisfied ? "Sim" : "Não"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
