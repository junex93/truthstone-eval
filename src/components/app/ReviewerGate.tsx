/**
 * Fase 7G — gate humano de revisão independente (T01 / T04 / T07).
 *
 * Esta tela NÃO autoriza nada: o banco continua recusando aceite de claim por
 * quem propôs e verificação sem papel de revisão. Aqui apenas explicitamos:
 * quem existe na organização, se há revisor independente real e qual é o
 * próximo ato humano necessário. Nenhum revisor fictício, de serviço ou de IA
 * é aceitável como segundo ator.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";

import { GovernanceNote, SectionTitle } from "@/components/app/Primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getReviewerSegregationGate } from "@/lib/methodology.functions";

/** Escada de atos: cada degrau é um fato distinto, nunca sinônimo do seguinte. */
const VERIFICATION_LADDER: { key: string; label: string; meaning: string }[] = [
  {
    key: "METADATA_VERIFIED",
    label: "1 · Metadado conferido",
    meaning:
      "Um humano autorizado comparou o cadastro com o documento real (norma, parte, título, edição, data observável, emissor, idioma).",
  },
  {
    key: "CONTENT_VERIFIED",
    label: "2 · Conteúdo conferido",
    meaning:
      "O documento corresponde à fonte e está legível para revisão metodológica. Não significa que qualquer regra da norma foi aprovada.",
  },
  {
    key: "LOCATOR_VERIFIED",
    label: "3 · Localizador conferido",
    meaning:
      "Seção, cláusula, página ou tabela foi conferida no documento. Sugestão automática nunca substitui esta conferência.",
  },
  {
    key: "CLAIM_ACCEPTED",
    label: "4 · Claim aceita",
    meaning:
      "Afirmação candidata aceita por revisor independente, com justificativa. Continua sendo conteúdo metodológico, não parâmetro operacional.",
  },
  {
    key: "METHOD_RULE_APPROVED",
    label: "5 · Regra do método aprovada",
    meaning: "Ato posterior e distinto: nenhuma claim aceita aprova regra por consequência.",
  },
  {
    key: "SPEC_APPROVED",
    label: "6 · Especificação aprovada",
    meaning:
      "Ato final de governança. A especificação MCDDM — Tratamento por Fatores permanece em DRAFT nesta rodada.",
  },
];

export function ReviewerGatePanel({ compact = false }: { compact?: boolean }) {
  const fetchGate = useServerFn(getReviewerSegregationGate);
  const query = useQuery({
    queryKey: ["methodology", "reviewer-gate"],
    queryFn: () => fetchGate({}),
  });

  if (query.isPending) return <Skeleton className="h-40 w-full" />;
  if (query.isError || !query.data) return null;

  const gate = query.data.gate;
  const blocked = !gate.independentReviewerPresent;

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Gate de revisão humana independente"
        description="Estado factual da segregação profissional exigida para revisar fonte primária. Nenhum ator automatizado pode ocupar o papel de revisor."
      />

      <div className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={blocked ? "destructive" : "default"}>{gate.batchStatus}</Badge>
          <Badge variant="outline">Membros ativos: {gate.activeMembers}</Badge>
          <Badge variant="outline">
            Revisor independente: {gate.independentReviewerPresent ? "SIM" : "NÃO"}
          </Badge>
          {gate.independentReviewerRoles.map((role) => (
            <Badge key={role} variant="secondary">
              {role}
            </Badge>
          ))}
        </div>

        {blocked ? (
          <GovernanceNote>
            É necessário um segundo membro autorizado para revisão independente. Enquanto existir
            apenas um membro ativo, o Batch 01 (T01, T04 e T07) permanece{" "}
            <strong>BLOCKED_BY_HUMAN_REVIEWER</strong>: os temas continuam
            PENDING_PRIMARY_SOURCE. Convide uma pessoa real com papel REVIEWER — não crie conta de
            teste, conta de sistema, revisor de IA nem conceda OWNER apenas para destravar o fluxo.
          </GovernanceNote>
        ) : (
          <GovernanceNote>
            Existe revisor independente. Quem propõe a claim candidata nunca pode ser quem a aceita:
            o banco recusa a operação e a recusa é exibida como está.
          </GovernanceNote>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2">Pessoa</th>
                <th className="p-2">Papel</th>
                <th className="p-2">Situação</th>
                <th className="p-2">Pode revisar metodologia</th>
              </tr>
            </thead>
            <tbody>
              {gate.members.map((member) => (
                <tr key={member.memberId} className="border-t border-border">
                  <td className="p-2">
                    {member.displayName}
                    {member.isSelf ? " (você)" : ""}
                  </td>
                  <td className="p-2">{member.role}</td>
                  <td className="p-2">{member.status}</td>
                  <td className="p-2">
                    {member.canReviewMethodology
                      ? member.isSelf
                        ? "Sim — mas não sobre as próprias propostas"
                        : "Sim"
                      : "Não"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin">Gerenciar membros da organização</Link>
          </Button>
        </div>
      </div>

      {compact ? null : (
        <div className="panel space-y-3 p-5">
          <p className="text-sm font-medium">
            Atos distintos: verificar fonte não é aprovar conteúdo normativo
          </p>
          <ol className="space-y-2 text-xs text-muted-foreground">
            {VERIFICATION_LADDER.map((step) => (
              <li key={step.key} className="border-l-2 border-border pl-3">
                <span className="font-medium text-foreground">{step.label}</span> — {step.meaning}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Nenhum item candidato, pendente ou sugerido por IA é apresentado como verificado,
            aprovado ou requisito normativo. Sugestão automática é apenas proveniência de
            descoberta; autoria profissional é sempre humana.
          </p>
        </div>
      )}
    </section>
  );
}
