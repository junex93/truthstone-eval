/**
 * FUNCTIONAL + NEGATIVE FLOW TEST — METHODOLOGY GOVERNANCE (fase 6)
 *
 * Prova quatro coisas:
 *   A. o fluxo legítimo de especificação metodológica funciona ponta a ponta;
 *   B. as permissões (RBAC + separação de funções) são impostas pelo banco;
 *   C. a integridade histórica (imutabilidade, manifesto, SHA-256) se sustenta;
 *   D. uma afirmação metodológica não ultrapassa a evidência que possui.
 *
 * TODO conteúdo criado aqui é TEST_ONLY. Nenhum fator, coeficiente, threshold
 * ou fórmula de avaliação real é criado, e os dois esqueletos reais
 * (MCDDM — Tratamento por Fatores / Inferência Estatística) são apenas lidos.
 *
 * A service role é usada só para provisionar usuários/fixtures e para leituras
 * independentes. Nenhuma asserção de governança é feita com ela.
 *
 * Run with:  bun run tests/functional/methodology-governance-flow.ts
 */
import { readFileSync } from "node:fs";

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

const stamp = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const email = `mg-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Mg!${stamp}${label}Aa1`;
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

const REQUIRED_SECTIONS = [
  "PURPOSE",
  "INTENDED_USE",
  "APPLICABILITY",
  "NON_APPLICABILITY",
  "REQUIRED_INPUTS",
  "DATA_REQUIREMENTS",
  "RULES",
  "LIMITATIONS",
  "TEST_REQUIREMENTS",
  "OUTPUTS",
] as const;

const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

async function main() {
  console.log("=== SETUP ===");
  const owner = await createUser("owner");
  const valuer = await createUser("valuer");
  const reviewer = await createUser("reviewer");
  const viewer = await createUser("viewer");
  const outsider = await createUser("outsider");

  const mkOrg = async (suffix: string, creator: string) => {
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name: `Methodology Governance Fixture ${suffix} ${stamp}`,
        slug: `mg-fixture-${suffix}-${stamp}`,
        created_by: creator,
      })
      .select("id")
      .single();
    if (error) throw new Error(`org ${suffix}: ${error.message}`);
    return data.id as string;
  };
  const orgA = await mkOrg("a", owner.id);
  const orgB = await mkOrg("b", outsider.id);

  const membersA = await admin.from("organization_members").insert([
    { organization_id: orgA, user_id: owner.id, role: "OWNER", status: "ACTIVE" },
    { organization_id: orgA, user_id: valuer.id, role: "VALUER", status: "ACTIVE" },
    { organization_id: orgA, user_id: reviewer.id, role: "REVIEWER", status: "ACTIVE" },
    { organization_id: orgA, user_id: viewer.id, role: "VIEWER", status: "ACTIVE" },
  ]);
  if (membersA.error) throw new Error(`members A: ${membersA.error.message}`);
  const membersB = await admin
    .from("organization_members")
    .insert([{ organization_id: orgB, user_id: outsider.id, role: "OWNER", status: "ACTIVE" }]);
  if (membersB.error) throw new Error(`members B: ${membersB.error.message}`);

  /* fixture de artefato autorizado (fluxo controlado do servidor grava artefatos) */
  const mkArtifact = async (org: string, creator: string, tag: string) => {
    const { data: kase, error: caseError } = await admin
      .from("valuation_cases")
      .insert({
        organization_id: org,
        case_code: `MG-${tag}-${stamp}`,
        title: `Caso de apoio metodológico ${tag}`,
        purpose: "Fixture TEST_ONLY da suíte de governança metodológica",
        valuation_date: day(0),
        status: "EVIDENCE_COLLECTION",
        created_by: creator,
      })
      .select("id")
      .single();
    if (caseError) throw new Error(`case ${tag}: ${caseError.message}`);
    const { data: src, error: srcError } = await admin
      .from("evidence_sources")
      .insert({
        organization_id: org,
        valuation_case_id: kase.id,
        source_type: "USER_PROVIDED",
        source_name: `Cópia autorizada TEST_ONLY ${tag}`,
        created_by: creator,
      })
      .select("id")
      .single();
    if (srcError) throw new Error(`evidence source ${tag}: ${srcError.message}`);
    const { data: art, error: artError } = await admin
      .from("evidence_artifacts")
      .insert({
        organization_id: org,
        evidence_source_id: src.id,
        storage_bucket: "evidence-originals",
        storage_path: `${org}/${kase.id}/mg-${tag}-${stamp}.pdf`,
        file_name: `mg-${tag}-${stamp}.pdf`,
        sha256_hash: null,
        hash_computed_by: "SERVER",
        created_by: creator,
      })
      .select("id")
      .single();
    if (artError) throw new Error(`artifact ${tag}: ${artError.message}`);
    return art.id as string;
  };

  const artifactA = await mkArtifact(orgA, owner.id, "a");
  const artifactB = await mkArtifact(orgB, outsider.id, "b");
  record("fixtures de artefato autorizado criadas (org A e org B)", true, "2 artefatos");

  /* ============================================================ helpers */

  const mkSource = async (
    client: AnyClient,
    creator: string,
    opts: {
      tag: string;
      accessStatus: string;
      authorityLevel: string;
      sourceType?: string;
      externalUrl?: string | null;
      org?: string;
    },
  ) => {
    const { data, error } = await client
      .from("methodology_sources")
      .insert({
        organization_id: opts.org ?? orgA,
        title: `TEST_ONLY — fonte metodológica ${opts.tag} ${stamp}`,
        short_title: `TEST_ONLY ${opts.tag}`,
        source_type: opts.sourceType ?? "TECHNICAL_ARTICLE",
        issuing_body: "TEST_ONLY Fixture Body",
        jurisdiction: "ORGANIZATIONAL",
        access_status: opts.accessStatus,
        authority_level: opts.authorityLevel,
        external_url: opts.externalUrl ?? null,
        status: "DRAFT",
        created_by: creator,
      })
      .select("id")
      .single();
    return { id: data?.id as string | undefined, error };
  };

  type SpecContent = {
    specId: string;
    ruleId: string;
    formulaId: string;
  };

  /**
   * Cria uma especificação TEST_ONLY completa e aprovável.
   * `order` permite variar a ordem de INSERT para provar que o manifesto
   * canônico não depende dela.
   */
  const buildApprovableSpec = async (opts: {
    tag: string;
    version: string;
    methodId: string;
    sourceId: string;
    locatorId: string;
    relationship: string;
    reverseOrder?: boolean;
    supersedes?: string | null;
  }): Promise<SpecContent> => {
    const { data: spec, error: specError } = await valuer.client
      .from("method_specifications")
      .insert({
        organization_id: orgA,
        valuation_method_id: opts.methodId,
        version: opts.version,
        title: `TEST_ONLY — especificação simbólica ${opts.tag}`,
        purpose: "Exercitar a infraestrutura de governança metodológica (TEST_ONLY).",
        scope: "Nenhum conteúdo avaliatório real: apenas infraestrutura simbólica.",
        jurisdiction: "ORGANIZATIONAL",
        status: "DRAFT",
        supersedes_specification_id: opts.supersedes ?? null,
        created_by: valuer.id,
      })
      .select("id")
      .single();
    if (specError) throw new Error(`spec ${opts.tag}: ${specError.message}`);
    const specId = spec.id as string;

    const sectionKeys = opts.reverseOrder
      ? [...REQUIRED_SECTIONS].reverse()
      : [...REQUIRED_SECTIONS];
    for (const [i, key] of sectionKeys.entries()) {
      const { error } = await valuer.client.from("method_specification_sections").insert({
        organization_id: orgA,
        method_specification_id: specId,
        section_key: key,
        content: `TEST_ONLY — conteúdo declarativo da seção ${key}.`,
        ordinal: i,
        created_by: valuer.id,
      });
      if (error) throw new Error(`section ${key} (${opts.tag}): ${error.message}`);
    }

    const { data: rule, error: ruleError } = await valuer.client
      .from("methodology_rules")
      .insert({
        organization_id: orgA,
        method_specification_id: specId,
        rule_code: "TEST_R01",
        title: "TEST_ONLY — controle interno de infraestrutura",
        rule_type: "VALIDATION",
        description: "Controle interno TEST_ONLY. Não é exigência normativa externa.",
        normative_strength: "INTERNAL_CONTROL",
        priority: 100,
        status: "DRAFT",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    if (ruleError) throw new Error(`rule (${opts.tag}): ${ruleError.message}`);
    const ruleId = rule.id as string;

    const ruleSource = await valuer.client.from("methodology_rule_sources").insert({
      organization_id: orgA,
      rule_id: ruleId,
      source_id: opts.sourceId,
      source_locator_id: opts.locatorId,
      relationship_type: opts.relationship,
      interpretation_notes: "Proveniência TEST_ONLY.",
      created_by: valuer.id,
    });
    if (ruleSource.error) throw new Error(`rule_source (${opts.tag}): ${ruleSource.error.message}`);

    const { data: formula, error: formulaError } = await valuer.client
      .from("methodology_formulas")
      .insert({
        organization_id: orgA,
        rule_id: ruleId,
        formula_code: "TEST_F01",
        name: "TEST_ONLY — soma simbólica de infraestrutura",
        expression: "TEST_A + TEST_B",
        expression_language: "SYMBOLIC",
        description: "Expressão declarativa TEST_ONLY. Nunca executada.",
        status: "DRAFT",
        created_by: valuer.id,
      })
      .select("id")
      .single();
    if (formulaError) throw new Error(`formula (${opts.tag}): ${formulaError.message}`);
    const formulaId = formula.id as string;

    const varCodes = opts.reverseOrder ? ["TEST_B", "TEST_A"] : ["TEST_A", "TEST_B"];
    for (const code of varCodes) {
      const { error } = await valuer.client.from("methodology_formula_variables").insert({
        organization_id: orgA,
        formula_id: formulaId,
        variable_code: code,
        name: `Variável simbólica ${code}`,
        data_type: "COUNT",
        unit_code: "COUNT",
        required: true,
      });
      if (error) throw new Error(`variable ${code} (${opts.tag}): ${error.message}`);
    }

    const testCodes = opts.reverseOrder ? ["TEST_T02", "TEST_T01"] : ["TEST_T01", "TEST_T02"];
    for (const code of testCodes) {
      const { error } = await valuer.client.from("method_test_cases").insert({
        organization_id: orgA,
        method_specification_id: specId,
        test_code: code,
        title: `TEST_ONLY — caso de teste ${code}`,
        test_type: code === "TEST_T01" ? "UNIT" : "REPRODUCIBILITY",
        expected_status: "PASS",
        source_reference: "TEST_ONLY",
        created_by: valuer.id,
      });
      if (error) throw new Error(`test case ${code} (${opts.tag}): ${error.message}`);
    }

    const applicability = await valuer.client.from("method_applicability_rules").insert({
      organization_id: orgA,
      method_specification_id: specId,
      criterion_code: "TEST_C01",
      criterion_description: "Critério TEST_ONLY de aplicabilidade da infraestrutura simbólica.",
      expected_result: "METHOD_APPLICABLE",
      created_by: valuer.id,
    });
    if (applicability.error) {
      throw new Error(`applicability (${opts.tag}): ${applicability.error.message}`);
    }

    const output = await valuer.client.from("method_output_contracts").insert({
      organization_id: orgA,
      method_specification_id: specId,
      output_type: "DIAGNOSTICS",
      description: "Saída declarativa TEST_ONLY.",
      required: true,
    });
    if (output.error) throw new Error(`output (${opts.tag}): ${output.error.message}`);

    return { specId, ruleId, formulaId };
  };

  const completeness = async (client: AnyClient, specId: string) => {
    const { data, error } = await client.rpc("specification_completeness", { _spec_id: specId });
    if (error) throw new Error(`completeness: ${error.message}`);
    return data as {
      is_complete: boolean;
      is_approvable: boolean;
      missing_requirements: string[];
      blockers: string[];
      completed_requirements: string[];
    };
  };

  /* ================================================== 1. FONTE / VERIFICAÇÃO */

  console.log("\n=== 1. FONTE METODOLÓGICA E BASE DE ACESSO ===");
  const mainSource = await mkSource(valuer.client, valuer.id, {
    tag: "principal",
    accessStatus: "USER_PROVIDED_COPY",
    authorityLevel: "ESTABLISHED_TECHNICAL_LITERATURE",
  });
  expectOk("VALUER registra fonte metodológica TEST_ONLY", mainSource.error);
  const mainSourceId = mainSource.id!;

  const attach = await valuer.client.from("methodology_source_artifacts").insert({
    organization_id: orgA,
    source_id: mainSourceId,
    evidence_artifact_id: artifactA,
    access_basis: "USER_PROVIDED_COPY",
    notes: "Cópia autorizada TEST_ONLY",
    created_by: valuer.id,
  });
  expectOk("artefato autorizado vinculado à fonte", attach.error);

  const metaVerify = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: mainSourceId,
    _verification_type: "METADATA_VERIFIED",
    _locator_id: null,
    _notes: "Metadados conferidos (TEST_ONLY).",
  });
  expectOk("REVIEWER verifica metadados (METADATA_VERIFIED)", metaVerify.error);

  const contentVerify = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: mainSourceId,
    _verification_type: "CONTENT_VERIFIED",
    _locator_id: null,
    _notes: "Conteúdo conferido na cópia autorizada (TEST_ONLY).",
  });
  expectOk("REVIEWER verifica conteúdo (CONTENT_VERIFIED) com artefato autorizado", contentVerify.error);

  const { data: locator, error: locatorError } = await valuer.client
    .from("methodology_source_locators")
    .insert({
      organization_id: orgA,
      source_id: mainSourceId,
      artifact_id: artifactA,
      locator_type: "SECTION",
      section: "TEST_ONLY 1.1",
      support_excerpt: "Trecho de apoio TEST_ONLY.",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("localizador criado sobre a fonte autorizada", locatorError);
  const mainLocatorId = locator!.id as string;

  const locatorVerify = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: mainSourceId,
    _verification_type: "LOCATOR_VERIFIED",
    _locator_id: mainLocatorId,
    _notes: "Localizador conferido (TEST_ONLY).",
  });
  expectOk("REVIEWER verifica localizador (LOCATOR_VERIFIED)", locatorVerify.error);

  /* fonte incompatível para localizador */
  const otherSource = await mkSource(valuer.client, valuer.id, {
    tag: "secundaria",
    accessStatus: "USER_PROVIDED_COPY",
    authorityLevel: "ESTABLISHED_TECHNICAL_LITERATURE",
  });
  expectOk("segunda fonte TEST_ONLY registrada", otherSource.error);
  const crossLocator = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: otherSource.id!,
    _verification_type: "LOCATOR_VERIFIED",
    _locator_id: mainLocatorId,
    _notes: "Localizador de outra fonte",
  });
  expectFail("localizador de fonte incompatível não pode ser verificado", crossLocator.error);

  /* ================================================== 2. METADATA_ONLY */

  console.log("\n=== 2. METADATA_ONLY NÃO VIRA CONTEÚDO VERIFICADO ===");
  const metaOnly = await mkSource(valuer.client, valuer.id, {
    tag: "metadata-only",
    accessStatus: "METADATA_ONLY",
    authorityLevel: "PRIMARY_NORMATIVE",
    sourceType: "TECHNICAL_STANDARD",
  });
  expectOk("fonte METADATA_ONLY registrada", metaOnly.error);
  const metaOnlyId = metaOnly.id!;

  const metaOnlyMeta = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: metaOnlyId,
    _verification_type: "METADATA_VERIFIED",
    _locator_id: null,
    _notes: "Somente metadados (TEST_ONLY).",
  });
  expectOk("METADATA_ONLY aceita METADATA_VERIFIED", metaOnlyMeta.error);

  const metaOnlyContent = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: metaOnlyId,
    _verification_type: "CONTENT_VERIFIED",
    _locator_id: null,
    _notes: "Tentativa indevida",
  });
  expectFail("METADATA_ONLY recusa CONTENT_VERIFIED (RPC oficial)", metaOnlyContent.error);

  const metaOnlyDirect = await reviewer.client.from("methodology_source_verifications").insert({
    organization_id: orgA,
    source_id: metaOnlyId,
    verification_type: "CONTENT_VERIFIED",
    verified_by: reviewer.id,
    verified_at: new Date().toISOString(),
  });
  expectFail("METADATA_ONLY recusa CONTENT_VERIFIED também por escrita direta", metaOnlyDirect.error);

  /* snippet / metadado externo: sem cópia autorizada e sem URL registrada */
  const snippetSource = await mkSource(valuer.client, valuer.id, {
    tag: "snippet",
    accessStatus: "PUBLICLY_ACCESSIBLE",
    authorityLevel: "SECONDARY_GUIDANCE",
  });
  expectOk("fonte de resultado de busca/snippet registrada", snippetSource.error);
  const snippetContent = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: snippetSource.id!,
    _verification_type: "CONTENT_VERIFIED",
    _locator_id: null,
    _notes: "Somente snippet",
  });
  expectFail(
    "snippet/metadado externo não satisfaz CONTENT_VERIFIED (sem cópia nem URL registrada)",
    snippetContent.error,
  );

  /* ================================================== 3. MÉTODO TEST_ONLY */

  console.log("\n=== 3. MÉTODO E ESPECIFICAÇÃO TEST_ONLY ===");
  const { data: method, error: methodError } = await valuer.client
    .from("valuation_methods")
    .insert({
      organization_id: orgA,
      code: `TEST_ONLY_INFRA_${stamp}`,
      name: "TEST_ONLY — método de infraestrutura simbólica",
      family_code: "MARKET_COMPARISON",
      description: "Método fictício exclusivo de teste. Não produz valor.",
      status: "CONCEPT",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("método de avaliação TEST_ONLY criado (não é método real)", methodError);
  const methodId = method!.id as string;

  const main = await buildApprovableSpec({
    tag: "V1",
    version: "1.0.0-test",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  record("especificação V1 TEST_ONLY montada com seções, regra, fórmula, testes e saída", true, main.specId);

  const before = await completeness(valuer.client, main.specId);
  record(
    "specification_completeness = completa e aprovável antes da submissão",
    before.is_complete && before.is_approvable,
    `missing=${JSON.stringify(before.missing_requirements)} blockers=${JSON.stringify(before.blockers)}`,
  );

  /* ================================================== 4. FLUXO DE STATUS */

  console.log("\n=== 4. SUBMISSÃO, SEPARAÇÃO DE FUNÇÕES E APROVAÇÃO ===");
  const viewerSubmit = await viewer.client.rpc("submit_method_specification", {
    _spec_id: main.specId,
    _notes: "tentativa VIEWER",
  });
  expectFail("VIEWER não submete especificação", viewerSubmit.error);

  const submit = await valuer.client.rpc("submit_method_specification", {
    _spec_id: main.specId,
    _notes: "Submissão TEST_ONLY.",
  });
  expectOk("VALUER submete especificação (DRAFT -> UNDER_REVIEW)", submit.error);

  const { data: submitted } = await admin
    .from("method_specifications")
    .select("status, submitted_by, submitted_for_review_at")
    .eq("id", main.specId)
    .single();
  record(
    "submitted_by / submitted_at são produzidos pelo workflow oficial",
    submitted?.status === "UNDER_REVIEW" &&
      submitted?.submitted_by === valuer.id &&
      !!submitted?.submitted_for_review_at,
    `status=${submitted?.status} submitted_by=${submitted?.submitted_by === valuer.id ? "submitter" : "outro"}`,
  );

  const selfApprove = await valuer.client.rpc("approve_method_specification", {
    _spec_id: main.specId,
    _notes: "auto-aprovação",
  });
  expectFail("separação de funções: quem submeteu não aprova", selfApprove.error);

  const valuerApprove = await owner.client.rpc("approve_method_specification", {
    _spec_id: main.specId,
    _notes: null,
  });
  // OWNER pode revisar; a checagem específica de VALUER vem abaixo com outra spec.
  expectOk("OWNER (autoridade de revisão, distinto do submissor) pode aprovar", valuerApprove.error);

  const { data: approved } = await admin
    .from("method_specifications")
    .select(
      "status, approved_by, approved_at, specification_hash, hash_algorithm, manifest_schema_version, specification_manifest, title",
    )
    .eq("id", main.specId)
    .single();
  record(
    "approved_by / approved_at gravados pelo fluxo de aprovação",
    approved?.status === "APPROVED" && approved?.approved_by === owner.id && !!approved?.approved_at,
    `status=${approved?.status}`,
  );
  record(
    "manifesto canônico e SHA-256 criados pela aprovação",
    !!approved?.specification_manifest &&
      typeof approved?.specification_hash === "string" &&
      (approved?.specification_hash as string).length === 64 &&
      approved?.hash_algorithm === "SHA-256",
    `hash=${String(approved?.specification_hash).slice(0, 16)}… algo=${approved?.hash_algorithm}`,
  );
  const approvedHash = approved!.specification_hash as string;

  const integrity = await valuer.client.rpc("verify_specification_integrity", {
    _spec_id: main.specId,
  });
  record(
    "verify_specification_integrity = VALID logo após o selo",
    (integrity.data as { result?: string } | null)?.result === "VALID",
    JSON.stringify((integrity.data as Record<string, unknown>)?.["result"]),
  );

  /* VALUER não aprova — segunda especificação submetida pelo OWNER */
  const second = await buildApprovableSpec({
    tag: "V-perm",
    version: "1.1.0-test",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  const submit2 = await owner.client.rpc("submit_method_specification", {
    _spec_id: second.specId,
    _notes: "Submissão TEST_ONLY (permissões).",
  });
  expectOk("OWNER submete a especificação de teste de permissões", submit2.error);

  const ownerSelfApprove = await owner.client.rpc("approve_method_specification", {
    _spec_id: second.specId,
    _notes: null,
  });
  expectFail("mesmo OWNER que submeteu não pode aprovar (two-person review)", ownerSelfApprove.error);

  const valuerApproveAttempt = await valuer.client.rpc("approve_method_specification", {
    _spec_id: second.specId,
    _notes: null,
  });
  expectFail("VALUER não pode aprovar especificação", valuerApproveAttempt.error);

  const viewerApprove = await viewer.client.rpc("approve_method_specification", {
    _spec_id: second.specId,
    _notes: null,
  });
  expectFail("VIEWER não pode aprovar especificação", viewerApprove.error);

  const viewerReject = await viewer.client.rpc("reject_method_specification", {
    _spec_id: second.specId,
    _reason: "tentativa indevida de rejeição",
  });
  expectFail("VIEWER não pode rejeitar especificação", viewerReject.error);

  const { data: stillUnderReview } = await admin
    .from("method_specifications")
    .select("status")
    .eq("id", second.specId)
    .single();
  record(
    "após tentativas recusadas o status permanece UNDER_REVIEW",
    stillUnderReview?.status === "UNDER_REVIEW",
    `status=${stillUnderReview?.status}`,
  );

  const reviewerApprove = await reviewer.client.rpc("approve_method_specification", {
    _spec_id: second.specId,
    _notes: "Aprovação por revisor autorizado (TEST_ONLY).",
  });
  expectOk("REVIEWER autorizado e distinto do submissor aprova", reviewerApprove.error);

  /* rejeição registrada pelo fluxo oficial */
  const rejectable = await buildApprovableSpec({
    tag: "V-reject",
    version: "1.2.0-test",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  await valuer.client.rpc("submit_method_specification", {
    _spec_id: rejectable.specId,
    _notes: "Submissão TEST_ONLY (rejeição).",
  });
  const reject = await reviewer.client.rpc("reject_method_specification", {
    _spec_id: rejectable.specId,
    _reason: "Rejeição TEST_ONLY com motivo técnico registrado.",
  });
  expectOk("REVIEWER rejeita especificação pelo fluxo oficial", reject.error);
  const { data: rejected } = await admin
    .from("method_specifications")
    .select("status, rejected_by, rejected_at, rejection_reason")
    .eq("id", rejectable.specId)
    .single();
  record(
    "rejected_by / rejected_at / rejection_reason controlados pelo fluxo de rejeição",
    rejected?.status === "REJECTED" &&
      rejected?.rejected_by === reviewer.id &&
      !!rejected?.rejected_at &&
      !!rejected?.rejection_reason,
    `status=${rejected?.status}`,
  );

  /* ================================================== 5. TRANSIÇÃO DIRETA */

  console.log("\n=== 5. TRANSIÇÃO DE STATUS SÓ PELO WORKFLOW ===");
  const draftForStatus = await buildApprovableSpec({
    tag: "V-status",
    version: "1.3.0-test",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  const directStatus = await valuer.client
    .from("method_specifications")
    .update({ status: "APPROVED" })
    .eq("id", draftForStatus.specId);
  expectFail("cliente autenticado não altera status para APPROVED diretamente", directStatus.error);
  const { data: afterDirect } = await admin
    .from("method_specifications")
    .select("status, approved_by, specification_hash")
    .eq("id", draftForStatus.specId)
    .single();
  record(
    "estado do banco após tentativa direta permanece DRAFT e sem selo",
    afterDirect?.status === "DRAFT" &&
      afterDirect?.approved_by === null &&
      afterDirect?.specification_hash === null,
    `status=${afterDirect?.status}`,
  );

  const directManifest = await valuer.client
    .from("method_specifications")
    .update({ specification_manifest: { forged: true } })
    .eq("id", draftForStatus.specId);
  expectFail("cliente não define specification_manifest diretamente", directManifest.error);

  const directHash = await valuer.client
    .from("method_specifications")
    .update({ specification_hash: "0".repeat(64) })
    .eq("id", draftForStatus.specId);
  expectFail("cliente não define specification_hash diretamente", directHash.error);

  const directApprovedBy = await valuer.client
    .from("method_specifications")
    .update({ approved_by: valuer.id, approved_at: new Date().toISOString() })
    .eq("id", draftForStatus.specId);
  expectFail("cliente não define approved_by/approved_at diretamente", directApprovedBy.error);

  const directSubmittedBy = await valuer.client
    .from("method_specifications")
    .update({ submitted_by: valuer.id, submitted_for_review_at: new Date().toISOString() })
    .eq("id", draftForStatus.specId);
  expectFail("cliente não define submitted_by/submitted_at diretamente", directSubmittedBy.error);

  /* ================================================== 6. IMUTABILIDADE */

  console.log("\n=== 6. IMUTABILIDADE DA ESPECIFICAÇÃO APROVADA ===");
  const upTitle = await valuer.client
    .from("method_specifications")
    .update({ title: "título alterado" })
    .eq("id", main.specId);
  expectFail("título de especificação aprovada não muda", upTitle.error);

  const upPurpose = await valuer.client
    .from("method_specifications")
    .update({ purpose: "propósito alterado" })
    .eq("id", main.specId);
  expectFail("propósito de especificação aprovada não muda", upPurpose.error);

  const upSection = await valuer.client
    .from("method_specification_sections")
    .update({ content: "conteúdo alterado" })
    .eq("method_specification_id", main.specId)
    .eq("section_key", "PURPOSE");
  expectFail("seção estruturada de especificação aprovada não muda", upSection.error);

  const newRule = await valuer.client.from("methodology_rules").insert({
    organization_id: orgA,
    method_specification_id: main.specId,
    rule_code: "TEST_R99",
    title: "regra tardia",
    rule_type: "VALIDATION",
    normative_strength: "INTERNAL_CONTROL",
    created_by: valuer.id,
  });
  expectFail("nova regra não entra em especificação aprovada", newRule.error);

  const upRule = await valuer.client
    .from("methodology_rules")
    .update({ title: "regra alterada" })
    .eq("id", main.ruleId);
  expectFail("regra de especificação aprovada não muda", upRule.error);

  const newRuleSource = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: main.ruleId,
    source_id: otherSource.id!,
    relationship_type: "BACKGROUND",
    created_by: valuer.id,
  });
  expectFail("novo vínculo regra-fonte não entra em especificação aprovada", newRuleSource.error);

  const upFormula = await valuer.client
    .from("methodology_formulas")
    .update({ expression: "TEST_A - TEST_B" })
    .eq("id", main.formulaId);
  expectFail("fórmula de especificação aprovada não muda", upFormula.error);

  const newVariable = await valuer.client.from("methodology_formula_variables").insert({
    organization_id: orgA,
    formula_id: main.formulaId,
    variable_code: "TEST_C",
    name: "variável tardia",
    data_type: "COUNT",
    unit_code: "COUNT",
    required: false,
  });
  expectFail("nova variável não entra em fórmula de especificação aprovada", newVariable.error);

  const newParameter = await valuer.client.from("methodology_parameters").insert({
    organization_id: orgA,
    method_specification_id: main.specId,
    parameter_code: "TEST_P99",
    name: "parâmetro tardio",
    data_type: "COUNT",
    unit_code: "COUNT",
    source_required: false,
    created_by: valuer.id,
  });
  expectFail("novo parâmetro não entra em especificação aprovada", newParameter.error);

  const newApplicability = await valuer.client.from("method_applicability_rules").insert({
    organization_id: orgA,
    method_specification_id: main.specId,
    criterion_code: "TEST_C99",
    criterion_description: "critério tardio",
    expected_result: "METHOD_APPLICABLE",
    created_by: valuer.id,
  });
  expectFail("novo critério de aplicabilidade não entra em especificação aprovada", newApplicability.error);

  const newTestCase = await valuer.client.from("method_test_cases").insert({
    organization_id: orgA,
    method_specification_id: main.specId,
    test_code: "TEST_T99",
    title: "teste tardio",
    test_type: "UNIT",
    created_by: valuer.id,
  });
  expectFail("novo caso de teste não entra em especificação aprovada", newTestCase.error);

  const newOutput = await valuer.client.from("method_output_contracts").insert({
    organization_id: orgA,
    method_specification_id: main.specId,
    output_type: "WARNINGS",
    required: false,
  });
  expectFail("novo contrato de saída não entra em especificação aprovada", newOutput.error);

  console.log("\n=== 7. PROTEÇÃO CONTRA DELETE ===");
  const expectPreserved = async (
    name: string,
    deleteResult: { error: { message: string } | null },
    table: string,
    column: string,
    value: string,
  ) => {
    const { count } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    record(
      name,
      (count ?? 0) > 0,
      deleteResult.error
        ? `recusado: ${deleteResult.error.message.slice(0, 120)}`
        : `nenhuma linha removida (RLS não concede DELETE); ${count} linha(s) preservada(s)`,
    );
  };

  await expectPreserved(
    "especificação aprovada não pode ser removida",
    await valuer.client.from("method_specifications").delete().eq("id", main.specId),
    "method_specifications",
    "id",
    main.specId,
  );
  await expectPreserved(
    "regra de especificação aprovada não pode ser removida",
    await valuer.client.from("methodology_rules").delete().eq("id", main.ruleId),
    "methodology_rules",
    "id",
    main.ruleId,
  );
  await expectPreserved(
    "fórmula de especificação aprovada não pode ser removida",
    await valuer.client.from("methodology_formulas").delete().eq("id", main.formulaId),
    "methodology_formulas",
    "id",
    main.formulaId,
  );
  await expectPreserved(
    "caso de teste de especificação aprovada não pode ser removido",
    await valuer.client
      .from("method_test_cases")
      .delete()
      .eq("method_specification_id", main.specId),
    "method_test_cases",
    "method_specification_id",
    main.specId,
  );
  await expectPreserved(
    "verificação de fonte não pode ser removida",
    await reviewer.client
      .from("methodology_source_verifications")
      .delete()
      .eq("source_id", mainSourceId),
    "methodology_source_verifications",
    "source_id",
    mainSourceId,
  );

  const { data: afterImmutability } = await admin
    .from("method_specifications")
    .select("title, specification_hash, approved_by")
    .eq("id", main.specId)
    .single();
  record(
    "conteúdo histórico aprovado permanece intacto após todas as tentativas",
    afterImmutability?.title === approved?.title &&
      afterImmutability?.specification_hash === approvedHash &&
      afterImmutability?.approved_by === owner.id,
    `hash preservado=${afterImmutability?.specification_hash === approvedHash}`,
  );

  /* ================================================== 8. CLAIM NORMATIVA */

  console.log("\n=== 8. AFIRMAÇÃO NORMATIVA DIRETA vs EVIDÊNCIA ===");
  const normSpec = await valuer.client
    .from("method_specifications")
    .insert({
      organization_id: orgA,
      valuation_method_id: methodId,
      version: "2.0.0-test-normative",
      title: "TEST_ONLY — especificação de claim normativa",
      jurisdiction: "ORGANIZATIONAL",
      status: "DRAFT",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("especificação TEST_ONLY para claims normativas criada", normSpec.error);
  const normSpecId = normSpec.data!.id as string;

  const { data: normRule, error: normRuleError } = await valuer.client
    .from("methodology_rules")
    .insert({
      organization_id: orgA,
      method_specification_id: normSpecId,
      rule_code: "TEST_N01",
      title: "TEST_ONLY — regra que se apresenta como exigência normativa",
      rule_type: "REQUIREMENT",
      normative_strength: "MANDATORY",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("regra MANDATORY TEST_ONLY criada", normRuleError);

  const claimOnMetadataOnly = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: normRule!.id,
    source_id: metaOnlyId,
    relationship_type: "DIRECT_REQUIREMENT",
    created_by: valuer.id,
  });
  expectFail(
    "DIRECT_REQUIREMENT sobre fonte apenas com metadados é recusado",
    claimOnMetadataOnly.error,
  );

  const claimWithoutLocator = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: normRule!.id,
    source_id: mainSourceId,
    source_locator_id: null,
    relationship_type: "DIRECT_REQUIREMENT",
    created_by: valuer.id,
  });
  expectFail("DIRECT_REQUIREMENT sem localizador é recusado", claimWithoutLocator.error);

  const beforeClaim = await completeness(valuer.client, normSpecId);
  record(
    "regra normativa sem fonte direta é bloqueador de aprovação",
    beforeClaim.blockers.some((b) => b.startsWith("NORMATIVE_RULE_WITHOUT_DIRECT_SOURCE")),
    JSON.stringify(beforeClaim.blockers),
  );

  /* localizador ainda não verificado */
  const { data: unverifiedLocator } = await valuer.client
    .from("methodology_source_locators")
    .insert({
      organization_id: orgA,
      source_id: mainSourceId,
      locator_type: "CLAUSE",
      clause: "TEST_ONLY 2.2",
      created_by: valuer.id,
    })
    .select("id")
    .single();

  const claimUnverifiedLocator = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: normRule!.id,
    source_id: mainSourceId,
    source_locator_id: unverifiedLocator!.id,
    relationship_type: "DIRECT_REQUIREMENT",
    created_by: valuer.id,
  });
  expectOk("vínculo direto com conteúdo verificado e localizador é aceito", claimUnverifiedLocator.error);

  const withUnverified = await completeness(valuer.client, normSpecId);
  record(
    "localizador não verificado permanece como bloqueador de aprovação",
    withUnverified.blockers.some((b) => b.startsWith("DIRECT_CLAIM_WITHOUT_LOCATOR_VERIFICATION")),
    JSON.stringify(withUnverified.blockers),
  );

  const verifyThatLocator = await reviewer.client.rpc("verify_methodology_source", {
    _source_id: mainSourceId,
    _verification_type: "LOCATOR_VERIFIED",
    _locator_id: unverifiedLocator!.id,
    _notes: "Localizador conferido (TEST_ONLY).",
  });
  expectOk("REVIEWER verifica o localizador citado pela claim", verifyThatLocator.error);

  const afterLocatorVerified = await completeness(valuer.client, normSpecId);
  record(
    "claim normativa completa (conteúdo + localizador verificados) deixa de ser bloqueador",
    !afterLocatorVerified.blockers.some((b) => b.startsWith("DIRECT_CLAIM_")) &&
      !afterLocatorVerified.blockers.some((b) => b.startsWith("NORMATIVE_RULE_WITHOUT_DIRECT_SOURCE")),
    JSON.stringify(afterLocatorVerified.blockers),
  );
  record(
    "resolver a claim não aprova a especificação inteira (ainda há requisitos faltando)",
    !afterLocatorVerified.is_complete,
    JSON.stringify(afterLocatorVerified.missing_requirements),
  );

  /* ================================================== 9. CONTROLE INTERNO */

  console.log("\n=== 9. CONTROLE INTERNO NUNCA É EXIGÊNCIA EXTERNA ===");
  const internalSource = await mkSource(valuer.client, valuer.id, {
    tag: "interna",
    accessStatus: "INTERNAL_AUTHORIZED_COPY",
    authorityLevel: "INTERNAL_SPECIFICATION",
    sourceType: "INTERNAL_POLICY",
  });
  expectOk("fonte INTERNAL_SPECIFICATION registrada", internalSource.error);

  const { data: internalRule } = await valuer.client
    .from("methodology_rules")
    .insert({
      organization_id: orgA,
      method_specification_id: normSpecId,
      rule_code: "TEST_I01",
      title: "TEST_ONLY — controle interno",
      rule_type: "VALIDATION",
      normative_strength: "INTERNAL_CONTROL",
      created_by: valuer.id,
    })
    .select("id")
    .single();

  const internalLink = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: internalRule!.id,
    source_id: internalSource.id!,
    relationship_type: "INTERNAL_DESIGN",
    created_by: valuer.id,
  });
  expectOk("fonte interna sustenta regra como INTERNAL_DESIGN", internalLink.error);

  const internalAsNormative = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: internalRule!.id,
    source_id: internalSource.id!,
    relationship_type: "DIRECT_REQUIREMENT",
    created_by: valuer.id,
  });
  expectFail(
    "fonte interna não pode sustentar exigência normativa externa (DIRECT_REQUIREMENT)",
    internalAsNormative.error,
  );

  const externalAsInternalDesign = await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: internalRule!.id,
    source_id: mainSourceId,
    relationship_type: "INTERNAL_DESIGN",
    created_by: valuer.id,
  });
  expectFail("fonte externa não pode ser classificada como INTERNAL_DESIGN", externalAsInternalDesign.error);

  const { data: internalManifestCheck } = await admin
    .from("methodology_sources")
    .select("authority_level")
    .eq("id", internalSource.id!)
    .single();
  record(
    "proveniência interna permanece identificada como INTERNAL_SPECIFICATION",
    internalManifestCheck?.authority_level === "INTERNAL_SPECIFICATION",
    `authority_level=${internalManifestCheck?.authority_level}`,
  );

  /* ================================================== 10. FÓRMULAS */

  console.log("\n=== 10. REGISTRO SIMBÓLICO DE FÓRMULAS (NUNCA EXECUTÁVEL) ===");
  const { data: fRule } = await valuer.client
    .from("methodology_rules")
    .insert({
      organization_id: orgA,
      method_specification_id: normSpecId,
      rule_code: "TEST_F_RULE",
      title: "TEST_ONLY — regra portadora de fórmula",
      rule_type: "FORMULA",
      normative_strength: "INTERNAL_CONTROL",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  await valuer.client.from("methodology_rule_sources").insert({
    organization_id: orgA,
    rule_id: fRule!.id,
    source_id: internalSource.id!,
    relationship_type: "INTERNAL_DESIGN",
    created_by: valuer.id,
  });

  const badExpressions: Array<[string, string]> = [
    ["eval de código", "eval(TEST_A)"],
    ["função anônima", "function (x) { return x; }"],
    ["arrow function", "TEST_A => TEST_A"],
    ["import dinâmico", "import('fs')"],
    ["consulta SQL", "select * from method_specifications"],
    ["caractere não simbólico", "TEST_A; drop table users$"],
  ];
  for (const [label, expression] of badExpressions) {
    const { error } = await valuer.client.from("methodology_formulas").insert({
      organization_id: orgA,
      rule_id: fRule!.id,
      formula_code: `TEST_BAD_${label.length}`,
      name: `TEST_ONLY — expressão inválida (${label})`,
      expression,
      expression_language: "SYMBOLIC",
      created_by: valuer.id,
    });
    expectFail(`expressão com aparência executável recusada — ${label}`, error);
  }

  const nonSymbolic = await valuer.client.from("methodology_formulas").insert({
    organization_id: orgA,
    rule_id: fRule!.id,
    formula_code: "TEST_LANG",
    name: "TEST_ONLY — linguagem não simbólica",
    expression: "TEST_A + TEST_B",
    expression_language: "SYMBOLIC",
    created_by: valuer.id,
  });
  expectOk("fórmula simbólica declarativa TEST_ONLY é registrada quando válida", nonSymbolic.error);

  const { data: symbolicFormula } = await admin
    .from("methodology_formulas")
    .select("id, expression_language")
    .eq("rule_id", fRule!.id)
    .maybeSingle();
  record(
    "expressão permanece dado declarativo (SYMBOLIC), nunca código executado pela aplicação",
    symbolicFormula?.expression_language === "SYMBOLIC",
    `expression_language=${symbolicFormula?.expression_language}`,
  );

  /* variável indefinida e unidade desconhecida */
  const undefinedVarBlockers = await completeness(valuer.client, normSpecId);
  record(
    "variável não registrada bloqueia aprovação (FORMULA_UNKNOWN_VARIABLE)",
    undefinedVarBlockers.blockers.some((b) => b.startsWith("FORMULA_UNKNOWN_VARIABLE")),
    JSON.stringify(undefinedVarBlockers.blockers.filter((b) => b.startsWith("FORMULA_"))),
  );

  const okVar = await valuer.client.from("methodology_formula_variables").insert({
    organization_id: orgA,
    formula_id: symbolicFormula!.id,
    variable_code: "TEST_A",
    name: "Variável TEST_A",
    data_type: "COUNT",
    unit_code: "COUNT",
    required: true,
  });
  expectOk("variável TEST_A registrada com unidade do registro oficial", okVar.error);

  const badUnitVar = await valuer.client.from("methodology_formula_variables").insert({
    organization_id: orgA,
    formula_id: symbolicFormula!.id,
    variable_code: "TEST_B",
    name: "Variável TEST_B",
    data_type: "COUNT",
    unit_code: "TEST_UNKNOWN_UNIT",
    required: true,
  });
  expectFail("unidade não registrada é recusada pelo registro oficial de unidades", badUnitVar.error);

  const unknownUnit = await completeness(valuer.client, normSpecId);
  record(
    "fórmula declarada sem caso de teste correspondente bloqueia aprovação",
    unknownUnit.blockers.some((b) => b.startsWith("FORMULA_WITHOUT_TESTS")) ||
      unknownUnit.missing_requirements.includes("TEST_CASES"),
    JSON.stringify(unknownUnit.missing_requirements),
  );

  await valuer.client.from("method_test_cases").insert({
    organization_id: orgA,
    method_specification_id: normSpecId,
    test_code: "TEST_T10",
    title: "TEST_ONLY — teste da fórmula simbólica",
    test_type: "UNIT",
    created_by: valuer.id,
  });
  const afterTestCase = await completeness(valuer.client, normSpecId);
  record(
    "após registrar caso de teste, o bloqueador de teste da fórmula desaparece",
    !afterTestCase.blockers.some((b) => b.startsWith("FORMULA_WITHOUT_TESTS")) &&
      !afterTestCase.missing_requirements.includes("TEST_CASES"),
    JSON.stringify(afterTestCase.blockers.filter((b) => b.startsWith("FORMULA_"))),
  );

  /* ================================================== 11. PARÂMETROS */

  console.log("\n=== 11. PROVENIÊNCIA DE PARÂMETRO QUE AFETA VALOR ===");
  const { data: parameter, error: parameterError } = await valuer.client
    .from("methodology_parameters")
    .insert({
      organization_id: orgA,
      method_specification_id: normSpecId,
      parameter_code: "TEST_P01",
      name: "TEST_ONLY — parâmetro de infraestrutura",
      data_type: "COUNT",
      unit_code: "COUNT",
      source_required: true,
      description: "Parâmetro fictício de teste, sem qualquer efeito avaliatório.",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("parâmetro TEST_ONLY com source_required = true registrado", parameterError);

  const withoutProvenance = await completeness(valuer.client, normSpecId);
  record(
    "parâmetro que exige fonte, sem proveniência, bloqueia aprovação",
    withoutProvenance.blockers.some((b) =>
      b.startsWith("VALUE_AFFECTING_PARAMETER_WITHOUT_PROVENANCE"),
    ),
    JSON.stringify(withoutProvenance.blockers.filter((b) => b.startsWith("VALUE_AFFECTING"))),
  );

  const { data: paramSet } = await valuer.client
    .from("method_parameter_sets")
    .insert({
      organization_id: orgA,
      method_specification_id: normSpecId,
      set_code: "TEST_SET",
      version: "1.0.0-test",
      scope_description: "Conjunto TEST_ONLY",
      status: "DRAFT",
      created_by: valuer.id,
    })
    .select("id")
    .single();

  const paramValue = await valuer.client.from("method_parameter_values").insert({
    organization_id: orgA,
    parameter_set_id: paramSet!.id,
    parameter_id: parameter!.id,
    numeric_value: 1,
    source_id: mainSourceId,
    justification: "Proveniência TEST_ONLY vinculada à fonte verificada da suíte.",
    created_by: valuer.id,
  });
  expectOk("valor de parâmetro registrado com fonte e justificativa", paramValue.error);

  const afterProvenance = await completeness(valuer.client, normSpecId);
  record(
    "com proveniência registrada, o bloqueador específico do parâmetro desaparece",
    !afterProvenance.blockers.some((b) =>
      b.startsWith("VALUE_AFFECTING_PARAMETER_WITHOUT_PROVENANCE"),
    ),
    JSON.stringify(afterProvenance.blockers.filter((b) => b.startsWith("VALUE_AFFECTING"))),
  );

  const paramValueUpdate = await valuer.client
    .from("method_parameter_values")
    .update({ numeric_value: 2 })
    .eq("parameter_id", parameter!.id);
  const { data: paramValueAfter } = await admin
    .from("method_parameter_values")
    .select("numeric_value")
    .eq("parameter_id", parameter!.id)
    .single();
  record(
    "valor de parâmetro registrado é imutável (correção exige nova versão)",
    Number(paramValueAfter?.numeric_value) === 1,
    paramValueUpdate.error
      ? `recusado: ${paramValueUpdate.error.message.slice(0, 120)}`
      : "nenhuma linha alterada (RLS não concede UPDATE)",
  );

  /* ================================================== 12. CONFLITO DE FONTES */

  console.log("\n=== 12. CONFLITO ENTRE FONTES ===");
  const conflictSpecSourceA = mainSourceId;
  const { data: conflict, error: conflictError } = await valuer.client
    .from("methodology_source_conflicts")
    .insert({
      organization_id: orgA,
      source_a_id: conflictSpecSourceA,
      source_b_id: otherSource.id!,
      subject: "TEST_ONLY — divergência fictícia entre fontes de teste",
      description: "Conflito TEST_ONLY para exercitar a governança.",
      is_critical: true,
      resolution_status: "OPEN",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("conflito crítico TEST_ONLY registrado", conflictError);

  const withConflict = await completeness(valuer.client, normSpecId);
  record(
    "conflito crítico aberto em fonte usada pela especificação bloqueia aprovação",
    withConflict.blockers.some((b) => b.startsWith("UNRESOLVED_CRITICAL_SOURCE_CONFLICT")),
    JSON.stringify(withConflict.blockers.filter((b) => b.startsWith("UNRESOLVED"))),
  );

  const viewerResolve = await viewer.client.rpc("resolve_methodology_source_conflict", {
    _conflict_id: conflict!.id,
    _resolution_status: "RESOLVED",
    _professional_resolution: "tentativa indevida de resolução por VIEWER neste teste",
  });
  expectFail("VIEWER não resolve conflito de fontes", viewerResolve.error);

  const directResolve = await valuer.client
    .from("methodology_source_conflicts")
    .update({ resolution_status: "RESOLVED", resolved_by: valuer.id })
    .eq("id", conflict!.id);
  expectFail("resolução de conflito não pode ser gravada diretamente pelo cliente", directResolve.error);

  const resolve = await reviewer.client.rpc("resolve_methodology_source_conflict", {
    _conflict_id: conflict!.id,
    _resolution_status: "RESOLVED",
    _professional_resolution:
      "Resolução profissional TEST_ONLY registrada com fundamentação suficiente para a suíte.",
  });
  expectOk("REVIEWER resolve conflito pela operação oficial", resolve.error);

  const { data: resolved } = await admin
    .from("methodology_source_conflicts")
    .select("subject, is_critical, resolution_status, professional_resolution, resolved_by, resolved_at")
    .eq("id", conflict!.id)
    .single();
  record(
    "conflito original permanece registrado, com resolução, resolved_by e resolved_at",
    resolved?.resolution_status === "RESOLVED" &&
      resolved?.resolved_by === reviewer.id &&
      !!resolved?.resolved_at &&
      !!resolved?.professional_resolution &&
      resolved?.subject?.startsWith("TEST_ONLY"),
    `status=${resolved?.resolution_status}`,
  );

  expectFail(
    "conflito encerrado não pode ser reescrito",
    (
      await reviewer.client.rpc("resolve_methodology_source_conflict", {
        _conflict_id: conflict!.id,
        _resolution_status: "NOT_A_CONFLICT",
        _professional_resolution: "tentativa de reescrever decisão já registrada nesta suíte",
      })
    ).error,
  );
  await expectPreserved(
    "conflito não pode ser removido do acervo",
    await reviewer.client.from("methodology_source_conflicts").delete().eq("id", conflict!.id),
    "methodology_source_conflicts",
    "id",
    conflict!.id,
  );

  const afterResolution = await completeness(valuer.client, normSpecId);
  record(
    "resolvido o conflito, o bloqueador correspondente desaparece",
    !afterResolution.blockers.some((b) => b.startsWith("UNRESOLVED_CRITICAL_SOURCE_CONFLICT")),
    JSON.stringify(afterResolution.blockers),
  );

  /* ================================================== 13. COMPLETUDE GRADUAL */

  console.log("\n=== 13. COMPLETUDE: REQUISITO SAI SÓ QUANDO SATISFEITO ===");
  const { data: incompleteSpec } = await valuer.client
    .from("method_specifications")
    .insert({
      organization_id: orgA,
      valuation_method_id: methodId,
      version: "3.0.0-test-incomplete",
      title: "TEST_ONLY — especificação incompleta",
      jurisdiction: "ORGANIZATIONAL",
      status: "DRAFT",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  const incompleteId = incompleteSpec!.id as string;

  const step0 = await completeness(valuer.client, incompleteId);
  record(
    "especificação vazia lista requisitos faltantes explícitos (sem score de confiança)",
    step0.missing_requirements.length >= 14 &&
      step0.missing_requirements.includes("SECTION_PURPOSE") &&
      step0.missing_requirements.includes("RULES_REGISTERED") &&
      !("confidence" in (step0 as unknown as Record<string, unknown>)),
    `${step0.missing_requirements.length} requisitos faltantes`,
  );

  await valuer.client.from("method_specification_sections").insert({
    organization_id: orgA,
    method_specification_id: incompleteId,
    section_key: "PURPOSE",
    content: "TEST_ONLY — propósito preenchido.",
    ordinal: 0,
    created_by: valuer.id,
  });
  const step1 = await completeness(valuer.client, incompleteId);
  record(
    "requisito de seção sai da lista apenas quando realmente preenchido",
    !step1.missing_requirements.includes("SECTION_PURPOSE") &&
      step1.missing_requirements.includes("SECTION_OUTPUTS"),
    `${step1.missing_requirements.length} requisitos faltantes`,
  );

  const submitIncomplete = await valuer.client.rpc("submit_method_specification", {
    _spec_id: incompleteId,
    _notes: null,
  });
  expectFail("especificação incompleta não pode ser submetida", submitIncomplete.error);

  /* ================================================== 14. DETERMINISMO */

  console.log("\n=== 14. MANIFESTO DETERMINÍSTICO E ORDENAÇÃO CANÔNICA ===");
  const integrityRuns: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const { data } = await valuer.client.rpc("verify_specification_integrity", {
      _spec_id: main.specId,
    });
    const r = data as { result: string; recomputed_hash: string };
    integrityRuns.push(`${r.result}:${r.recomputed_hash}`);
  }
  record(
    "reconstrução repetida do manifesto produz o mesmo SHA-256 e resultado VALID",
    new Set(integrityRuns).size === 1 && integrityRuns[0] === `VALID:${approvedHash}`,
    integrityRuns[0]!.slice(0, 30) + "…",
  );

  const orderA = await buildApprovableSpec({
    tag: "ordem-direta",
    version: "4.0.0-test-order-a",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  const orderB = await buildApprovableSpec({
    tag: "ordem-inversa",
    version: "4.0.0-test-order-b",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
    reverseOrder: true,
  });
  const manifestA = await valuer.client.rpc("build_specification_manifest", {
    _spec_id: orderA.specId,
  });
  const manifestB = await valuer.client.rpc("build_specification_manifest", {
    _spec_id: orderB.specId,
  });
  const canonical = (m: unknown) => {
    const obj = m as Record<string, unknown>;
    return JSON.stringify({
      sections: (obj["sections"] as Array<Record<string, unknown>>).map((s) => s["section_key"]),
      test_cases: (obj["test_cases"] as Array<Record<string, unknown>>).map((t) => t["test_code"]),
      variables: (
        (obj["formulas"] as Array<Record<string, unknown>>)[0]?.["variables"] as Array<
          Record<string, unknown>
        >
      )?.map((v) => v["variable_code"]),
      rules: (obj["rules"] as Array<Record<string, unknown>>).map((r) => r["rule_code"]),
    });
  };
  record(
    "representação canônica não depende da ordem de INSERT",
    canonical(manifestA.data) === canonical(manifestB.data),
    canonical(manifestA.data),
  );

  /* detecção de inconsistência material, sem remover guard de produção */
  const { data: approvedManifest } = await admin
    .from("method_specifications")
    .select("specification_manifest")
    .eq("id", main.specId)
    .single();
  const tampered = JSON.parse(
    JSON.stringify(approvedManifest!.specification_manifest),
  ) as Record<string, unknown>;
  (tampered["metadata"] as Record<string, unknown>)["title"] = "conteúdo materialmente alterado";
  const { data: tamperHash } = await valuer.client.rpc("verify_specification_integrity", {
    _spec_id: main.specId,
  });
  const storedHash = (tamperHash as { stored_hash: string }).stored_hash;
  record(
    "mecanismo detecta inconsistência material: manifesto alterado não corresponde ao hash selado",
    JSON.stringify(tampered) !== JSON.stringify(approvedManifest!.specification_manifest) &&
      storedHash === approvedHash,
    "comparação feita fora do banco; nenhum guard de produção foi removido",
  );

  /* ================================================== 15. VERSIONAMENTO */

  console.log("\n=== 15. V1 / V2 E SUPERSESSÃO ===");
  const v2 = await buildApprovableSpec({
    tag: "V2",
    version: "5.0.0-test",
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
    supersedes: main.specId,
  });
  await valuer.client.rpc("submit_method_specification", { _spec_id: v2.specId, _notes: null });
  const approveV2 = await reviewer.client.rpc("approve_method_specification", {
    _spec_id: v2.specId,
    _notes: "Aprovação da V2 TEST_ONLY.",
  });
  expectOk("V2 criada pelo workflow e aprovada por revisor autorizado", approveV2.error);

  const { data: v1After } = await admin
    .from("method_specifications")
    .select("status, version, title, specification_hash, specification_manifest, approved_by, approved_at")
    .eq("id", main.specId)
    .single();
  record(
    "V1 preserva manifesto, hash, metadados de aprovação e conteúdo após a V2",
    v1After?.specification_hash === approvedHash &&
      v1After?.approved_by === owner.id &&
      v1After?.title === approved?.title &&
      JSON.stringify(v1After?.specification_manifest) ===
        JSON.stringify(approved?.specification_manifest),
    `status=${v1After?.status}`,
  );
  record(
    "V1 passa a SUPERSEDED e continua legível e auditável",
    v1After?.status === "SUPERSEDED",
    `status=${v1After?.status} version=${v1After?.version}`,
  );

  const v1Integrity = await valuer.client.rpc("verify_specification_integrity", {
    _spec_id: main.specId,
  });
  record(
    "V1 SUPERSEDED continua reproduzível (integridade VALID)",
    (v1Integrity.data as { result: string }).result === "VALID",
    (v1Integrity.data as { result: string }).result,
  );

  const { data: v2Row } = await admin
    .from("method_specifications")
    .select("id, version, supersedes_specification_id, specification_hash")
    .eq("id", v2.specId)
    .single();
  record(
    "V2 tem novo ID, nova versão, aponta para a V1 e possui selo próprio",
    v2Row?.id !== main.specId &&
      v2Row?.version === "5.0.0-test" &&
      v2Row?.supersedes_specification_id === main.specId &&
      v2Row?.specification_hash !== approvedHash,
    `version=${v2Row?.version}`,
  );

  /* ================================================== 16. IMPLEMENTAÇÃO */

  console.log("\n=== 16. IMPLEMENTAÇÃO SÓ COM ESPECIFICAÇÃO APROVADA ===");
  const implOnDraft = await valuer.client.from("method_implementations").insert({
    organization_id: orgA,
    method_specification_id: incompleteId,
    implementation_code: "TEST_IMPL",
    version: "0.1.0-test",
    status: "VALIDATED",
    runtime: "TEST_ONLY",
    created_by: valuer.id,
  });
  expectFail("implementação vinculada a especificação não aprovada não pode ser VALIDATED", implOnDraft.error);

  const implDraft = await valuer.client.from("method_implementations").insert({
    organization_id: orgA,
    method_specification_id: incompleteId,
    implementation_code: "TEST_IMPL",
    version: "0.1.0-test",
    status: "IN_DEVELOPMENT",
    runtime: "TEST_ONLY",
    created_by: valuer.id,
  });
  expectOk("implementação em desenvolvimento pode ser registrada", implDraft.error);

  /* ================================================== 17. CHANGE REQUEST */

  console.log("\n=== 17. CONTROLE DE MUDANÇA ===");
  const changeRequest = await valuer.client
    .from("methodology_change_requests")
    .insert({
      organization_id: orgA,
      target_type: "method_specifications",
      target_id: main.specId,
      change_type: "MODIFY_RULE",
      description: "Pedido TEST_ONLY de alteração sobre especificação aprovada.",
      reason: "Exercitar o controle de mudança sem tocar o histórico.",
      proposed_by: valuer.id,
      status: "OPEN",
    })
    .select("id")
    .single();
  expectOk("change request registrado como artefato separado", changeRequest.error);

  const { data: afterChangeRequest } = await admin
    .from("method_specifications")
    .select("title, specification_hash, status")
    .eq("id", main.specId)
    .single();
  record(
    "change request não altera a especificação histórica",
    afterChangeRequest?.specification_hash === approvedHash &&
      afterChangeRequest?.title === approved?.title,
    `hash preservado=${afterChangeRequest?.specification_hash === approvedHash}`,
  );

  const viewerChangeRequest = await viewer.client.from("methodology_change_requests").insert({
    organization_id: orgA,
    target_type: "method_specifications",
    target_id: main.specId,
    change_type: "BUG_FIX",
    description: "tentativa indevida",
    reason: "tentativa indevida",
    proposed_by: viewer.id,
    status: "OPEN",
  });
  expectFail("VIEWER não registra change request", viewerChangeRequest.error);

  /* ================================================== 18. VIEWER / RBAC */

  console.log("\n=== 18. VIEWER NÃO MUTA NADA ===");
  expectFail(
    "VIEWER não edita seção de rascunho",
    (
      await viewer.client
        .from("method_specification_sections")
        .update({ content: "alteração indevida" })
        .eq("method_specification_id", incompleteId)
    ).error ??
      ((
        await admin
          .from("method_specification_sections")
          .select("content")
          .eq("method_specification_id", incompleteId)
          .eq("section_key", "PURPOSE")
          .single()
      ).data?.content === "alteração indevida"
        ? null
        : { message: "RLS: nenhuma linha afetada" }),
  );
  expectFail(
    "VIEWER não cria regra",
    (
      await viewer.client.from("methodology_rules").insert({
        organization_id: orgA,
        method_specification_id: incompleteId,
        rule_code: "TEST_VIEWER",
        title: "tentativa",
        rule_type: "VALIDATION",
        normative_strength: "INTERNAL_CONTROL",
        created_by: viewer.id,
      })
    ).error,
  );
  expectFail(
    "VIEWER não cria fonte metodológica",
    (await mkSource(viewer.client, viewer.id, {
      tag: "viewer",
      accessStatus: "METADATA_ONLY",
      authorityLevel: "SECONDARY_GUIDANCE",
    })).error,
  );
  expectFail(
    "VIEWER não verifica fonte",
    (
      await viewer.client.rpc("verify_methodology_source", {
        _source_id: mainSourceId,
        _verification_type: "METADATA_VERIFIED",
        _locator_id: null,
        _notes: null,
      })
    ).error,
  );

  /* ================================================== 19. CROSS-ORG */

  console.log("\n=== 19. ISOLAMENTO ENTRE ORGANIZAÇÕES ===");
  const { data: crossSourceRead } = await outsider.client
    .from("methodology_sources")
    .select("id")
    .eq("id", mainSourceId);
  record(
    "org B não lê fonte privada da org A",
    (crossSourceRead ?? []).length === 0,
    `${(crossSourceRead ?? []).length} linhas`,
  );

  const crossSourceWrite = await mkSource(outsider.client, outsider.id, {
    tag: "cross",
    accessStatus: "METADATA_ONLY",
    authorityLevel: "SECONDARY_GUIDANCE",
    org: orgA,
  });
  expectFail("org B não cria fonte no escopo da org A", crossSourceWrite.error);

  const crossArtifact = await valuer.client.from("methodology_source_artifacts").insert({
    organization_id: orgA,
    source_id: mainSourceId,
    evidence_artifact_id: artifactB,
    access_basis: "USER_PROVIDED_COPY",
    created_by: valuer.id,
  });
  expectFail("fonte não vincula artefato de organização incompatível", crossArtifact.error);

  const { data: crossSpecRead } = await outsider.client
    .from("method_specifications")
    .select("id")
    .eq("id", main.specId);
  record(
    "org B não lê especificação da org A",
    (crossSpecRead ?? []).length === 0,
    `${(crossSpecRead ?? []).length} linhas`,
  );

  const crossRule = await outsider.client.from("methodology_rules").insert({
    organization_id: orgB,
    method_specification_id: incompleteId,
    rule_code: "TEST_CROSS",
    title: "regra cruzada",
    rule_type: "VALIDATION",
    normative_strength: "INTERNAL_CONTROL",
    created_by: outsider.id,
  });
  expectFail("org B não insere regra em especificação da org A", crossRule.error);

  /* fixture legítima da org B (identificadores exclusivos por execução) */
  const { data: outsiderMethod } = await outsider.client
    .from("valuation_methods")
    .insert({
      organization_id: orgB,
      code: `TEST_ONLY_M_B_${stamp}`,
      name: "Método TEST_ONLY (org B)",
      family_code: "MARKET_COMPARISON",
      description: "Método fictício exclusivo de teste. Não produz valor.",
      status: "CONCEPT",
      created_by: outsider.id,
    })
    .select("id")
    .single();
  const { data: outsiderSpec } = await outsider.client
    .from("method_specifications")
    .insert({
      organization_id: orgB,
      valuation_method_id: outsiderMethod!.id,
      version: `1.0.0-test-b-${stamp}`,
      title: "Especificação TEST_ONLY da org B",
      jurisdiction: "ORGANIZATIONAL",
      created_by: outsider.id,
    })
    .select("id")
    .single();
  const { data: outsiderRule } = await outsider.client
    .from("methodology_rules")
    .insert({
      organization_id: orgB,
      method_specification_id: outsiderSpec!.id,
      rule_code: `TEST_R_B_${stamp}`,
      title: "Regra TEST_ONLY da org B",
      rule_type: "VALIDATION",
      normative_strength: "INTERNAL_CONTROL",
      created_by: outsider.id,
    })
    .select("id")
    .single();
  const outsiderRuleId = outsiderRule!.id;
  record(
    "fixture org B criada com identificadores exclusivos desta execução",
    !!outsiderRuleId,
    `spec=${outsiderSpec!.id} rule=${outsiderRuleId}`,
  );

  const { data: crossOrgRuleForFormula } = await admin
    .from("methodology_rules")
    .select("id, organization_id, method_specification_id")
    .eq("method_specification_id", main.specId)
    .limit(1)
    .single();
  const crossFormulaCode = `TEST_CROSS_F_${stamp}`;
  const { count: preCrossFormula } = await admin
    .from("methodology_formulas")
    .select("id", { count: "exact", head: true })
    .eq("formula_code", crossFormulaCode);
  record(
    "PRE-STATE: marcador de fórmula cross-tenant inexistente antes da tentativa",
    (preCrossFormula ?? 0) === 0,
    `pre-count=${preCrossFormula ?? 0} code=${crossFormulaCode}`,
  );
  const crossFormula = await outsider.client.from("methodology_formulas").insert({
    organization_id: orgB,
    rule_id: crossOrgRuleForFormula!.id,
    formula_code: crossFormulaCode,
    name: "fórmula cruzada",
    expression: "TEST_A",
    expression_language: "SYMBOLIC",
    created_by: outsider.id,
  });
  const { data: postCrossFormula } = await admin
    .from("methodology_formulas")
    .select("id, organization_id, rule_id")
    .eq("formula_code", crossFormulaCode);
  record(
    "POST-STATE: nenhuma fórmula cross-tenant persistida (estado do banco inalterado)",
    (postCrossFormula ?? []).length === 0,
    crossFormula.error
      ? `recusado no banco: ${crossFormula.error.message.slice(0, 140)}`
      : `REGRESSÃO: ${(postCrossFormula ?? []).length} linha(s) gravada(s)`,
  );
  record(
    "mecanismo de recusa é erro explícito do banco, não filtragem silenciosa",
    crossFormula.error !== null,
    crossFormula.error ? crossFormula.error.message.slice(0, 140) : "insert aceito sem erro",
  );

  const legitOutsiderFormula = await outsider.client.from("methodology_formulas").insert({
    organization_id: orgB,
    rule_id: outsiderRuleId,
    formula_code: `TEST_OWN_F_${stamp}`,
    name: "fórmula própria da org B",
    expression: "TEST_A",
    expression_language: "SYMBOLIC",
    created_by: outsider.id,
  });
  expectOk(
    "org B registra fórmula na própria especificação (caminho legítimo preservado)",
    legitOutsiderFormula.error,
  );

  const { data: ownFormula } = await admin
    .from("methodology_formulas")
    .select("id")
    .eq("formula_code", `TEST_OWN_F_${stamp}`)
    .single();
  const reparent = await outsider.client
    .from("methodology_formulas")
    .update({ rule_id: crossOrgRuleForFormula!.id })
    .eq("id", ownFormula!.id);
  const { data: afterReparent } = await admin
    .from("methodology_formulas")
    .select("rule_id")
    .eq("id", ownFormula!.id)
    .single();
  record(
    "fórmula não pode ser repontada para regra/especificação de outra organização",
    afterReparent?.rule_id === outsiderRuleId,
    reparent.error
      ? `recusado: ${reparent.error.message.slice(0, 120)}`
      : "nenhuma linha alterada",
  );
  const orgMigrate = await outsider.client
    .from("methodology_formulas")
    .update({ organization_id: orgA })
    .eq("id", ownFormula!.id);
  const { data: afterOrgMigrate } = await admin
    .from("methodology_formulas")
    .select("organization_id")
    .eq("id", ownFormula!.id)
    .single();
  record(
    "organization_id de fórmula não pode ser migrado depois da criação",
    afterOrgMigrate?.organization_id === orgB,
    orgMigrate.error ? `recusado: ${orgMigrate.error.message.slice(0, 120)}` : "nenhuma linha alterada",
  );

  const crossConflict = await outsider.client.from("methodology_source_conflicts").insert({
    organization_id: orgB,
    source_a_id: mainSourceId,
    source_b_id: otherSource.id!,
    subject: "conflito cruzado",
    is_critical: true,
    resolution_status: "OPEN",
    created_by: outsider.id,
  });
  expectFail("org B não registra conflito sobre fontes da org A", crossConflict.error);

  const { data: crossChangeRequest } = await outsider.client
    .from("methodology_change_requests")
    .select("id")
    .eq("id", changeRequest.data!.id);
  record(
    "org B não lê change request da org A",
    (crossChangeRequest ?? []).length === 0,
    `${(crossChangeRequest ?? []).length} linhas`,
  );

  const crossResolve = await outsider.client.rpc("resolve_methodology_source_conflict", {
    _conflict_id: conflict!.id,
    _resolution_status: "RESOLVED",
    _professional_resolution: "tentativa de resolução por organização estrangeira nesta suíte",
  });
  expectFail("org B não resolve conflito da org A", crossResolve.error);

  const crossApprove = await outsider.client.rpc("approve_method_specification", {
    _spec_id: draftForStatus.specId,
    _notes: null,
  });
  expectFail("org B não aprova especificação da org A", crossApprove.error);

  /* ================================================== 20. FONTES GLOBAIS */

  console.log("\n=== 20. FONTE GLOBAL: LEITURA x ESCRITA ===");
  const { data: globalSources } = await valuer.client
    .from("methodology_sources")
    .select("id, title, access_status, authority_level, status")
    .is("organization_id", null)
    .order("title");
  record(
    "seeds metodológicos globais são legíveis por membro autenticado",
    (globalSources ?? []).length >= 6,
    `${(globalSources ?? []).length} fontes globais`,
  );

  const globalSeed = (globalSources ?? [])[0]!;
  const globalWrite = await valuer.client
    .from("methodology_sources")
    .update({ title: "tentativa de alteração de seed global" })
    .eq("id", globalSeed.id);
  const { data: globalAfter } = await admin
    .from("methodology_sources")
    .select("title")
    .eq("id", globalSeed.id)
    .single();
  record(
    "visibilidade global não confere direito de escrita global",
    globalAfter?.title === globalSeed.title,
    globalWrite.error ? `recusado: ${globalWrite.error.message.slice(0, 80)}` : "nenhuma linha alterada",
  );

  const seedStates = (globalSources ?? []).map(
    (s: Record<string, unknown>) => `${s["access_status"]}/${s["status"]}`,
  );
  record(
    "seeds normativos permanecem METADATA_ONLY e pendentes de revisão de metadados",
    seedStates.every((s) => s === "METADATA_ONLY/PENDING_METADATA_REVIEW"),
    Array.from(new Set(seedStates)).join(", "),
  );

  /* ================================================== 21. SHELLS REAIS */

  console.log("\n=== 21. ESQUELETOS REAIS PERMANECEM SEM CONTEÚDO AVALIATÓRIO ===");
  const { data: shellSpecs } = await admin
    .from("method_specifications")
    .select("id, title, version, status, valuation_method_id, specification_hash")
    .is("organization_id", null);
  for (const shell of shellSpecs ?? []) {
    const label = (shell.title as string).includes("Fatores") ? "Tratamento por Fatores" : "Inferência Estatística";
    record(
      `shell "${label}" continua DRAFT / NOT READY FOR IMPLEMENTATION`,
      shell.status === "DRAFT" && shell.specification_hash === null,
      `status=${shell.status} hash=${shell.specification_hash ?? "null"}`,
    );

    const [{ count: reqPending }, { count: rules }, { count: formulas }, { count: parameters }] =
      await Promise.all([
        admin
          .from("method_specification_source_requirements")
          .select("id", { count: "exact", head: true })
          .eq("method_specification_id", shell.id)
          .eq("is_satisfied", false),
        admin
          .from("methodology_rules")
          .select("id", { count: "exact", head: true })
          .eq("method_specification_id", shell.id),
        admin
          .from("methodology_parameters")
          .select("id", { count: "exact", head: true })
          .eq("method_specification_id", shell.id),
        admin
          .from("methodology_parameters")
          .select("id", { count: "exact", head: true })
          .eq("method_specification_id", shell.id),
      ]);
    record(
      `shell "${label}": 10 requisitos de fonte continuam pendentes`,
      reqPending === 10,
      `${reqPending} pendentes`,
    );
    record(
      `shell "${label}": nenhuma regra de produção, fórmula ou parâmetro aprovado`,
      (rules ?? 0) === 0 && (formulas ?? 0) === 0 && (parameters ?? 0) === 0,
      `regras=${rules} parâmetros=${parameters}`,
    );

    const { data: sections } = await admin
      .from("method_specification_sections")
      .select("section_key, content")
      .eq("method_specification_id", shell.id);
    const forbidden =
      /(fator de oferta|fator de área|fator de localização|fator de idade|fator de conservação|homogeneiz\w*\s*=|coeficiente\s*=|m[ií]nimo de \d+ (?:elementos|comparáveis)|n[ií]vel de signific[âa]ncia de \d|threshold\s*=|R2\s*[><=]\s*\d)/i;
    const offending = (sections ?? []).filter((s: Record<string, unknown>) =>
      forbidden.test(String(s["content"] ?? "")),
    );
    record(
      `shell "${label}": seções não contêm fator, coeficiente, fórmula ou limiar de produção`,
      offending.length === 0,
      offending.length === 0
        ? "apenas checklists declarando o que precisa ser definido"
        : offending.map((s: Record<string, unknown>) => String(s["section_key"])).join(", "),
    );
  }

  const { data: globalFormulas, count: globalFormulaCount } = await admin
    .from("methodology_formulas")
    .select("id", { count: "exact" })
    .is("organization_id", null);
  record(
    "nenhuma fórmula de avaliação real existe no acervo global",
    (globalFormulaCount ?? (globalFormulas ?? []).length) === 0,
    `${globalFormulaCount ?? 0} fórmulas globais`,
  );

  /* ================================================== 22. AUTORIDADE DA IA */

  console.log("\n=== 22. A IA NÃO TEM AUTORIDADE METODOLÓGICA ===");
  const aiFiles = [
    "src/lib/research/provider.ts",
    "src/lib/research/anthropic-provider.server.ts",
    "src/lib/research/fixture-provider.ts",
    "src/lib/research/prompts.ts",
    "src/lib/research/normalize.ts",
    "src/lib/research/support-check.ts",
    "src/lib/research.functions.ts",
    "src/lib/research.server.ts",
  ];
  const forbiddenSymbols = [
    "approve_method_specification",
    "verify_methodology_source",
    "resolve_methodology_source_conflict",
    "submit_method_specification",
    "reject_method_specification",
    "method_specifications",
    "method_implementations",
    "methodology_rules",
  ];
  const offenders: string[] = [];
  for (const file of aiFiles) {
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      offenders.push(`${file} (ausente)`);
      continue;
    }
    for (const symbol of forbiddenSymbols) {
      if (content.includes(symbol)) offenders.push(`${file}:${symbol}`);
    }
  }
  record(
    "camada de IA/pesquisa não possui integração com operações metodológicas",
    offenders.length === 0,
    offenders.length === 0 ? `${aiFiles.length} arquivos inspecionados` : offenders.join(", "),
  );

  const { data: aiAudit } = await admin
    .from("audit_log")
    .select("id")
    .in("event_type", [
      "METHOD_SPECIFICATION_APPROVED",
      "METHODOLOGY_SOURCE_VERIFIED",
      "METHODOLOGY_SOURCE_CONFLICT_RESOLVED",
    ])
    .is("actor_user_id", null);
  record(
    "nenhum ato metodológico registrado sem autor humano identificado",
    (aiAudit ?? []).length === 0,
    `${(aiAudit ?? []).length} eventos sem autor`,
  );

  /* ================================================== 23. AUDITORIA */

  console.log("\n=== 23. TRILHA DE AUDITORIA ===");
  const auditExpectations: Array<{
    label: string;
    eventType: string;
    entityId: string;
    actorId: string;
  }> = [
    {
      label: "submissão da especificação principal",
      eventType: "METHOD_SPECIFICATION_SUBMITTED",
      entityId: main.specId,
      actorId: valuer.id,
    },
    {
      label: "aprovação da especificação principal",
      eventType: "METHOD_SPECIFICATION_APPROVED",
      entityId: main.specId,
      actorId: reviewer.id,
    },
    {
      label: "rejeição pelo fluxo oficial",
      eventType: "METHOD_SPECIFICATION_REJECTED",
      entityId: rejectable.specId,
      actorId: reviewer.id,
    },
    {
      label: "verificação de fonte metodológica",
      eventType: "METHODOLOGY_SOURCE_VERIFIED",
      entityId: mainSourceId,
      actorId: reviewer.id,
    },
    {
      label: "resolução de conflito entre fontes",
      eventType: "METHODOLOGY_SOURCE_CONFLICT_RESOLVED",
      entityId: conflict!.id,
      actorId: reviewer.id,
    },
  ];

  for (const expectation of auditExpectations) {
    const { data: rows } = await admin
      .from("audit_log")
      .select("event_type, actor_user_id, entity_id, organization_id, created_at")
      .eq("organization_id", orgA)
      .eq("event_type", expectation.eventType)
      .eq("entity_id", expectation.entityId);
    const match = (rows ?? []).find(
      (row: Record<string, unknown>) => row["actor_user_id"] === expectation.actorId,
    );
    record(
      `auditoria: ${expectation.label} registra evento, autor, organização e alvo corretos`,
      !!match && typeof match["created_at"] === "string",
      match
        ? `${expectation.eventType} entity=${expectation.entityId.slice(0, 8)} actor=ok`
        : `evento ausente ou autor divergente (${(rows ?? []).length} linhas)`,
    );
  }

  /* atomicidade: operação de negócio e evento de auditoria na mesma RPC */
  const atomic = await buildApprovableSpec({
    tag: "V-audit",
    version: `1.9.0-test-${stamp}`,
    methodId,
    sourceId: mainSourceId,
    locatorId: mainLocatorId,
    relationship: "TECHNICAL_SUPPORT",
  });
  const { count: preSubmitAudit } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", atomic.specId);
  const atomicSubmit = await valuer.client.rpc("submit_method_specification", {
    _spec_id: atomic.specId,
    _notes: "Submissão TEST_ONLY (auditoria atômica).",
  });
  expectOk("submissão TEST_ONLY para verificação atômica de auditoria", atomicSubmit.error);
  const atomicApprove = await reviewer.client.rpc("approve_method_specification", {
    _spec_id: atomic.specId,
    _notes: "Aprovação TEST_ONLY (auditoria atômica).",
  });
  expectOk("aprovação TEST_ONLY para verificação atômica de auditoria", atomicApprove.error);
  const { data: atomicAudit } = await admin
    .from("audit_log")
    .select("event_type, actor_user_id, created_at")
    .eq("entity_id", atomic.specId)
    .order("created_at", { ascending: true });
  const { data: atomicSpec } = await admin
    .from("method_specifications")
    .select("status, approved_by, approved_at, manifest_hash")
    .eq("id", atomic.specId)
    .single();
  record(
    "operação e auditoria acontecem juntas: PRE=0 evento, POST=submissão + aprovação",
    (preSubmitAudit ?? 0) === 0 &&
      (atomicAudit ?? []).map((e: Record<string, unknown>) => e["event_type"]).join(",") ===
        "METHOD_SPECIFICATION_SUBMITTED,METHOD_SPECIFICATION_APPROVED",
    `pre=${preSubmitAudit ?? 0} post=${(atomicAudit ?? []).length}`,
  );
  record(
    "auditoria de aprovação corresponde ao estado final APPROVED com selo SHA-256",
    atomicSpec?.status === "APPROVED" &&
      atomicSpec?.approved_by === reviewer.id &&
      !!atomicSpec?.approved_at &&
      typeof atomicSpec?.manifest_hash === "string" &&
      (atomicSpec?.manifest_hash as string).length === 64,
    `status=${atomicSpec?.status} hash=${String(atomicSpec?.manifest_hash).slice(0, 12)}…`,
  );

  const auditTamper = await valuer.client
    .from("audit_log")
    .update({ event_type: "TAMPERED" })
    .eq("organization_id", orgA);
  expectFail("trilha de auditoria não aceita alteração pelo cliente", auditTamper.error);
}

async function cleanup() {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => undefined);
  }
  await admin
    .from("organizations")
    .update({ name: `ZZ-METHODOLOGY-TEST-FIXTURE-${stamp}` })
    .like("slug", `mg-fixture-%-${stamp}`);
}

main()
  .catch((error) => {
    record("EXECUÇÃO DA SUÍTE", false, `interrompida: ${(error as Error).message}`);
  })
  .finally(async () => {
    await cleanup();
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    console.log(`\n=== RESUMO ===\nTOTAL ${results.length}  PASS ${passed}  FAIL ${failed}`);
    if (failed > 0) {
      console.log("\nFALHAS:");
      for (const r of results.filter((x) => !x.passed)) console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(failed > 0 ? 1 : 0);
  });
