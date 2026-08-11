/**
 * FUNCTIONAL (POSITIVE) FLOW TEST — market & comparable intelligence
 *
 * Proves that legitimate users can still operate the platform end to end after
 * the forensic hardening: the negative suite proves bypasses fail, this suite
 * proves the official paths work.
 *
 * Every domain mutation goes through the real Data API / RPCs as a signed-in
 * user. The service role is used ONLY for provisioning ephemeral users and the
 * organization/case/property fixtures, and for independent read-back.
 *
 * Run with:  bun run tests/functional/market-flow.ts
 */
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
  record(name, !error, error ? `unexpected error: ${error.message.slice(0, 220)}` : detail);
  if (error) throw new Error(`${name}: ${error.message}`);
}

const stamp = Date.now();
const createdUserIds: string[] = [];

async function createUser(label: string) {
  const email = `fun-${label}-${stamp}@valuation-functional-test.local`;
  const password = `Fun!${stamp}${label}Aa1`;
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

async function main() {
  console.log("=== SETUP (service role: users, org, case, subject property) ===");
  const owner = await createUser("owner");
  const valuer = await createUser("valuer");

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: `Functional Fixture ${stamp}`,
      slug: `functional-fixture-${stamp}`,
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (orgError) throw new Error(`org: ${orgError.message}`);
  const orgId = org.id as string;

  const memberInsert = await admin.from("organization_members").insert([
    { organization_id: orgId, user_id: owner.id, role: "OWNER", status: "ACTIVE" },
    { organization_id: orgId, user_id: valuer.id, role: "VALUER", status: "ACTIVE" },
  ]);
  if (memberInsert.error) throw new Error(`members: ${memberInsert.error.message}`);

  const { data: kase, error: caseError } = await admin
    .from("valuation_cases")
    .insert({
      organization_id: orgId,
      case_code: `FUN-${stamp}`,
      title: "Caso funcional de mercado",
      purpose: "Teste funcional positivo",
      status: "EVIDENCE_COLLECTION",
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (caseError) throw new Error(`case: ${caseError.message}`);
  const caseId = kase.id as string;

  console.log("\n=== 1. SUBJECT PROPERTY (avaliando) ===");
  const subject = await valuer.client
    .from("properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      property_type_code: "APARTMENT",
      address_raw: "Rua do Teste Funcional, 100",
      city: "São Paulo",
      state: "SP",
      private_area: 85,
      bedrooms: 3,
      parking_spaces: null,
    })
    .select("id, parking_spaces")
    .single();
  expectOk("VALUER creates the subject property", subject.error);

  console.log("\n=== 2. UNKNOWN != ZERO ===");
  record(
    "subject property parking_spaces = NULL stays NULL",
    subject.data?.parking_spaces === null,
    `parking_spaces = ${JSON.stringify(subject.data?.parking_spaces)}`,
  );
  const zeroParking = await valuer.client
    .from("market_properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      label: "Imóvel sem vaga (zero declarado)",
      parking_spaces: 0,
      created_by: valuer.id,
    })
    .select("id, parking_spaces")
    .single();
  expectOk("market property with an explicit 0 is accepted", zeroParking.error);
  record(
    "an explicit parking_spaces = 0 stays 0 and is never turned into NULL",
    zeroParking.data?.parking_spaces === 0,
    `parking_spaces = ${JSON.stringify(zeroParking.data?.parking_spaces)}`,
  );

  console.log("\n=== 3. EVIDENCE SOURCE / FIELD (official path) ===");
  const source = await valuer.client
    .from("evidence_sources")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      source_type: "REAL_ESTATE_LISTING",
      source_name: "Portal de anúncios (fixture funcional)",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("VALUER registers an evidence source", source.error);

  // Artifacts and extractions are written by the controlled server-side flow
  // (server computes the SHA-256 from the stored bytes), so authenticated users
  // have no direct INSERT grant. This mirrors that server path.
  const artifact = await admin
    .from("evidence_artifacts")
    .insert({
      organization_id: orgId,
      evidence_source_id: source.data!.id,
      storage_bucket: "evidence-originals",
      storage_path: `${orgId}/${caseId}/functional-${stamp}.pdf`,
      file_name: `functional-${stamp}.pdf`,
      hash_computed_by: "SERVER",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("server-side controlled flow registers an evidence artifact", artifact.error);

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
  expectOk("server-side controlled flow registers a manual extraction", extraction.error);

  const field = await valuer.client
    .from("evidence_fields")
    .insert({
      organization_id: orgId,
      extraction_id: extraction.data!.id,
      field_name: "private_area",
      raw_value: "78 m²",
      normalized_value: "78",
      numeric_value: 78,
      unit: "m2",
      field_state: "PRESENT",
      created_by: valuer.id,
    })
    .select("id, validation_status")
    .single();
  expectOk(
    "VALUER produces a candidate evidence field (never a verified fact)",
    field.error,
    `validation_status = ${field.data?.validation_status}`,
  );

  const verify = await owner.client.rpc("verify_evidence_field", {
    _field_id: field.data!.id,
    _notes: "conferido contra o documento original",
  });
  expectOk("OWNER (review authority) verifies the field through verify_evidence_field", verify.error);

  console.log("\n=== 4. MARKET PROPERTY + SALE_LISTING OBSERVATION ===");
  const marketProperty = await valuer.client
    .from("market_properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      label: "Comparável em potencial 01",
      property_type_code: "APARTMENT",
      address_raw: "Rua do Comparável, 200",
      city: "São Paulo",
      state: "SP",
      private_area: 78,
      bedrooms: 3,
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("VALUER creates a market property", marketProperty.error);

  const listing = await valuer.client
    .from("market_observations")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      market_property_id: marketProperty.data!.id,
      observation_type: "SALE_LISTING",
      status: "ACTIVE",
      currency_code: "BRL",
      asking_price: 850000,
      evidence_source_id: source.data!.id,
      seller_type: "REAL_ESTATE_AGENCY",
      created_by: valuer.id,
    })
    .select("id, asking_price, transaction_price")
    .single();
  expectOk("VALUER records a SALE_LISTING observation with an asking price", listing.error);

  console.log("\n=== 5. ASKING != TRANSACTION ===");
  record(
    "SALE_LISTING carries asking_price and keeps transaction_price NULL",
    listing.data?.asking_price !== null && listing.data?.transaction_price === null,
    `asking_price = ${listing.data?.asking_price} / transaction_price = ${JSON.stringify(listing.data?.transaction_price)}`,
  );

  const closed = await valuer.client
    .from("market_observations")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      market_property_id: marketProperty.data!.id,
      observation_type: "CLOSED_SALE",
      status: "UNKNOWN",
      currency_code: "BRL",
      transaction_price: 790000,
      transaction_date: new Date().toISOString().slice(0, 10),
      transaction_evidence_status: "DECLARED",
      created_by: valuer.id,
    })
    .select("id, transaction_price, asking_price")
    .single();
  expectOk("a separate CLOSED_SALE observation is created (no conversion of the listing)", closed.error);

  const bothObs = await admin
    .from("market_observations")
    .select("id, observation_type, asking_price, transaction_price")
    .eq("market_property_id", marketProperty.data!.id);
  record(
    "listing and closed sale coexist as distinct observations of the same market property",
    (bothObs.data?.length ?? 0) === 2 &&
      bothObs.data!.some((o) => o.observation_type === "SALE_LISTING" && o.asking_price !== null) &&
      bothObs.data!.some((o) => o.observation_type === "CLOSED_SALE" && o.transaction_price !== null),
    `${bothObs.data?.length ?? 0} observation(s): ${bothObs.data?.map((o) => o.observation_type).join(", ")}`,
  );

  console.log("\n=== 6. PRICE HISTORY (record_price_observation) ===");
  const price1 = await valuer.client.rpc("record_price_observation", {
    _observation_id: listing.data!.id,
    _asking_price: 850000,
    _asking_monthly_rent: null,
    _observed_at: new Date(Date.now() - 86400000).toISOString(),
    _status: "ACTIVE",
    _evidence_source_id: source.data!.id,
    _evidence_field_id: field.data!.id,
    _notes: "primeira leitura do preço pedido",
  });
  expectOk("record_price_observation accepts a same-case evidence source and field", price1.error);

  const price2 = await valuer.client.rpc("record_price_observation", {
    _observation_id: listing.data!.id,
    _asking_price: 815000,
    _asking_monthly_rent: null,
    _observed_at: new Date().toISOString(),
    _status: "ACTIVE",
    _evidence_source_id: source.data!.id,
    _evidence_field_id: null,
    _notes: "redução de preço observada",
  });
  expectOk("record_price_observation records a second (lower) reading", price2.error);

  const history = await admin
    .from("market_observation_price_history")
    .select("asking_price, observed_at")
    .eq("market_observation_id", listing.data!.id)
    .order("observed_at", { ascending: true });
  const currentObs = await admin
    .from("market_observations")
    .select("asking_price")
    .eq("id", listing.data!.id)
    .single();
  record(
    "price history is append-only: the previous reading is preserved and the current price is updated",
    (history.data?.length ?? 0) === 2 &&
      Number(history.data![0]!.asking_price) === 850000 &&
      Number(history.data![1]!.asking_price) === 815000 &&
      Number(currentObs.data?.asking_price) === 815000,
    `history = ${history.data?.map((h) => h.asking_price).join(" -> ")} / current = ${currentObs.data?.asking_price}`,
  );

  console.log("\n=== 7. DIVERGENT ATTRIBUTE OBSERVATIONS ===");
  const obs1 = await valuer.client
    .from("property_attribute_observations")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      market_property_id: marketProperty.data!.id,
      attribute_name: "private_area",
      raw_value: "78 m²",
      numeric_value: 78,
      unit: "m2",
      knowledge_state: "KNOWN",
      value_origin: "EVIDENCE_EXTRACTION",
      evidence_field_id: field.data!.id,
      evidence_source_id: source.data!.id,
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("first attribute observation (from verified evidence) is recorded", obs1.error);

  const obs2 = await valuer.client
    .from("property_attribute_observations")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      market_property_id: marketProperty.data!.id,
      attribute_name: "private_area",
      raw_value: "81 m²",
      numeric_value: 81,
      unit: "m2",
      knowledge_state: "CONFLICTING",
      value_origin: "MANUAL_USER_INPUT",
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("second, divergent attribute observation is recorded", obs2.error);

  const bothAttr = await admin
    .from("property_attribute_observations")
    .select("id, numeric_value")
    .eq("market_property_id", marketProperty.data!.id)
    .eq("attribute_name", "private_area");
  record(
    "divergence is preserved: both observations remain, nothing is overwritten or reconciled",
    (bothAttr.data?.length ?? 0) === 2,
    `${bothAttr.data?.length ?? 0} observation(s): ${bothAttr.data?.map((a) => a.numeric_value).join(" / ")}`,
  );

  console.log("\n=== 8. CANONICAL FACT ADOPTION (review authority only) ===");
  const adopt = await owner.client.rpc("adopt_canonical_fact", {
    _subject_property_id: null,
    _market_property_id: marketProperty.data!.id,
    _attribute_name: "private_area",
    _observation_id: obs1.data!.id,
    _reason: "adotada a leitura da evidência verificada (78 m²)",
  });
  expectOk("OWNER adopts a canonical fact from a VERIFIED evidence extraction", adopt.error);

  const facts = await admin
    .from("property_canonical_facts")
    .select("id, adopted_numeric_value, superseded_at")
    .eq("market_property_id", marketProperty.data!.id);
  record(
    "the adopted fact is persisted with the human justification path",
    (facts.data?.length ?? 0) === 1 && Number(facts.data![0]!.adopted_numeric_value) === 78,
    `${facts.data?.length ?? 0} fact(s), value = ${facts.data?.[0]?.adopted_numeric_value}`,
  );

  console.log("\n=== 9. COMPARABLE LIFECYCLE ===");
  const candidate = await valuer.client
    .from("comparable_candidates")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      subject_property_id: subject.data!.id,
      market_property_id: marketProperty.data!.id,
      market_observation_id: listing.data!.id,
      created_by: valuer.id,
    })
    .select("id, candidate_status, inclusion_status")
    .single();
  expectOk("VALUER creates a comparable candidate (DISCOVERED)", candidate.error);

  const steps: Array<[string, Record<string, unknown>]> = [
    ["UNDER_REVIEW", { _candidate_status: "UNDER_REVIEW", _inclusion_status: null, _reason_code: null, _notes: "em análise" }],
    ["ELIGIBLE", { _candidate_status: "ELIGIBLE", _inclusion_status: null, _reason_code: null, _notes: "elegível" }],
    ["INCLUDED", { _candidate_status: null, _inclusion_status: "INCLUDED", _reason_code: null, _notes: "incluído na composição" }],
    [
      "EXCLUDED",
      {
        _candidate_status: null,
        _inclusion_status: "EXCLUDED",
        _reason_code: "AREA_OUT_OF_SCOPE",
        _notes: "área fora do escopo após revisão",
      },
    ],
  ];
  for (const [label, args] of steps) {
    const res = await owner.client.rpc("decide_comparable", {
      _candidate_id: candidate.data!.id,
      ...args,
    });
    expectOk(`decide_comparable moves the candidate to ${label}`, res.error);
  }

  const decisions = await owner.client
    .from("comparable_decision_history")
    .select("new_candidate_status, new_inclusion_status, reason_code, created_at")
    .eq("candidate_id", candidate.data!.id)
    .order("created_at", { ascending: true });
  record(
    "the full decision history is readable and every prior decision is still present",
    !decisions.error && (decisions.data?.length ?? 0) === 4,
    decisions.error?.message ??
      decisions.data!
        .map((d) => d.new_inclusion_status ?? d.new_candidate_status)
        .join(" -> "),
  );

  const excluded = await admin
    .from("comparable_candidates")
    .select("inclusion_status, exclusion_reason_code")
    .eq("id", candidate.data!.id)
    .single();
  record(
    "EXCLUDED != DELETED: the excluded candidate row still exists with its reason code",
    excluded.data?.inclusion_status === "EXCLUDED" &&
      excluded.data?.exclusion_reason_code === "AREA_OUT_OF_SCOPE",
    `${excluded.data?.inclusion_status} / ${excluded.data?.exclusion_reason_code}`,
  );

  console.log("\n=== 10. DUPLICATE RESOLUTION ===");
  const marketProperty2 = await valuer.client
    .from("market_properties")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      label: "Comparável em potencial 01 (segundo anúncio)",
      property_type_code: "APARTMENT",
      address_raw: "Rua do Comparável, 200",
      city: "São Paulo",
      state: "SP",
      private_area: 78,
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("a second market property (suspected duplicate) is created", marketProperty2.error);

  const [left, right] =
    marketProperty.data!.id < marketProperty2.data!.id
      ? [marketProperty.data!.id, marketProperty2.data!.id]
      : [marketProperty2.data!.id, marketProperty.data!.id];
  const match = await valuer.client
    .from("property_match_candidates")
    .insert({
      organization_id: orgId,
      valuation_case_id: caseId,
      left_market_property_id: left,
      right_market_property_id: right,
      reason_codes: ["SAME_ADDRESS", "SAME_AREA"],
      deterministic_signals: { address_raw: "equal", private_area: "equal" },
      created_by: valuer.id,
    })
    .select("id")
    .single();
  expectOk("a duplicate (match) candidate is recorded with deterministic signals", match.error);

  const resolve = await owner.client.rpc("resolve_property_match", {
    _match_id: match.data!.id,
    _status: "CONFIRMED_SAME",
    _notes: "mesmo imóvel anunciado por dois canais",
  });
  expectOk("resolve_property_match confirms CONFIRMED_SAME", resolve.error);

  const survivors = await admin
    .from("market_properties")
    .select("id")
    .in("id", [marketProperty.data!.id, marketProperty2.data!.id]);
  const survivingObs = await admin
    .from("market_observations")
    .select("id")
    .eq("market_property_id", marketProperty.data!.id);
  record(
    "resolving a duplicate deletes nothing: both market properties and their observations remain",
    (survivors.data?.length ?? 0) === 2 && (survivingObs.data?.length ?? 0) === 2,
    `${survivors.data?.length ?? 0} market propert(ies), ${survivingObs.data?.length ?? 0} observation(s)`,
  );

  console.log("\n=== CLEANUP ===");
  for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  await admin
    .from("organizations")
    .update({ name: `ZZ-FUNCTIONAL-TEST-FIXTURE-${stamp}` })
    .eq("id", orgId);
  console.log("ephemeral users removed; append-only fixture rows remain by design");

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
