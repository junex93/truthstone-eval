import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INVITABLE_ROLES } from "@/lib/domain/constants";
import {
  generateInvitationToken,
  hashInvitationToken,
  normalizeEmail,
  readInvitations,
  resolveInvitationActors,
} from "@/lib/invitations.server";
import { requireAdminAccess, requireMembership } from "@/lib/workspace.server";

const inviteInputSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  role: z.enum(INVITABLE_ROLES),
  ttlHours: z.number().int().min(1).max(720).optional(),
});

const invitationIdSchema = z.object({ invitationId: z.string().uuid() });

/** Mensagens humanas: erro bruto de banco não sobe para a interface. */
function humanize(message: string): string {
  const clean = message.replace(/^.*?:\s*/, "").trim();
  if (/duplicate key|uq_invitation_pending/i.test(message)) {
    return "Já existe um convite pendente para este e-mail.";
  }
  if (/chk_invitation_role_not_owner/i.test(message)) {
    return "Não é permitido convidar alguém como titular por este fluxo.";
  }
  return clean.length > 0 && clean.length < 240 ? clean : "Não foi possível concluir a operação.";
}

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireAdminAccess(supabase, userId);

    await supabase.rpc("expire_stale_invitations", { _organization_id: membership.organizationId });

    const rows = await readInvitations(supabase, membership.organizationId);
    const actors = await resolveInvitationActors(
      supabase,
      rows.flatMap((r) => [r.invited_by, r.accepted_by ?? "", r.revoked_by ?? ""]),
    );

    return {
      currentRole: membership.role,
      invitations: rows.map((row) => ({
        ...row,
        invited_by_name: actors[row.invited_by] ?? null,
        accepted_by_name: row.accepted_by ? (actors[row.accepted_by] ?? null) : null,
        revoked_by_name: row.revoked_by ? (actors[row.revoked_by] ?? null) : null,
      })),
    };
  });

/**
 * Cria o convite. O token é retornado UMA vez para que o ator autorizado o
 * entregue ao convidado; o banco guarda apenas o digest.
 */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inviteInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireAdminAccess(supabase, userId);

    const token = generateInvitationToken();
    const tokenHash = await hashInvitationToken(token);

    const { data: invitationId, error } = await supabase.rpc("create_organization_invitation", {
      _organization_id: membership.organizationId,
      _email: normalizeEmail(data.email),
      _role: data.role,
      _token_hash: tokenHash,
      _ttl_hours: data.ttlHours ?? 168,
    });
    if (error) throw new Error(humanize(error.message));

    return {
      invitationId: invitationId as unknown as string,
      token,
      emailDelivery: "MANUAL_LINK" as const,
    };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => invitationIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    const token = generateInvitationToken();
    const tokenHash = await hashInvitationToken(token);

    const { error } = await supabase.rpc("resend_organization_invitation", {
      _invitation_id: data.invitationId,
      _token_hash: tokenHash,
      _ttl_hours: 168,
    });
    if (error) throw new Error(humanize(error.message));

    return { token, emailDelivery: "MANUAL_LINK" as const };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    invitationIdSchema.extend({ reason: z.string().trim().max(400).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    const { error } = await supabase.rpc(
      "revoke_organization_invitation",
      data.reason
        ? { _invitation_id: data.invitationId, _reason: data.reason }
        : { _invitation_id: data.invitationId },
    );

    if (error) throw new Error(humanize(error.message));
    return { ok: true };
  });

const tokenSchema = z.object({ token: z.string().trim().min(20).max(200) });

export const inspectInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tokenHash = await hashInvitationToken(data.token);

    const { data: result, error } = await supabase.rpc("inspect_organization_invitation", {
      _token_hash: tokenHash,
    });
    if (error) throw new Error(humanize(error.message));
    return result as unknown as {
      found: boolean;
      reason?: string;
      organization_id?: string;
      organization_name?: string;
      invited_role?: string;
      status?: string;
      expires_at?: string;
      expired?: boolean;
      email_matches?: boolean;
      already_member?: boolean;
    };
  });

/**
 * Aceite. Tudo o que importa é validado no banco, em uma única transação: token,
 * organização, e-mail autenticado, expiração, revogação, consumo e papel.
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const tokenHash = await hashInvitationToken(data.token);

    const { data: result, error } = await supabase.rpc("accept_organization_invitation", {
      _token_hash: tokenHash,
    });
    if (error) throw new Error(humanize(error.message));

    return result as unknown as { organization_id: string; member_id: string; role: string };
  });

export const getMyPendingInvitationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireMembership(supabase, userId);
    return { ok: true };
  });
