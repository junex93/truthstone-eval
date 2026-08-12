import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  ChecklistRow,
  HashRow,
  NormativeStrengthBadge,
  SpecStatusBadge,
} from "@/components/app/MethodologyBits";
import {
  DataField,
  EmptyState,
  GovernanceNote,
  PageHeader,
  SectionTitle,
} from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canReview, canWrite } from "@/hooks/use-workspace";
import {
  METHOD_SPEC_SECTION_KEYS,
  REQUIRED_SPEC_SECTIONS,
  SPEC_SECTION_LABEL,
  isSpecificationEditable,
} from "@/lib/domain/methodology";
import {
  approveMethodSpecification,
  getMethodSpecification,
  getSpecificationCompleteness,
  rejectMethodSpecification,
  submitMethodSpecification,
  updateDraftSpecificationSection,
  verifySpecificationIntegrity,
} from "@/lib/methodology.functions";

export const Route = createFileRoute(
  "/_authenticated/_shell/methodology/specifications/$specId",
)({
  component: SpecificationPage,
});

function SpecificationPage() {
  const { specId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchSpec = useServerFn(getMethodSpecification);
  const fetchCompleteness = useServerFn(getSpecificationCompleteness);
  const runIntegrity = useServerFn(verifySpecificationIntegrity);
  const submit = useServerFn(submitMethodSpecification);
  const approve = useServerFn(approveMethodSpecification);
  const reject = useServerFn(rejectMethodSpecification);

  const query = useQuery({
    queryKey: ["methodology", "spec", specId],
    queryFn: () => fetchSpec({ data: { specificationId: specId } }),
  });
  const completeness = useQuery({
    queryKey: ["methodology", "spec", specId, "completeness"],
    queryFn: () => fetchCompleteness({ data: { specificationId: specId } }),
  });
  const [rejectReason, setRejectReason] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["methodology"] });
  };

  const integrity = useMutation({
    mutationFn: () => runIntegrity({ data: { specificationId: specId } }),
    onSuccess: (report) =>
      report.result === "VALID"
        ? toast.success("Integridade confirmada: hash recalculado coincide com o selo.")
        : toast.error(`Integridade: ${report.result}`),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const submitMutation = useMutation({
    mutationFn: () => submit({ data: { specificationId: specId } }),
    onSuccess: () => {
      toast.success("Especificação submetida à revisão.");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const approveMutation = useMutation({
    mutationFn: () => approve({ data: { specificationId: specId } }),
    onSuccess: (r) => {
      toast.success(`Aprovada e selada (${r.hashAlgorithm}).`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const rejectMutation = useMutation({
    mutationFn: () => reject({ data: { specificationId: specId, reason: rejectReason } }),
    onSuccess: () => {
      toast.success("Especificação rejeitada com justificativa registrada.");
      setRejectReason("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError || !query.data.specification) {
    return (
      <EmptyState
        title="Especificação indisponível"
        description={query.error instanceof Error ? query.error.message : "Fora do escopo."}
        action={
          <Button asChild variant="outline">
            <Link to="/methodology">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const { specification, sections, rules, formulas, parameters, applicability, tests, role } =
    query.data;
  const editable = isSpecificationEditable(specification.status);
  const report = completeness.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Metodologia · Especificação"
        title={`v${specification.version} — ${specification.title}`}
        description={specification.purpose ?? "Especificação declarada. Nenhum cálculo é executado."}
        actions={
          <Button asChild variant="outline">
            <Link to="/methodology">Voltar</Link>
          </Button>
        }
      />

      <div className="panel space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <DataField label="Situação" value={<SpecStatusBadge status={specification.status} />} />
          <DataField label="Jurisdição" value={specification.jurisdiction} />
          <DataField
            label="Aprovada em"
            value={
              specification.approved_at
                ? new Date(specification.approved_at).toLocaleString("pt-BR")
                : "—"
            }
          />
        </div>
        <HashRow label="Selo de integridade" value={specification.specification_hash} />
        <HashRow label="Algoritmo" value={specification.hash_algorithm} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={integrity.isPending}
            onClick={() => integrity.mutate()}
          >
            Verificar integridade
          </Button>
          {editable && canWrite(role) ? (
            <Button
              size="sm"
              disabled={submitMutation.isPending || report?.is_complete === false}
              onClick={() => submitMutation.mutate()}
            >
              Submeter à revisão
            </Button>
          ) : null}
          {specification.status === "IN_REVIEW" && canReview(role) ? (
            <Button
              size="sm"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              Aprovar e selar
            </Button>
          ) : null}
        </div>
        {specification.status === "IN_REVIEW" && canReview(role) ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="reject-reason">Justificativa da rejeição</Label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              variant="destructive"
              disabled={rejectMutation.isPending || rejectReason.trim().length < 10}
              onClick={() => rejectMutation.mutate()}
            >
              Rejeitar
            </Button>
          </div>
        ) : null}
      </div>

      <section>
        <SectionTitle
          step="01"
          title="Completude"
          description="Diagnóstico calculado no banco. Aprovação é bloqueada enquanto houver impedimento."
        />
        {completeness.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : report ? (
          <div className="panel space-y-3 p-4">
            <p className="text-sm">
              {report.is_approvable
                ? "Apta a aprovação."
                : "Não apta: há requisitos pendentes ou impedimentos."}
            </p>
            <ul className="space-y-1">
              {report.completed_requirements.map((r) => (
                <ChecklistRow key={r} ok>
                  {r}
                </ChecklistRow>
              ))}
              {report.missing_requirements.map((r) => (
                <ChecklistRow key={r} ok={false}>
                  {r}
                </ChecklistRow>
              ))}
              {report.blockers.map((r) => (
                <ChecklistRow key={r} ok={false}>
                  IMPEDIMENTO: {r}
                </ChecklistRow>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section>
        <SectionTitle
          step="02"
          title="Seções estruturadas"
          description="Seções obrigatórias precisam estar preenchidas antes da submissão. Só rascunho é editável."
        />
        <div className="space-y-3">
          {METHOD_SPEC_SECTION_KEYS.map((key) => (
            <SectionEditor
              key={key}
              specId={specId}
              sectionKey={key}
              required={REQUIRED_SPEC_SECTIONS.includes(key)}
              content={sections.find((s) => s.section_key === key)?.content ?? ""}
              editable={editable && canWrite(role)}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          step="03"
          title="Regras, fórmulas e parâmetros declarados"
          description="Fórmulas são registros simbólicos: nenhuma expressão é avaliada em runtime."
        />
        <div className="panel divide-y divide-border">
          {rules.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma regra declarada.</p>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    <span className="mono-value text-xs text-muted-foreground">
                      {rule.rule_code}
                    </span>{" "}
                    {rule.title}
                  </p>
                  <NormativeStrengthBadge strength={rule.normative_strength} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(rule.methodology_rule_sources ?? []).length} fonte(s) vinculada(s)
                </p>
                {formulas
                  .filter((f) => f.rule_id === rule.id)
                  .map((f) => (
                    <p key={f.id} className="mono-value mt-1 text-xs break-all">
                      {f.formula_code}: {f.expression}
                    </p>
                  ))}
              </div>
            ))
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="panel p-4 text-sm">
            {parameters.length} parâmetro(s) declarado(s)
          </div>
          <div className="panel p-4 text-sm">
            {applicability.length} critério(s) de aplicabilidade
          </div>
          <div className="panel p-4 text-sm">{tests.length} caso(s) de teste</div>
        </div>
      </section>

      <GovernanceNote>
        Especificação aprovada é imutável e selada por SHA-256 sobre manifesto canônico. Qualquer
        correção exige nova versão, que nasce em rascunho e não herda satisfação de requisitos.
      </GovernanceNote>
    </div>
  );
}

function SectionEditor({
  specId,
  sectionKey,
  required,
  content,
  editable,
}: {
  specId: string;
  sectionKey: string;
  required: boolean;
  content: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateDraftSpecificationSection);
  const [value, setValue] = useState(content);

  const mutation = useMutation({
    mutationFn: () =>
      update({ data: { specificationId: specId, sectionKey, content: value } }),
    onSuccess: () => {
      toast.success("Seção atualizada.");
      void queryClient.invalidateQueries({ queryKey: ["methodology", "spec", specId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  return (
    <div className="panel space-y-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`sec-${sectionKey}`} className="text-xs">
          {SPEC_SECTION_LABEL[sectionKey as keyof typeof SPEC_SECTION_LABEL] ?? sectionKey}
          {required ? " *" : ""}
        </Label>
        {content.trim() === "" ? (
          <span className="label-meta text-destructive">vazia</span>
        ) : null}
      </div>
      <Textarea
        id={`sec-${sectionKey}`}
        rows={3}
        value={value}
        disabled={!editable}
        onChange={(e) => setValue(e.target.value)}
      />
      {editable ? (
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending || value.trim() === content.trim()}
          onClick={() => mutation.mutate()}
        >
          Salvar seção
        </Button>
      ) : null}
    </div>
  );
}
