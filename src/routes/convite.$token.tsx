import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { ORG_ROLE_LABELS, type OrgRole } from "@/lib/domain/constants";
import { acceptInvitation, inspectInvitation } from "@/lib/invitations.functions";
import { clearInviteIntent, rememberInviteIntent } from "@/lib/invite-intent";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite para organização — Inteligência Pericial Imobiliária" },
      {
        name: "description",
        content:
          "Aceite o convite para participar de uma organização da plataforma de inteligência pericial e avaliação imobiliária.",
      },
      { property: "og:title", content: "Convite para organização" },
      {
        property: "og:description",
        content: "Aceite autenticado de convite de membro, com verificação de e-mail e auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4">
        <Link to="/" className="label-meta hover:text-foreground">
          ← Início
        </Link>
        {children}
      </div>
    </div>
  );
}

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inspect = useServerFn(inspectInvitation);
  const accept = useServerFn(acceptInvitation);

  const [sessionState, setSessionState] = useState<"loading" | "anon" | "authenticated">("loading");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  /**
   * Guarda a intenção de voltar a este convite depois do ciclo signup → confirmação
   * de e-mail → login. Nada é aceito por isso: o aceite continua sendo ato explícito.
   */
  useEffect(() => {
    rememberInviteIntent(token);
  }, [token]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSessionState(data.session ? "authenticated" : "anon");
      setSessionEmail(data.session?.user.email ?? null);
    });
  }, []);

  const query = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => inspect({ data: { token } }),
    enabled: sessionState === "authenticated",
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: () => accept({ data: { token } }),
    onSuccess: async (result) => {
      clearInviteIntent();
      toast.success(
        `Convite aceito. Você agora participa desta organização como ${
          ORG_ROLE_LABELS[result.role as OrgRole] ?? result.role
        }.`,
      );
      // Contexto de organização, papel e permissões precisa refletir o novo vínculo
      // sem exigir logout/login.
      await queryClient.invalidateQueries();
      await navigate({ to: "/dashboard", replace: true });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Não foi possível aceitar este convite.",
      ),
  });

  if (sessionState === "loading") {
    return (
      <Shell>
        <Skeleton className="h-40 w-full" />
      </Shell>
    );
  }

  if (sessionState === "anon") {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Convite para uma organização</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Entre com a conta do mesmo e-mail que recebeu o convite, ou crie a conta com esse e-mail. O
          vínculo só é criado depois do aceite autenticado — autenticar-se, por si só, não gera
          participação na organização.
        </p>
        <Button asChild className="w-full">
          <Link to="/auth" search={{ convite: token }}>
            Entrar ou criar conta
          </Link>
        </Button>
      </Shell>
    );
  }


  if (query.isPending) {
    return (
      <Shell>
        <Skeleton className="h-40 w-full" />
      </Shell>
    );
  }

  const invite = query.data;

  if (!invite || !invite.found) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold">Convite inválido</h1>
        <p className="text-sm text-muted-foreground">
          Este link não corresponde a nenhum convite. Solicite um novo convite ao titular da
          organização.
        </p>
      </Shell>
    );
  }

  const blocked =
    invite.status !== "INVITED"
      ? invite.status === "ACCEPTED"
        ? "Este convite já foi utilizado."
        : invite.status === "REVOKED"
          ? "Este convite foi revogado. Solicite um novo convite ao administrador."
          : "O convite expirou. Solicite um novo convite ao administrador."
      : invite.expired
        ? "O convite expirou. Solicite um novo convite ao administrador."
        : invite.already_member
          ? "Este usuário já pertence à organização."
          : !invite.email_matches
            ? "Este convite foi enviado para outro endereço de e-mail."
            : null;

  /** Já pertence à organização: nada a aceitar, segue para uma tela útil. */
  const alreadyIn = invite.already_member === true;

  return (
    <Shell>
      <h1 className="text-2xl font-semibold">
        Convite para {invite.organization_name ?? "organização"}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Papel proposto:{" "}
        <strong className="text-foreground">
          {ORG_ROLE_LABELS[invite.invited_role as OrgRole] ?? invite.invited_role}
        </strong>
        . O papel é definido pelo convite aprovado e não pode ser alterado no aceite.
      </p>

      <dl className="panel space-y-2 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Organização</dt>
          <dd className="text-xs font-medium">{invite.organization_name ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Papel</dt>
          <dd className="text-xs">
            {ORG_ROLE_LABELS[invite.invited_role as OrgRole] ?? invite.invited_role}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd className="mono-value text-xs">{sessionEmail ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Expira em</dt>
          <dd className="mono-value text-xs">
            {invite.expires_at
              ? `${new Date(invite.expires_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC`
              : "—"}
          </dd>
        </div>
      </dl>

      {blocked ? (
        <div className="space-y-3">
          <p className="rounded-sm border-l-2 border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
            {blocked}
          </p>
          {alreadyIn || invite.status === "ACCEPTED" ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/dashboard">Ir para o painel</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <Button
            className="w-full"
            disabled={acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
          >
            Aceitar convite
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            O vínculo é criado apenas neste ato explícito de aceite, validado no servidor pelo token
            do convite e pelo e-mail autenticado.
          </p>
        </>
      )}
    </Shell>
  );

}
