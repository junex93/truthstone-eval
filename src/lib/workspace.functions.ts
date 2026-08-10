import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ORG_ROLES, type OrgRole } from "@/lib/domain/constants";
import { organizationSchema, profileSchema } from "@/lib/validation/schemas";
import {
  getMembership,
  requireAdminAccess,
  requireMembership,
  writeAudit,
} from "@/lib/workspace.server";
import { z } from "zod";

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const membership = await getMembership(supabase, userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, professional_registration")
      .eq("id", userId)
      .maybeSingle();

    let organization: { id: string; name: string; legal_name: string | null } | null = null;
    if (membership) {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, legal_name")
        .eq("id", membership.organizationId)
        .maybeSingle();
      organization = data ?? null;
    }

    return {
      userId,
      email: typeof claims.email === "string" ? claims.email : null,
      profile: profile ?? null,
      role: membership?.role ?? null,
      organization,
    };
  });

export const bootstrapWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => organizationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const existing = await getMembership(supabase, userId);
    if (existing) {
      throw new Error("Este usuário já pertence a uma organização.");
    }

    await supabase.from("profiles").upsert({
      id: userId,
      email: typeof claims.email === "string" ? claims.email : null,
    });

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: data.name,
        legal_name: data.legalName ?? null,
        created_by: userId,
      })
      .select("id, name")
      .single();
    if (orgError) throw new Error(orgError.message);

    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: userId,
      role: "OWNER",
      status: "ACTIVE",
    });
    if (memberError) throw new Error(memberError.message);

    await writeAudit(supabase, {
      organizationId: org.id,
      actorUserId: userId,
      eventType: "ORGANIZATION_CREATED",

      entityType: "organization",
      entityId: org.id,
      after: { name: org.name },
    });

    return { organizationId: org.id };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      email: typeof claims.email === "string" ? claims.email : null,
      full_name: data.fullName ?? null,
      professional_registration: data.professionalRegistration ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await requireMembership(supabase, userId);

    const { data, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, status, created_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);

    return {
      currentRole: membership.role,
      members: (data ?? []).map((m) => {
        const profile = (profiles ?? []).find((p) => p.id === m.user_id);
        return {
          ...m,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          isSelf: m.user_id === userId,
        };
      }),
    };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ memberId: z.string().uuid(), role: z.enum(ORG_ROLES) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const membership = await requireAdminAccess(supabase, userId);

    const { data: before, error: readError } = await supabase
      .from("organization_members")
      .select("id, user_id, role, organization_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!before || before.organization_id !== membership.organizationId) {
      throw new Error("Membro não encontrado nesta organização.");
    }
    if (before.user_id === userId) {
      throw new Error("Não é permitido alterar o próprio papel.");
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ role: data.role as OrgRole })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      organizationId: membership.organizationId,
      actorUserId: userId,
      eventType: "USER_ROLE_CHANGED",
      entityType: "organization_member",
      entityId: data.memberId,
      before: { role: before.role },
      after: { role: data.role },
    });

    return { ok: true };
  });

export const getDashboardMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const membership = await getMembership(supabase, userId);
    if (!membership) {
      return null;
    }
    const org = membership.organizationId;

    const activeStatuses = [
      "DRAFT",
      "EVIDENCE_COLLECTION",
      "DATA_REVIEW",
      "DATASET_FROZEN",
      "VALUATION",
      "REVIEW",
    ] as const;

    const [activeCases, pendingFields, frozenDatasets, completedCases, sources, artifacts] =
      await Promise.all([
        supabase
          .from("valuation_cases")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .in("status", [...activeStatuses]),
        supabase
          .from("evidence_fields")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .in("validation_status", ["EXTRACTED", "PENDING_REVIEW"]),
        supabase
          .from("dataset_versions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .not("frozen_at", "is", null),
        supabase
          .from("valuation_cases")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org)
          .eq("status", "COMPLETED"),
        supabase
          .from("evidence_sources")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org),
        supabase
          .from("evidence_artifacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", org),
      ]);

    const { data: recentAudit } = await supabase
      .from("audit_log")
      .select("id, event_type, entity_type, created_at, actor_user_id")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(8);

    return {
      activeCases: activeCases.count ?? 0,
      pendingFields: pendingFields.count ?? 0,
      frozenDatasets: frozenDatasets.count ?? 0,
      completedCases: completedCases.count ?? 0,
      sources: sources.count ?? 0,
      artifacts: artifacts.count ?? 0,
      recentAudit: recentAudit ?? [],
    };
  });
