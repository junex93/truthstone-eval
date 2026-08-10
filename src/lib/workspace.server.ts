import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { AuditEventType, OrgRole } from "@/lib/domain/constants";

/**
 * Server-only helpers. This file never reaches the client bundle (*.server.ts).
 * Authorization is resolved here AND enforced again by RLS in the database.
 */

export type Db = SupabaseClient<Database>;

export interface Membership {
  organizationId: string;
  role: OrgRole;
}

const WRITE_ROLES: OrgRole[] = ["OWNER", "ADMIN", "VALUER"];
const REVIEW_ROLES: OrgRole[] = ["OWNER", "ADMIN", "REVIEWER"];
const ADMIN_ROLES: OrgRole[] = ["OWNER", "ADMIN"];

export async function getMembership(supabase: Db, userId: string): Promise<Membership | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { organizationId: data.organization_id, role: data.role as OrgRole };
}

export async function requireMembership(supabase: Db, userId: string): Promise<Membership> {
  const membership = await getMembership(supabase, userId);
  if (!membership) {
    throw new Error("Nenhuma organização ativa vinculada a este usuário.");
  }
  return membership;
}

export async function requireWriteAccess(supabase: Db, userId: string): Promise<Membership> {
  const membership = await requireMembership(supabase, userId);
  if (!WRITE_ROLES.includes(membership.role)) {
    throw new Error("Permissão insuficiente: é necessário papel VALUER, ADMIN ou OWNER.");
  }
  return membership;
}

export async function requireReviewAccess(supabase: Db, userId: string): Promise<Membership> {
  const membership = await requireMembership(supabase, userId);
  if (!REVIEW_ROLES.includes(membership.role)) {
    throw new Error("Permissão insuficiente: é necessário papel REVIEWER, ADMIN ou OWNER.");
  }
  return membership;
}

export async function requireAdminAccess(supabase: Db, userId: string): Promise<Membership> {
  const membership = await requireMembership(supabase, userId);
  if (!ADMIN_ROLES.includes(membership.role)) {
    throw new Error("Permissão insuficiente: é necessário papel ADMIN ou OWNER.");
  }
  return membership;
}

export interface AuditInput {
  organizationId: string;
  caseId?: string | null;
  /** Acting user. Required because the audit row is written with the service role. */
  actorUserId?: string | null;
  eventType: AuditEventType;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}


/**
 * Append-only audit write.
 *
 * The client role has NO write grant on public.audit_log: the trail cannot be
 * fabricated, edited or deleted through the Data API. Non-atomic events (record
 * creation) are written here with the service role; every critical invariant
 * change (verify, reject, revise, freeze, status transition) writes its own audit
 * row INSIDE the database function, in the same transaction as the act itself.
 */
export async function writeAudit(_supabase: Db, input: AuditInput): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("audit_log").insert({
    organization_id: input.organizationId,
    valuation_case_id: input.caseId ?? null,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before_data: (input.before ?? null) as never,
    after_data: (input.after ?? null) as never,
    metadata: (input.metadata ?? null) as never,
  });

  if (error) {
    console.error("[audit] failed to write event", input.eventType, error.message);
    throw new Error(`Falha ao registrar evento de auditoria: ${error.message}`);
  }
}


/** Deterministic SHA-256 over bytes, computed on the server runtime. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256HexOfString(value: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(value).buffer as ArrayBuffer);
}

export function requireOrgScope(recordOrgId: string, membership: Membership): void {
  if (recordOrgId !== membership.organizationId) {
    throw new Error("Registro fora do escopo da organização atual.");
  }
}
