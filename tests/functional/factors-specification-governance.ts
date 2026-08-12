/**
 * GOVERNANCE TEST SUITE — FACTORS SPECIFICATION (fase 7)
 *
 * Valida a GOVERNANÇA do conteúdo metodológico do shell real
 * "MCDDM — Tratamento por Fatores". Não valida matemática de avaliação,
 * porque nenhuma matemática de avaliação existe.
 *
 * Provas:
 *   A. toda regra real do shell tem procedência (source) ou INTERNAL_DESIGN explícito;
 *   B. nenhuma claim normativa direta existe sem fonte com conteúdo/localizador verificados;
 *   C. fonte ABNT METADATA_ONLY não sustenta claim normativa direta;
 *   D. nenhum fator/parâmetro de produção com valor numérico sem procedência;
 *   E. nenhum conteúdo TEST_ONLY (fixture) contamina o shell real;
 *   F. nenhum componente de produção calcula valor;
 *   G. a especificação real permanece NÃO APROVADA.
 *
 * Run with:  bun run tests/functional/factors-specification-governance.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"]!;
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyClient = SupabaseClient<any, any, any>;
const admin: AnyClient = createClient(url, serviceKey, { auth: { persistSession: false } });

const FACTORS_SPEC_ID = "33333333-0000-4000-8000-000000000001";
const FACTORS_METHOD_ID = "22222222-0000-4000-8000-000000000001";
const INTERNAL_SOURCE_ID = "11111111-0000-4000-8000-00000000000f";

type Result = { name: string; passed: boolean; detail: string };
const results: Result[] = [];
function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

async function rows(table: string, select: string, filter?: (q: any) => any) {
  let q = admin.from(table).select(select);
  if (filter) q = filter(q);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, any>[];
}

const REQUIRED_SECTIONS = [
  "PURPOSE",
  "INTENDED_USE",
  "APPLICABILITY",
  "NON_APPLICABILITY",
  "REQUIRED_INPUTS",
  "OPTIONAL_INPUTS",
  "DATA_REQUIREMENTS",
  "RULES",
  "FORMULAS",
  "ASSUMPTIONS",
  "DIAGNOSTICS",
  "LIMITATIONS",
  "OUTPUTS",
  "UNCERTAINTY",
  "REPORTING_REQUIREMENTS",
  "SOURCE_REFERENCES",
  "TEST_REQUIREMENTS",
  "KNOWN_RISKS",
] as const;

/** varredura de código de produção: nenhum motor de cálculo de valor */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

async function main() {
  console.log("=== SHELL REAL: MCDDM — TRATAMENTO POR FATORES ===");

  const [spec] = await rows(
    "method_specifications",
    "id, valuation_method_id, version, status, approved_by, approved_at, specification_hash, organization_id",
    (q) => q.eq("id", FACTORS_SPEC_ID),
  );
  record(
    "shell real existe e pertence ao método Tratamento por Fatores",
    !!spec && spec["valuation_method_id"] === FACTORS_METHOD_ID,
    `spec=${spec?.["version"]} method=${spec?.["valuation_method_id"]}`,
  );
  record(
    "SPEC NOT AUTO-APPROVED: especificação permanece DRAFT sem aprovador nem selo",
    spec?.["status"] === "DRAFT" &&
      !spec?.["approved_by"] &&
      !spec?.["approved_at"] &&
      !spec?.["specification_hash"],
    `status=${spec?.["status"]} approved_by=${spec?.["approved_by"] ?? "null"} hash=${spec?.["specification_hash"] ?? "null"}`,
  );

  /* --------------------------------------------------------------- seções */
  const sections = await rows("method_specification_sections", "section_key, content", (q) =>
    q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  const byKey = new Map(sections.map((s) => [s["section_key"] as string, s["content"] as string]));
  for (const key of REQUIRED_SECTIONS) {
    const content = byKey.get(key) ?? "";
    record(
      `seção ${key} preenchida com conteúdo substantivo`,
      content.trim().length >= 80,
      `${content.trim().length} caracteres`,
    );
  }
  const gapSections = ["FORMULAS", "UNCERTAINTY"] as const;
  for (const key of gapSections) {
    const content = byKey.get(key) ?? "";
    record(
      `seção ${key} declara a lacuna explicitamente (PENDING_PRIMARY_SOURCE)`,
      /PENDING_PRIMARY_SOURCE/.test(content),
      content.slice(0, 90),
    );
  }
  record(
    "REQUIRED_INPUTS usa semântica exata de área (nunca 'AREA' genérica)",
    /PRIVATE_AREA/.test(byKey.get("REQUIRED_INPUTS") ?? "") &&
      /BUILT_AREA/.test(byKey.get("REQUIRED_INPUTS") ?? "") &&
      /LAND_AREA/.test(byKey.get("REQUIRED_INPUTS") ?? ""),
    "semântica declarada",
  );
  record(
    "REQUIRED_INPUTS declara que input ausente não vira zero",
    /MISSING_REQUIRED_INPUT/.test(byKey.get("REQUIRED_INPUTS") ?? ""),
    "estado explícito de ausência",
  );

  /* --------------------------------------------------------------- regras */
  const rules = await rows(
    "methodology_rules",
    "id, rule_code, rule_type, normative_strength, status",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  record(
    "regras candidatas registradas no shell real",
    rules.length >= 20,
    `${rules.length} regras`,
  );

  const ruleSources = await rows(
    "methodology_rule_sources",
    "rule_id, source_id, source_locator_id, relationship_type",
    (q) =>
      q.in(
        "rule_id",
        rules.map((r) => r["id"] as string),
      ),
  );
  const provenance = new Map<string, Record<string, any>[]>();
  for (const rs of ruleSources) {
    const list = provenance.get(rs["rule_id"] as string) ?? [];
    list.push(rs);
    provenance.set(rs["rule_id"] as string, list);
  }
  const orphans = rules.filter((r) => (provenance.get(r["id"] as string) ?? []).length === 0);
  record(
    "ZERO ORPHAN RULES: toda regra real tem procedência registrada",
    orphans.length === 0,
    orphans.length === 0
      ? "nenhuma órfã"
      : `órfãs: ${orphans.map((r) => r["rule_code"]).join(", ")}`,
  );

  const internalOnly = rules.every((r) => {
    const links = provenance.get(r["id"] as string) ?? [];
    return (
      r["normative_strength"] === "INTERNAL_CONTROL" &&
      links.some((l) => l["relationship_type"] === "INTERNAL_DESIGN") &&
      links.every((l) =>
        ["INTERNAL_DESIGN", "BACKGROUND", "INTERPRETATION", "TECHNICAL_SUPPORT"].includes(
          l["relationship_type"] as string,
        ),
      )
    );
  });
  record(
    "regras do shell real são controle interno declarado (INTERNAL_DESIGN), não exigência de norma",
    internalOnly,
    "nenhuma regra se apresenta como norma de terceiro",
  );


  /* ------------------------------------------- claims normativas diretas */
  const verifications = await rows(
    "methodology_source_verifications",
    "source_id, locator_id, verification_type",
  );
  const contentVerified = new Set(
    verifications
      .filter((v) => v["verification_type"] === "CONTENT_VERIFIED")
      .map((v) => v["source_id"]),
  );
  const locatorVerified = new Set(
    verifications
      .filter((v) => v["verification_type"] === "LOCATOR_VERIFIED")
      .map((v) => v["locator_id"]),
  );
  const directClaims = ruleSources.filter((rs) =>
    ["DIRECT_REQUIREMENT", "DIRECT_PROHIBITION"].includes(rs["relationship_type"] as string),
  );
  const unsupportedDirect = directClaims.filter(
    (rs) =>
      !contentVerified.has(rs["source_id"]) ||
      !rs["source_locator_id"] ||
      !locatorVerified.has(rs["source_locator_id"]),
  );
  record(
    "nenhuma claim normativa direta sem CONTENT_VERIFIED + localizador verificado",
    unsupportedDirect.length === 0,
    `claims diretas=${directClaims.length} sem suporte=${unsupportedDirect.length}`,
  );

  const abntSources = await rows("methodology_sources", "id, short_title, access_status", (q) =>
    q.is("organization_id", null).like("short_title", "NBR%"),
  );
  const metadataOnlyAbnt = new Set(
    abntSources.filter((s) => s["access_status"] === "METADATA_ONLY").map((s) => s["id"]),
  );
  const abntDirect = directClaims.filter((rs) => metadataOnlyAbnt.has(rs["source_id"]));
  record(
    "fonte ABNT METADATA_ONLY não sustenta claim normativa direta",
    metadataOnlyAbnt.size > 0 && abntDirect.length === 0,
    `ABNT metadata-only=${metadataOnlyAbnt.size} claims diretas sobre elas=${abntDirect.length}`,
  );
  const abntAnySupport = ruleSources.filter((rs) => metadataOnlyAbnt.has(rs["source_id"]));
  record(
    "ABNT metadata-only só aparece como BACKGROUND (identificação de tema), nunca como suporte normativo",
    abntAnySupport.every((rs) => rs["relationship_type"] === "BACKGROUND"),
    `${abntAnySupport.length} vínculos, todos de contexto`,
  );


  /* ------------------------------------- fórmulas, parâmetros e defaults */
  const formulas = await rows("methodology_formulas", "id, formula_code, status, expression", (q) =>
    q.in(
      "rule_id",
      rules.map((r) => r["id"] as string),
    ),
  );
  record(
    "FORMULA CANDIDATES permanecem declarativas e nunca APPROVED",
    formulas.every((f) => f["status"] !== "APPROVED"),
    `${formulas.length} fórmulas registradas`,
  );

  const params = await rows(
    "methodology_parameters",
    "parameter_code, default_value, min_value, max_value, source_required",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  const withValue = params.filter((p) => p["default_value"] !== null);
  record(
    "NO DEFAULT FACTORS: nenhum parâmetro do shell real carrega valor numérico de produção",
    withValue.length === 0,
    `${params.length} parâmetros, ${withValue.length} com valor`,
  );

  const paramValues = await rows(
    "method_parameter_values",
    "id, numeric_value, source_id, parameter_set_id",
  );
  const setIds = new Set(
    (
      await rows("method_parameter_sets", "id", (q) =>
        q.eq("method_specification_id", FACTORS_SPEC_ID),
      )
    ).map((s) => s["id"]),
  );
  const unsourcedValues = paramValues.filter(
    (v) => setIds.has(v["parameter_set_id"]) && v["numeric_value"] !== null && !v["source_id"],
  );
  record(
    "nenhum valor de parâmetro do shell real existe sem fonte",
    unsourcedValues.length === 0,
    `${unsourcedValues.length} valores sem fonte`,
  );

  /* --------------------------------------------------- fixture isolation */
  const testOnlyRules = rules.filter((r) => /TEST_ONLY/i.test(String(r["rule_code"])));
  const linkedSources = await rows("methodology_sources", "id, title, short_title", (q) =>
    q.in("id", [...new Set(ruleSources.map((rs) => rs["source_id"] as string))]),
  );
  const testOnlySources = linkedSources.filter((s) =>
    /TEST_ONLY/i.test(`${s["title"]} ${s["short_title"]}`),
  );
  record(
    "FIXTURE ISOLATION: nenhuma regra/fonte TEST_ONLY aparece no shell real",
    testOnlyRules.length === 0 && testOnlySources.length === 0,
    `regras=${testOnlyRules.length} fontes=${testOnlySources.length}`,
  );
  record(
    "procedência interna aponta para a fonte de controle da plataforma",
    linkedSources.some((s) => s["id"] === INTERNAL_SOURCE_ID),
    "fonte INTERNAL_SPECIFICATION presente",
  );

  /* ------------------------------------------------- source traceability */
  const sourceIds = new Set(linkedSources.map((s) => s["id"]));
  const untraceable = ruleSources.filter((rs) => !sourceIds.has(rs["source_id"]));
  record(
    "SOURCE TRACEABILITY: cada vínculo navega para uma fonte existente",
    untraceable.length === 0,
    `${ruleSources.length} vínculos navegáveis`,
  );

  /* --------------------------------------------- conflitos e lacunas */
  const conflicts = await rows(
    "methodology_source_conflicts",
    "id, subject, resolution_status",
    (q) => q.is("organization_id", null),
  );
  const autoResolved = conflicts.filter((c) => c["resolution_status"] === "RESOLVED");
  record(
    "SOURCE CONFLICT: nenhum conflito global foi resolvido automaticamente",
    autoResolved.length === 0,
    `${conflicts.length} conflitos globais, ${autoResolved.length} resolvidos`,
  );

  /* ----------------------------------------- aplicabilidade e testes */
  const applicability = await rows(
    "method_applicability_rules",
    "criterion_code, expected_result",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  record(
    "critérios de aplicabilidade exigem revisão profissional (nenhum auto-habilitado)",
    applicability.length > 0 &&
      applicability.every((a) => a["expected_result"] !== "METHOD_APPLICABLE"),
    `${applicability.length} critérios`,
  );

  const testCases = await rows("method_test_cases", "test_code, test_type", (q) =>
    q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  const requiredTestCodes = [
    "T-UNSOURCED-FACTOR",
    "T-WRONG-SCOPE",
    "T-EXPIRED-PARAM",
    "T-MISSING-INPUT",
    "T-AREA-SEMANTIC",
    "T-OFFER-TRANSACTION",
    "T-UNSOURCED-CONSTANT",
  ];
  for (const code of requiredTestCodes) {
    record(
      `requisito de teste do futuro motor registrado: ${code}`,
      testCases.some((t) => t["test_code"] === code),
      "presente",
    );
  }
  const testTypes = new Set(testCases.map((t) => t["test_type"]));
  record(
    "categorias de teste cobertas (UNIT/NUMERIC/BOUNDARY/NEGATIVE/COMPLIANCE/REPRODUCIBILITY/AUDITABILITY)",
    [
      "UNIT",
      "NUMERIC",
      "BOUNDARY",
      "NEGATIVE",
      "COMPLIANCE",
      "REPRODUCIBILITY",
      "AUDITABILITY",
    ].every((t) => testTypes.has(t)),
    [...testTypes].join(", "),
  );

  /* ------------------------------------------------- dicionário de dados */
  const dict = await rows("methodology_data_dictionary", "concept_code", (q) =>
    q.is("organization_id", null),
  );
  const dictCodes = new Set(dict.map((d) => d["concept_code"]));
  for (const code of [
    "PRIVATE_AREA",
    "BUILT_AREA",
    "LAND_AREA",
    "ASKING_PRICE",
    "TRANSACTION_PRICE",
    "OBSERVATION_DATE",
    "DISTANCE_TO_SUBJECT",
  ]) {
    record(`dicionário de dados declara ${code}`, dictCodes.has(code), "mapeado");
  }

  /* ---------------------------------------------- ausência de motor */
  const files = walk("src");
  const enginePattern =
    /(homogeniz|adjusted_?comparable|adjustedPrice|estimatedValue|valuation_?result|applyFactor|final_?valuation)/i;
  const offenders = files.filter((f) => {
    const text = readFileSync(f, "utf8");
    return enginePattern.test(text);
  });
  record(
    "NO ENGINE: nenhum componente de produção calcula valor homogeneizado/ajustado/estimado",
    offenders.length === 0,
    offenders.length === 0 ? `${files.length} arquivos inspecionados` : offenders.join(", "),
  );

  const implementations = await rows("method_implementations", "implementation_code, status", (q) =>
    q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  record(
    "nenhuma implementação registrada para o shell real",
    implementations.length === 0,
    `${implementations.length} implementações`,
  );

  /* ----------------------------------- método permanece em preparação */
  const [method] = await rows("valuation_methods", "code, status", (q) =>
    q.eq("id", FACTORS_METHOD_ID),
  );
  record(
    "método permanece em SPECIFICATION_IN_PROGRESS (nunca READY_FOR_EXECUTION)",
    method?.["status"] === "SPECIFICATION_IN_PROGRESS",
    `status=${method?.["status"]}`,
  );

  /* ============================ FASE 7B — SOURCE VERIFICATION ============================ */

  /* topic map completo T01..T32, todos com status explícito */
  const requirements = await rows(
    "method_specification_source_requirements",
    "requirement_code, description, is_satisfied, notes",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  const topics = requirements.filter((r) => /^T\d{2}_/.test(r["requirement_code"] as string));
  record(
    "TOPIC MAP: 32 temas metodológicos registrados (T01..T32)",
    topics.length === 32,
    `${topics.length} temas`,
  );
  const allowedTopicStatus =
    /(VERIFIED_PRIMARY|VERIFIED_PROFESSIONAL|VERIFIED_TECHNICAL|CANDIDATE|CONFLICT|PENDING_PRIMARY_SOURCE|PENDING_PRIMARY_SOURCE_ACCESS|NOT_FOUND)/;
  const badTopics = topics.filter((t) => !allowedTopicStatus.test((t["notes"] as string) ?? ""));
  record(
    "TOPIC MAP: todo tema declara status permitido explicitamente",
    badTopics.length === 0,
    badTopics.map((t) => t["requirement_code"]).join(", ") || "todos declarados",
  );
  const satisfiedTopics = topics.filter((t) => t["is_satisfied"] === true);
  record(
    "TOPIC MAP: nenhum tema marcado como satisfeito sem fonte verificada",
    satisfiedTopics.length === 0,
    `${satisfiedTopics.length} satisfeitos`,
  );

  const criticalGates = [
    "T14_FACTOR_COMBINATION",
    "T24_FUNDAMENTATION",
    "T25_PRECISION",
    "T26_ARBITRATION_FIELD",
    "T27_EXTRAPOLATION",
    "T07_SAMPLE_REQUIREMENTS",
  ];
  for (const code of criticalGates) {
    const topic = topics.find((t) => t["requirement_code"] === code);
    const notes = (topic?.["notes"] as string) ?? "";
    record(
      `GATE ${code} permanece PENDING_PRIMARY_SOURCE (nenhum número inferido)`,
      /PENDING_PRIMARY_SOURCE/.test(notes) && !/\d+(\.\d+)?\s*%/.test(notes),
      notes.slice(0, 90),
    );
  }

  /* inventário de fontes: nenhuma ABNT sai de METADATA_ONLY sem verificação */
  const sources = await rows(
    "methodology_sources",
    "id, short_title, source_type, authority_level, access_status, status, notes",
    (q) => q.is("organization_id", null),
  );
  const abnt = sources.filter((s) => /NBR 14653/.test((s["short_title"] as string) ?? ""));
  record(
    "ABNT GATE: entradas NBR 14653-1/-2 registradas",
    abnt.length >= 2,
    abnt.map((s) => s["short_title"]).join(", "),
  );
  for (const s of abnt) {
    const verified = verifications.some(
      (v) => v["source_id"] === s["id"] && v["verification_type"] === "CONTENT_VERIFIED",
    );
    record(
      `ABNT GATE: ${s["short_title"]} declara acesso coerente com verificação`,
      s["access_status"] !== "METADATA_ONLY" || !verified,
      `access=${s["access_status"]} content_verified=${verified}`,
    );
  }
  const literature = sources.filter(
    (s) => s["authority_level"] === "ESTABLISHED_TECHNICAL_LITERATURE",
  );
  record(
    "LITERATURA TÉCNICA: referências catalogadas sem elevação a PRIMARY_NORMATIVE",
    literature.length >= 3 &&
      literature.every((s) => s["authority_level"] !== "PRIMARY_NORMATIVE"),
    `${literature.length} referências técnicas`,
  );
  record(
    "GUIDANCE PROFISSIONAL: orientação nunca registrada como norma primária",
    sources
      .filter((s) => s["source_type"] === "PROFESSIONAL_GUIDANCE")
      .every((s) => s["authority_level"] !== "PRIMARY_NORMATIVE"),
    "classificação coerente",
  );
  const internalSources = sources.filter(
    (s) => s["authority_level"] === "INTERNAL_SPECIFICATION",
  );
  record(
    "SEPARAÇÃO: apenas fonte interna sustenta controle de plataforma",
    internalSources.length === 1 && internalSources[0]?.["id"] === INTERNAL_SOURCE_ID,
    `${internalSources.length} fonte(s) interna(s)`,
  );

  /* MISCLASSIFICATION TEST — INTERNAL_DESIGN não pode afirmar norma externa */
  const fullRules = await rows(
    "methodology_rules",
    "id, rule_code, description, title, normative_strength",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  const externalClaim =
    /(ABNT|NBR\s*14653|IVS\b|RICS|COFECI|IBAPE)\s*(exige|requer|determina|obriga|proíbe|estabelece|define|manda|requires|mandates)|(conforme|segundo|de acordo com)\s+(a\s+)?(ABNT|NBR|IVS|RICS|COFECI)/i;
  const misclassified = fullRules.filter((r) => {
    const text = `${r["title"]} ${r["description"]}`;
    if (!externalClaim.test(text)) return false;
    const links = provenance.get(r["id"] as string) ?? [];
    return !links.some((l) =>
      ["DIRECT_REQUIREMENT", "DIRECT_PROHIBITION", "INTERPRETATION"].includes(
        l["relationship_type"] as string,
      ),
    );
  });
  record(
    "NO MISCLASSIFICATION: regra interna não afirma exigência externa sem procedência correspondente",
    misclassified.length === 0,
    misclassified.map((r) => r["rule_code"]).join(", ") || "nenhuma afirmação externa disfarçada",
  );

  /* rastreabilidade da reclassificação: temas externos vinculados como BACKGROUND */
  const background = ruleSources.filter((rs) => rs["relationship_type"] === "BACKGROUND");
  record(
    "RECLASSIFICAÇÃO: regras com tema externo correlato vinculadas como BACKGROUND (nunca DIRECT_*)",
    background.length >= 16,
    `${background.length} vínculos de contexto`,
  );
  const backgroundRuleIds = new Set(background.map((rs) => rs["rule_id"] as string));
  record(
    "RECLASSIFICAÇÃO: todo vínculo BACKGROUND preserva também o INTERNAL_DESIGN original",
    [...backgroundRuleIds].every((id) =>
      (provenance.get(id) ?? []).some((l) => l["relationship_type"] === "INTERNAL_DESIGN"),
    ),
    "histórico preservado",
  );
  const directLinks = ruleSources.filter((rs) =>
    ["DIRECT_REQUIREMENT", "DIRECT_PROHIBITION"].includes(rs["relationship_type"] as string),
  );
  record(
    "ABNT METADATA_ONLY não sustenta DIRECT_REQUIREMENT/DIRECT_PROHIBITION",
    directLinks.length === 0,
    `${directLinks.length} claims diretas`,
  );

  /* seções de fechamento da fase 7B */
  const refs = byKey.get("SOURCE_REFERENCES") ?? "";
  for (const bucket of [
    "PRIMARY NORMATIVE",
    "PRIMARY REGULATORY",
    "PROFESSIONAL GUIDANCE",
    "TECHNICAL LITERATURE",
    "RESEARCH",
    "INTERNAL",
  ]) {
    record(
      `SOURCE_REFERENCES separa a categoria ${bucket}`,
      refs.includes(bucket),
      "hierarquia declarada",
    );
  }
  const limits = byKey.get("LIMITATIONS") ?? "";
  for (const bucket of [
    "SOURCE_ACCESS_GAP",
    "SOURCE_CONFLICT",
    "PROFESSIONAL_DECISION_REQUIRED",
    "TECHNICAL_RESEARCH_REQUIRED",
    "IMPLEMENTATION_DESIGN_LATER",
  ]) {
    record(
      `OPEN QUESTIONS registra a categoria ${bucket}`,
      limits.includes(bucket),
      "questão aberta declarada",
    );
  }

  /* nenhum conflito de fonte resolvido automaticamente no escopo global */
  const globalConflicts = await rows(
    "methodology_source_conflicts",
    "subject, resolution_status, professional_resolution",
    (q) => q.is("organization_id", null),
  );
  record(
    "CONFLICT REGISTER: nenhum conflito global resolvido sem decisão profissional",
    globalConflicts.every(
      (c) => c["resolution_status"] !== "RESOLVED" || !!c["professional_resolution"],
    ),
    `${globalConflicts.length} conflitos globais`,
  );

  /* fatores e parâmetros: nada operacional */
  const globalParams = await rows(
    "methodology_parameters",
    "parameter_code, default_value, source_required",
    (q) => q.eq("method_specification_id", FACTORS_SPEC_ID),
  );
  record(
    "PARAMETER CANDIDATES: nenhum parâmetro do shell real possui valor default",
    globalParams.every((p) => p["default_value"] === null),
    `${globalParams.length} parâmetros`,
  );
  const globalFormulas = await rows("methodology_formulas", "formula_code, status, rule_id", (q) =>
    q.in(
      "rule_id",
      fullRules.map((r) => r["id"] as string),
    ),
  );
  record(
    "FORMULA CANDIDATES: nenhuma fórmula aprovada no shell real",
    globalFormulas.every((f) => f["status"] !== "APPROVED"),
    `${globalFormulas.length} fórmulas`,
  );

  /* engine gates textuais adicionais */
  const engineTerms =
    /(fatorDeOferta|offerFactor|locationFactor|areaFactor|ageFactor|conservationFactor|combineFactors)/i;
  const engineOffenders = files.filter((f) => engineTerms.test(readFileSync(f, "utf8")));
  record(
    "NO ENGINE: nenhum fator nomeado implementado em produção",
    engineOffenders.length === 0,
    engineOffenders.join(", ") || "nenhum",
  );
}


main()
  .catch((error) => {
    record("EXECUÇÃO DA SUÍTE", false, `interrompida: ${(error as Error).message}`);
  })
  .finally(() => {
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    console.log(`\n=== RESUMO ===\nTOTAL ${results.length}  PASS ${passed}  FAIL ${failed}`);
    if (failed > 0) {
      console.log("\nFALHAS:");
      for (const r of results.filter((x) => !x.passed)) console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(failed > 0 ? 1 : 0);
  });
