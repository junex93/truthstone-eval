/**
 * FUNCTIONAL + NEGATIVE FLOW TEST — PRIMARY SOURCE INGESTION GATE (fase 7C)
 *
 * Prova o fluxo:
 *   AUTHORIZED SOURCE → ARTIFACT → SHA-256 → SOURCE BINDING → CONTENT REVIEW
 *   → LOCATORS → HUMAN VERIFICATION → SOURCE READY FOR RULE REVIEW
 *
 * E prova, principalmente, o que NÃO acontece:
 *   A. fonte global METADATA_ONLY sem documento autorizado na organização não
 *      recebe verificação de conteúdo nem de localizador;
 *   B. documento enviado pela organização A jamais habilita a organização B;
 *   C. hash é do servidor: o cliente não escreve `sha256_hash` nem artefato;
 *   D. vínculo artefato↔fonte é append-only (sem UPDATE, sem DELETE);
 *   E. localizador não aceita artefato de outra fonte ou de outra organização;
 *   F. verificação de localizador exige verificação de conteúdo anterior;
 *   G. nenhuma regra, fórmula ou parâmetro de avaliação é criado nesta rodada.
 *
 * Todo conteúdo criado aqui é TEST_ONLY.
 *
 * Run with:  bun run tests/functional/methodology-source-ingestion.ts
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
  const email = `si-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Si!${stamp}${label}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  createdUserIds.push(data.user.id);
  const client: AnyClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);
  return { id: data.user.id, client };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const BUCKET = "methodology-sources";

async function main() {
  console.log("=== SETUP ===");
  const ownerA = await createUser("ownera");
  const valuerA = await createUser("valuera");
  const ownerB = await createUser("ownerb");

  const mkOrg = async (suffix: string, creator: string) => {
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name: `Source Ingestion Fixture ${suffix} ${stamp}`,
        slug: `si-fixture-${suffix}-${stamp}`,
        created_by: creator,
      })
      .select("id")
      .single();
    if (error) throw new Error(`org ${suffix}: ${error.message}`);
    return data.id as string;
  };
  const orgA = await mkOrg("a", ownerA.id);
  const orgB = await mkOrg("b", ownerB.id);

  const members = await admin.from("organization_members").insert([
    { organization_id: orgA, user_id: ownerA.id, role: "OWNER", status: "ACTIVE" },
    { organization_id: orgA, user_id: valuerA.id, role: "VALUER", status: "ACTIVE" },
    { organization_id: orgB, user_id: ownerB.id, role: "OWNER", status: "ACTIVE" },
  ]);
  if (members.error) throw new Error(`members: ${members.error.message}`);

  /* Fonte GLOBAL METADATA_ONLY: representa a norma cujo texto a plataforma não possui. */
  const { data: globalSource, error: gsError } = await admin
    .from("methodology_sources")
    .insert({
      organization_id: null,
      title: `TEST_ONLY Norma global de referência ${stamp}`,
      source_type: "TECHNICAL_STANDARD",
      jurisdiction: "BRAZIL",
      access_status: "METADATA_ONLY",
      authority_level: "PRIMARY_NORMATIVE",
      status: "ACTIVE",
      created_by: ownerA.id,
    })
    .select("id")
    .single();
  if (gsError) throw new Error(`global source: ${gsError.message}`);
  const globalSourceId = globalSource.id as string;

  /* Segunda fonte global, para provar que artefato não vaza entre fontes. */
  const { data: otherSource, error: osError } = await admin
    .from("methodology_sources")
    .insert({
      organization_id: null,
      title: `TEST_ONLY Norma global secundária ${stamp}`,
      source_type: "TECHNICAL_STANDARD",
      jurisdiction: "BRAZIL",
      access_status: "METADATA_ONLY",
      authority_level: "PRIMARY_NORMATIVE",
      status: "ACTIVE",
      created_by: ownerA.id,
    })
    .select("id")
    .single();
  if (osError) throw new Error(`other source: ${osError.message}`);
  const otherSourceId = otherSource.id as string;

  console.log("\n=== A. GATE ANTES DE QUALQUER DOCUMENTO ===");
  {
    const r = await ownerA.client.rpc("methodology_source_readiness", {
      _source_id: globalSourceId,
    });
    expectOk("A1 readiness legível pela organização", r.error);
    const state = (r.data as any)?.state;
    expectTrue(
      "A2 estado inicial é BLOCKED_BY_USER_ARTIFACT",
      state === "BLOCKED_BY_USER_ARTIFACT",
      `state=${state}`,
    );
    expectTrue(
      "A3 base de acesso da organização é nula",
      (r.data as any)?.organization_access_basis === null,
      `basis=${(r.data as any)?.organization_access_basis}`,
    );
    expectTrue(
      "A4 citação com localizador não é permitida",
      (r.data as any)?.locator_backed_claims_allowed === false,
      "locator_backed_claims_allowed=false",
    );
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "CONTENT_VERIFIED",
      _notes: "TEST_ONLY tentativa sem documento autorizado",
    });
    expectFail("A5 verificação de conteúdo sem documento é recusada", r.error);
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "LOCATOR_VERIFIED",
      _notes: "TEST_ONLY sem localizador",
    });
    expectFail("A6 verificação de localizador sem localizador é recusada", r.error);
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "METADATA_VERIFIED",
      _notes: "TEST_ONLY metadados conferidos",
    });
    expectOk("A7 verificação de METADADOS é permitida sem documento", r.error);
  }

  console.log("\n=== B. INGESTÃO DO DOCUMENTO AUTORIZADO ===");
  const fileBytes = new TextEncoder().encode(
    `TEST_ONLY conteúdo de documento normativo simulado ${stamp}`,
  );
  const expectedHash = await sha256Hex(fileBytes.buffer as ArrayBuffer);
  const pathA = `${orgA}/${globalSourceId}/${stamp}-norma.txt`;

  {
    const up = await ownerA.client.storage
      .from(BUCKET)
      .upload(pathA, new Blob([fileBytes]), { contentType: "text/plain" });
    expectOk("B1 upload no caminho canônico da organização", up.error);
  }
  {
    const up = await ownerB.client.storage
      .from(BUCKET)
      .upload(`${orgA}/${globalSourceId}/${stamp}-invasao.txt`, new Blob([fileBytes]));
    expectFail("B2 upload em pasta de outra organização é recusado", up.error);
  }
  {
    const dl = await ownerB.client.storage.from(BUCKET).download(pathA);
    expectFail("B3 leitura do documento por outra organização é recusada", dl.error);
  }
  {
    const dl = await ownerA.client.storage.from(BUCKET).download(pathA);
    expectOk("B4 leitura do documento pela própria organização", dl.error);
    if (dl.data) {
      const hash = await sha256Hex(await dl.data.arrayBuffer());
      expectTrue("B5 hash do servidor confere com os bytes armazenados", hash === expectedHash, hash);
    }
  }

  /* O artefato é gravado pelo fluxo de servidor (admin), nunca pelo cliente. */
  {
    const attempt = await ownerA.client.from("evidence_artifacts").insert({
      organization_id: orgA,
      evidence_source_id: globalSourceId,
      storage_bucket: BUCKET,
      storage_path: pathA,
      file_name: "cliente.txt",
      sha256_hash: "0".repeat(64),
      hash_computed_by: "CLIENT",
      created_by: ownerA.id,
    });
    expectFail("B6 cliente não grava artefato com hash próprio", attempt.error);
  }

  const { data: libSource, error: libError } = await admin
    .from("evidence_sources")
    .insert({
      organization_id: orgA,
      valuation_case_id: null,
      source_type: "PRIVATE_DOCUMENT",
      source_name: "Biblioteca metodológica — documentos autorizados",
      notes: "TEST_ONLY biblioteca metodológica",
      created_by: ownerA.id,
    })
    .select("id")
    .single();
  if (libError) throw new Error(`library source: ${libError.message}`);
  expectTrue(
    "B7 biblioteca metodológica existe sem vínculo a caso",
    !!libSource.id,
    "valuation_case_id = null",
  );

  const mkArtifact = async (org: string, creator: string, path: string) => {
    const { data, error } = await admin
      .from("evidence_artifacts")
      .insert({
        organization_id: org,
        evidence_source_id: libSource.id,
        storage_bucket: BUCKET,
        storage_path: path,
        file_name: "norma.txt",
        mime_type: "text/plain",
        file_size: fileBytes.byteLength,
        sha256_hash: expectedHash,
        hash_computed_by: "SERVER",
        created_by: creator,
      })
      .select("id")
      .single();
    if (error) throw new Error(`artifact: ${error.message}`);
    return data.id as string;
  };
  const artifactA = await mkArtifact(orgA, ownerA.id, pathA);

  {
    const link = await ownerA.client
      .from("methodology_source_artifacts")
      .insert({
        organization_id: orgA,
        source_id: globalSourceId,
        evidence_artifact_id: artifactA,
        access_basis: "METADATA_ONLY",
        notes: "TEST_ONLY base ilegítima",
        created_by: ownerA.id,
      })
      .select("id")
      .single();
    expectFail("B8 METADATA_ONLY não é base de acesso de documento", link.error);
  }

  let linkId = "";
  {
    const link = await ownerA.client
      .from("methodology_source_artifacts")
      .insert({
        organization_id: orgA,
        source_id: globalSourceId,
        evidence_artifact_id: artifactA,
        access_basis: "USER_PROVIDED_COPY",
        notes: "TEST_ONLY exemplar fornecido pela organização",
        created_by: ownerA.id,
      })
      .select("id")
      .single();
    expectOk("B9 vínculo documento↔fonte registrado", link.error);
    linkId = link.data?.id ?? "";
  }
  {
    const upd = await ownerA.client
      .from("methodology_source_artifacts")
      .update({ access_basis: "LICENSED_COPY" })
      .eq("id", linkId);
    expectFail("B10 vínculo não aceita UPDATE (append-only)", upd.error);
  }
  {
    const del = await ownerA.client.from("methodology_source_artifacts").delete().eq("id", linkId);
    expectFail("B11 vínculo não aceita DELETE", del.error);
  }
  {
    const read = await ownerB.client
      .from("methodology_source_artifacts")
      .select("id")
      .eq("id", linkId);
    expectTrue(
      "B12 outra organização não lê o vínculo do documento",
      !read.error && (read.data ?? []).length === 0,
      `rows=${(read.data ?? []).length}`,
    );
  }

  console.log("\n=== C. ISOLAMENTO: FONTE GLOBAL NÃO É LIBERADA PARA TODOS ===");
  {
    const r = await ownerB.client.rpc("methodology_source_readiness", {
      _source_id: globalSourceId,
    });
    expectOk("C1 organização B lê o próprio diagnóstico", r.error);
    expectTrue(
      "C2 organização B permanece bloqueada",
      (r.data as any)?.state === "BLOCKED_BY_USER_ARTIFACT",
      `state=${(r.data as any)?.state}`,
    );
  }
  {
    const r = await ownerB.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "CONTENT_VERIFIED",
      _notes: "TEST_ONLY tentativa de aproveitar documento de terceiro",
    });
    expectFail("C3 documento da organização A não habilita a organização B", r.error);
  }
  {
    const r = await admin.rpc("methodology_source_org_access_basis", {
      _source_id: globalSourceId,
      _org: orgB,
    });
    expectTrue(
      "C4 base de acesso da organização B é nula",
      !r.error && r.data === null,
      `basis=${r.data}`,
    );
  }

  console.log("\n=== D. LOCALIZADORES E LINHAGEM ===");
  {
    // Trecho literal exige CONTENT_VERIFIED humano (gate da Fase 7E).
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "CONTENT_VERIFIED",
      _notes: "TEST_ONLY conteúdo conferido contra o documento autorizado da organização A",
    });
    expectOk("D0 conteúdo verificado por revisor da organização A", r.error);
  }
  let locatorId = "";

  {
    const loc = await ownerA.client
      .from("methodology_source_locators")
      .insert({
        organization_id: orgA,
        source_id: globalSourceId,
        locator_type: "SECTION",
        section: "TEST_ONLY 7.1",
        support_excerpt: "TEST_ONLY trecho mínimo transcrito para conferência",
        artifact_id: artifactA,
        created_by: ownerA.id,
      })
      .select("id")
      .single();
    expectOk("D1 localizador com documento de apoio", loc.error);
    locatorId = loc.data?.id ?? "";
  }
  {
    const loc = await ownerA.client.from("methodology_source_locators").insert({
      organization_id: orgA,
      source_id: otherSourceId,
      locator_type: "SECTION",
      section: "TEST_ONLY cruzado",
      artifact_id: artifactA,
      created_by: ownerA.id,
    });
    expectFail("D2 documento de outra fonte não sustenta localizador", loc.error);
  }
  {
    const loc = await ownerB.client.from("methodology_source_locators").insert({
      organization_id: orgB,
      source_id: globalSourceId,
      locator_type: "SECTION",
      section: "TEST_ONLY invasão",
      artifact_id: artifactA,
      created_by: ownerB.id,
    });
    expectFail("D3 documento de outra organização não sustenta localizador", loc.error);
  }

  console.log("\n=== E. VERIFICAÇÃO HUMANA E PRONTIDÃO ===");
  {
    const r = await valuerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "CONTENT_VERIFIED",
      _notes: "TEST_ONLY VALUER tentando verificar",
    });
    expectFail("E1 VALUER não verifica fonte (separação de funções)", r.error);
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "LOCATOR_VERIFIED",
      _locator_id: locatorId,
      _notes: "TEST_ONLY localizador antes do conteúdo",
    });
    expectFail("E2 localizador verificado exige conteúdo verificado antes", r.error);
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "CONTENT_VERIFIED",
      _notes: "TEST_ONLY conteúdo conferido contra o documento autorizado",
    });
    expectOk("E3 conteúdo verificado com documento autorizado", r.error);
  }
  {
    const r = await ownerA.client.rpc("verify_methodology_source", {
      _source_id: globalSourceId,
      _verification_type: "LOCATOR_VERIFIED",
      _locator_id: locatorId,
      _notes: "TEST_ONLY localizador conferido",
    });
    expectOk("E4 localizador verificado após conteúdo", r.error);
  }
  {
    const r = await ownerA.client.rpc("methodology_source_readiness", {
      _source_id: globalSourceId,
    });
    expectOk("E5 readiness recalculado", r.error);
    const report = r.data as any;
    expectTrue(
      "E6 estado final é SOURCE_READY_FOR_RULE_REVIEW",
      report?.state === "SOURCE_READY_FOR_RULE_REVIEW",
      `state=${report?.state}`,
    );
    expectTrue(
      "E7 citação com localizador liberada",
      report?.locator_backed_claims_allowed === true,
      "locator_backed_claims_allowed=true",
    );
    expectTrue("E8 nenhum bloqueio restante", (report?.blockers ?? []).length === 0, "blockers=[]");
    expectTrue(
      "E9 fonte global permanece METADATA_ONLY no registro global",
      report?.global_access_status === "METADATA_ONLY",
      `global_access_status=${report?.global_access_status}`,
    );
  }
  {
    const verifs = await admin
      .from("methodology_source_verifications")
      .select("verified_by, organization_id, verification_type")
      .eq("source_id", globalSourceId);
    const allOwner = (verifs.data ?? []).every(
      (v: any) => v.verified_by === ownerA.id && v.organization_id === orgA,
    );
    expectTrue(
      "E10 autoria e organização vêm do token, não do payload",
      !verifs.error && allOwner,
      `registros=${(verifs.data ?? []).length}`,
    );
  }
  {
    const audit = await admin
      .from("audit_log")
      .select("event_type")
      .eq("entity_id", globalSourceId)
      .eq("organization_id", orgA);
    const types = new Set((audit.data ?? []).map((r: any) => r.event_type));
    expectTrue(
      "E11 auditoria registra metadados, conteúdo e localizador",
      types.has("METHODOLOGY_SOURCE_METADATA_VERIFIED") &&
        types.has("METHODOLOGY_SOURCE_CONTENT_VERIFIED") &&
        types.has("METHODOLOGY_SOURCE_LOCATOR_VERIFIED"),
      Array.from(types).join(", "),
    );
  }

  console.log("\n=== F. NENHUMA METODOLOGIA MATEMÁTICA FOI CRIADA ===");
  {
    const params = await admin.from("methodology_parameters").select("id, default_value, min_value, max_value");
    if (params.error) throw new Error(`methodology_parameters: ${params.error.message}`);
    const numeric = (params.data ?? []).filter(
      (r: any) => r.default_value !== null || r.min_value !== null || r.max_value !== null,
    );
    expectTrue(
      "F1 nenhum parâmetro numérico de produção existe",
      numeric.length === 0,
      `parâmetros numéricos=${numeric.length}`,
    );
  }
  {
    const specs = await admin
      .from("method_specifications")
      .select("status")
      .eq("id", "33333333-0000-4000-8000-000000000001")
      .maybeSingle();
    expectTrue(
      "F2 especificação MCDDM permanece não aprovada",
      !specs.error && specs.data?.status !== "APPROVED",
      `status=${specs.data?.status}`,
    );
  }

  console.log("\n=== CLEANUP ===");
  await admin.storage.from(BUCKET).remove([pathA]);
  await admin.from("methodology_sources").delete().is("organization_id", null).ilike("title", "TEST_ONLY%");
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n=== RESULT: ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length > 0) {
    for (const f of failed) console.log(`FAIL  ${f.name} — ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
