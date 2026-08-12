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
      links.every((l) => l["relationship_type"] === "INTERNAL_DESIGN")
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
    "nenhuma regra do shell real cita ABNT metadata-only como suporte",
    abntAnySupport.length === 0,
    `${abntAnySupport.length} vínculos`,
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
