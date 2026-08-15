import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { readInviteIntent } from "@/lib/invite-intent";
import { listMyPendingInvitations } from "@/lib/invitations.functions";
import { useWorkspace } from "@/hooks/use-workspace";

export type OnboardingState =
  | "AUTH_LOADING"
  | "MEMBER"
  | "PENDING_INVITATION"
  | "NO_ORGANIZATION"
  | "ERROR";

export interface PendingInvitationView {
  invitationId: string;
  organizationId: string;
  organizationName: string;
  invitedRole: string;
  email: string;
  invitedAt: string;
  expiresAt: string;
}

/**
 * Máquina de estados pura, testável sem React. Enquanto qualquer camada estiver
 * pendente o resultado é AUTH_LOADING: membership ausente nunca é interpretado como
 * "novo usuário" antes de os convites terem sido resolvidos.
 */
export function resolveOnboardingState(input: {
  workspaceLoading: boolean;
  workspaceError: boolean;
  hasMembership: boolean;
  invitationsLoading: boolean;
  pendingInvitationCount: number;
}): OnboardingState {
  if (input.workspaceError) return "ERROR";
  if (input.workspaceLoading) return "AUTH_LOADING";
  if (input.hasMembership) return "MEMBER";
  if (input.invitationsLoading) return "AUTH_LOADING";
  return input.pendingInvitationCount > 0 ? "PENDING_INVITATION" : "NO_ORGANIZATION";
}

/**
 * Fonte única de verdade do onboarding.
 *
 * Regra obrigatória: membership ausente NÃO significa "novo usuário". Só depois de
 * resolver sessão + memberships + convites pendentes o estado final é decidido.
 * Enquanto qualquer camada estiver carregando, o estado é AUTH_LOADING — nunca
 * "Sem organização vinculada".
 */
export function useOnboardingState() {
  const workspace = useWorkspace();
  const fetchPending = useServerFn(listMyPendingInvitations);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    setInviteToken(readInviteIntent());
  }, []);

  const hasMembership = Boolean(workspace.data?.role && workspace.data?.organization);

  const pending = useQuery({
    queryKey: ["my-pending-invitations"],
    queryFn: () => fetchPending(),
    enabled: workspace.isSuccess && !hasMembership,
    retry: false,
  });

  const state = resolveOnboardingState({
    workspaceLoading: workspace.isPending,
    workspaceError: workspace.isError,
    hasMembership,
    invitationsLoading: !hasMembership && pending.isPending,
    pendingInvitationCount: pending.data?.invitations.length ?? 0,
  });

  return {
    state,
    workspace: workspace.data ?? null,
    email: workspace.data?.email ?? null,
    role: workspace.data?.role ?? null,
    organization: workspace.data?.organization ?? null,
    invitations: (pending.data?.invitations ?? []) as PendingInvitationView[],
    /** Token bruto só existe no navegador do convidado; o banco guarda apenas o digest. */
    inviteToken,
    error: workspace.error,
    isLoading: state === "AUTH_LOADING",
  };
}
