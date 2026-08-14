/**
 * FUNCTIONAL + NEGATIVE FLOW TEST — CLAIM GATE DE FONTE PRIMÁRIA (fase 7E)
 *
 * Prova o caminho legítimo:
 *   DOCUMENTO AUTORIZADO → METADATA_VERIFIED → CONTENT_VERIFIED → LOCATOR
 *   → LOCATOR_VERIFIED → CLAIM CANDIDATA → ACEITE POR OUTRO REVISOR
 *   → TEMA DO MAPA SATISFEITO
 *
 * E prova o que NÃO acontece:
 *   A. trecho literal em localizador sem CONTENT_VERIFIED;
 *   B. claim candidata sem CONTENT_VERIFIED, sem base de acesso, ou em
 *      especificação que não está em DRAFT;
 *   C. claim com localizador de outra fonte;
 *   D. claim numérica sem payload numérico declarado;
 *   E. aceite sem LOCATOR_VERIFIED;
 *   F. aceite pelo próprio propositor (separação de funções);
 *   G. tema satisfeito por claim não aceita, ou por escrita direta na tabela;
 *   H. claim e decisão são append-only (sem UPDATE, sem DELETE);
 *   I. organização vizinha não lê nem decide nada disso.
 *
 * Todo conteúdo criado aqui é TEST_ONLY.
 *
 * Run with:  bun run tests/functional/methodology-claim-gate.ts
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
const BUCKET = "methodology-sources";

async function createUser(label: string) {
  const email = `cg-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Cg!${stamp}${label}Aa1`;
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

async function main() {
  console.log("=== SETUP ===");
  const owner = await createUser("owner");
  const valuer = await createUser("valuer");
  const reviewer = await createUser("reviewer");
  const outsider = await createUser("outsider");

  const mkOrg = async (suffix: string, creator: string) => {
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name: `Claim Gate Fixture ${suffix} ${stamp}`,
        slug: `cg-fixture-${suffix}-${stamp}`,
        created_by: creator,
      })
      .select("id")
      .single();
    if (error) throw new Error(`org ${suffix}: ${error.message}`);
    return data.id as string;
  };
  const orgA = await mkOrg("a", owner.id);
  const orgB = await mkOrg("b", outsider.id);

  const members = await admin.from("organization_members").insert([
    { organization_id: orgA, user_id: owner.id, role: "OWNER", status: "ACTIVE" },
    { organization_id: orgA, user_id: valuer.id, role: "VALUER", status: "ACTIVE" },
    { organization_id: orgA, user_id: reviewer.id, role: "REVIEWER", status: "ACTIVE" },
    { organization_id: orgB, user_id: outsider.id, role: "OWNER", status: "ACTIVE" },
  ]);
  if (members.error) throw new Error(`members: ${members.error.message}`);

  /* Fonte global (norma) e uma segunda fonte, para provar linhagem de localizador. */
  const mkSource = async (label: string) => {
    const { data, error } = await admin
      .from("methodology_sources")
      .insert({
        organization_id: null,
        title: `TEST_ONLY Norma ${label} ${stamp}`,
        source_type: "TECHNICAL_STANDARD",
        jurisdiction: "BRAZIL",
        access_status: "METADATA_ONLY",
        authority_level: "PRIMARY_NORMATIVE",
        status: "ACTIVE",
        created_by: owner.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`source ${label}: ${error.message}`);
    return data.id as string;
  };
  const sourceId = await mkSource("principal");
  const otherSourceId = await mkSource("secundaria");

  /* Especificações da organização: uma DRAFT (alvo) e uma UNDER_REVIEW (recusa). */
  const method = await admin
    .from("valuation_methods")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (method.error || !method.data) throw new Error("nenhum método de avaliação disponível");

  const mkSpec = async (version: string, status: string) => {
    const { data, error } = await admin
      .from("method_specifications")
      .insert({
        organization_id: orgA,
        valuation_method_id: method.data!.id,
        version,
        title: `TEST_ONLY Especificação ${version} ${stamp}`,
        jurisdiction: "BRAZIL",
        status,
        created_by: owner.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`spec ${version}: ${error.message}`);
    return data.id as string;
  };
  const specDraft = await mkSpec(`cg-draft-${stamp}`, "DRAFT");

  const mkRequirement = async (spec: string, code: string) => {
    const { data, error } = await admin
      .from("method_specification_source_requirements")
      .insert({
        organization_id: orgA,
        method_specification_id: spec,
        requirement_code: code,
        description: `TEST_ONLY tema ${code}`,
        is_satisfied: false,
        created_by: owner.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`requirement ${code}: ${error.message}`);
    return data.id as string;
  };
  const reqDraft = await mkRequirement(specDraft, "T07_SAMPLE_REQUIREMENTS");

  console.log("\n=== A. ANTES DO DOCUMENTO AUTORIZADO ===");
  {
    const r = await valuer.client
      .from("methodology_source_locators")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_type: "CLAUSE",
        clause: "B.2.2",
        support_excerpt: "TEST_ONLY trecho literal sem conteúdo verificado",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("A1 trecho literal sem CONTENT_VERIFIED é recusado", r.error);
  }
  let locatorNoExcerpt = "";
  {
    const r = await valuer.client
      .from("methodology_source_locators")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_type: "CLAUSE",
        clause: "B.2.2",
        notes: "TEST_ONLY localizador sem citação",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectOk("A2 localizador sem citação é permitido (endereço não é conteúdo)", r.error);
    locatorNoExcerpt = r.data?.id ?? "";
  }
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_id: locator,
        method_specification_id: specDraft,
        requirement_code: `T99_INEXISTENTE_${stamp}`,
        claim_code: `CG-NOTOPIC-${stamp}`,
        claim_kind: "NORMATIVE_TEXT",
        statement: "TEST_ONLY tema fora do mapa",
        verbatim_excerpt: "TEST_ONLY trecho",
        extraction_method: "HUMAN_READING",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("C4 claim com tema fora do mapa de requisitos é recusada", r.error);
  }
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_id: locator,
        method_specification_id: specDraft,
        requirement_code: "T07_SAMPLE_REQUIREMENTS",
        claim_code: `CG-NONUM-${stamp}`,
        claim_kind: "NUMERIC_NORMATIVE_CANDIDATE",
        statement: "TEST_ONLY número sem payload declarado",
        verbatim_excerpt: "TEST_ONLY entre 0,50 e 2,00",
        extraction_method: "OCR_ASSISTED",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("C5 claim numérica sem payload numérico é recusada", r.error);
  }
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_id: locator,
        method_specification_id: specDraft,
        requirement_code: "T07_SAMPLE_REQUIREMENTS",
        claim_code: `CG-NOEXCERPT-${stamp}`,
        claim_kind: "NORMATIVE_TEXT",
        statement: "TEST_ONLY afirmação sem trecho literal",
        extraction_method: "HUMAN_READING",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("C6 claim de conteúdo sem trecho literal é recusada", r.error);
  }
  let claimId = "";
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_id: locator,
        method_specification_id: specDraft,
        requirement_code: "T07_SAMPLE_REQUIREMENTS",
        claim_code: `CG-OK-${stamp}`,
        claim_kind: "NUMERIC_NORMATIVE_CANDIDATE",
        statement: "TEST_ONLY intervalo admissível por fator individual",
        verbatim_excerpt: "TEST_ONLY cada fator contido entre 0,50 e 2,00",
        numeric_payload: { lower_bound: 0.5, upper_bound: 2, status: "CANDIDATE" },
        extraction_method: "OCR_ASSISTED",
        reviewer_alerts: ["TEST_ONLY OCR exige conferência humana"],
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectOk("C7 claim candidata registrada após o gate completo", r.error);
    claimId = r.data?.id ?? "";
  }
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .update({ statement: "TEST_ONLY reescrita" })
      .eq("id", claimId);
    expectFail("C8 claim não aceita UPDATE (append-only)", r.error);
  }
  {
    const r = await valuer.client.from("methodology_source_claims").delete().eq("id", claimId);
    expectFail("C9 claim não aceita DELETE", r.error);
  }
  {
    const r = await valuer.client
      .from("methodology_source_claims")
      .insert({
        organization_id: orgA,
        source_id: sourceId,
        locator_id: locator,
        method_specification_id: specDraft,
        requirement_code: "T07_SAMPLE_REQUIREMENTS",
        claim_code: `CG-OK-${stamp}`,
        claim_kind: "NORMATIVE_TEXT",
        statement: "TEST_ONLY código duplicado",
        verbatim_excerpt: "TEST_ONLY trecho",
        extraction_method: "HUMAN_READING",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("C10 código de claim duplicado na mesma especificação é recusado", r.error);
  }

  console.log("\n=== D. DECISÃO HUMANA ===");
  {
    const r = await reviewer.client.rpc("review_methodology_claim", {
      _claim_id: claimId,
      _decision: "ACCEPTED",
      _justification: "curto",
    });
    expectFail("D1 aceite sem justificativa suficiente é recusado", r.error);
  }
  {
    const r = await reviewer.client.rpc("review_methodology_claim", {
      _claim_id: claimId,
      _decision: "ACCEPTED",
      _justification: "TEST_ONLY conferido, mas localizador ainda não verificado.",
    });
    expectFail("D2 aceite sem LOCATOR_VERIFIED é recusado", r.error);
  }
  {
    const r = await reviewer.client.rpc("verify_methodology_source", {
      _source_id: sourceId,
      _verification_type: "LOCATOR_VERIFIED",
      _locator_id: locator,
      _notes: "TEST_ONLY cláusula conferida contra o documento",
    });
    expectOk("D3 LOCATOR_VERIFIED registrada por revisor", r.error);
  }
  {
    const r = await valuer.client.rpc("review_methodology_claim", {
      _claim_id: claimId,
      _decision: "ACCEPTED",
      _justification: "TEST_ONLY tentativa de aceite pelo próprio propositor.",
    });
    expectFail("D4 papel produtor não decide sobre claim", r.error);
  }
  {
    const r = await outsider.client.rpc("review_methodology_claim", {
      _claim_id: claimId,
      _decision: "ACCEPTED",
      _justification: "TEST_ONLY tentativa de aceite por outra organização.",
    });
    expectFail("D5 organização vizinha não decide sobre claim", r.error);
  }
  {
    const r = await reviewer.client.rpc("review_methodology_claim", {
      _claim_id: claimId,
      _decision: "ACCEPTED",
      _justification: "TEST_ONLY trecho e números conferidos célula a célula no exemplar.",
    });
    expectOk("D6 aceite por revisor distinto, com localizador verificado", r.error);
  }
  {
    const r = await reviewer.client
      .from("methodology_claim_reviews")
      .insert({
        organization_id: orgA,
        claim_id: claimId,
        decision: "ACCEPTED",
        justification: "TEST_ONLY escrita direta na tabela de decisões",
        reviewer_id: reviewer.id,
      })
      .select("id")
      .single();
    expectFail("D7 decisão não entra por escrita direta na tabela", r.error);
  }
  {
    const audit = await admin
      .from("audit_log")
      .select("id")
      .eq("organization_id", orgA)
      .eq("event_type", "METHODOLOGY_CLAIM_REVIEWED")
      .eq("entity_id", claimId);
    expectTrue(
      "D8 aceite gravou evento de auditoria na mesma transação",
      !audit.error && (audit.data?.length ?? 0) === 1,
      `eventos=${audit.data?.length ?? 0}`,
    );
  }

  console.log("\n=== E. CONFRONTO COM REGRA E SATISFAÇÃO DO TEMA ===");
  {
    const r = await valuer.client
      .from("methodology_claim_rule_assessments")
      .insert({
        organization_id: orgA,
        claim_id: claimId,
        rule_id: null,
        assessment: "SUPPORTS_EXISTING_RULE",
        rationale: "TEST_ONLY avaliação sobre regra sem informar a regra.",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectFail("E1 avaliação de regra existente sem rule_id é recusada", r.error);
  }
  {
    const r = await valuer.client
      .from("methodology_claim_rule_assessments")
      .insert({
        organization_id: orgA,
        claim_id: claimId,
        rule_id: null,
        assessment: "NEEDS_NEW_RULE",
        proposed_relationship: "DIRECT_REQUIREMENT",
        proposed_normative_strength: "MANDATORY",
        rationale: "TEST_ONLY proposta de nova regra derivada da claim aceita.",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    expectOk("E2 proposta de nova regra registrada como proposta", r.error);
  }
  {
    const rules = await admin
      .from("methodology_rules")
      .select("id")
      .eq("method_specification_id", specDraft);
    expectTrue(
      "E3 proposta não criou regra automaticamente",
      !rules.error && (rules.data?.length ?? 0) === 0,
      `regras=${rules.data?.length ?? 0}`,
    );
  }
  {
    const r = await reviewer.client
      .from("method_specification_source_requirements")
      .update({ is_satisfied: true })
      .eq("id", reqDraft);
    const after = await admin
      .from("method_specification_source_requirements")
      .select("is_satisfied")
      .eq("id", reqDraft)
      .maybeSingle();
    expectTrue(
      "E4 tema não fica satisfeito por escrita direta do cliente",
      after.data?.is_satisfied === false,
      `is_satisfied=${after.data?.is_satisfied} (erro=${r.error ? "sim" : "não"})`,
    );
  }
  {
    const r = await reviewer.client.rpc("satisfy_specification_requirement", {
      _requirement_id: reqDraft,
      _claim_id: claimId,
      _justification: "TEST_ONLY tema coberto pela claim aceita e localizador verificado.",
    });
    expectOk("E5 tema satisfeito pela operação oficial", r.error);
    const after = await admin
      .from("method_specification_source_requirements")
      .select("is_satisfied, satisfied_by_source_id")
      .eq("id", reqDraft)
      .maybeSingle();
    expectTrue(
      "E6 tema registra a fonte que o satisfez",
      after.data?.is_satisfied === true && after.data?.satisfied_by_source_id === sourceId,
      `is_satisfied=${after.data?.is_satisfied}`,
    );
  }
  {
    const r = await reviewer.client.rpc("methodology_claim_dossier", {
      _specification_id: specDraft,
    });
    expectOk("E7 dossiê de claims legível", r.error);
    const row = (r.data as any)?.requirements?.find(
      (x: any) => x.requirement_code === "T07_SAMPLE_REQUIREMENTS",
    );
    expectTrue(
      "E8 dossiê conta claim aceita sem pendência",
      row?.claims_total === 1 && row?.claims_accepted === 1 && row?.claims_pending === 0,
      JSON.stringify(row ?? {}),
    );
  }

  console.log("\n=== F. ISOLAMENTO E AUSÊNCIA DE CÁLCULO ===");
  {
    const r = await outsider.client
      .from("methodology_source_claims")
      .select("id")
      .eq("id", claimId);
    expectTrue(
      "F1 organização vizinha não lê claim alheia",
      !r.error && (r.data?.length ?? 0) === 0,
      `linhas=${r.data?.length ?? 0}`,
    );
  }
  {
    const r = await outsider.client.rpc("methodology_claim_dossier", {
      _specification_id: specDraft,
    });
    expectFail("F2 dossiê de especificação alheia é recusado", r.error);
  }
  {
    const anon: AnyClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const r = await anon.from("methodology_source_claims").select("id").limit(1);
    expectTrue(
      "F3 anônimo não lê claims",
      !!r.error || (r.data?.length ?? 0) === 0,
      r.error ? `recusado: ${r.error.message.slice(0, 120)}` : "nenhuma linha",
    );
  }
  {
    const formulas = await admin
      .from("methodology_formulas")
      .select("id")
      .eq("method_specification_id", specDraft);
    expectTrue(
      "F4 nenhuma fórmula foi criada nesta rodada",
      !formulas.error && (formulas.data?.length ?? 0) === 0,
      `fórmulas=${formulas.data?.length ?? 0}`,
    );
  }
  {
    const spec = await admin
      .from("method_specifications")
      .select("status")
      .eq("id", "33333333-0000-4000-8000-000000000001")
      .maybeSingle();
    expectTrue(
      "F5 especificação MCDDM real permanece não aprovada",
      !spec.error && spec.data?.status !== "APPROVED",
      `status=${spec.data?.status}`,
    );
  }

  console.log("\n=== CLEANUP ===");
  await admin.storage.from(BUCKET).remove([path]);
  await admin.from("methodology_claim_rule_assessments").delete().eq("organization_id", orgA);
  await admin.from("methodology_claim_reviews").delete().eq("organization_id", orgA);
  await admin.from("methodology_source_claims").delete().eq("organization_id", orgA);
  await admin.from("methodology_source_locators").delete().eq("organization_id", orgA);
  await admin.from("methodology_source_verifications").delete().eq("organization_id", orgA);
  await admin.from("methodology_source_artifacts").delete().eq("organization_id", orgA);
  await admin.from("method_specification_source_requirements").delete().eq("organization_id", orgA);
  await admin.from("method_specifications").delete().eq("organization_id", orgA);
  await admin.from("methodology_sources").delete().in("id", [sourceId, otherSourceId]);
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
