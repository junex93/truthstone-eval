import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Inteligência Pericial Imobiliária" },
      {
        name: "description",
        content:
          "Solicite o link de redefinição e defina uma nova senha de acesso à plataforma de inteligência pericial imobiliária.",
      },
      { property: "og:title", content: "Redefinir senha de acesso" },
      {
        property: "og:description",
        content:
          "Recuperação de acesso por link enviado ao e-mail cadastrado, com definição de nova senha pelo próprio titular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

const emailSchema = z.string().trim().email("Informe um e-mail válido").max(255);
const passwordSchema = z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(200);

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"loading" | "request" | "update">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * O link de recuperação devolve o usuário com uma sessão temporária. Nesse caso,
   * a tela deve pedir a nova senha; sem sessão, pede apenas o e-mail.
   */
  useEffect(() => {
    let active = true;
    const decide = (hasSession: boolean) => {
      if (!active) return;
      setMode(hasSession ? "update" : "request");
    };

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) decide(true);
    });

    void supabase.auth.getSession().then(({ data }) => decide(Boolean(data.session)));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function requestLink() {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "E-mail inválido");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setNotice(
        "Se este e-mail estiver cadastrado, um link de redefinição foi enviado. Abra o link no mesmo navegador para definir a nova senha.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao solicitar redefinição");
    } finally {
      setBusy(false);
    }
  }

  async function submitNewPassword() {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Senha inválida");
      return;
    }
    if (password !== confirmation) {
      toast.error("A confirmação não corresponde à nova senha");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
      toast.success("Senha atualizada. Use a nova senha para entrar.");
      await navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link to="/auth" className="label-meta hover:text-foreground">
          ← Acesso
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">
          {mode === "update" ? "Definir nova senha" : "Redefinir senha"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "update"
            ? "Escolha a nova senha de acesso. Ela é gravada apenas como hash, sem cópia legível."
            : "Enviamos um link de redefinição para o e-mail cadastrado. A nova senha é definida pelo próprio titular da conta."}
        </p>

        {mode === "loading" ? (
          <p className="mt-8 text-sm text-muted-foreground">Verificando o link…</p>
        ) : mode === "request" ? (
          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => void requestLink()}>
              Enviar link de redefinição
            </Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password-confirmation">Confirmar nova senha</Label>
              <Input
                id="new-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => void submitNewPassword()}>
              Salvar nova senha
            </Button>
          </div>
        )}

        {notice ? (
          <p className="mt-6 rounded-sm border-l-2 border-info/50 bg-info/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {notice}
          </p>
        ) : null}
      </div>
    </div>
  );
}
