import type { Db } from "@/lib/workspace.server";
import { sha256HexOfString } from "@/lib/workspace.server";

/**
 * Server-only helpers do onboarding de membro humano.
 *
 * O token do convite é gerado aqui, entregue UMA única vez ao ator autorizado e
 * nunca persistido: o banco guarda apenas o digest SHA-256. Nada de token em log.
 */

const TOKEN_BYTES = 32;

export function generateInvitationToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashInvitationToken(token: string): Promise<string> {
  return sha256HexOfString(token);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface InvitationRow {
  id: string;
  email: string;
  invited_role: string;
  status: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  last_sent_at: string | null;
  send_count: number;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

/**
 * Lista convites da organização. A projeção NUNCA inclui `token_hash`: o digest
 * não precisa cruzar a fronteira do servidor.
 */
export async function readInvitations(
  supabase: Db,
  organizationId: string,
): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, email, invited_role, status, invited_by, invited_at, expires_at, last_sent_at, send_count, accepted_by, accepted_at, revoked_by, revoked_at, revoked_reason",
    )
    .eq("organization_id", organizationId)
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as InvitationRow[];
}

/** Nomes de atores para exibição, sem expor e-mail de quem não é da organização. */
export async function resolveInvitationActors(
  supabase: Db,
  userIds: string[],
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return {};

  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", unique);

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.id] = row.full_name ?? row.email ?? row.id;
  }
  return map;
}
