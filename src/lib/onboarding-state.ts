/**
 * Máquina de estados do onboarding — pura, sem React e sem acesso a rede, para
 * poder ser provada por teste. Regra central: membership ausente NÃO significa
 * "novo usuário"; enquanto sessão, memberships ou convites estiverem pendentes o
 * estado é AUTH_LOADING, jamais "Sem organização vinculada".
 */
export type OnboardingState =
  | "AUTH_LOADING"
  | "MEMBER"
  | "PENDING_INVITATION"
  | "NO_ORGANIZATION"
  | "ERROR";

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
