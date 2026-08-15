/**
 * FUNCTIONAL + NEGATIVE FLOW TEST — CONVITE DE MEMBRO / REVIEWER (fase 7H.1)
 *
 * Prova o fluxo humano:
 *   OWNER → INVITE (REVIEWER) → membership NÃO ativa → aceite autenticado do
 *   mesmo e-mail → membership REVIEWER ACTIVE → invite ACCEPTED → OWNER segue OWNER.
 *
 * E prova o que NÃO acontece:
 *   A. usuário externo não cria convite;
 *   B. REVIEWER não convida e não vira OWNER;
 *   C. papel do payload não sobrepõe o papel aprovado no convite;
 *   D. convidado com outro e-mail não aceita;
 *   E. convite expirado, revogado ou já consumido não aceita;
 *   F. convite não cria membership antes do aceite;
 *   G. sem membership duplicada;
 *   H. cross-tenant bloqueado (OWNER de A não convida para B);
 *   I. OWNER não altera o próprio papel por este fluxo;
 *   J. token em texto puro não é persistido em nenhuma coluna;
 *   K. escrita direta na tabela de convites é recusada (RLS/GRANT).
 *
 * Run with:  bun run tests/functional/organization-invitation-flow.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!;
const anonKey =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;
const admin: AnyClient = createClient(url, serviceKey, { auth: { persistSession: false } });

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}
function expectOk(name: string, error: { message: string } | null, detail = "ok") {
  record(name, !error, error ? `unexpected error: ${error.message.slice(0, 240)}` : detail);
  if (error) throw new Error(`${name}: ${error.message}`);
}
function expectFail(name: string, error: { message: string } | null) {
  record(
    name,
    !!error,
    error ? `recusado: ${error.message.slice(0, 200)}` : "GOVERNANCE REGRESSION: operação aceita",
  );
}
function expectTrue(name: string, condition: boolean, detail: string) {
  record(name, condition, detail);
}

const stamp = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const email = `inv-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Inv!${stamp}${label}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  createdUserIds.push(data.user.id);

  const client: AnyClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  await admin.from("profiles").upsert({ id: data.user.id, email });
  return { id: data.user.id, email, client };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const { count: baselineCount } = await admin
    .from("methodology_source_verifications")
    .select("id", { count: "exact", head: true });
  const verificationsBaseline = baselineCount ?? 0;

  // ---------- SETUP: duas organizações reais, atores distintos ----------
  const ownerA = await createUser("owner-a");
  const ownerB = await createUser("owner-b");
  const reviewer = await createUser("reviewer");
  const outsider = await createUser("outsider");

  const { data: orgA, error: orgAError } = await admin
    .from("organizations")
    .insert({ name: `TEST_ONLY Invite Org A ${stamp}`, created_by: ownerA.id })
    .select("id")
    .single();
  expectOk("setup: organização A criada", orgAError);
  const { data: orgB, error: orgBError } = await admin
    .from("organizations")
    .insert({ name: `TEST_ONLY Invite Org B ${stamp}`, created_by: ownerB.id })
    .select("id")
    .single();
  expectOk("setup: organização B criada", orgBError);

  expectOk(
    "setup: OWNER A ativo",
    (
      await admin.from("organization_members").insert({
        organization_id: orgA!.id,
        user_id: ownerA.id,
        role: "OWNER",
        status: "ACTIVE",
      })
    ).error,
  );
  expectOk(
    "setup: OWNER B ativo",
    (
      await admin.from("organization_members").insert({
        organization_id: orgB!.id,
        user_id: ownerB.id,
        role: "OWNER",
        status: "ACTIVE",
      })
    ).error,
  );

  // ---------- 1. AUTORIZAÇÃO DE CRIAÇÃO ----------
  const outsiderToken = randomToken();
  expectFail(
    "externo não cria convite na organização A",
    (
      await outsider.client.rpc("create_organization_invitation", {
        _organization_id: orgA!.id,
        _email: `x-${stamp}@example.test`,
        _role: "REVIEWER",
        _token_hash: await sha256Hex(outsiderToken),
      })
    ).error,
  );

  expectFail(
    "OWNER de A não convida para a organização B (cross-tenant)",
    (
      await ownerA.client.rpc("create_organization_invitation", {
        _organization_id: orgB!.id,
        _email: `x2-${stamp}@example.test`,
        _role: "REVIEWER",
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  expectFail(
    "convite como OWNER é recusado (sem escalada de privilégio)",
    (
      await ownerA.client.rpc("create_organization_invitation", {
        _organization_id: orgA!.id,
        _email: `x3-${stamp}@example.test`,
        _role: "OWNER",
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  expectFail(
    "escrita direta na tabela de convites é recusada",
    (
      await ownerA.client.from("organization_invitations").insert({
        organization_id: orgA!.id,
        email: `direct-${stamp}@example.test`,
        invited_role: "OWNER",
        token_hash: await sha256Hex(randomToken()),
        invited_by: ownerA.id,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
    ).error,
  );

  // ---------- 2. CRIAÇÃO LEGÍTIMA ----------
  const token = randomToken();
  const { data: inviteId, error: inviteError } = await ownerA.client.rpc(
    "create_organization_invitation",
    {
      _organization_id: orgA!.id,
      _email: reviewer.email,
      _role: "REVIEWER",
      _token_hash: await sha256Hex(token),
    },
  );
  expectOk("OWNER A cria convite REVIEWER", inviteError, `invite=${inviteId}`);

  const { data: inviteRow } = await admin
    .from("organization_invitations")
    .select("*")
    .eq("id", inviteId)
    .single();
  expectTrue("convite nasce como INVITED", inviteRow?.status === "INVITED", `${inviteRow?.status}`);
  expectTrue(
    "papel gravado é exatamente o papel do convite",
    inviteRow?.invited_role === "REVIEWER",
    `${inviteRow?.invited_role}`,
  );
  expectTrue(
    "token em texto puro não é persistido",
    JSON.stringify(inviteRow).includes(token) === false,
    "nenhuma coluna contém o token",
  );
  expectTrue(
    "token_hash é o digest SHA-256 do token",
    inviteRow?.token_hash === (await sha256Hex(token)),
    "digest confere",
  );

  const { count: membershipBefore } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgA!.id)
    .eq("user_id", reviewer.id);
  expectTrue(
    "convite não cria membership antes do aceite",
    (membershipBefore ?? 0) === 0,
    `memberships=${membershipBefore ?? 0}`,
  );

  const { data: auditCreated } = await admin
    .from("audit_log")
    .select("event_type")
    .eq("entity_id", inviteId)
    .in("event_type", ["INVITE_CREATED", "INVITE_SENT"]);
  expectTrue(
    "auditoria registra INVITE_CREATED e INVITE_SENT",
    (auditCreated ?? []).length >= 2,
    `${(auditCreated ?? []).map((r: any) => r.event_type).join(",")}`,
  );
  expectTrue(
    "auditoria não contém o token",
    JSON.stringify(auditCreated ?? []).includes(token) === false,
    "sem token no log",
  );

  // ---------- 3. DUPLICIDADE ----------
  expectFail(
    "segundo convite pendente para o mesmo e-mail é recusado",
    (
      await ownerA.client.rpc("create_organization_invitation", {
        _organization_id: orgA!.id,
        _email: reviewer.email,
        _role: "REVIEWER",
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  // ---------- 4. ISOLAMENTO DE LEITURA ----------
  const { data: outsiderRead } = await outsider.client
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", orgA!.id);
  expectTrue(
    "externo não enxerga convites da organização A",
    (outsiderRead ?? []).length === 0,
    `rows=${(outsiderRead ?? []).length}`,
  );

  const { data: ownerBRead } = await ownerB.client
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", orgA!.id);
  expectTrue(
    "OWNER de B não enxerga convites da organização A",
    (ownerBRead ?? []).length === 0,
    `rows=${(ownerBRead ?? []).length}`,
  );

  const { data: inviteeRead } = await reviewer.client
    .from("organization_invitations")
    .select("id, email, invited_role")
    .eq("organization_id", orgA!.id);
  expectTrue(
    "convidado enxerga apenas o próprio convite pendente",
    (inviteeRead ?? []).length === 1 && inviteeRead![0].email === reviewer.email,
    `rows=${(inviteeRead ?? []).length}`,
  );

  const { data: ownerARead } = await ownerA.client
    .from("organization_invitations")
    .select("id")
    .eq("organization_id", orgA!.id);
  expectTrue(
    "OWNER A enxerga os convites da própria organização",
    (ownerARead ?? []).length >= 1,
    `rows=${(ownerARead ?? []).length}`,
  );

  // ---------- 5. ACEITE COM E-MAIL ERRADO ----------
  expectFail(
    "convidado com outro e-mail não aceita",
    (await outsider.client.rpc("accept_organization_invitation", { _token_hash: await sha256Hex(token) }))
      .error,
  );
  expectFail(
    "token inexistente não aceita",
    (
      await reviewer.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  // ---------- 6. EXPIRAÇÃO ----------
  const expiredToken = randomToken();
  const { data: expiredId } = await ownerA.client.rpc("create_organization_invitation", {
    _organization_id: orgA!.id,
    _email: `expired-${stamp}@valuation-functional-test.local`,
    _role: "REVIEWER",
    _token_hash: await sha256Hex(expiredToken),
    _ttl_hours: 1,
  });
  await admin
    .from("organization_invitations")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", expiredId);

  const expiredUser = await createUser("expired");
  await admin
    .from("organization_invitations")
    .update({ email: expiredUser.email })
    .eq("id", expiredId);
  expectFail(
    "convite expirado não aceita",
    (
      await expiredUser.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(expiredToken),
      })
    ).error,
  );
  // A recusa do aceite é atômica: nada muda na mesma transação que falhou.
  // A transição para EXPIRED é feita pela rotina de expiração governada.
  expectOk(
    "rotina de expiração transiciona convite vencido",
    (await ownerA.client.rpc("expire_stale_invitations", { _organization_id: orgA!.id })).error,
  );
  const { data: expiredRow } = await admin
    .from("organization_invitations")
    .select("status")
    .eq("id", expiredId)
    .single();
  expectTrue(
    "convite expirado é marcado EXPIRED",
    expiredRow?.status === "EXPIRED",
    `${expiredRow?.status}`,
  );
  const { data: expiredAudit } = await admin
    .from("audit_log")
    .select("event_type")
    .eq("entity_id", expiredId)
    .eq("event_type", "INVITE_EXPIRED");
  expectTrue(
    "auditoria registra INVITE_EXPIRED",
    (expiredAudit ?? []).length === 1,
    `rows=${(expiredAudit ?? []).length}`,
  );

  // ---------- 7. REVOGAÇÃO ----------
  const revokedToken = randomToken();
  const revokedUser = await createUser("revoked");
  const { data: revokedId } = await ownerA.client.rpc("create_organization_invitation", {
    _organization_id: orgA!.id,
    _email: revokedUser.email,
    _role: "REVIEWER",
    _token_hash: await sha256Hex(revokedToken),
  });
  expectFail(
    "externo não revoga convite",
    (await outsider.client.rpc("revoke_organization_invitation", { _invitation_id: revokedId }))
      .error,
  );
  expectOk(
    "OWNER A revoga convite",
    (
      await ownerA.client.rpc("revoke_organization_invitation", {
        _invitation_id: revokedId,
        _reason: "TEST_ONLY",
      })
    ).error,
  );
  expectFail(
    "convite revogado não aceita",
    (
      await revokedUser.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(revokedToken),
      })
    ).error,
  );
  const { data: revokedAudit } = await admin
    .from("audit_log")
    .select("event_type")
    .eq("entity_id", revokedId)
    .eq("event_type", "INVITE_REVOKED");
  expectTrue(
    "auditoria registra INVITE_REVOKED",
    (revokedAudit ?? []).length === 1,
    `rows=${(revokedAudit ?? []).length}`,
  );

  // ---------- 8. REENVIO ROTACIONA TOKEN ----------
  const resendUser = await createUser("resend");
  const firstToken = randomToken();
  const { data: resendId } = await ownerA.client.rpc("create_organization_invitation", {
    _organization_id: orgA!.id,
    _email: resendUser.email,
    _role: "REVIEWER",
    _token_hash: await sha256Hex(firstToken),
  });
  const secondToken = randomToken();
  expectOk(
    "OWNER A reenvia convite (rotaciona token)",
    (
      await ownerA.client.rpc("resend_organization_invitation", {
        _invitation_id: resendId,
        _token_hash: await sha256Hex(secondToken),
      })
    ).error,
  );
  expectFail(
    "token antigo deixa de valer após reenvio",
    (
      await resendUser.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(firstToken),
      })
    ).error,
  );
  expectOk(
    "token novo aceita normalmente",
    (
      await resendUser.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(secondToken),
      })
    ).error,
  );

  // ---------- 9. ACEITE PRINCIPAL ----------
  const { data: acceptResult, error: acceptError } = await reviewer.client.rpc(
    "accept_organization_invitation",
    { _token_hash: await sha256Hex(token) },
  );
  expectOk("convidado real aceita o convite", acceptError, JSON.stringify(acceptResult));
  expectTrue(
    "papel efetivo é REVIEWER (nunca OWNER)",
    (acceptResult as any)?.role === "REVIEWER",
    `${(acceptResult as any)?.role}`,
  );

  const { data: membership } = await admin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", orgA!.id)
    .eq("user_id", reviewer.id)
    .single();
  expectTrue(
    "membership criada como REVIEWER ACTIVE",
    membership?.role === "REVIEWER" && membership?.status === "ACTIVE",
    `${membership?.role}/${membership?.status}`,
  );

  const { data: acceptedInvite } = await admin
    .from("organization_invitations")
    .select("status, accepted_by, accepted_at")
    .eq("id", inviteId)
    .single();
  expectTrue(
    "convite passa a ACCEPTED com autor e data",
    acceptedInvite?.status === "ACCEPTED" &&
      acceptedInvite?.accepted_by === reviewer.id &&
      !!acceptedInvite?.accepted_at,
    `${acceptedInvite?.status}`,
  );

  const { data: acceptAudit } = await admin
    .from("audit_log")
    .select("event_type, actor_user_id")
    .eq("entity_id", inviteId)
    .eq("event_type", "INVITE_ACCEPTED");
  expectTrue(
    "auditoria registra INVITE_ACCEPTED com o ator do aceite",
    (acceptAudit ?? []).length === 1 && acceptAudit![0].actor_user_id === reviewer.id,
    `rows=${(acceptAudit ?? []).length}`,
  );

  expectFail(
    "convite já consumido não aceita de novo",
    (
      await reviewer.client.rpc("accept_organization_invitation", {
        _token_hash: await sha256Hex(token),
      })
    ).error,
  );

  const { count: memberCount } = await admin
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgA!.id)
    .eq("status", "ACTIVE");
  expectTrue(
    "organização A passa a ter OWNER + REVIEWER ativos",
    (memberCount ?? 0) >= 2,
    `ativos=${memberCount ?? 0}`,
  );

  const { data: ownerStill } = await admin
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", orgA!.id)
    .eq("user_id", ownerA.id)
    .single();
  expectTrue(
    "OWNER permanece OWNER ACTIVE após o aceite",
    ownerStill?.role === "OWNER" && ownerStill?.status === "ACTIVE",
    `${ownerStill?.role}/${ownerStill?.status}`,
  );

  // ---------- 10. DUPLICIDADE PÓS-ACEITE / REVIEWER SEM PODER ----------
  expectFail(
    "e-mail de membro ativo não recebe novo convite",
    (
      await ownerA.client.rpc("create_organization_invitation", {
        _organization_id: orgA!.id,
        _email: reviewer.email,
        _role: "VIEWER",
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  expectFail(
    "REVIEWER não cria convite",
    (
      await reviewer.client.rpc("create_organization_invitation", {
        _organization_id: orgA!.id,
        _email: `rev-${stamp}@example.test`,
        _role: "REVIEWER",
        _token_hash: await sha256Hex(randomToken()),
      })
    ).error,
  );

  expectFail(
    "REVIEWER não se promove a OWNER",
    (
      await reviewer.client
        .from("organization_members")
        .update({ role: "OWNER" })
        .eq("organization_id", orgA!.id)
        .eq("user_id", reviewer.id)
        .select("id")
        .single()
    ).error,
  );

  expectFail(
    "OWNER não altera o próprio papel",
    (
      await ownerA.client
        .from("organization_members")
        .update({ role: "REVIEWER" })
        .eq("organization_id", orgA!.id)
        .eq("user_id", ownerA.id)
        .select("id")
        .single()
    ).error,
  );

  // ---------- 11. NENHUMA VERIFICAÇÃO NORMATIVA AUTOMÁTICA ----------
  const { count: verificationsAfter } = await admin
    .from("methodology_source_verifications")
    .select("id", { count: "exact", head: true });
  expectTrue(
    "onboarding não cria verificação normativa automática",
    (verificationsAfter ?? 0) === verificationsBaseline,
    `baseline=${verificationsBaseline} depois=${verificationsAfter ?? 0}`,
  );

  // ---------- CLEANUP ----------
  await admin.from("audit_log").delete().in("organization_id", [orgA!.id, orgB!.id]);
  await admin.from("organization_invitations").delete().in("organization_id", [orgA!.id, orgB!.id]);
  await admin.from("organizations").delete().in("id", [orgA!.id, orgB!.id]);
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
}

main()
  .catch((error) => {
    record("FATAL", false, error instanceof Error ? error.message : String(error));
  })
  .finally(() => {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    console.log(`\n=== INVITATION FLOW: ${passed}/${total} PASS ===`);
    process.exit(passed === total ? 0 : 1);
  });
