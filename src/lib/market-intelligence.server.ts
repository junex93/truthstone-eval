import type { Db, Membership } from "@/lib/workspace.server";
import type { MarketIntelligenceReport } from "@/lib/domain/intelligence";

/**
 * Helpers exclusivos de servidor da camada de inteligência de mercado.
 * Nenhuma regra vive aqui em caráter exclusivo: toda invariante crítica está
 * imposta em GRANT, RLS, trigger ou RPC no PostgreSQL. Estas funções apenas
 * resolvem escopo e produzem mensagens de erro legíveis.
 */

export async function requireSnapshotInCase(
  supabase: Db,
  table: "market_evidence_snapshots" | "sample_selection_snapshots",
  snapshotId: string,
  caseId: string,
  membership: Membership,
): Promise<void> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", snapshotId)
    .eq("valuation_case_id", caseId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Retrato não encontrado neste caso e organização.");
}

export async function requireSelectionRunInCase(
  supabase: Db,
  runId: string,
  caseId: string,
  membership: Membership,
): Promise<{ id: string; status: string; snapshotId: string }> {
  const { data, error } = await supabase
    .from("sample_selection_runs")
    .select("id, status, market_evidence_snapshot_id")
    .eq("id", runId)
    .eq("valuation_case_id", caseId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Rodada de seleção não encontrada neste caso.");
  return { id: data.id, status: data.status, snapshotId: data.market_evidence_snapshot_id };
}

export async function requireIssueInCase(
  supabase: Db,
  issueId: string,
  caseId: string,
  membership: Membership,
): Promise<{ id: string; status: string; issueType: string; severity: string }> {
  const { data, error } = await supabase
    .from("market_data_issues")
    .select("id, status, issue_type, severity")
    .eq("id", issueId)
    .eq("valuation_case_id", caseId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Ocorrência de qualidade não encontrada neste caso.");
  return {
    id: data.id,
    status: data.status,
    issueType: data.issue_type,
    severity: data.severity,
  };
}

/** Converte a resposta jsonb da RPC agregadora no contrato tipado de leitura. */
export function asIntelligenceReport(payload: unknown): MarketIntelligenceReport {
  if (!payload || typeof payload !== "object") {
    throw new Error("Relatório de inteligência de mercado indisponível.");
  }
  return payload as MarketIntelligenceReport;
}
