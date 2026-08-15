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

/* ============================== FASE 7G — gate de revisor independente === */

/** Papéis que a arquitetura admite para revisão metodológica independente. */
export const METHODOLOGY_REVIEWER_ROLES = ["OWNER", "ADMIN", "REVIEWER"] as const;

export interface ReviewerGateMember {
  memberId: string;
  role: string;
  status: string;
  displayName: string;
  isSelf: boolean;
  canReviewMethodology: boolean;
}

export interface ReviewerGateReport {
  organizationId: string;
  currentRole: string;
  totalMembers: number;
  activeMembers: number;
  roleCounts: Record<string, number>;
  members: ReviewerGateMember[];
  /** Existe outra pessoa ativa, distinta do ator, com papel de revisão. */
  independentReviewerPresent: boolean;
  independentReviewerRoles: string[];
  /** Estado factual do lote: nunca "PASS" sem revisor humano independente. */
  batchStatus: "BLOCKED_BY_HUMAN_REVIEWER" | "READY_FOR_HUMAN_VERIFICATION";
  blockedReason: string | null;
}

/**
 * Leitura factual da segregação humana. Não cria, não convida e não promove
 * ninguém: apenas relata quem existe. O banco continua sendo quem recusa o
 * ato profissional sem revisor distinto (`review_methodology_claim`).
 */
export async function readReviewerSegregationGate(
  supabase: Db,
  membership: Membership,
  actorUserId: string,
): Promise<ReviewerGateReport> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, status, created_at")
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const ids = rows.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const reviewerRoles = new Set<string>(METHODOLOGY_REVIEWER_ROLES);
  const members: ReviewerGateMember[] = rows.map((r) => {
    const profile = (profiles ?? []).find((p) => p.id === r.user_id);
    return {
      memberId: r.id,
      role: r.role,
      status: r.status,
      displayName: profile?.full_name ?? profile?.email ?? "Membro sem perfil preenchido",
      isSelf: r.user_id === actorUserId,
      canReviewMethodology: r.status === "ACTIVE" && reviewerRoles.has(r.role),
    };
  });

  const active = members.filter((m) => m.status === "ACTIVE");
  const roleCounts = active.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  const independents = active.filter((m) => !m.isSelf && m.canReviewMethodology);
  const independentReviewerPresent = independents.length > 0;

  return {
    organizationId: membership.organizationId,
    currentRole: membership.role,
    totalMembers: members.length,
    activeMembers: active.length,
    roleCounts,
    members,
    independentReviewerPresent,
    independentReviewerRoles: [...new Set(independents.map((m) => m.role))],
    batchStatus: independentReviewerPresent
      ? "READY_FOR_HUMAN_VERIFICATION"
      : "BLOCKED_BY_HUMAN_REVIEWER",
    blockedReason: independentReviewerPresent
      ? null
      : "É necessário um segundo membro autorizado para revisão independente.",
  };
}

/**
 * Nome legível dos atores envolvidos em proposta e revisão de claim.
 * Autoria nunca é anônima e nunca é atribuída a IA: a identidade vem do token
 * gravado pelo banco, e aqui apenas traduzimos para nome/e-mail do perfil.
 */
export async function resolveActorNames(
  supabase: Db,
  userIds: (string | null)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => typeof id === "string"))];
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce<Record<string, string>>((acc, p) => {
    acc[p.id] = p.full_name ?? p.email ?? "Membro sem perfil preenchido";
    return acc;
  }, {});
}
