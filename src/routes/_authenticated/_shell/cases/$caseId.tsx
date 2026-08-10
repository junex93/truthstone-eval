import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataField, EmptyState, GovernanceNote, PageHeader, SectionTitle } from "@/components/app/Primitives";
import { CaseStatusBadge, FrozenBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { canWrite } from "@/hooks/use-workspace";
import { changeCaseStatus, getCaseDetail, saveProperty } from "@/lib/cases.functions";
import { CASE_STATUS_LABELS, type CaseStatus } from "@/lib/domain/constants";
import { propertySchema } from "@/lib/validation/schemas";

export const Route = createFileRoute("/_authenticated/_shell/cases/$caseId")({
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = useParams({ from: "/_authenticated/_shell/cases/$caseId" });
  const fetchDetail = useServerFn(getCaseDetail);
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => fetchDetail({ data: { caseId } }),
  });

  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return (
      <EmptyState
        title="Caso indisponível"
        description={query.error instanceof Error ? query.error.message : "Erro desconhecido."}
        action={
          <Button asChild variant="outline">
            <Link to="/cases">Voltar aos casos</Link>
          </Button>
        }
      />
    );
  }

  const { valuationCase, property, sourceCount, datasets, audit, allowedTransitions, role } =
    query.data;
  const writable = canWrite(role);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={valuationCase.case_code}
        title={valuationCase.title}
        description={valuationCase.purpose ?? "Finalidade não informada."}
        actions={<CaseStatusBadge status={valuationCase.status} />}
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="property">Imóvel</TabsTrigger>
          <TabsTrigger value="workflow">Fluxo</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="panel grid gap-x-8 gap-y-1 p-5 sm:grid-cols-2">
            <DataField label="Situação" value={CASE_STATUS_LABELS[valuationCase.status as CaseStatus]} />
            <DataField label="Data de referência" value={valuationCase.valuation_date} />
            <DataField label="Fontes de evidência" value={String(sourceCount)} />
            <DataField label="Versões de dataset" value={String(datasets.length)} />
            <DataField
              label="Criado em"
              value={new Date(valuationCase.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })}
            />
            <DataField label="Identificador" value={valuationCase.id} mono />
          </div>

          <div className="space-y-3">
            <SectionTitle
              title="Datasets deste caso"
              description="Um dataset congelado é pré-requisito para qualquer cálculo metodológico."
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link to="/datasets">Gerenciar datasets</Link>
                </Button>
              }
            />
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma versão de dataset criada.</p>
            ) : (
              <ul className="panel divide-y divide-border">
                {datasets.map((dataset) => (
                  <li key={dataset.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm">
                        v{dataset.version_number} · {dataset.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <FrozenBadge frozen={dataset.frozen_at !== null} />
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/datasets/$datasetId" params={{ datasetId: dataset.id }}>
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="property" className="mt-6">
          <PropertyForm caseId={caseId} property={property} writable={writable} />
        </TabsContent>

        <TabsContent value="workflow" className="mt-6 space-y-4">
          <SectionTitle
            title="Transições permitidas"
            description="O servidor recusa qualquer transição fora da máquina de estados, inclusive quando solicitada diretamente pela API."
          />
          {!writable ? (
            <p className="text-sm text-muted-foreground">
              Seu papel atual não permite alterar a situação do caso.
            </p>
          ) : allowedTransitions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não há transições disponíveis a partir da situação atual.
            </p>
          ) : (
            <StatusTransitions caseId={caseId} transitions={allowedTransitions as CaseStatus[]} />
          )}
          <GovernanceNote>
            A transição para “Dataset congelado” exige a existência de pelo menos um dataset
            efetivamente congelado neste caso.
          </GovernanceNote>
        </TabsContent>

        <TabsContent value="audit" className="mt-6 space-y-3">
          <SectionTitle
            title="Trilha de auditoria"
            description="Registros append-only. Não podem ser editados nem removidos pela aplicação."
          />
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <ul className="panel divide-y divide-border">
              {audit.map((event) => (
                <li key={event.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="mono-value">{event.event_type}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "UTC" })} UTC
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.entity_type} · {event.entity_id}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusTransitions({
  caseId,
  transitions,
}: {
  caseId: string;
  transitions: CaseStatus[];
}) {
  const queryClient = useQueryClient();
  const change = useServerFn(changeCaseStatus);
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: (nextStatus: CaseStatus) =>
      change({ data: { caseId, nextStatus, reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Situação atualizada.");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="panel space-y-4 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="transition-reason">Justificativa (registrada na auditoria)</Label>
        <Textarea
          id="transition-reason"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {transitions.map((status) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(status)}
          >
            {CASE_STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}

type PropertyRecord = Record<string, unknown> | null;

const PROPERTY_FIELDS = [
  { key: "propertyType", column: "property_type", label: "Tipologia", type: "text" },
  { key: "addressLine", column: "address_line", label: "Logradouro", type: "text" },
  { key: "addressNumber", column: "address_number", label: "Número", type: "text" },
  { key: "complement", column: "complement", label: "Complemento", type: "text" },
  { key: "district", column: "district", label: "Bairro", type: "text" },
  { key: "city", column: "city", label: "Município", type: "text" },
  { key: "state", column: "state", label: "UF", type: "text" },
  { key: "postalCode", column: "postal_code", label: "CEP", type: "text" },
  { key: "latitude", column: "latitude", label: "Latitude", type: "text" },
  { key: "longitude", column: "longitude", label: "Longitude", type: "text" },
  { key: "privateArea", column: "private_area", label: "Área privativa (m²)", type: "text" },
  { key: "builtArea", column: "built_area", label: "Área construída (m²)", type: "text" },
  { key: "landArea", column: "land_area", label: "Área do terreno (m²)", type: "text" },
  { key: "bedrooms", column: "bedrooms", label: "Dormitórios", type: "text" },
  { key: "bathrooms", column: "bathrooms", label: "Banheiros", type: "text" },
  { key: "parkingSpaces", column: "parking_spaces", label: "Vagas", type: "text" },
  { key: "constructionYear", column: "construction_year", label: "Ano de construção", type: "text" },
  { key: "floorNumber", column: "floor_number", label: "Pavimento", type: "text" },
] as const;

function PropertyForm({
  caseId,
  property,
  writable,
}: {
  caseId: string;
  property: PropertyRecord;
  writable: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveProperty);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const field of PROPERTY_FIELDS) {
      const raw = property ? property[field.column] : null;
      initial[field.key] = raw === null || raw === undefined ? "" : String(raw);
    }
    initial["description"] = property?.["description"] ? String(property["description"]) : "";
    setValues(initial);
  }, [property]);

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = propertySchema.parse({ caseId, ...values });
      return save({ data: parsed });
    },
    onSuccess: () => {
      toast.success("Ficha do imóvel gravada.");
      void queryClient.invalidateQueries({ queryKey: ["case", caseId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Falha"),
  });

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Ficha do imóvel"
        description="Campos deixados em branco permanecem explicitamente não informados. Nenhum valor é estimado ou inferido."
      />
      <div className="panel grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {PROPERTY_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`prop-${field.key}`}>{field.label}</Label>
            <Input
              id={`prop-${field.key}`}
              disabled={!writable}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="prop-description">Descrição técnica</Label>
          <Textarea
            id="prop-description"
            rows={4}
            disabled={!writable}
            value={values["description"] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
      </div>
      {writable ? (
        <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Gravar ficha do imóvel
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Seu papel atual permite apenas consulta.</p>
      )}
    </div>
  );
}
