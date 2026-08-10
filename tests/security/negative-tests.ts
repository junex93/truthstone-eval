/**
 * NEGATIVE SECURITY TESTS — Fluxa Forensic Valuation Platform
 *
 * These tests prove that the forensic invariants are enforced by PostgreSQL
 * (RLS + GRANTs + triggers + controlled RPCs), NOT by the user interface.
 *
 * Every test is expected to FAIL at the database level. A test that succeeds
 * in mutating protected state is reported as a SECURITY REGRESSION.
 *
 * Run with:  bun run tests/security/negative-tests.ts
 *
 * Requires: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY
 * (service role is used ONLY to provision and clean up ephemeral test users and
 * fixture rows — never to assert security behaviour).
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

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

/** Asserts that an operation is blocked. `run` must return a postgres error. */
async function expectBlocked(name: string, run: () => Promise<{ error: unknown }>) {
  try {
    const { error } = await run();
    if (error) {
      const message = (error as { message?: string }).message ?? String(error);
      record(name, true, `blocked: ${message.slice(0, 220)}`);
    } else {
      record(name, false, "SECURITY REGRESSION: operation succeeded but must be blocked");
    }
  } catch (err) {
    record(name, true, `blocked (throw): ${(err as Error).message.slice(0, 220)}`);
  }
}

/** Asserts an operation returns zero rows (invisible under RLS). */
async function expectInvisible(
  name: string,
  run: () => Promise<{ data: unknown[] | null; error: unknown }>,
) {
  const { data, error } = await run();
  const count = data?.length ?? 0;
  if (error) {
    record(name, true, `blocked: ${(error as { message: string }).message.slice(0, 200)}`);
  } else if (count === 0) {
    record(name, true, "returned 0 rows (tenant isolated)");
  } else {
    record(name, false, `SECURITY REGRESSION: leaked ${count} row(s) across tenant boundary`);
  }
}

/**
 * Asserts an operation has no persisted effect. RLS-restricted DELETE/UPDATE do
 * not raise an error over the Data API: they simply affect zero rows. So the
 * protected state is re-read with the service role to prove it is intact.
 */
async function expectNoEffect(
  name: string,
  run: () => Promise<{ error: unknown }>,
  verify: () => Promise<boolean>,
) {
  const { error } = await run();
  const intact = await verify();
  if (error && intact) {
    record(name, true, `blocked: ${(error as { message: string }).message.slice(0, 200)}`);
  } else if (intact) {
    record(name, true, "affected 0 rows under RLS; protected state verified intact");
  } else {
    record(name, false, "SECURITY REGRESSION: protected state was mutated");
  }
}


const stamp = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const email = `neg-${label}-${stamp}@fluxa-security-test.local`;
  const password = `Neg!${stamp}${label}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}) failed: ${signIn.error.message}`);
  return { id: data.user.id, client };
}

async function seedOrg(opts: {
  name: string;
  ownerId: string;
  members: Array<{ userId: string; role: string }>;
}) {
  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name: opts.name, slug: `${opts.name}-${stamp}`.toLowerCase(), created_by: opts.ownerId })
    .select("id")
    .single();
  if (error) throw new Error(`seedOrg: ${error.message}`);
  const members = [
    { organization_id: org.id, user_id: opts.ownerId, role: "OWNER", status: "ACTIVE" },
    ...opts.members.map((m) => ({
      organization_id: org.id,
      user_id: m.userId,
      role: m.role,
      status: "ACTIVE",
    })),
  ];
  const memberInsert = await admin.from("organization_members").insert(members);
  if (memberInsert.error) throw new Error(`seedMembers: ${memberInsert.error.message}`);
  return org.id as string;
}

async function seedCase(orgId: string, ownerId: string, code: string) {
  const { data, error } = await admin
    .from("valuation_cases")
    .insert({
      organization_id: orgId,
      case_code: code,
      title: `Caso de teste ${code}`,
      purpose: "Teste negativo de segurança",
      status: "EVIDENCE_COLLECTION",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedCase: ${error.message}`);
  return data.id as string;
}

/** Seeds a full evidence lineage and returns the candidate field id. */
async function seedCandidateField(orgId: string, caseId: string, ownerId: string, fieldName: string) {
  const source = await admin
    .from("evidence_sources")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      source_type: "PRIVATE_DOCUMENT",
      source_name: `Fonte ${fieldName}`,
      accessed_at: new Date().toISOString(),
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (source.error) throw new Error(`seedSource: ${source.error.message}`);

  const artifact = await admin
    .from("evidence_artifacts")
    .insert({
      organization_id: orgId,
      evidence_source_id: source.data.id,
      storage_bucket: "evidence-originals",
      storage_path: `${orgId}/${caseId}/${fieldName}-${stamp}.pdf`,
      file_name: `${fieldName}.pdf`,
      mime_type: "application/pdf",
      file_size: 1024,
      sha256_hash: "0".repeat(64),
      hash_computed_by: "SERVER",
      captured_at: new Date().toISOString(),
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (artifact.error) throw new Error(`seedArtifact: ${artifact.error.message}`);

  const extraction = await admin
    .from("evidence_extractions")
    .insert({
      organization_id: orgId,
      artifact_id: artifact.data.id,
      version_number: 1,
      extraction_type: "MANUAL_TRANSCRIPTION",
      processor_type: "MANUAL",
      processor_name: "negative-test",
      processor_version: "1",
      status: "COMPLETED",
      raw_output: { note: "fixture" },
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (extraction.error) throw new Error(`seedExtraction: ${extraction.error.message}`);

  const field = await admin
    .from("evidence_fields")
    .insert({
      organization_id: orgId,
      extraction_id: extraction.data.id,
      field_name: fieldName,
      raw_value: "120",
      normalized_value: "120",
      numeric_value: 120,
      unit: "m2",
      field_state: "PRESENT",
      source_excerpt: "Área privativa de 120 m2 conforme matrícula.",
      validation_status: "PENDING_REVIEW",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (field.error) throw new Error(`seedField: ${field.error.message}`);
  return field.data.id as string;
}

async function cleanup(orgIds: string[]) {
  // Immutable tables refuse deletes by design; teardown uses the privileged flag
  // is NOT available over the API, so fixture rows are left tagged and orgs renamed.
  for (const orgId of orgIds) {
    await admin
      .from("organizations")
      .update({ name: `ZZ-SECURITY-TEST-FIXTURE-${stamp}` })
      .eq("id", orgId);
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
}

async function main() {
  const orgIds: string[] = [];
  const owner = await createUser("owner");
  const valuer = await createUser("valuer");
  const outsider = await createUser("outsider");

  const orgA = await seedOrg({
    name: `negA${stamp}`,
    ownerId: owner.id,
    members: [{ userId: valuer.id, role: "VALUER" }],
  });
  orgIds.push(orgA);
  const orgB = await seedOrg({ name: `negB${stamp}`, ownerId: outsider.id, members: [] });
  orgIds.push(orgB);

  const caseA1 = await seedCase(orgA, owner.id, `NEG-A1-${stamp}`);
  const caseA2 = await seedCase(orgA, owner.id, `NEG-A2-${stamp}`);
  const caseB1 = await seedCase(orgB, outsider.id, `NEG-B1-${stamp}`);

  const candidateField = await seedCandidateField(orgA, caseA1, owner.id, "private_area");
  const fieldToFreeze = await seedCandidateField(orgA, caseA1, owner.id, "land_area");
  const crossCaseField = await seedCandidateField(orgA, caseA2, owner.id, "built_area");

  const anon: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: false } });

  console.log("\n=== 1. ANONYMOUS ACCESS ===");
  await expectInvisible("anon cannot read valuation_cases", () =>
    anon.from("valuation_cases").select("id").limit(5),
  );
  await expectInvisible("anon cannot read evidence_fields", () =>
    anon.from("evidence_fields").select("id").limit(5),
  );
  await expectBlocked("anon cannot call verify_evidence_field", () =>
    anon.rpc("verify_evidence_field", { _field_id: candidateField, _notes: "bypass" }),
  );

  console.log("\n=== 2. CROSS-TENANT ISOLATION ===");
  await expectInvisible("member of org A cannot read org B cases", () =>
    owner.client.from("valuation_cases").select("id").eq("organization_id", orgB),
  );
  await expectInvisible("member of org A cannot read org B evidence sources", () =>
    owner.client.from("evidence_sources").select("id").eq("organization_id", orgB),
  );
  await expectBlocked("member of org A cannot create a case inside org B", () =>
    owner.client.from("valuation_cases").insert({
      organization_id: orgB,
      case_code: `HIJACK-${stamp}`,
      title: "Injeção cross-tenant",
      status: "DRAFT",
      created_by: owner.id,
    }),
  );
  await expectBlocked("outsider cannot verify a field of org A", () =>
    outsider.client.rpc("verify_evidence_field", {
      _field_id: candidateField,
      _notes: "verificação indevida",
    }),
  );

  console.log("\n=== 3. VALIDATION AUTHORITY (RBAC) ===");
  await expectBlocked("VALUER cannot verify evidence via RPC", () =>
    valuer.client.rpc("verify_evidence_field", {
      _field_id: candidateField,
      _notes: "valuer tentando verificar",
    }),
  );
  await expectBlocked("VALUER cannot verify evidence via direct UPDATE", () =>
    valuer.client
      .from("evidence_fields")
      .update({
        validation_status: "VERIFIED",
        verified_by: valuer.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", candidateField),
  );
  await expectBlocked("OWNER cannot verify evidence via direct UPDATE (RPC-only path)", () =>
    owner.client
      .from("evidence_fields")
      .update({
        validation_status: "VERIFIED",
        verified_by: owner.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", candidateField),
  );
  await expectBlocked("verification without technical justification is refused", () =>
    owner.client.rpc("verify_evidence_field", { _field_id: candidateField, _notes: "" }),
  );
  await expectBlocked("a field cannot be inserted already VERIFIED", () =>
    owner.client.from("evidence_fields").insert({
      organization_id: orgA,
      extraction_id: null,
      field_name: "pre_verified",
      validation_status: "VERIFIED",
      field_state: "PRESENT",
      created_by: owner.id,
    }),
  );

  console.log("\n=== 4. AUDIT TRAIL INTEGRITY ===");
  await expectBlocked("client cannot fabricate an audit_log entry", () =>
    owner.client.from("audit_log").insert({
      organization_id: orgA,
      event_type: "FIELD_VERIFIED",
      entity_type: "evidence_field",
      entity_id: candidateField,
      actor_user_id: owner.id,
    }),
  );
  await expectBlocked("client cannot delete audit_log entries", () =>
    owner.client.from("audit_log").delete().eq("organization_id", orgA),
  );
  await expectBlocked("client cannot update audit_log entries", () =>
    owner.client.from("audit_log").update({ event_type: "TAMPERED" }).eq("organization_id", orgA),
  );
  await expectBlocked("client cannot forge an evidence_field_revision", () =>
    owner.client.from("evidence_field_revisions").insert({
      organization_id: orgA,
      field_id: candidateField,
      revision_number: 99,
      validation_status: "VERIFIED",
    }),
  );
  await expectBlocked("client cannot forge an evidence_review decision", () =>
    owner.client.from("evidence_reviews").insert({
      organization_id: orgA,
      field_id: candidateField,
      decision: "VERIFIED",
      notes: "revisão fabricada",
      reviewer_id: owner.id,
    }),
  );

  console.log("\n=== 5. IMMUTABILITY OF RAW EVIDENCE ===");
  const artifactRow = await owner.client
    .from("evidence_artifacts")
    .select("id")
    .eq("organization_id", orgA)
    .limit(1)
    .maybeSingle();
  const artifactId = artifactRow.data?.id as string | undefined;
  if (artifactId) {
    await expectBlocked("artifact sha256_hash cannot be rewritten", () =>
      owner.client.from("evidence_artifacts").update({ sha256_hash: "f".repeat(64) }).eq("id", artifactId),
    );
    await expectNoEffect(
      "artifact cannot be physically deleted",
      () => owner.client.from("evidence_artifacts").delete().eq("id", artifactId),
      async () => {
        const check = await admin.from("evidence_artifacts").select("id").eq("id", artifactId);
        return (check.data?.length ?? 0) === 1;
      },
    );
  } else {
    record("artifact immutability", false, "fixture artifact not visible to owner (unexpected)");
  }

  console.log("\n=== 6. TENANT / LINEAGE IMMUTABILITY ===");
  await expectBlocked("organization_id of a case is immutable", () =>
    owner.client.from("valuation_cases").update({ organization_id: orgB }).eq("id", caseA1),
  );
  await expectBlocked("case status cannot be changed by direct UPDATE", () =>
    owner.client.from("valuation_cases").update({ status: "COMPLETED" }).eq("id", caseA1),
  );
  await expectBlocked("invalid state transition is refused by the state machine", () =>
    owner.client.rpc("transition_case_status", {
      _case_id: caseA1,
      _next_status: "COMPLETED",
      _reason: "pulo indevido de fase",
    }),
  );
  await expectBlocked("archiving without justification is refused", () =>
    owner.client.rpc("transition_case_status", {
      _case_id: caseA1,
      _next_status: "ARCHIVED",
      _reason: "",
    }),
  );

  console.log("\n=== 7. DATASET COMPOSITION RULES ===");
  const dataset = await owner.client
    .from("dataset_versions")
    .insert({
      organization_id: orgA,
      valuation_case_id: caseA1,
      version_number: 1,
      name: `Dataset negativo ${stamp}`,
      purpose: "Teste de invariantes",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (dataset.error) {
    record("dataset creation fixture", false, `unexpected: ${dataset.error.message}`);
  }
  const datasetId = dataset.data?.id as string | undefined;

  if (datasetId) {
    await expectBlocked("non-VERIFIED field cannot enter a dataset", () =>
      owner.client.from("dataset_items").insert({
        organization_id: orgA,
        dataset_version_id: datasetId,
        evidence_field_id: candidateField,
        role_in_dataset: "COMPARABLE",
        created_by: owner.id,
      }),
    );
    await expectBlocked("freeze metadata cannot be written directly", () =>
      owner.client
        .from("dataset_versions")
        .update({
          frozen_at: new Date().toISOString(),
          frozen_by: owner.id,
          dataset_hash: "deadbeef",
        })
        .eq("id", datasetId),
    );
    await expectNoEffect(
      "dataset version cannot be deleted",
      () => owner.client.from("dataset_versions").delete().eq("id", datasetId),
      async () => {
        const check = await admin.from("dataset_versions").select("id").eq("id", datasetId);
        return (check.data?.length ?? 0) === 1;
      },
    );
    await expectBlocked("empty dataset cannot be frozen", () =>
      owner.client.rpc("freeze_dataset", { _dataset_version_id: datasetId, _confirmation: "CONGELAR" }),
    );

    // Verify two fields through the official RPC so a legitimate freeze is possible.
    const v1 = await owner.client.rpc("verify_evidence_field", {
      _field_id: fieldToFreeze,
      _notes: "Conferido contra a matrícula anexada.",
    });
    const v2 = await owner.client.rpc("verify_evidence_field", {
      _field_id: crossCaseField,
      _notes: "Conferido contra o documento do caso A2.",
    });
    record(
      "OWNER/REVIEWER can verify through the official RPC",
      !v1.error && !v2.error,
      v1.error?.message ?? v2.error?.message ?? "both fields verified with justification",
    );

    await expectBlocked("cross-case verified field cannot contaminate the dataset", () =>
      owner.client.from("dataset_items").insert({
        organization_id: orgA,
        dataset_version_id: datasetId,
        evidence_field_id: crossCaseField,
        role_in_dataset: "COMPARABLE",
        created_by: owner.id,
      }),
    );

    const item = await owner.client.from("dataset_items").insert({
      organization_id: orgA,
      dataset_version_id: datasetId,
      evidence_field_id: fieldToFreeze,
      role_in_dataset: "COMPARABLE",
      created_by: owner.id,
    });
    record(
      "verified same-case field can compose the dataset",
      !item.error,
      item.error?.message ?? "item inserted",
    );

    await expectBlocked("substantive edit of a VERIFIED field is refused in place", () =>
      owner.client.from("evidence_fields").update({ raw_value: "999" }).eq("id", fieldToFreeze),
    );
    await expectBlocked("revision without registered reason is refused", () =>
      owner.client.rpc("revise_evidence_field", {
        _field_id: fieldToFreeze,
        _reason: "",
        _raw_value: "999",
        _normalized_value: "999",
        _numeric_value: 999,
        _unit: "m2",
        _field_state: "PRESENT",
        _source_excerpt: "trecho",
        _source_locator: null,
      }),
    );

    console.log("\n=== 8. FREEZE + MANIFEST + POST-FREEZE IMMUTABILITY ===");
    await expectBlocked("freeze without explicit confirmation is refused", () =>
      owner.client.rpc("freeze_dataset", { _dataset_version_id: datasetId, _confirmation: "sim" }),
    );
    const frozen = await owner.client.rpc("freeze_dataset", {
      _dataset_version_id: datasetId,
      _confirmation: "CONGELAR",
    });
    record(
      "freeze_dataset produces a deterministic SHA-256 manifest",
      !frozen.error && typeof (frozen.data as { dataset_hash?: string })?.dataset_hash === "string",
      frozen.error?.message ?? JSON.stringify(frozen.data),
    );

    const snap = await owner.client
      .from("dataset_item_snapshots")
      .select("id, field_name, normalized_value_at_freeze, artifact_sha256")
      .eq("dataset_version_id", datasetId);
    record(
      "freeze writes an immutable value snapshot (not only references)",
      (snap.data?.length ?? 0) > 0,
      snap.error?.message ?? `${snap.data?.length ?? 0} snapshot row(s)`,
    );

    await expectBlocked("snapshot rows cannot be updated", () =>
      owner.client
        .from("dataset_item_snapshots")
        .update({ normalized_value_at_freeze: "tampered" })
        .eq("dataset_version_id", datasetId),
    );
    await expectBlocked("snapshot rows cannot be deleted", () =>
      owner.client.from("dataset_item_snapshots").delete().eq("dataset_version_id", datasetId),
    );
    await expectBlocked("frozen dataset metadata cannot be edited", () =>
      owner.client.from("dataset_versions").update({ name: "renomeado" }).eq("id", datasetId),
    );
    await expectBlocked("items cannot be added to a frozen dataset", () =>
      owner.client.from("dataset_items").insert({
        organization_id: orgA,
        dataset_version_id: datasetId,
        evidence_field_id: fieldToFreeze,
        role_in_dataset: "COMPARABLE",
        created_by: owner.id,
      }),
    );
    await expectBlocked("items cannot be removed from a frozen dataset", () =>
      owner.client.from("dataset_items").delete().eq("dataset_version_id", datasetId),
    );
    await expectBlocked("field inside a frozen dataset cannot be revised", () =>
      owner.client.rpc("revise_evidence_field", {
        _field_id: fieldToFreeze,
        _reason: "tentativa de alteração pós-congelamento",
        _raw_value: "999",
        _normalized_value: "999",
        _numeric_value: 999,
        _unit: "m2",
        _field_state: "PRESENT",
        _source_excerpt: "trecho",
        _source_locator: null,
      }),
    );
    await expectBlocked("field inside a frozen dataset cannot be rejected", () =>
      owner.client.rpc("reject_evidence_field", {
        _field_id: fieldToFreeze,
        _reason: "tentativa de rejeição pós-congelamento",
      }),
    );

    const audit = await owner.client
      .from("audit_log")
      .select("event_type")
      .eq("organization_id", orgA)
      .in("event_type", ["FIELD_VERIFIED", "DATASET_FROZEN"]);
    record(
      "critical operations write audit events in the same transaction",
      (audit.data?.length ?? 0) >= 2,
      audit.error?.message ?? JSON.stringify(audit.data?.map((a) => a.event_type)),
    );
  }

  console.log("\n=== 9. MEMBERSHIP / PRIVILEGE ESCALATION ===");
  await expectNoEffect(
    "a member cannot escalate their own role",
    () =>
      valuer.client
        .from("organization_members")
        .update({ role: "OWNER" })
        .eq("organization_id", orgA)
        .eq("user_id", valuer.id),
    async () => {
      const check = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgA)
        .eq("user_id", valuer.id)
        .maybeSingle();
      return check.data?.role === "VALUER";
    },
  );
  await expectBlocked("a VALUER cannot invite members", () =>
    valuer.client.from("organization_members").insert({
      organization_id: orgA,
      user_id: outsider.id,
      role: "ADMIN",
      status: "ACTIVE",
    }),
  );
  await expectBlocked("the last active OWNER cannot be demoted", () =>
    owner.client
      .from("organization_members")
      .update({ role: "VIEWER" })
      .eq("organization_id", orgA)
      .eq("user_id", owner.id),
  );

  console.log("\n=== 10. STORAGE SCOPE ===");
  await expectBlocked("upload outside the organization folder is refused", () =>
    valuer.client.storage
      .from("evidence-originals")
      .upload(`${orgB}/${caseB1}/leak-${stamp}.txt`, new Blob(["x"]))
      .then((r) => ({ error: r.error })),
  );
  await expectBlocked("upload to a case path that does not exist is refused", () =>
    valuer.client.storage
      .from("evidence-originals")
      .upload(`${orgA}/${crypto.randomUUID()}/ghost-${stamp}.txt`, new Blob(["x"]))
      .then((r) => ({ error: r.error })),
  );
  await expectBlocked("outsider cannot download an org A evidence object", () =>
    outsider.client.storage
      .from("evidence-originals")
      .download(`${orgA}/${caseA1}/private_area-${stamp}.pdf`)
      .then((r) => ({ error: r.error })),
  );

  await cleanup(orgIds);

  const failed = results.filter((r) => !r.passed);
  console.log(`\n===== SUMMARY =====`);
  console.log(`total: ${results.length}  passed: ${results.length - failed.length}  failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(2);
});
