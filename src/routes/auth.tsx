import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { convite?: string } =>
    typeof search["convite"] === "string" && search["convite"].length > 0
      ? { convite: search["convite"] }
      : {},

  head: () => ({
    meta: [
      { title: "Acesso — Inteligência Pericial Imobiliária" },
      {
        name: "description",
        content:
          "Entre na plataforma técnica de evidências imobiliárias auditáveis e avaliação multimetodológica.",
      },
      { property: "og:title", content: "Acesso — Inteligência Pericial Imobiliária" },
      {
        property: "og:description",
        content: "Autenticação da plataforma de inteligência pericial e avaliação imobiliária.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(200),
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  /**
   * O convite pode chegar pelo search param (link direto) ou pela intenção guardada
   * no navegador quando o ciclo de confirmação de e-mail devolve o usuário à raiz.
   */
  const convite = search.convite ?? readInviteIntent() ?? undefined;

  /** Após autenticar, volta ao convite pendente quando existe intenção de convite. */
  const goToNextStep = async () => {
    if (convite) {
      await navigate({ to: "/convite/$token", params: { token: convite }, replace: true });
      return;
    }
    await navigate({ to: "/dashboard", replace: true });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (search.convite) rememberInviteIntent(search.convite);
  }, [search.convite]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goToNextStep();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, convite]);

  /** Destino da confirmação de e-mail: a própria tela do convite, quando houver. */
  function confirmationRedirect(): string {
    return convite
      ? `${window.location.origin}/convite/${encodeURIComponent(convite)}`
      : window.location.origin;
  }

  async function handlePasswordSubmit(mode: "signin" | "signup") {
    setNotice(null);
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        await goToNextStep();
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: confirmationRedirect() },
        });
        if (error) throw error;
        if (data.session) {
          await goToNextStep();
        } else {
          setNotice(
            convite
              ? "Cadastro registrado. Confirme o e-mail enviado: o link devolve você a esta mesma tela de convite, onde o aceite ainda precisa ser feito por você. O vínculo não é criado automaticamente."
              : "Cadastro registrado. Confirme o e-mail enviado para ativar o acesso — a sessão só é criada após a confirmação.",
          );
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  }


  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: convite
          ? `${window.location.origin}/auth?convite=${encodeURIComponent(convite)}`
          : window.location.origin,
      });
      if (result.error) {
        toast.error("Não foi possível iniciar o acesso com Google.");
        return;
      }
      if (result.redirected) return;
      await goToNextStep();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-border bg-surface-muted p-10 lg:flex">
        <div>
          <p className="label-meta">Plataforma técnica</p>
          <p className="font-serif text-lg font-semibold">Inteligência Pericial Imobiliária</p>
        </div>
        <div className="max-w-md">
          <h2 className="text-xl font-semibold">Cadeia de proveniência obrigatória</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Toda informação usada em uma avaliação precisa ter fonte, artefato original, extração
            registrada, validação humana e histórico. Nenhum dado é preenchido por suposição.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Acesso restrito. Dados isolados por organização.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="label-meta hover:text-foreground">
            ← Início
          </Link>
          <h1 className="mt-4 text-2xl font-semibold">Acesso à plataforma</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Autentique-se para acessar casos, evidências e datasets da sua organização.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="w-full">
              <TabsTrigger value="signin" className="flex-1">
                Entrar
              </TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">
                Criar conta
              </TabsTrigger>
            </TabsList>

            {(["signin", "signup"] as const).map((mode) => (
              <TabsContent key={mode} value={mode} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`email-${mode}`}>E-mail</Label>
                  <Input
                    id={`email-${mode}`}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`password-${mode}`}>Senha</Label>
                  <Input
                    id={`password-${mode}`}
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => void handlePasswordSubmit(mode)}
                >
                  {mode === "signin" ? "Entrar" : "Criar conta"}
                </Button>
              </TabsContent>
            ))}
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-meta">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" disabled={busy} onClick={() => void handleGoogle()}>
            Continuar com Google
          </Button>

          {notice ? (
            <p className="mt-6 rounded-sm border-l-2 border-info/50 bg-info/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
