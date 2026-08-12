/**
 * Helpers exclusivos de servidor da camada metodológica.
 *
 * Nada aqui substitui o banco: as invariantes vivem em GRANT/RLS/trigger/RPC.
 * Estas funções apenas resolvem escopo e produzem mensagens legíveis antes de
 * a operação oficial ser chamada.
 */
import type { MethodSpecStatus, MethodologyAccessStatus } from "@/lib/domain/methodology";
import type { Db, Membership } from "@/lib/workspace.server";

export interface SourceScope {
  id: string;
  organizationId: string | null;
  accessStatus: MethodologyAccessStatus;
}

/**
 * A biblioteca metodológica tem objetos globais (organization_id NULL) e
 * objetos da organização. Nunca aceitamos objeto de outra organização.
 */
export async function requireSourceInScope(
  supabase: Db,
  sourceId: string,
  membership: Membership,
): Promise<SourceScope> {
  const { data, error } = await supabase
    .from("methodology_sources")
    .select("id, organization_id, access_status")
    .eq("id", sourceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fonte metodológica inexistente ou fora do escopo desta organização.");
  if (data.organization_id !== null && data.organization_id !== membership.organizationId) {
    throw new Error("Fonte metodológica fora do escopo desta organização.");
  }
  return {
    id: data.id,
    organizationId: data.organization_id,
    accessStatus: data.access_status as MethodologyAccessStatus,
  };
}

export interface SpecScope {
  id: string;
  organizationId: string | null;
  status: MethodSpecStatus;
  valuationMethodId: string;
  version: string;
}

export async function requireSpecificationInScope(
  supabase: Db,
  specificationId: string,
  membership: Membership,
): Promise<SpecScope> {
  const { data, error } = await supabase
    .from("method_specifications")
    .select("id, organization_id, status, valuation_method_id, version")
    .eq("id", specificationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Especificação inexistente ou fora do escopo desta organização.");
  if (data.organization_id !== null && data.organization_id !== membership.organizationId) {
    throw new Error("Especificação fora do escopo desta organização.");
  }
  return {
    id: data.id,
    organizationId: data.organization_id,
    status: data.status as MethodSpecStatus,
    valuationMethodId: data.valuation_method_id,
    version: data.version,
  };
}

/**
 * Somente DRAFT recebe edição. O banco recusa de novo por trigger
 * (guard_method_specification_update); esta checagem só antecipa o erro.
 */
export async function requireDraftSpecification(
  supabase: Db,
  specificationId: string,
  membership: Membership,
): Promise<SpecScope> {
  const scope = await requireSpecificationInScope(supabase, specificationId, membership);
  if (scope.status !== "DRAFT") {
    throw new Error(
      `Especificação ${scope.version} está ${scope.status}: registro imutável. Crie uma nova versão.`,
    );
  }
  return scope;
}

export async function requireRuleInDraftSpecification(
  supabase: Db,
  ruleId: string,
  membership: Membership,
): Promise<{ ruleId: string; specificationId: string }> {
  const { data, error } = await supabase
    .from("methodology_rules")
    .select("id, method_specification_id")
    .eq("id", ruleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Regra metodológica inexistente ou fora do escopo.");
  await requireDraftSpecification(supabase, data.method_specification_id, membership);
  return { ruleId: data.id, specificationId: data.method_specification_id };
}

export async function requireFormulaInDraftSpecification(
  supabase: Db,
  formulaId: string,
  membership: Membership,
): Promise<{ formulaId: string; ruleId: string }> {
  const { data, error } = await supabase
    .from("methodology_formulas")
    .select("id, rule_id")
    .eq("id", formulaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fórmula inexistente ou fora do escopo.");
  await requireRuleInDraftSpecification(supabase, data.rule_id, membership);
  return { formulaId: data.id, ruleId: data.rule_id };
}

/** Converte o JSON das RPCs de diagnóstico em objeto tipado sem usar `any`. */
export function asJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Resposta inesperada da operação oficial do banco.");
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** Bucket privado exclusivo de documentos normativos autorizados (Fase 7C). */
export const METHODOLOGY_SOURCE_BUCKET = "methodology-sources";

/**
 * Documento normativo não pertence a nenhum caso: ele pertence à biblioteca da
 * organização. Esta função resolve (ou cria) a fonte de evidência interna que
 * abriga os artefatos metodológicos, sem `valuation_case_id`.
 */
export async function ensureMethodologyLibrarySource(
  supabase: Db,
  membership: Membership,
  userId: string,
): Promise<string> {
  const name = "Biblioteca metodológica — documentos autorizados";
  const existing = await supabase
    .from("evidence_sources")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .is("valuation_case_id", null)
    .eq("source_name", name)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data.id;

  const created = await supabase
    .from("evidence_sources")
    .insert({
      organization_id: membership.organizationId,
      valuation_case_id: null,
      source_type: "PRIVATE_DOCUMENT",
      source_name: name,
      notes:
        "Cópias autorizadas de normas e literatura técnica. Escopo organizacional; nunca compartilhada com outra organização.",
      created_by: userId,
    })
    .select("id")
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

/**
 * Caminho canônico do documento normativo:
 * `<organization_id>/<methodology_source_id>/<arquivo>`.
 * Os dois primeiros segmentos são conferidos contra o banco, não contra o texto.
 */
export function assertMethodologyStoragePath(
  storagePath: string,
  organizationId: string,
  sourceId: string,
): void {
  const segments = storagePath.split("/");
  if (segments.length < 3 || segments.some((s) => s.trim() === "")) {
    throw new Error(
      "Caminho inválido: use <organization_id>/<source_id>/<arquivo> no bucket de fontes metodológicas.",
    );
  }
  if (segments[0] !== organizationId) {
    throw new Error("Caminho de armazenamento fora do escopo da organização.");
  }
  if (segments[1] !== sourceId) {
    throw new Error("Caminho de armazenamento não corresponde à fonte metodológica informada.");
  }
}
