import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CaseStatusBadge } from "@/components/app/StatusBadge";
import { EmptyState, GovernanceNote, PageHeader } from "@/components/app/Primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { canWrite } from "@/hooks/use-workspace";
import { createCase, listCases } from "@/lib/cases.functions";
import { createCaseSchema } from "@/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/")({
  component: CasesPage,
});

function CasesPage() {
  const fetchCases = useServerFn(listCases);
  const query = useQuery({ queryKey: ["cases"], queryFn: () => fetchCases() });

  if (query.isPending) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (query.isError) {
    return (
      <EmptyState
        title="Falha ao carregar casos"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={<Button onClick={() => void query.refetch()}>Tentar novamente</Button>}
      />
    );
  }

  const { cases, role } = query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Casos de avaliação"
        title="Casos"
        description="Cada caso representa uma avaliação ou perícia específica, com evidências, datasets e trilha de auditoria próprios."
        actions={writable ? <NewCaseDialog /> : null}
      />

      {cases.length === 0 ? (
        <EmptyState
          title="Nenhum caso cadastrado"
          description={
            writable
              ? "Crie o primeiro caso para iniciar a coleta de evidências. Nenhum caso de demonstração é criado automaticamente."
              : "Seu papel atual permite apenas consulta. Solicite a um administrador a criação de casos."
          }
          action={writable ? <NewCaseDialog /> : undefined}
        />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="label-meta px-4 py-2.5">Código</th>
                <th className="label-meta px-4 py-2.5">Título</th>
                <th className="label-meta px-4 py-2.5">Situação</th>
                <th className="label-meta px-4 py-2.5">Data de referência</th>
                <th className="label-meta px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="mono-value px-4 py-3">{item.case_code}</td>
                  <td className="px-4 py-3">{item.title}</td>
                  <td className="px-4 py-3">
                    <CaseStatusBadge status={item.status} />
                  </td>
                  <td className="mono-value px-4 py-3 text-muted-foreground">
                    {item.valuation_date ?? "não informado"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to="/cases/$caseId" params={{ caseId: item.id }}>
                        Abrir
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <GovernanceNote>
        Transições de situação são validadas no servidor. Alterações no navegador não alteram o
        estado do caso.
      </GovernanceNote>
    </div>
  );
}

function NewCaseDialog() {
  const queryClient = useQueryClient();
  const create = useServerFn(createCase);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    caseCode: "",
    title: "",
    purpose: "",
    valuationDate: "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = createCaseSchema.parse(form);
      return create({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Caso criado.");
      setOpen(false);
      setForm({ caseCode: "", title: "", purpose: "", valuationDate: "" });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Falha ao criar o caso"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Novo caso</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo caso de avaliação</DialogTitle>
          <DialogDescription>
            O caso é criado em situação Rascunho. Nenhum dado do imóvel é preenchido
            automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-code">Código do caso</Label>
              <Input
                id="case-code"
                value={form.caseCode}
                onChange={(e) => setForm((f) => ({ ...f, caseCode: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="case-date">Data de referência</Label>
              <Input
                id="case-date"
                type="date"
                value={form.valuationDate}
                onChange={(e) => setForm((f) => ({ ...f, valuationDate: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-title">Título</Label>
            <Input
              id="case-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-purpose">Finalidade</Label>
            <Textarea
              id="case-purpose"
              rows={3}
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Criar caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
