import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { EmptyState, GovernanceNote, PageHeader } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdmin } from "@/hooks/use-workspace";
import { ORG_ROLES, ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/constants";
import { listMembers, updateMemberRole } from "@/lib/workspace.functions";

export const Route = createFileRoute("/_authenticated/_shell/admin")({
  component: AdminPage,
});

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administração"
        title="Membros e papéis"
        description="Papéis definem permissões de escrita e revisão. A autorização é validada no servidor e também pelas políticas de acesso do banco de dados."
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

      <GovernanceNote>
        Convites por e-mail e remoção de membros não estão implementados nesta fase. O próprio papel
        não pode ser alterado pelo titular da conta, evitando escalada silenciosa de privilégio.
      </GovernanceNote>
    </div>
  );
}
