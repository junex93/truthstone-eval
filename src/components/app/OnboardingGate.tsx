import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { EmptyState, GovernanceNote, PageHeader } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboardingState, type PendingInvitationView } from "@/hooks/use-onboarding-state";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/constants";

function formatUtc(value: string): string {
  return `${new Date(value).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`;
}

/** Convite pendente do usuário autenticado. Nenhum vínculo nasce desta tela. */
export function PendingInvitationPanel({
  invitations,
  inviteToken,
  email,
}: {
  invitations: PendingInvitationView[];
  inviteToken: string | null;
  email: string | null;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Convite pendente"
        title={
          invitations.length === 1
            ? "Você possui um convite pendente"
            : `Você possui ${invitations.length} convites pendentes`
        }
        description="Nenhum vínculo é criado automaticamente por coincidência de e-mail. O ingresso exige o link original do convite e um aceite humano explícito, validado no banco de dados."
      />

      <div className="panel divide-y divide-border">
        {invitations.map((invite) => (
          <dl key={invite.invitationId} className="space-y-2 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Organização</dt>
              <dd className="font-medium">{invite.organizationName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Papel proposto</dt>
              <dd>{ORG_ROLE_LABELS[invite.invitedRole as OrgRole] ?? invite.invitedRole}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Convite enviado para</dt>
              <dd className="mono-value text-xs">{invite.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Situação</dt>
              <dd className="mono-value text-xs">Pendente</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Expira em</dt>
              <dd className="text-xs">{formatUtc(invite.expiresAt)}</dd>
            </div>
          </dl>
        ))}
      </div>

      {inviteToken ? (
        <div className="panel space-y-3 p-5">
          <p className="text-sm leading-relaxed">
            O link do convite ainda está disponível neste navegador. Abra-o para revisar os dados e
            confirmar o aceite.
          </p>
          <Button asChild>
            <Link to="/convite/$token" params={{ token: inviteToken }}>
              Continuar para o convite
            </Link>
          </Button>
        </div>
      ) : (
        <div className="panel space-y-2 p-5">
          <p className="text-sm leading-relaxed">
            Você possui um convite pendente, mas é necessário abrir o link original enviado pelo
            administrador. O sistema guarda apenas o resumo criptográfico do código do convite: o
            link não pode ser recuperado nem reconstruído aqui.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Peça ao titular da organização para reemitir o convite em Administração → Convites
            pendentes → Reenviar, e entregar o novo link. O link anterior deixa de valer.
          </p>
        </div>
      )}

      <GovernanceNote>
        Autenticado como {email ?? "—"}. O aceite só é possível quando o e-mail autenticado
        corresponde exatamente ao e-mail convidado, e é sempre um ato humano explícito.
      </GovernanceNote>
    </div>
  );
}

/**
 * Envolve telas que pressupõem organização selecionada. Enquanto sessão, memberships
 * e convites não estiverem resolvidos, nada de estado final é renderizado.
 */
export function OnboardingGate({
  children,
  noOrganization,
}: {
  children: ReactNode;
  noOrganization?: ReactNode;
}) {
  const onboarding = useOnboardingState();

  if (onboarding.state === "AUTH_LOADING") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (onboarding.state === "ERROR") {
    return (
      <EmptyState
        title="Falha ao resolver o contexto do usuário"
        description={
          onboarding.error instanceof Error ? onboarding.error.message : "Erro desconhecido."
        }
      />
    );
  }

  if (onboarding.state === "PENDING_INVITATION") {
    return (
      <PendingInvitationPanel
        invitations={onboarding.invitations}
        inviteToken={onboarding.inviteToken}
        email={onboarding.email}
      />
    );
  }

  if (onboarding.state === "NO_ORGANIZATION") {
    return (
      noOrganization ?? (
        <EmptyState
          title="Sem organização vinculada"
          description="Esta tela pertence a uma organização. Crie uma organização no painel ou abra o link de convite recebido. Se você esperava um convite, confirme com o administrador para qual endereço de e-mail ele foi enviado."
          action={
            <Button asChild variant="outline">
              <Link to="/dashboard">Ir para o painel</Link>
            </Button>
          }
        />
      )
    );
  }

  return <>{children}</>;
}
