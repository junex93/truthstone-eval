import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { OnboardingGate } from "@/components/app/OnboardingGate";
import { EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { isAdmin } from "@/hooks/use-workspace";
import {
  INVITABLE_ROLES,
  INVITATION_STATUS_LABELS,
  ORG_ROLES,
  ORG_ROLE_LABELS,
  type InvitableRole,
  type InvitationStatus,
  type OrgRole,
} from "@/lib/domain/constants";
import {
  createInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from "@/lib/invitations.functions";
import { listMembers, updateMemberRole } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/_shell/admin")({
  component: AdminRoute,
});

/**
 * Sem organização ativa não existe administração de organização: o estado de
 * onboarding (convite pendente ou primeiro acesso) tem precedência.
 */
function AdminRoute() {
  return (
    <OnboardingGate>
      <AdminPage />
    </OnboardingGate>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function AdminPage() {
  const fetchMembers = useServerFn(listMembers);
  const updateRole = useServerFn(updateMemberRole);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["members"], queryFn: () => fetchMembers() });

  const mutation = useMutation({
    mutationFn: (input: { memberId: string; role: OrgRole }) => updateRole({ data: input }),
    onSuccess: () => {
      toast.success("Papel atualizado.");
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar membros"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
      />
    );
  }

  const { members, currentRole } = query.data;
  const admin = isAdmin(currentRole);
  const activeMembers = members.filter((m) => m.status === "ACTIVE");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administração"
        title="Membros, papéis e convites"
        description="Papéis definem permissões de escrita e revisão. A autorização é validada no servidor e também pelas políticas de acesso do banco de dados."
      />

      <p className="rounded-sm border-l-2 border-info/50 bg-info/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Ambiente de desenvolvimento — convites são entregues por link manual. O envio automático por
        e-mail será configurado antes da produção.
      </p>



      <section className="space-y-3">
        <SectionTitle
          title="Membros ativos"
          description={`${activeMembers.length} vínculo(s) ativo(s) nesta organização.`}
        />
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-meta px-4 py-2.5">Usuário</th>
                <th className="label-meta px-4 py-2.5">Situação</th>
                <th className="label-meta px-4 py-2.5">Papel</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p>{member.full_name ?? member.email ?? "—"}</p>
                    <p className="mono-value text-xs text-muted-foreground">{member.user_id}</p>
                  </td>
                  <td className="mono-value px-4 py-3 text-muted-foreground">{member.status}</td>
                  <td className="px-4 py-3">
                    {admin && !member.isSelf ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          mutation.mutate({ memberId: member.id, role: value as OrgRole })
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORG_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ORG_ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="mono-value text-muted-foreground">
                        {ORG_ROLE_LABELS[member.role as OrgRole]}
                        {member.isSelf ? " (você)" : ""}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {admin ? <InvitationsPanel /> : null}

      <GovernanceNote>
        O papel efetivo de um convidado é sempre o papel aprovado no convite, decidido no banco de
        dados — nunca no formulário. Não é possível convidar alguém como titular, nem alterar o
        próprio papel, evitando escalada silenciosa de privilégio. Remoção de membros não está
        implementada nesta fase.
      </GovernanceNote>
    </div>
  );
}

function InvitationsPanel() {
  const fetchInvitations = useServerFn(listInvitations);
  const create = useServerFn(createInvitation);
  const resend = useServerFn(resendInvitation);
  const revoke = useServerFn(revokeInvitation);
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("REVIEWER");
  const [issuedLink, setIssuedLink] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; email: string } | null>(null);

  const query = useQuery({ queryKey: ["invitations"], queryFn: () => fetchInvitations() });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["invitations"] });
    void queryClient.invalidateQueries({ queryKey: ["members"] });
  }

  function linkFor(token: string): string {
    return `${window.location.origin}/convite/${token}`;
  }

  const createMutation = useMutation({
    mutationFn: () => create({ data: { email, role } }),
    onSuccess: (result) => {
      if (result.outcome === "PENDING_ALREADY_EXISTS") {
        toast.info(
          `Já existe um convite pendente para ${result.email}. Use "Gerar novo link" no convite pendente abaixo, ou revogue-o antes de convidar novamente.`,
        );
        refresh();
        return;
      }
      setIssuedLink(linkFor(result.token));
      setEmail("");
      toast.success("Convite criado. Copie este link e envie para a pessoa convidada.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o convite."),
  });

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => resend({ data: { invitationId } }),
    onSuccess: (result) => {
      setIssuedLink(linkFor(result.token));
      toast.success("Novo link gerado. O link anterior deixou de funcionar.");
      refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link."),
  });


  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revoke({ data: { invitationId } }),
    onSuccess: () => {
      setIssuedLink(null);
      toast.success("Convite revogado.");
      refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha ao revogar."),
  });

  const invitations = query.data?.invitations ?? [];
  const pending = invitations.filter((i) => i.status === "INVITED");
  const history = invitations.filter((i) => i.status !== "INVITED");

  return (
    <section className="space-y-4">
      <SectionTitle
        title="Convidar membro"
        description="Convide uma pessoa real para participar desta organização. O vínculo só se torna ativo após o aceite autenticado com o mesmo e-mail convidado."
      />

      <div className="panel space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="pessoa@dominio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Papel</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InvitableRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_ROLES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {ORG_ROLE_LABELS[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={createMutation.isPending || email.trim().length === 0}
            onClick={() => createMutation.mutate()}
          >
            Convidar membro
          </Button>
        </div>

        {issuedLink ? (
          <div className="rounded-sm border-l-2 border-info/50 bg-info/5 px-3 py-3">
            <p className="label-meta">Link de convite para desenvolvimento</p>
            <p className="mono-value mt-1.5 break-all text-xs">{issuedLink}</p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(issuedLink);
                  toast.success("Link copiado.");
                }}
              >
                Copiar link
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssuedLink(null)}>
                Ocultar
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Envie este link diretamente para a pessoa convidada. O envio automático por e-mail será
              configurado antes da produção. Este link aparece uma única vez: se fechar esta tela,
              gere um novo link no convite pendente.
            </p>

          </div>
        ) : null}
      </div>

      <SectionTitle
        title="Convites pendentes"
        description="Convite pendente não é membro ativo. O papel só passa a valer depois do aceite explícito. Gere um novo link sempre que precisar reenviar o convite — o link anterior deixa de funcionar."
      />

      {query.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : pending.length === 0 ? (
        <EmptyState
          title="Nenhum convite pendente"
          description="Convites aceitos, expirados ou revogados aparecem no histórico abaixo."
        />
      ) : (
        <div className="panel divide-y divide-border">
          {pending.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"
            >
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="label-meta">E-mail</dt>
                  <dd className="font-medium break-all">{invite.email}</dd>
                </div>
                <div>
                  <dt className="label-meta">Papel</dt>
                  <dd>{ORG_ROLE_LABELS[invite.invited_role as OrgRole]}</dd>
                </div>
                <div>
                  <dt className="label-meta">Situação</dt>
                  <dd className="mono-value text-xs text-muted-foreground">
                    {INVITATION_STATUS_LABELS[invite.status as InvitationStatus]}
                  </dd>
                </div>
                <div>
                  <dt className="label-meta">Convidado por</dt>
                  <dd className="text-muted-foreground">{invite.invited_by_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="label-meta">Enviado em</dt>
                  <dd className="text-muted-foreground">
                    {formatDate(invite.last_sent_at ?? invite.invited_at)}
                  </dd>
                </div>
                <div>
                  <dt className="label-meta">Expira em</dt>
                  <dd className="text-muted-foreground">{formatDate(invite.expires_at)}</dd>
                </div>
              </dl>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resendMutation.isPending}
                  onClick={() => resendMutation.mutate(invite.id)}
                >
                  Gerar novo link
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={revokeMutation.isPending}
                  onClick={() => setRevokeTarget({ id: invite.id, email: invite.email })}
                >
                  Remover convite
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este convite?</AlertDialogTitle>
            <AlertDialogDescription>
              O convite para {revokeTarget?.email ?? "—"} será cancelado. A pessoa não poderá mais
              usar o link atual. Depois você poderá criar um novo convite para este e-mail. O
              histórico do convite é preservado para auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revokeMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
              }}
            >
              Remover convite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {history.length > 0 ? (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-meta px-4 py-2.5">E-mail</th>
                <th className="label-meta px-4 py-2.5">Papel</th>
                <th className="label-meta px-4 py-2.5">Situação</th>
                <th className="label-meta px-4 py-2.5">Desfecho</th>
              </tr>
            </thead>
            <tbody>
              {history.map((invite) => (
                <tr key={invite.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{invite.email}</td>
                  <td className="px-4 py-3">{ORG_ROLE_LABELS[invite.invited_role as OrgRole]}</td>
                  <td className="mono-value px-4 py-3 text-muted-foreground">
                    {INVITATION_STATUS_LABELS[invite.status as InvitationStatus]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {invite.status === "ACCEPTED"
                      ? `Aceito por ${invite.accepted_by_name ?? "—"} em ${formatDate(invite.accepted_at)}`
                      : invite.status === "REVOKED"
                        ? `Revogado por ${invite.revoked_by_name ?? "—"} em ${formatDate(invite.revoked_at)}`
                        : `Expirado em ${formatDate(invite.expires_at)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
