/**
 * RESEARCH ENGINE TEST SUITE — Phase 4 closeout
 *
 * Part A (offline, deterministic): proves the anti-hallucination gate rejects
 * fabricated excerpts, absent numbers, numbers that disagree with the parser,
 * fields outside the closed allowlist, prompt injection, and any attempt to turn
 * an asking price into a transacted price. No network, no database.
 *
 * Part B (database): proves the forensic invariants of the research tables are
 * enforced by PostgreSQL — never by the UI. Service role is used ONLY to
 * provision fixtures; every assertion runs as a signed-in user or as anon.
 *
 * Run with:  bun run tests/functional/research-flow.ts
 */
import { createClient } from "@supabase/supabase-js";

import { FIXTURE_SOURCES, FixtureResearchProvider } from "../../src/lib/research/fixture-provider";
import { checkExtractedFields, detectAdversarialContent } from "../../src/lib/research/support-check";
import type { RawExtractedField } from "../../src/lib/research/support-check";
import { canonicalizeUrl, extractDomain } from "../../src/lib/research/url";
import { RESEARCH_BUDGET_LIMITS, RESEARCH_FIELD_NAMES } from "../../src/lib/domain/research";

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

function expect(name: string, condition: boolean, detail: string) {
  record(name, condition, detail);
}

/* ==========================================================================
 * PART A — deterministic gate (offline)
 * ======================================================================== */

function toRawFields(source: (typeof FIXTURE_SOURCES)[number]): RawExtractedField[] {
  return source.extraction.entity_candidates.flatMap((candidate) =>
    candidate.fields.map((field) => ({
      fieldName: field.field_name,
      rawValue: field.raw_value,
      supportStatus: field.support_status,
      sourceExcerpt: field.source_excerpt,
      sourceLocator: field.source_locator,
      aiNumericValue: field.numeric_value,
    })),
  );
}

function gateOf(url: string) {
  const source = FIXTURE_SOURCES.find((s) => s.url === url);
  if (!source) throw new Error(`fixture não encontrada: ${url}`);
  return { source, gate: checkExtractedFields(source.content, toRawFields(source)) };
}

function runOfflineChecks() {
  // 1 — clean listing survives the gate.
  {
    const { gate } = gateOf("https://exemplo-imoveis.com.br/apartamento-jardins-101");
    const price = gate.fields.find((f) => f.fieldName === "asking_price");
    expect(
      "gate: anúncio íntegro é aceito com trecho conferido",
      price?.supportCheckStatus === "EXACT_MATCH" &&
        price?.fieldState === "PRESENT" &&
        price?.numericValue === 1850000,
      `asking_price=${price?.numericValue} check=${price?.supportCheckStatus}`,
    );
    const notFound = gate.fields.find((f) => f.fieldName === "construction_year");
    expect(
      "gate: ausência declarada vira NOT_FOUND, nunca zero",
      notFound?.fieldState === "NOT_FOUND" && notFound?.numericValue === null,
      `construction_year state=${notFound?.fieldState} numeric=${notFound?.numericValue}`,
    );
  }

  // 2 — fabricated excerpt, number absent from excerpt, field off the allowlist.
  {
    const { gate } = gateOf("https://exemplo-imoveis.com.br/casa-alphaville-77");
    const invented = gate.fields.find((f) => f.fieldName === "asking_price");
    expect(
      "gate: trecho inexistente na fonte reprova a conferência",
      invented?.supportCheckStatus === "FAILED" &&
        invented.issues.some((i) => i.issueType === "EXCERPT_NOT_FOUND_IN_SOURCE"),
      `asking_price check=${invented?.supportCheckStatus}`,
    );
    const bathrooms = gate.fields.find((f) => f.fieldName === "bathrooms");
    expect(
      "gate: número ausente do trecho citado reprova a conferência",
      bathrooms?.supportCheckStatus === "FAILED" &&
        bathrooms.numericValue === null &&
        bathrooms.issues.some((i) => i.issueType === "NUMERIC_VALUE_NOT_IN_EXCERPT"),
      `bathrooms check=${bathrooms?.supportCheckStatus}`,
    );
    expect(
      "gate: campo fora do vocabulário é descartado com registro",
      gate.discarded.some(
        (d) =>
          d.fieldName === "investment_grade" &&
          d.issue.issueType === "FIELD_NAME_OUTSIDE_ALLOWLIST",
      ),
      `descartados=${gate.discarded.map((d) => d.fieldName).join(",") || "nenhum"}`,
    );
    expect(
      "gate: campo reprovado nunca fica em estado PRESENT",
      gate.fields.every((f) => f.supportCheckStatus !== "FAILED" || f.fieldState !== "PRESENT"),
      "reprovados fora de PRESENT",
    );
  }

  // 3 — model number disagrees with the deterministic parser.
  {
    const { gate } = gateOf("https://exemplo-imoveis.com.br/apartamento-moema-33");
    const price = gate.fields.find((f) => f.fieldName === "asking_price");
    expect(
      "gate: divergência entre número da IA e parser é preservada",
      price?.fieldState === "DIVERGENT" &&
        price.supportCheckStatus === "FAILED" &&
        price.issues.some((i) => i.issueType === "NUMERIC_CONFLICT_WITH_PARSER"),
      `asking_price state=${price?.fieldState} parser=${price?.numericValue}`,
    );
  }

  // 4 — prompt injection is detected and never obeyed.
  {
    const { source, gate } = gateOf("https://portal-hostil.example.com/anuncio-999");
    expect(
      "gate: instrução embutida na fonte é sinalizada",
      gate.issues.some((i) => i.issueType === "ADVERSARIAL_CONTENT_SUSPECTED") &&
        detectAdversarialContent(source.content).length > 0,
      "conteúdo hostil sinalizado",
    );
    const transaction = gate.fields.find((f) => f.fieldName === "transaction_price");
    expect(
      "gate: preço 'vendido' injetado no texto não gera transação",
      transaction?.fieldState === "NOT_FOUND" && transaction.numericValue === null,
      `transaction_price state=${transaction?.fieldState}`,
    );
    const asking = gate.fields.find((f) => f.fieldName === "asking_price");
    expect(
      "gate: apenas o preço realmente publicado é aceito na fonte hostil",
      asking?.numericValue === 900000,
      `asking_price=${asking?.numericValue}`,
    );
  }

  // 5 — removed listing must never become a closed sale.
  {
    const { gate } = gateOf("https://exemplo-imoveis.com.br/apartamento-retirado-55");
    const transaction = gate.fields.find((f) => f.fieldName === "transaction_price");
    expect(
      "gate: preço pedido citado como transacionado é reprovado",
      transaction?.fieldState !== "PRESENT" &&
        transaction?.supportCheckStatus === "FAILED" &&
        transaction.issues.some((i) => i.issueType === "TRANSACTION_CLAIM_FROM_ASKING_PRICE"),
      `transaction_price state=${transaction?.fieldState} check=${transaction?.supportCheckStatus}`,
    );
  }

  // 6 — invented URLs never enter the source list.
  {
    const provider = new FixtureResearchProvider({
      proseUrls: ["https://inventado-pela-ia.example.com/imovel-999"],
    });
    return provider
      .search({
        query: "apartamento jardins",
        maxUses: 1,
        maxResults: 10,
        location: { city: "São Paulo", region: "SP", country: "BR" },
      })
      .then((search) => {
        expect(
          "provider: URL citada apenas na prosa do modelo é rejeitada como fonte",
          search.results.every((r) => !r.url.includes("inventado-pela-ia")) &&
            search.rejectedProseUrls.includes("https://inventado-pela-ia.example.com/imovel-999"),
          `resultados=${search.results.length} rejeitadas=${search.rejectedProseUrls.length}`,
        );
        expect(
          "provider: todo resultado carrega referência do bloco de ferramenta",
          search.results.every((r) => r.providerResultReference !== null),
          "referências presentes",
        );
      });
  }
}

function runStaticChecks() {
  const noisy = canonicalizeUrl("HTTPS://WWW.Exemplo.com.br/imovel/1?utm_source=x&ref=y#foto");
  const clean = canonicalizeUrl("https://exemplo.com.br/imovel/1");
  expect(
    "url: canonicalização remove rastreadores e normaliza host",
    noisy.canonicalUrl === clean.canonicalUrl && noisy.domain === "exemplo.com.br",
    noisy.canonicalUrl,
  );
  expect(
    "url: domínio extraído do host, nunca do texto do modelo",
    extractDomain("https://sub.exemplo.com.br/anuncio/9") === "sub.exemplo.com.br",
    extractDomain("https://sub.exemplo.com.br/anuncio/9"),
  );
  expect(
    "orçamento: tetos de provedor são finitos e declarados",
    RESEARCH_BUDGET_LIMITS.maxSearchUses > 0 &&
      RESEARCH_BUDGET_LIMITS.maxFetches > 0 &&
      RESEARCH_BUDGET_LIMITS.maxExtractions > 0 &&
      RESEARCH_BUDGET_LIMITS.aiCallsPerUserPerHour > 0 &&
      RESEARCH_BUDGET_LIMITS.aiCallsPerOrgPerHour > 0,
    JSON.stringify(RESEARCH_BUDGET_LIMITS),
  );
  expect(
    "taxonomia: allowlist fechada e sem duplicidade",
    new Set(RESEARCH_FIELD_NAMES).size === RESEARCH_FIELD_NAMES.length,
    `${RESEARCH_FIELD_NAMES.length} campos`,
  );
}

/* ==========================================================================
 * PART B — database invariants
 * ======================================================================== */

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
const anonKey =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

async function runDatabaseChecks() {
  if (!url || !anonKey || !serviceKey) {
    console.log(
      "SKIP  Parte B (banco): defina SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
    return;
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const stamp = Date.now();
  const createdUserIds: string[] = [];

  async function createUser(label: string) {
    const email = `res-${label}-${stamp}@valuation-research-test.local`;
    const password = `Res!${stamp}${label}Aa1`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
    createdUserIds.push(data.user.id);
    const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
    const signIn = await client.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);
    return { id: data.user.id, client };
  }

  async function expectBlocked(name: string, run: () => Promise<{ error: unknown }>) {
    try {
      const { error } = await run();
      if (error) {
        record(name, true, `bloqueado: ${String((error as { message?: string }).message).slice(0, 200)}`);
      } else {
        record(name, false, "REGRESSÃO: operação proibida foi aceita");
      }
    } catch (err) {
      record(name, true, `bloqueado (throw): ${(err as Error).message.slice(0, 200)}`);
    }
  }

  const owner = await createUser("owner");
  const outsider = await createUser("outsider");

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: `Research Test ${stamp}`, created_by: owner.id })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(`org: ${orgError?.message}`);

  const { error: memberError } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: owner.id,
    role: "OWNER",
    status: "ACTIVE",
    invited_by: owner.id,
  });
  if (memberError) throw new Error(`member: ${memberError.message}`);

  const { data: kase, error: caseError } = await admin
    .from("valuation_cases")
    .insert({
      organization_id: org.id,
      case_code: `RES-${stamp}`,
      title: "Caso de teste do motor de pesquisa",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (caseError || !kase) throw new Error(`case: ${caseError?.message}`);

  const { data: run, error: runError } = await admin
    .from("property_research_runs")
    .insert({
      organization_id: org.id,
      valuation_case_id: kase.id,
      research_type: "COMPARABLE_DISCOVERY",
      objective: "Suite determinística de pesquisa",
      requested_by: owner.id,
      status: "REVIEW_REQUIRED",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error(`run: ${runError?.message}`);

  const { data: source, error: sourceError } = await admin
    .from("evidence_sources")
    .insert({
      organization_id: org.id,
      valuation_case_id: kase.id,
      source_type: "REAL_ESTATE_LISTING",
      source_name: "Fonte de teste",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (sourceError || !source) throw new Error(`source: ${sourceError?.message}`);

  const { data: artifact, error: artifactError } = await admin
    .from("evidence_artifacts")
    .insert({
      organization_id: org.id,
      evidence_source_id: source.id,
      storage_path: `${org.id}/${kase.id}/research-test.txt`,
      file_name: "research-test.txt",
      created_by: owner.id,
      sha256_hash: "0".repeat(64),
      source_content_text: "Preço: R$ 1.000.000",
    })
    .select("id")
    .single();
  if (artifactError || !artifact) throw new Error(`artifact: ${artifactError?.message}`);

  const { data: extraction, error: extractionError } = await admin
    .from("evidence_extractions")
    .insert({
      organization_id: org.id,
      artifact_id: artifact.id,
      created_by: owner.id,
      processor_type: "LLM",
      status: "COMPLETED",
      extraction_type: "RESEARCH_SOURCE_EXTRACTION",
    })
    .select("id")
    .single();
  if (extractionError || !extraction) throw new Error(`extraction: ${extractionError?.message}`);

  const { data: candidate, error: candidateError } = await admin
    .from("research_entity_candidates")
    .insert({
      organization_id: org.id,
      valuation_case_id: kase.id,
      research_run_id: run.id,
      candidate_type: "SALE_LISTING",
      created_by: owner.id,
      status: "EXTRACTED",
      evidence_source_id: source.id,
      evidence_artifact_id: artifact.id,
      evidence_extraction_id: extraction.id,
    })
    .select("id")
    .single();
  if (candidateError || !candidate) throw new Error(`candidate: ${candidateError?.message}`);

  async function addField(fieldName: string, patch: Record<string, unknown>) {
    const { data, error } = await admin
      .from("evidence_fields")
      .insert({
        organization_id: org!.id,
        extraction_id: extraction!.id,
        created_by: owner.id,
        field_name: fieldName,
        validation_status: "EXTRACTED",
        ...patch,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`field(${fieldName}): ${error?.message}`);
    const { error: linkError } = await admin.from("research_entity_candidate_fields").insert({
      organization_id: org!.id,
      valuation_case_id: kase!.id,
      candidate_id: candidate!.id,
      evidence_field_id: data.id,
      semantic_role: "OBSERVATION",
    });
    if (linkError) throw new Error(`link(${fieldName}): ${linkError.message}`);
    return data.id;
  }

  const failedFieldId = await addField("asking_price", {
    raw_value: "R$ 1.000.000",
    numeric_value: 1000000,
    field_state: "NOT_VERIFIABLE",
    ai_support_status: "EXPLICIT_TEXT",
    support_check_status: "FAILED",
    source_excerpt: "Preço inventado: R$ 4.000.000",
  });

  const pendingFieldId = await addField("private_area", {
    raw_value: "80 m²",
    numeric_value: 80,
    unit: "m2",
    field_state: "PRESENT",
    ai_support_status: "EXPLICIT_TEXT",
    support_check_status: "EXACT_MATCH",
    source_excerpt: "Preço: R$ 1.000.000",
  });

  // Anonymous access to the research acervo.
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const anonRead = await anon.from("research_entity_candidates").select("id").limit(1);
  record(
    "banco: anon não lê candidatos de pesquisa",
    anonRead.error !== null || (anonRead.data?.length ?? 0) === 0,
    anonRead.error ? `bloqueado: ${anonRead.error.message.slice(0, 160)}` : "0 linhas",
  );

  // Cross-org isolation.
  const outsiderRead = await outsider.client
    .from("research_entity_candidates")
    .select("id")
    .eq("id", candidate.id);
  record(
    "banco: usuário de outra organização não vê o candidato",
    outsiderRead.error !== null || (outsiderRead.data?.length ?? 0) === 0,
    outsiderRead.error ? `bloqueado: ${outsiderRead.error.message.slice(0, 160)}` : "0 linhas",
  );

  const outsiderIssues = await outsider.client
    .from("research_extraction_issues")
    .select("id")
    .eq("research_run_id", run.id);
  record(
    "banco: inconsistências de outra organização são invisíveis",
    outsiderIssues.error !== null || (outsiderIssues.data?.length ?? 0) === 0,
    outsiderIssues.error ? `bloqueado: ${outsiderIssues.error.message.slice(0, 160)}` : "0 linhas",
  );

  // A failed support check can never be verified.
  await expectBlocked("banco: campo com conferência FAILED não pode ser verificado", () =>
    owner.client.rpc("verify_evidence_field", { _field_id: failedFieldId, _notes: "tentativa" }),
  );

  // Promotion requires VERIFIED fields.
  await expectBlocked("banco: promoção com campo apenas EXTRAÍDO é bloqueada", () =>
    owner.client.rpc("promote_research_candidate", {
      _candidate_id: candidate.id,
      _field_ids: [pendingFieldId],
      _observation_type: "SALE_LISTING",
      _observation_status: "ACTIVE",
      _market_property_id: null,
      _label: null,
      _notes: null,
    }),
  );

  // Offer never becomes transaction.
  const { error: verifyError } = await owner.client.rpc("verify_evidence_field", {
    _field_id: pendingFieldId,
    _notes: "conferido manualmente na suíte de testes",
  });
  record(
    "banco: campo conferido pode ser verificado pelo caminho oficial",
    verifyError === null,
    verifyError ? `erro inesperado: ${verifyError.message.slice(0, 200)}` : "verificado",
  );

  await expectBlocked("banco: venda concretizada sem preço transacionado é bloqueada", () =>
    owner.client.rpc("promote_research_candidate", {
      _candidate_id: candidate.id,
      _field_ids: [pendingFieldId],
      _observation_type: "CLOSED_SALE",
      _observation_status: "INACTIVE",
      _market_property_id: null,
      _label: null,
      _notes: null,
    }),
  );

  // Direct writes bypassing the official operations.
  const { error: statusError } = await owner.client
    .from("research_entity_candidates")
    .update({ status: "PROMOTED" })
    .eq("id", candidate.id);
  const { data: afterStatus } = await admin
    .from("research_entity_candidates")
    .select("status")
    .eq("id", candidate.id)
    .single();
  record(
    "banco: status PROMOTED não pode ser gravado por UPDATE direto",
    afterStatus?.status !== "PROMOTED",
    statusError
      ? `bloqueado: ${statusError.message.slice(0, 160)}`
      : `status permanece ${afterStatus?.status}`,
  );

  await expectBlocked("banco: exclusão de candidato de pesquisa é proibida", async () => {
    const { error } = await owner.client
      .from("research_entity_candidates")
      .delete()
      .eq("id", candidate.id);
    if (error) return { error };
    const { data } = await admin
      .from("research_entity_candidates")
      .select("id")
      .eq("id", candidate.id)
      .maybeSingle();
    return { error: data ? { message: "registro preservado (delete sem efeito)" } : null };
  });

  await expectBlocked("banco: inconsistência de extração não pode ser inserida pelo cliente", () =>
    owner.client.from("research_extraction_issues").insert({
      organization_id: org.id,
      valuation_case_id: kase.id,
      research_run_id: run.id,
      issue_type: "AMBIGUOUS_SUPPORT",
      detail: "inserção direta pelo cliente",
    }),
  );

  await expectBlocked("banco: consumo de IA não pode ser inserido pelo cliente", () =>
    owner.client.from("research_usage_events").insert({
      organization_id: org.id,
      valuation_case_id: kase.id,
      research_run_id: run.id,
      usage_type: "SEARCH",
    }),
  );

  // Cleanup: ephemeral users only. Domain rows are immutable by design.
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
}

async function main() {
  runStaticChecks();
  await runOfflineChecks();
  await runDatabaseChecks();

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${results.length - failed.length}/${results.length} verificações aprovadas${
      failed.length > 0 ? ` — ${failed.length} FALHA(S)` : ""
    }`,
  );
  if (failed.length > 0) process.exit(1);
}

void main();
