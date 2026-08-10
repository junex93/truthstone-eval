import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSearch, GitBranch, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inteligência Pericial e Avaliação Imobiliária Multimetodológica" },
      {
        name: "description",
        content:
          "Fundação técnica para evidências imobiliárias auditáveis: proveniência, validação humana, datasets versionados e congelamento imutável.",
      },
      {
        property: "og:title",
        content: "Inteligência Pericial e Avaliação Imobiliária Multimetodológica",
      },
      {
        property: "og:description",
        content:
          "Evidence Intelligence Engine: cadeia de proveniência de dados imobiliários com validação humana e datasets reprodutíveis.",
      },
    ],
  }),
  component: LandingPage,
});

const CHAIN = [
  "FONTE BRUTA",
  "EVIDÊNCIA CAPTURADA",
  "CANDIDATO EXTRAÍDO",
  "VALIDAÇÃO",
  "EVIDÊNCIA VERIFICADA",
  "DATASET DE AVALIAÇÃO",
];

const PILLARS = [
  {
    icon: FileSearch,
    title: "Evidence Intelligence Engine",
    body: "Fonte, artefato original, extração, dado candidato, validação e decisão de uso são entidades distintas e rastreáveis.",
  },
  {
    icon: ShieldCheck,
    title: "IA não é fonte de evidência",
    body: "Saídas de modelo só podem existir como candidatos de extração registrados. Nenhum dado se torna fato sem validação humana.",
  },
  {
    icon: GitBranch,
    title: "Datasets versionados",
    body: "Cada versão de dataset é composta apenas por campos verificados e, após o congelamento, torna-se imutável e reprodutível.",
  },
  {
    icon: Lock,
    title: "Isolamento e auditoria",
    body: "Multi-tenant com papéis, políticas de acesso no banco, artefatos em armazenamento privado e trilha de auditoria append-only.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="label-meta">Plataforma técnica</p>
            <p className="font-serif text-base font-semibold">Inteligência Pericial Imobiliária</p>
          </div>
          <Button asChild size="sm">
            <Link to="/auth">Acessar plataforma</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <p className="label-meta">Fase 1 — Fundação e motor de evidências</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-semibold">
            Organize evidências imobiliárias auditáveis antes de qualquer cálculo de valor.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Esta não é uma calculadora de preços. É a infraestrutura de dados para perícia e
            avaliação multimetodológica: proveniência documental, validação humana explícita,
            versionamento de dataset e trilha de auditoria. Os motores de avaliação (fatores,
            inferência estatística, AVM) serão implementados sobre esta base, com especificação
            técnica própria.
          </p>

          <div className="mt-10 overflow-x-auto">
            <ol className="flex min-w-max items-center gap-2">
              {CHAIN.map((step, index) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="mono-value rounded-sm border border-border bg-surface px-2.5 py-1.5">
                    {step}
                  </span>
                  {index < CHAIN.length - 1 ? (
                    <span aria-hidden className="text-muted-foreground">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border bg-surface-muted">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-2">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="panel p-5">
                <pillar.icon className="size-5 text-primary" aria-hidden />
                <h2 className="mt-3 text-base font-semibold">{pillar.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs leading-relaxed text-muted-foreground">
          Nenhum valor, probabilidade ou resultado de avaliação é apresentado nesta fase. Dados sem
          comprovação documental permanecem registrados como não encontrados, não informados, não
          verificáveis, divergentes ou pendentes de validação.
        </div>
      </footer>
    </div>
  );
}
