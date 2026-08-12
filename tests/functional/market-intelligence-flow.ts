/**
 * FUNCTIONAL (POSITIVE) FLOW TEST — MARKET EVIDENCE INTELLIGENCE & SAMPLE READINESS (fase 5)
 *
 * Prova que a camada de inteligência de mercado funciona ponta a ponta pelos
 * caminhos oficiais: identidade física, retratos com SHA-256, diagnósticos,
 * seleção de amostra, prontidão, questões de dados e isolamento entre casos.
 *
 * A service role é usada apenas para provisionar usuários efêmeros e fixtures
 * que o fluxo controlado do servidor grava (artefato/extração), além de leituras
 * independentes. Nenhuma asserção de governança é feita com ela.
 *
 * Run with:  bun run tests/functional/market-intelligence-flow.ts
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

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

function expectOk(name: string, error: { message: string } | null, detail = "ok") {
  record(name, !error, error ? `unexpected error: ${error.message.slice(0, 240)}` : detail);
  if (error) throw new Error(`${name}: ${error.message}`);
}

function expectFail(name: string, error: { message: string } | null) {
  record(
    name,
    !!error,
    error ? `recusado: ${error.message.slice(0, 200)}` : "SECURITY REGRESSION: operação aceita",
  );
}

const stamp = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const email = `mi-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Mi!${stamp}${label}Aa1`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn(${label}): ${signIn.error.message}`);
  return { id: data.user.id, client };
}

const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);

async function main() {
  console.log("=== SETUP ===");
  const owner = await createUser("owner");
  const valuer = await createUser("valuer");
  const reviewer = await createUser("reviewer");

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: `Market Intelligence Fixture ${stamp}`,
      slug: `mi-fixture-${stamp}`,
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (orgError) throw new Error(`org: ${orgError.message}`);
  const orgId = org.id as string;

  const members = await admin.from("organization_members").insert([
    { organization_id: orgId, user_id: owner.id, role: "OWNER", status: "ACTIVE" },
    { organization_id: orgId, user_id: valuer.id, role: "VALUER", status: "ACTIVE" },
    { organization_id: orgId, user_id: reviewer.id, role: "REVIEWER", status: "ACTIVE" },
  ]);
  if (members.error) throw new Error(`members: ${members.error.message}`);

  const mkCase = async (code: string, title: string) => {
    const { data, error } = await admin
      .from("valuation_cases")
      .insert({
        organization_id: orgId,
        case_code: code,
        title,
        purpose: "Suíte funcional de inteligência de mercado",
        valuation_date: day(0),
        status: "EVIDENCE_COLLECTION",
        created_by: owner.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`case ${code}: ${error.message}`);
    return data.id as string;
  };
  const caseA = await mkCase(`MI-A-${stamp}`, "Caso A — inteligência de mercado");
  const caseB = await mkCase(`MI-B-${stamp}`, "Caso B — isolamento");

  console.log("\n=== 1. SUBJECT PROPERTY ===");
  const subject = await valuer.client
    .from("properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseA,
      property_type_code: "APARTMENT",
      address_raw: "Rua do Avaliando, 1000",
      city: "São Paulo",
      state: "SP",
      district: "Centro",
      private_area: 110,
      bedrooms: 3,
      parking_spaces: null,
    })
    .select("id, private_area, parking_spaces")
    .single();
  expectOk("VALUER cadastra o imóvel avaliando (110 m²)", subject.error);
  record(
    "NULL != ZERO — parking_spaces ausente permanece UNKNOWN (NULL)",
    subject.data?.parking_spaces === null,
    `parking_spaces = ${JSON.stringify(subject.data?.parking_spaces)}`,
  );

  console.log("\n=== 2. EVIDENCE SOURCE / VERIFIED FIELD ===");
  const source = await valuer.client
    .from("evidence_sources")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseA,
      source_type: "REAL_ESTATE_LISTING",
      source_name: "Portal de anúncios (fixture de inteligência)",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("fonte de evidência registrada", source.error);

  const artifact = await admin
    .from("evidence_artifacts")
    .insert({
      organization_id: orgId,
      evidence_source_id: source.data!.id,
      storage_bucket: "evidence-originals",
      storage_path: `${orgId}/${caseA}/mi-${stamp}.pdf`,
      file_name: `mi-${stamp}.pdf`,
      hash_computed_by: "SERVER",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("artefato bruto registrado pelo fluxo controlado do servidor", artifact.error);

  const extraction = await admin
    .from("evidence_extractions")
    .insert({
      organization_id: orgId,
      artifact_id: artifact.data!.id,
      version_number: 1,
      processor_type: "MANUAL",
      status: "COMPLETED",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("extração manual registrada", extraction.error);

  const field = await valuer.client
    .from("evidence_fields")
    .insert({
      organization_id: orgId,
      extraction_id: extraction.data!.id,
      field_name: "private_area",
      raw_value: "100 m²",
      normalized_value: "100",
      numeric_value: 100,
      unit: "m2",
      field_state: "PRESENT",
      source_excerpt: "Área privativa: 100 m² (página 1, ficha do anúncio)",
      source_locator: { page: 1, section: "ficha do anúncio" },
      created_by: valuer.id,
    })
    .select("id, validation_status")
    .single();
  expectOk("VALUER produz candidato de campo (nunca fato verificado)", field.error);

  const verified = await reviewer.client.rpc("verify_evidence_field", {
    _field_id: field.data!.id,
    _notes: "conferido contra o documento original",
  });
  expectOk("REVIEWER verifica o campo pela operação oficial", verified.error);

  console.log("\n=== 3. MARKET PROPERTIES ===");
  const mkProperty = async (
    caseId: string,
    label: string,
    patch: Record<string, unknown> = {},
  ) => {
    const { data, error } = await valuer.client
      .from("market_properties")
      .insert({
        organization_id: orgId,
        valuation_case_id: caseId,
        label,
        property_type_code: "APARTMENT",
        city: "São Paulo",
        state: "SP",
        district: "Centro",
        created_by: valuer.id,
        ...patch,
      })
      .select("id, parking_spaces, private_area")
      .single();
    if (error) throw new Error(`market_property ${label}: ${error.message}`);
    return data;
  };

  const p1 = await mkProperty(caseA, "Anúncio A — canal 1", {
    address_raw: "Rua Alfa, 100 ap 51",
    private_area: 100,
    parking_spaces: 0,
    latitude: -23.55,
    longitude: -46.63,
  });
  const p2 = await mkProperty(caseA, "Anúncio A — canal 2", {
    address_raw: "Rua Alfa, 100 ap 51",
    private_area: 100,
  });
  const p3 = await mkProperty(caseA, "Anúncio A — canal 3", {
    address_raw: "Rua Alfa, 100 ap 51",
    private_area: 100,
  });
  const q1 = await mkProperty(caseA, "Anúncio B — canal 1", {
    address_raw: "Rua Beta, 200 ap 12",
    private_area: 95,
  });
  const q2 = await mkProperty(caseA, "Anúncio B — canal 2", {
    address_raw: "Rua Beta, 200 ap 12",
    private_area: 95,
  });
  const q3 = await mkProperty(caseA, "Anúncio B — canal 3", {
    address_raw: "Rua Beta, 200 ap 12",
    private_area: 95,
  });
  const r1 = await mkProperty(caseA, "Referência R1", {
    address_raw: "Rua Gama, 300",
    private_area: 100,
    bedrooms: 3,
    latitude: -23.56,
    longitude: -46.64,
  });
  const r2 = await mkProperty(caseA, "Referência R2", {
    address_raw: "Rua Delta, 400",
    private_area: 130,
  });
  record("8 imóveis de mercado cadastrados no caso A", true, "P1-P3, Q1-Q3, R1, R2");
  record(
    "KNOWN ZERO != UNKNOWN — parking_spaces = 0 é preservado como zero conhecido",
    p1.parking_spaces === 0 && p2.parking_spaces === null,
    `P1 = ${JSON.stringify(p1.parking_spaces)} / P2 = ${JSON.stringify(p2.parking_spaces)}`,
  );

  console.log("\n=== 4. MARKET OBSERVATIONS ===");
  const mkObservation = async (
    caseId: string,
    marketPropertyId: string,
    patch: Record<string, unknown>,
  ) => {
    const { data, error } = await valuer.client
      .from("market_observations")
      .insert({
        organization_id: orgId,
        valuation_case_id: caseId,
        market_property_id: marketPropertyId,
        currency_code: "BRL",
        evidence_source_id: source.data!.id,
        primary_artifact_id: artifact.data!.id,
        created_by: valuer.id,
        ...patch,
      })
      .select("id, observation_type, asking_price, transaction_price, observation_date")
      .single();
    if (error) throw new Error(`observation: ${error.message}`);
    return data;
  };

  const o1a = await mkObservation(caseA, p1.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 900000,
    observation_date: day(60),
    listing_url: "https://portal-alfa.example/anuncio/1",
    portal_name: "Portal Alfa",
  });
  const o1b = await mkObservation(caseA, p1.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 880000,
    observation_date: day(30),
    listing_url: "https://portal-beta.example/anuncio/2",
    portal_name: "Portal Beta",
  });
  const o1c = await mkObservation(caseA, p1.id, {
    observation_type: "SALE_LISTING",
    status: "REMOVED",
    asking_price: 870000,
    observation_date: day(5),
    listing_url: "https://portal-gama.example/anuncio/3",
    portal_name: "Portal Gama",
  });
  const o2 = await mkObservation(caseA, p2.id, {
    observation_type: "CLOSED_SALE",
    status: "UNKNOWN",
    transaction_price: 820000,
    transaction_date: day(3),
    transaction_evidence_status: "DOCUMENTED",
    publisher_name: "Cartório de registro",
  });
  await mkObservation(caseA, p3.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 895000,
    observation_date: day(20),
    portal_name: "Portal Delta",
  });
  const oq1 = await mkObservation(caseA, q1.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 700000,
    observation_date: day(25),
    portal_name: "Portal Alfa",
  });
  const oq2 = await mkObservation(caseA, q2.id, {
    observation_type: "CLOSED_SALE",
    status: "UNKNOWN",
    transaction_price: 660000,
    transaction_date: day(2),
    transaction_evidence_status: "DOCUMENTED",
    publisher_name: "Cartório de registro",
  });
  await mkObservation(caseA, q3.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 705000,
    observation_date: day(15),
    portal_name: "Portal Beta",
  });
  const or1 = await mkObservation(caseA, r1.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 850000,
    observation_date: day(10),
    portal_name: "Portal Alfa",
  });
  const or2 = await mkObservation(caseA, r2.id, {
    observation_type: "SALE_LISTING",
    status: "ACTIVE",
    asking_price: 1100000,
    observation_date: day(9),
    portal_name: "Portal Beta",
  });
  record(
    "observações registradas com data, origem e evidência vinculada",
    !!o1a.id && !!o2.id && !!or1.id && !!or2.id,
    "10 observações no caso A",
  );

  console.log("\n=== 5. IDENTIDADE AINDA NÃO CONFIRMADA ===");
  const mkMatch = async (a: { id: string }, b: { id: string }) => {
    const [left, right] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    const { data, error } = await valuer.client
      .from("property_match_candidates")
      .insert({
        organization_id: orgId,
        valuation_case_id: caseA,
        left_market_property_id: left,
        right_market_property_id: right,
        reason_codes: ["SAME_ADDRESS", "SAME_AREA"],
        deterministic_signals: { address_raw: "equal", private_area: "equal" },
        created_by: valuer.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`match: ${error.message}`);
    return data.id as string;
  };

  await mkMatch(q1, q2);
  await mkMatch(q2, q3);
  const metricsBefore = await valuer.client.rpc("market_universe_metrics", { _case_id: caseA });
  expectOk("market_universe_metrics disponível para membro da organização", metricsBefore.error);
  const mBefore = metricsBefore.data as Record<string, number>;
  record(
    "duplicidade apenas indicada NÃO reduz imóveis independentes (3 registros = 3 identidades)",
    mBefore["market_property_count"] === 8 && mBefore["independent_property_count"] === 8,
    `registros = ${mBefore["market_property_count"]}, independentes = ${mBefore["independent_property_count"]}`,
  );
  record(
    "duplicidades sem decisão humana são contabilizadas como pendências",
    mBefore["unresolved_duplicate_count"] === 2,
    `unresolved_duplicate_count = ${mBefore["unresolved_duplicate_count"]}`,
  );

  console.log("\n=== 6. IDENTIDADE FÍSICA CONFIRMADA ===");
  const m12 = await mkMatch(p1, p2);
  const m13 = await mkMatch(p1, p3);
  for (const [label, id] of [
    ["P1~P2", m12],
    ["P1~P3", m13],
  ] as const) {
    const res = await reviewer.client.rpc("resolve_property_match", {
      _match_id: id,
      _status: "CONFIRMED_SAME",
      _notes: `mesmo imóvel físico anunciado em canais distintos (${label})`,
    });
    expectOk(`REVIEWER confirma duplicidade ${label} por resolve_property_match`, res.error);
  }

  const clusterAttemptWithoutReason = await reviewer.client.rpc(
    "confirm_market_identity_cluster",
    {
      _case_id: caseA,
      _market_property_ids: [p1.id, p2.id, p3.id],
      _representative_market_property_id: p1.id,
      _reason: "   ",
    },
  );
  expectFail(
    "confirmação de identidade sem justificativa técnica é recusada",
    clusterAttemptWithoutReason.error,
  );

  const clusterByValuer = await valuer.client.rpc("confirm_market_identity_cluster", {
    _case_id: caseA,
    _market_property_ids: [p1.id, p2.id, p3.id],
    _representative_market_property_id: p1.id,
    _reason: "mesma unidade: endereço, área e identificação de unidade idênticos",
  });
  expectFail("VALUER não confirma identidade física (exige papel de revisão)", clusterByValuer.error);

  const cluster = await reviewer.client.rpc("confirm_market_identity_cluster", {
    _case_id: caseA,
    _market_property_ids: [p1.id, p2.id, p3.id],
    _representative_market_property_id: p1.id,
    _reason: "mesma unidade: endereço, área e identificação de unidade idênticos",
  });
  expectOk("REVIEWER confirma o agrupamento de identidade física", cluster.error);

  const metricsAfter = (
    await valuer.client.rpc("market_universe_metrics", { _case_id: caseA })
  ).data as Record<string, number>;
  record(
    "3 registros confirmados = 1 imóvel físico independente (8 registros -> 6 identidades)",
    metricsAfter["market_property_count"] === 8 &&
      metricsAfter["independent_property_count"] === 6 &&
      metricsAfter["identity_cluster_count"] === 1,
    `registros = ${metricsAfter["market_property_count"]}, independentes = ${metricsAfter["independent_property_count"]}, clusters = ${metricsAfter["identity_cluster_count"]}`,
  );
  const survivors = await admin
    .from("market_properties")
    .select("id")
    .in("id", [p1.id, p2.id, p3.id]);
  record(
    "nenhum registro histórico é removido pela confirmação de identidade",
    (survivors.data?.length ?? 0) === 3,
    `${survivors.data?.length ?? 0} registros preservados`,
  );

  console.log("\n=== 7. OBSERVAÇÕES TEMPORAIS DA MESMA IDENTIDADE ===");
  const clusterMembers = await admin
    .from("market_identity_cluster_members")
    .select("market_property_id")
    .eq("cluster_id", cluster.data as string);
  const memberIds = (clusterMembers.data ?? []).map((m) => m.market_property_id as string);
  const clusterObs = await admin
    .from("market_observations")
    .select("id, observation_date, observation_type")
    .in("market_property_id", memberIds);
  const p1Obs = await admin
    .from("market_observations")
    .select("id, observation_date")
    .eq("market_property_id", p1.id)
    .order("observation_date", { ascending: true });
  record(
    "1 identidade física com 3 observações em datas distintas: todas preservadas",
    (p1Obs.data?.length ?? 0) === 3 &&
      new Set(p1Obs.data!.map((o) => o.observation_date)).size === 3,
    `${p1Obs.data?.length ?? 0} observações: ${p1Obs.data?.map((o) => o.observation_date).join(", ")}`,
  );
  record(
    "o agrupamento não colapsa observações: o cluster mantém 5 leituras",
    (clusterObs.data?.length ?? 0) === 5,
    `${clusterObs.data?.length ?? 0} observações no cluster`,
  );
  record(
    "o cluster inclui as observações de oferta e a de transação (asking != transaction)",
    clusterObs.data!.some((o) => o.observation_type === "SALE_LISTING") &&
      clusterObs.data!.some((o) => o.observation_type === "CLOSED_SALE"),
    clusterObs.data!.map((o) => o.observation_type).join(", "),
  );

  console.log("\n=== 8. ASKING-TO-TRANSACTION OBSERVADO ===");
  const askingToTransaction = async (ids: string[]) => {
    const { data } = await admin
      .from("market_observations")
      .select("observation_type, asking_price, transaction_price, observation_date")
      .in("market_property_id", ids);
    const asking = (data ?? [])
      .filter((o) => o.observation_type === "SALE_LISTING" && o.asking_price !== null)
      .sort((a, b) => String(b.observation_date).localeCompare(String(a.observation_date)))[0];
    const closed = (data ?? []).find(
      (o) => o.observation_type === "CLOSED_SALE" && o.transaction_price !== null,
    );
    if (!asking || !closed) return null;
    return Number(closed.transaction_price) - Number(asking.asking_price);
  };
  const deltaConfirmed = await askingToTransaction(memberIds);
  record(
    "cenário A — identidade confirmada: delta oferta->transação observado é derivável",
    deltaConfirmed !== null,
    `delta = ${deltaConfirmed}`,
  );
  const q1Delta = await askingToTransaction([q1.id]);
  const q2Delta = await askingToTransaction([q2.id]);
  record(
    "cenário B — sem identidade confirmada: nenhum registro sustenta o delta oferta->transação",
    q1Delta === null && q2Delta === null,
    `Q1 = ${q1Delta}, Q2 = ${q2Delta} (observações ${oq1.id.slice(0, 8)} / ${oq2.id.slice(0, 8)} permanecem separadas)`,
  );

  console.log("\n=== 9. KNOWN / VERIFIED / UNKNOWN / CONFLICTING ===");
  const mkAttr = async (marketPropertyId: string, patch: Record<string, unknown>) => {
    const { error } = await valuer.client.from("property_attribute_observations").insert({
      organization_id: orgId,
      valuation_case_id: caseA,
      market_property_id: marketPropertyId,
      attribute_name: "private_area",
      unit: "m2",
      created_by: valuer.id,
      ...patch,
    });
    if (error) throw new Error(`attribute observation: ${error.message}`);
  };
  await mkAttr(r1.id, {
    raw_value: "100 m²",
    numeric_value: 100,
    knowledge_state: "KNOWN",
    value_origin: "EVIDENCE_EXTRACTION",
    evidence_field_id: field.data!.id,
    evidence_source_id: source.data!.id,
  });
  await mkAttr(r2.id, {
    raw_value: "130 m² (informado pelo corretor, sem documento)",
    numeric_value: 130,
    knowledge_state: "KNOWN",
    value_origin: "MANUAL_USER_INPUT",
  });
  await mkAttr(q1.id, {
    raw_value: null,
    numeric_value: null,
    knowledge_state: "UNKNOWN",
    value_origin: "MANUAL_USER_INPUT",
  });
  await mkAttr(q2.id, {
    raw_value: "97 m²",
    numeric_value: 97,
    knowledge_state: "CONFLICTING",
    value_origin: "MANUAL_USER_INPUT",
  });
  const attrRows = await admin
    .from("property_attribute_observations")
    .select("knowledge_state, evidence_field_id")
    .eq("valuation_case_id", caseA);
  const countBy = (state: string) =>
    (attrRows.data ?? []).filter((a) => a.knowledge_state === state).length;
  const knownCount = countBy("KNOWN");
  const verifiedBackedCount = (attrRows.data ?? []).filter(
    (a) => a.knowledge_state === "KNOWN" && a.evidence_field_id !== null,
  ).length;
  record(
    "KNOWN, UNKNOWN e CONFLICTING são contabilizados de forma independente",
    knownCount === 2 && countBy("UNKNOWN") === 1 && countBy("CONFLICTING") === 1,
    `KNOWN = ${knownCount}, UNKNOWN = ${countBy("UNKNOWN")}, CONFLICTING = ${countBy("CONFLICTING")}`,
  );
  record(
    "KNOWN nunca é tratado automaticamente como VERIFIED",
    knownCount === 2 && verifiedBackedCount === 1,
    `${knownCount} conhecidos, apenas ${verifiedBackedCount} lastreado(s) em campo verificado`,
  );
  record(
    "divergência é preservada até adoção humana (nenhuma reconciliação automática)",
    countBy("CONFLICTING") === 1 && metricsAfter["attribute_conflict_count"] >= 0,
    "atributo CONFLICTING permanece registrado",
  );

  console.log("\n=== 10. COMPARABLE CANDIDATES E CARACTERÍSTICAS FACTUAIS ===");
  const mkCandidate = async (marketPropertyId: string, observationId: string) => {
    const { data, error } = await valuer.client
      .from("comparable_candidates")
      .insert({
        organization_id: orgId,
        valuation_case_id: caseA,
        subject_property_id: subject.data!.id,
        market_property_id: marketPropertyId,
        market_observation_id: observationId,
        created_by: valuer.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(`candidate: ${error.message}`);
    return data.id as string;
  };
  const candidate1 = await mkCandidate(r1.id, or1.id);
  const candidate2 = await mkCandidate(r2.id, or2.id);
  const candidate3 = await mkCandidate(p1.id, o1b.id);

  const featureSnapshot = await valuer.client.rpc("build_comparable_feature_snapshot", {
    _candidate_id: candidate1,
  });
  expectOk("retrato factual de características gerado para o candidato R1", featureSnapshot.error);
  const featureRow = await admin
    .from("comparable_feature_snapshots")
    .select("features, derivation_version")
    .eq("id", featureSnapshot.data as string)
    .single();
  const features = (featureRow.data?.features ?? {}) as Record<string, unknown>;
  record(
    "avaliando 110 m² x referência 100 m²: delta de área = -10 m²",
    Number(features["private_area_delta_m2"]) === -10,
    `private_area_delta_m2 = ${features["private_area_delta_m2"]}`,
  );
  record(
    "razão de área = 100 / 110 (fato observado, não ajuste)",
    Math.abs(Number(features["private_area_ratio"]) - 100 / 110) < 1e-5,
    `private_area_ratio = ${features["private_area_ratio"]}`,
  );
  const featureKeys = Object.keys(features).map((k) => k.toLowerCase());
  record(
    "nenhum ajuste monetário, fator ou impacto de valor é produzido",
    features["semantics"] === "FACTUAL_DIFFERENCE_ONLY_NOT_AN_ADJUSTMENT" &&
      !featureKeys.some(
        (k) =>
          k.includes("factor") ||
          k.includes("fator") ||
          k.includes("adjust") ||
          k.includes("weight") ||
          k.includes("homogen"),
      ),
    `semantics = ${features["semantics"]}`,
  );

  console.log("\n=== 11. DECISÃO DE COMPARÁVEIS ===");
  for (const id of [candidate1, candidate2, candidate3]) {
    const a = await valuer.client.rpc("decide_comparable", {
      _candidate_id: id,
      _candidate_status: "UNDER_REVIEW",
      _inclusion_status: null,
      _reason_code: null,
      _notes: "em análise",
    });
    expectOk(`candidato ${id.slice(0, 8)} movido para UNDER_REVIEW`, a.error);
    const b = await valuer.client.rpc("decide_comparable", {
      _candidate_id: id,
      _candidate_status: "ELIGIBLE",
      _inclusion_status: null,
      _reason_code: null,
      _notes: "elegível para composição",
    });
    expectOk(`candidato ${id.slice(0, 8)} movido para ELIGIBLE`, b.error);
  }
  const excludeDecision = await reviewer.client.rpc("decide_comparable", {
    _candidate_id: candidate2,
    _candidate_status: null,
    _inclusion_status: "EXCLUDED",
    _reason_code: "AREA_OUT_OF_SCOPE",
    _notes: "área de 130 m² fora do intervalo de pesquisa declarado",
  });
  expectOk("REVIEWER exclui o candidato R2 com código e justificativa", excludeDecision.error);

  console.log("\n=== 12. MARKET EVIDENCE SNAPSHOT ===");
  const snapshot = await valuer.client.rpc("create_market_evidence_snapshot", {
    _case_id: caseA,
    _description: "Retrato do universo de mercado para seleção de amostra",
  });
  expectOk("retrato do universo criado", snapshot.error);
  const snapshotId = snapshot.data as string;
  const snapBefore = await admin
    .from("market_evidence_snapshots")
    .select("snapshot_manifest, snapshot_hash, observation_count, independent_property_count")
    .eq("id", snapshotId)
    .single();
  const integrity1 = await valuer.client.rpc("verify_snapshot_integrity", {
    _kind: "MARKET_EVIDENCE",
    _snapshot_id: snapshotId,
  });
  record(
    "verificação de integridade do retrato = VALID",
    (integrity1.data as Record<string, string>)?.["result"] === "VALID",
    JSON.stringify(integrity1.data ?? integrity1.error?.message),
  );

  const priceChange = await valuer.client.rpc("record_price_observation", {
    _observation_id: or1.id,
    _asking_price: 830000,
    _asking_monthly_rent: null,
    _observed_at: new Date().toISOString(),
    _status: "ACTIVE",
    _evidence_source_id: source.data!.id,
    _evidence_field_id: null,
    _notes: "redução legítima de preço pedido após o retrato",
  });
  expectOk("alteração legítima do registro vivo após o retrato", priceChange.error);

  const snapAfter = await admin
    .from("market_evidence_snapshots")
    .select("snapshot_manifest, snapshot_hash")
    .eq("id", snapshotId)
    .single();
  record(
    "o retrato histórico permanece idêntico após a mudança no registro vivo",
    JSON.stringify(snapBefore.data?.snapshot_manifest) ===
      JSON.stringify(snapAfter.data?.snapshot_manifest) &&
      snapBefore.data?.snapshot_hash === snapAfter.data?.snapshot_hash,
    `hash = ${String(snapAfter.data?.snapshot_hash).slice(0, 16)}...`,
  );
  const integrity2 = await valuer.client.rpc("verify_snapshot_integrity", {
    _kind: "MARKET_EVIDENCE",
    _snapshot_id: snapshotId,
  });
  record(
    "integridade continua VALID depois da alteração operacional",
    (integrity2.data as Record<string, string>)?.["result"] === "VALID",
    JSON.stringify(integrity2.data ?? integrity2.error?.message),
  );

  console.log("\n=== 13. SELEÇÃO DE AMOSTRA ===");
  const run = await valuer.client.rpc("start_sample_selection", {
    _case_id: caseA,
    _market_evidence_snapshot_id: snapshotId,
    _purpose: "Seleção de amostra para revisão metodológica",
    _notes: "fixture funcional",
  });
  expectOk("processo de seleção iniciado a partir do retrato", run.error);
  const runId = run.data as string;

  const items = await admin
    .from("sample_selection_items")
    .select("id, market_observation_id, comparable_candidate_id, final_state")
    .eq("selection_run_id", runId);
  record(
    "todos os candidatos entram no processo de seleção",
    (items.data?.length ?? 0) === 3,
    `${items.data?.length ?? 0} elementos`,
  );

  const selectR1 = await valuer.client.rpc("decide_sample_selection_item", {
    _run_id: runId,
    _market_observation_id: or1.id,
    _final_state: "SELECTED",
    _reason_code: null,
    _reason: "referência compatível com o avaliando",
  });
  expectOk("elemento R1 selecionado", selectR1.error);
  const selectP1 = await valuer.client.rpc("decide_sample_selection_item", {
    _run_id: runId,
    _market_observation_id: o1b.id,
    _final_state: "SELECTED",
    _reason_code: null,
    _reason: "identidade confirmada, leitura mais recente do canal 2",
  });
  expectOk("elemento do cluster selecionado", selectP1.error);
  const excludeNoCode = await valuer.client.rpc("decide_sample_selection_item", {
    _run_id: runId,
    _market_observation_id: or2.id,
    _final_state: "EXCLUDED",
    _reason_code: null,
    _reason: "sem código",
  });
  expectFail("exclusão sem código catalogado é recusada", excludeNoCode.error);
  const excludeR2 = await valuer.client.rpc("decide_sample_selection_item", {
    _run_id: runId,
    _market_observation_id: or2.id,
    _final_state: "EXCLUDED",
    _reason_code: "AREA_OUT_OF_SCOPE",
    _reason: "área de 130 m² fora do intervalo de pesquisa declarado",
  });
  expectOk("elemento R2 excluído com código e justificativa", excludeR2.error);

  const completed = await valuer.client.rpc("complete_sample_selection", {
    _run_id: runId,
    _notes: "seleção encerrada para avaliação de prontidão",
  });
  expectOk("seleção encerrada e retrato da amostra produzido", completed.error);
  const selectionSnapshotId = completed.data as string;
  const selSnap = await admin
    .from("sample_selection_snapshots")
    .select("selected_count, excluded_count, snapshot_hash")
    .eq("id", selectionSnapshotId)
    .single();
  record(
    "universo (10 observações) x amostra selecionada (2) permanece explícito",
    Number(selSnap.data?.selected_count) === 2 && Number(selSnap.data?.excluded_count) === 1,
    `selecionados = ${selSnap.data?.selected_count}, excluídos = ${selSnap.data?.excluded_count}, universo = ${snapBefore.data?.observation_count}`,
  );
  const selIntegrity = await valuer.client.rpc("verify_snapshot_integrity", {
    _kind: "SAMPLE_SELECTION",
    _snapshot_id: selectionSnapshotId,
  });
  record(
    "integridade do retrato da amostra = VALID",
    (selIntegrity.data as Record<string, string>)?.["result"] === "VALID",
    JSON.stringify(selIntegrity.data ?? selIntegrity.error?.message),
  );

  console.log("\n=== 14. EXCLUÍDO != DELETADO ===");
  const excludedItem = await admin
    .from("sample_selection_items")
    .select("final_state, reason_code, reason, actor_user_id")
    .eq("selection_run_id", runId)
    .eq("market_observation_id", or2.id)
    .single();
  const excludedCandidate = await admin
    .from("comparable_candidates")
    .select("inclusion_status, exclusion_reason_code")
    .eq("id", candidate2)
    .single();
  const excludedHistory = await admin
    .from("comparable_decision_history")
    .select("new_inclusion_status")
    .eq("candidate_id", candidate2);
  const selManifest = await admin
    .from("sample_selection_snapshots")
    .select("snapshot_manifest")
    .eq("id", selectionSnapshotId)
    .single();
  record(
    "o comparável excluído permanece no processo de seleção com motivo e autor",
    excludedItem.data?.final_state === "EXCLUDED" &&
      excludedItem.data?.reason_code === "AREA_OUT_OF_SCOPE" &&
      !!excludedItem.data?.actor_user_id,
    `${excludedItem.data?.final_state} / ${excludedItem.data?.reason_code}`,
  );
  record(
    "o comparável excluído permanece no acervo e no histórico de decisão",
    excludedCandidate.data?.inclusion_status === "EXCLUDED" &&
      (excludedHistory.data?.length ?? 0) >= 1,
    `${excludedHistory.data?.length ?? 0} decisão(ões) registradas`,
  );
  record(
    "o retrato da amostra registra o excluído (auditável)",
    JSON.stringify(selManifest.data?.snapshot_manifest).includes(or2.id),
    "observação excluída presente no manifesto",
  );

  console.log("\n=== 15. PRONTIDÃO (READINESS) ===");
  const policy = await admin
    .from("market_diagnostic_policies")
    .select("id, version")
    .is("organization_id", null)
    .eq("status", "ACTIVE")
    .limit(1)
    .single();
  const assessment = await valuer.client.rpc("assess_sample_readiness", {
    _case_id: caseA,
    _market_evidence_snapshot_id: snapshotId,
    _sample_selection_snapshot_id: selectionSnapshotId,
    _policy_id: policy.data!.id,
  });
  expectOk("avaliação de prontidão executada", assessment.error);
  const assessmentId = assessment.data as string;
  const assessmentRow = await admin
    .from("sample_readiness_assessments")
    .select(
      "readiness_state, hard_blockers, warnings, diagnostic_policy_version, feature_derivation_version, computed_by",
    )
    .eq("id", assessmentId)
    .single();
  const warnings = (assessmentRow.data?.warnings ?? []) as Array<Record<string, string>>;
  record(
    "prontidão produz estado explícito com alertas versionados",
    ["READY_WITH_WARNINGS", "NOT_READY", "READY_FOR_METHOD_REVIEW"].includes(
      String(assessmentRow.data?.readiness_state),
    ) && !!assessmentRow.data?.diagnostic_policy_version,
    `${assessmentRow.data?.readiness_state} — política ${assessmentRow.data?.diagnostic_policy_version}, alertas: ${warnings.map((w) => w["code"]).join(", ") || "nenhum"}`,
  );
  record(
    "prontidão é determinística: computada pelo diagnóstico do banco, sem IA",
    assessmentRow.data?.computed_by === "SYSTEM_DIAGNOSTIC",
    `computed_by = ${assessmentRow.data?.computed_by}`,
  );

  const assessment2 = await valuer.client.rpc("assess_sample_readiness", {
    _case_id: caseA,
    _market_evidence_snapshot_id: snapshotId,
    _sample_selection_snapshot_id: selectionSnapshotId,
    _policy_id: policy.data!.id,
  });
  const assessmentRow2 = await admin
    .from("sample_readiness_assessments")
    .select("readiness_state, warnings, version_number")
    .eq("id", assessment2.data as string)
    .single();
  record(
    "reexecução com os mesmos retratos e a mesma política produz o mesmo resultado",
    assessmentRow2.data?.readiness_state === assessmentRow.data?.readiness_state &&
      JSON.stringify(assessmentRow2.data?.warnings) === JSON.stringify(assessmentRow.data?.warnings),
    `versão ${assessmentRow2.data?.version_number} reproduz ${assessmentRow2.data?.readiness_state}`,
  );

  console.log("\n=== 16. CIÊNCIA DOS ALERTAS ===");
  const ackByValuer = await valuer.client.rpc("acknowledge_readiness_warnings", {
    _assessment_id: assessmentId,
    _notes: "ciente dos alertas",
  });
  expectFail("VALUER não registra ciência dos alertas (exige papel de revisão)", ackByValuer.error);
  const ackEmpty = await reviewer.client.rpc("acknowledge_readiness_warnings", {
    _assessment_id: assessmentId,
    _notes: "   ",
  });
  expectFail("ciência sem registro textual é recusada", ackEmpty.error);
  const ack = await reviewer.client.rpc("acknowledge_readiness_warnings", {
    _assessment_id: assessmentId,
    _notes:
      "Ressalvas assumidas: base predominantemente de ofertas e cobertura verificada parcial; limitação declarada no laudo.",
  });
  expectOk("REVIEWER registra ciência das ressalvas", ack.error);
  const acked = await admin
    .from("sample_readiness_assessments")
    .select("readiness_state, warnings, acknowledged_by, acknowledged_at, acknowledgement_notes")
    .eq("id", assessmentId)
    .single();
  record(
    "ciência não apaga alertas nem altera o estado de prontidão",
    JSON.stringify(acked.data?.warnings) === JSON.stringify(assessmentRow.data?.warnings) &&
      acked.data?.readiness_state === assessmentRow.data?.readiness_state,
    `estado = ${acked.data?.readiness_state}, alertas preservados`,
  );
  record(
    "ciência registra autor, momento e nota (acknowledgement != resolução)",
    acked.data?.acknowledged_by === reviewer.id &&
      !!acked.data?.acknowledged_at &&
      String(acked.data?.acknowledgement_notes).includes("Ressalvas assumidas"),
    `acknowledged_by = ${String(acked.data?.acknowledged_by).slice(0, 8)}..., em ${acked.data?.acknowledged_at}`,
  );

  console.log("\n=== 17. QUESTÕES DE DADOS DE MERCADO ===");
  const refreshed = await valuer.client.rpc("refresh_market_data_issues", {
    _case_id: caseA,
    _policy_id: policy.data!.id,
  });
  expectOk("diagnóstico de questões de dados executado", refreshed.error);
  const issues = await admin
    .from("market_data_issues")
    .select("id, issue_type, severity, status, rule_version, detail")
    .eq("valuation_case_id", caseA);
  record(
    "questões abertas são registradas com tipo, severidade e versão de regra",
    (issues.data?.length ?? 0) > 0 && issues.data!.every((i) => !!i.rule_version),
    `${issues.data?.length ?? 0} questão(ões): ${issues.data?.map((i) => i.issue_type).join(", ")}`,
  );

  const issueId = issues.data![0]!.id as string;
  const ackIssue = await valuer.client.rpc("acknowledge_market_data_issue", {
    _issue_id: issueId,
    _notes: "ciência registrada pela equipe técnica",
  });
  expectOk("ciência de questão de dados registrada", ackIssue.error);
  const resolveByValuer = await valuer.client.rpc("resolve_market_data_issue", {
    _issue_id: issueId,
    _notes: "resolvido",
  });
  expectFail("VALUER não resolve questão de dados (exige papel de revisão)", resolveByValuer.error);
  const resolveIssue = await reviewer.client.rpc("resolve_market_data_issue", {
    _issue_id: issueId,
    _notes: "Questão tratada: origem complementada com segunda fonte independente.",
  });
  expectOk("REVIEWER resolve a questão com justificativa", resolveIssue.error);
  const events = await admin
    .from("market_data_issue_events")
    .select("previous_status, new_status, actor_user_id")
    .eq("issue_id", issueId)
    .order("id", { ascending: true });
  record(
    "o ciclo de vida da questão é preservado como histórico (OPEN -> ACKNOWLEDGED -> RESOLVED)",
    (events.data?.length ?? 0) >= 2 &&
      events.data!.some((e) => e.new_status === "ACKNOWLEDGED") &&
      events.data!.some((e) => e.new_status === "RESOLVED"),
    events.data!.map((e) => `${e.previous_status}->${e.new_status}`).join(", "),
  );

  console.log("\n=== 18. LACUNAS DE PESQUISA (RESEARCH GAP) ===");
  const report = await valuer.client.rpc("market_intelligence_report", { _case_id: caseA });
  expectOk("relatório de inteligência de mercado disponível", report.error);
  const reportJson = report.data as Record<string, unknown>;
  const metricsFinal = (reportJson["metrics"] ?? {}) as Record<string, number>;
  record(
    "o relatório declara a lacuna de pesquisa: nenhuma captura de pesquisa neste caso",
    Number(metricsFinal["search_result_count"]) === 0 &&
      Number(metricsFinal["captured_source_count"]) === 0,
    `resultados de busca = ${metricsFinal["search_result_count"]}, capturas = ${metricsFinal["captured_source_count"]}`,
  );
  record(
    "o relatório expõe cobertura verificada, origem, tempo e espaço em uma única leitura",
    ["observations_with_verified_evidence", "top_domain", "properties_without_geo"].every(
      (k) => k in metricsFinal,
    ),
    Object.keys(metricsFinal).length + " métricas factuais",
  );

  console.log("\n=== 19. PRONTIDÃO É DETERMINÍSTICA (ARQUITETURA) ===");
  const intelligenceSources = [
    "src/lib/market-intelligence.server.ts",
    "src/lib/market-intelligence.functions.ts",
    "src/lib/domain/intelligence.ts",
  ];
  const aiTokens = ["anthropic", "research/provider", "ResearchProvider", "llm", "openai"];
  const contaminated = intelligenceSources.filter((path) => {
    const content = readFileSync(path, "utf8").toLowerCase();
    return aiTokens.some((t) => content.includes(t.toLowerCase()));
  });
  record(
    "a camada de prontidão não importa provedor de IA, LLM ou pesquisa externa",
    contaminated.length === 0,
    contaminated.length === 0 ? intelligenceSources.join(", ") : `contaminado: ${contaminated.join(", ")}`,
  );

  console.log("\n=== 20. ISOLAMENTO ENTRE CASOS ===");
  const foreignCluster = await reviewer.client.rpc("confirm_market_identity_cluster", {
    _case_id: caseB,
    _market_property_ids: [q1.id, q2.id],
    _representative_market_property_id: q1.id,
    _reason: "tentativa de usar imóveis do caso A no caso B",
  });
  expectFail("cluster de identidade não aceita imóveis de outro caso", foreignCluster.error);

  const foreignRun = await valuer.client.rpc("start_sample_selection", {
    _case_id: caseB,
    _market_evidence_snapshot_id: snapshotId,
    _purpose: "tentativa de reutilizar o retrato do caso A",
    _notes: null,
  });
  expectFail("seleção do caso B não aceita o retrato do universo do caso A", foreignRun.error);

  const foreignReadiness = await valuer.client.rpc("assess_sample_readiness", {
    _case_id: caseB,
    _market_evidence_snapshot_id: snapshotId,
    _sample_selection_snapshot_id: selectionSnapshotId,
    _policy_id: policy.data!.id,
  });
  expectFail("prontidão do caso B não aceita retratos do caso A", foreignReadiness.error);

  const subjectB = await valuer.client
    .from("properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseB,
      property_type_code: "APARTMENT",
      address_raw: "Rua do Caso B, 1",
      city: "São Paulo",
      state: "SP",
      private_area: 90,
    })
    .select("id")
    .single();
  expectOk("imóvel avaliando do caso B criado", subjectB.error);
  const crossCandidate = await valuer.client
    .from("comparable_candidates")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseB,
      subject_property_id: subjectB.data!.id,
      market_property_id: r1.id,
      market_observation_id: or1.id,
      created_by: valuer.id,
    })
    .select("id")
    .single();
  if (crossCandidate.error) {
    record(
      "candidato a comparável não cruza casos (recusado já na criação)",
      true,
      `recusado: ${crossCandidate.error.message.slice(0, 160)}`,
    );
  } else {
    const crossFeature = await valuer.client.rpc("build_comparable_feature_snapshot", {
      _candidate_id: crossCandidate.data!.id,
    });
    expectFail(
      "retrato de características recusa contaminação cross-case",
      crossFeature.error,
    );
  }

  const foreignSnapshotRead = await admin
    .from("market_evidence_snapshots")
    .select("id")
    .eq("valuation_case_id", caseB);
  record(
    "nenhum retrato do caso A é atribuído ao caso B",
    (foreignSnapshotRead.data?.length ?? 0) === 0,
    `${foreignSnapshotRead.data?.length ?? 0} retrato(s) no caso B`,
  );

  console.log("\n=== CLEANUP ===");
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  await admin
    .from("organizations")
    .update({ name: `ZZ-MARKET-INTELLIGENCE-TEST-FIXTURE-${stamp}` })
    .eq("id", orgId);
  console.log("usuários efêmeros removidos; linhas append-only permanecem por desenho");

  const failed = results.filter((r) => !r.passed);
  console.log(`\n===== SUMMARY =====`);
  console.log(
    `total: ${results.length}  passed: ${results.length - failed.length}  failed: ${failed.length}`,
  );
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
