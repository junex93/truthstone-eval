-- =====================================================================
-- PHASE 6 (A) — METHODOLOGY SPECIFICATION & NORMATIVE REGISTRY
-- Structure only. No valuation calculation. No invented normative value.
-- =====================================================================

/* ------------------------------------------------------------- enums --- */
CREATE TYPE public.methodology_source_type AS ENUM (
  'TECHNICAL_STANDARD','LAW','REGULATION','PROFESSIONAL_STANDARD','PROFESSIONAL_GUIDANCE',
  'COURT_OR_OFFICIAL_RULE','ACADEMIC_PAPER','BOOK','TECHNICAL_ARTICLE','COURSE_MATERIAL',
  'INTERNAL_POLICY','OTHER');

CREATE TYPE public.methodology_authority_level AS ENUM (
  'PRIMARY_NORMATIVE','PRIMARY_REGULATORY','PROFESSIONAL_STANDARD','AUTHORITATIVE_GUIDANCE',
  'PEER_REVIEWED_RESEARCH','ESTABLISHED_TECHNICAL_LITERATURE','SECONDARY_GUIDANCE',
  'INTERNAL_SPECIFICATION');

CREATE TYPE public.methodology_access_status AS ENUM (
  'METADATA_ONLY','PUBLICLY_ACCESSIBLE','USER_PROVIDED_COPY','LICENSED_COPY',
  'INTERNAL_AUTHORIZED_COPY');

CREATE TYPE public.methodology_source_status AS ENUM (
  'DRAFT','ACTIVE','SUPERSEDED','REVOKED','ARCHIVED','PENDING_METADATA_REVIEW');

CREATE TYPE public.methodology_locator_type AS ENUM (
  'CLAUSE','SECTION','PAGE','CHAPTER','FIGURE','TABLE','ANNEX','EXTERNAL_ANCHOR','OTHER');

CREATE TYPE public.methodology_verification_type AS ENUM (
  'METADATA_VERIFIED','CONTENT_VERIFIED','LOCATOR_VERIFIED');

CREATE TYPE public.methodology_jurisdiction AS ENUM (
  'BRAZIL','INTERNATIONAL','STATE','MUNICIPAL','ORGANIZATIONAL','NOT_SPECIFIED');

CREATE TYPE public.method_lifecycle_status AS ENUM (
  'CONCEPT','SPECIFICATION_IN_PROGRESS','SPECIFICATION_REVIEW','APPROVED_FOR_IMPLEMENTATION',
  'IMPLEMENTED','VALIDATED','DEPRECATED','SUSPENDED');

CREATE TYPE public.method_spec_status AS ENUM (
  'DRAFT','UNDER_REVIEW','APPROVED','SUPERSEDED','SUSPENDED','REJECTED');

CREATE TYPE public.methodology_rule_type AS ENUM (
  'APPLICABILITY','REQUIREMENT','INPUT_REQUIREMENT','TRANSFORMATION','FORMULA','VALIDATION',
  'DIAGNOSTIC','WARNING','BLOCKER','OUTPUT','REPORTING','PROHIBITION','HUMAN_DECISION','OTHER');

CREATE TYPE public.methodology_normative_strength AS ENUM (
  'MANDATORY','RECOMMENDED','PERMITTED','PROHIBITED','INTERNAL_CONTROL');

CREATE TYPE public.methodology_rule_status AS ENUM (
  'DRAFT','UNDER_REVIEW','APPROVED','SUPERSEDED','REJECTED');

CREATE TYPE public.methodology_source_relationship AS ENUM (
  'DIRECT_REQUIREMENT','DIRECT_PROHIBITION','TECHNICAL_SUPPORT','INTERPRETATION','BACKGROUND',
  'INTERNAL_DESIGN');

CREATE TYPE public.methodology_expression_language AS ENUM ('SYMBOLIC');

CREATE TYPE public.methodology_data_type AS ENUM (
  'NUMBER','INTEGER','PERCENT','RATIO','MONEY','DATE','BOOLEAN','TEXT','ENUM','COUNT');

CREATE TYPE public.methodology_formula_status AS ENUM ('DRAFT','UNDER_REVIEW','APPROVED','SUPERSEDED');

CREATE TYPE public.method_test_type AS ENUM (
  'UNIT','BOUNDARY','NEGATIVE','COMPLIANCE','REPRODUCIBILITY','NUMERIC','AUDITABILITY');

CREATE TYPE public.method_applicability_result AS ENUM (
  'METHOD_APPLICABLE','METHOD_APPLICABLE_WITH_CONDITIONS','METHOD_NOT_APPLICABLE',
  'METHOD_REQUIRES_PROFESSIONAL_REVIEW');

CREATE TYPE public.methodology_change_type AS ENUM (
  'NEW_RULE','MODIFY_RULE','REMOVE_RULE','NEW_SOURCE','SOURCE_SUPERSEDED','FORMULA_CHANGE',
  'PARAMETER_CHANGE','SCOPE_CHANGE','TEST_CHANGE','BUG_FIX');

CREATE TYPE public.methodology_change_status AS ENUM (
  'OPEN','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED','WITHDRAWN');

CREATE TYPE public.methodology_conflict_status AS ENUM (
  'OPEN','UNDER_ANALYSIS','RESOLVED','NOT_A_CONFLICT');

CREATE TYPE public.methodology_crosswalk_relationship AS ENUM (
  'RELATED','SIMILAR_CONCEPT','COMPLEMENTARY','POTENTIAL_CONFLICT');

CREATE TYPE public.method_implementation_status AS ENUM (
  'NOT_IMPLEMENTED','IN_DEVELOPMENT','AVAILABLE','VALIDATED','DEPRECATED','SUSPENDED');

CREATE TYPE public.methodology_output_type AS ENUM (
  'ESTIMATED_VALUE','VALUE_INTERVAL','UNIT_VALUE','DIAGNOSTICS','WARNINGS','ASSUMPTIONS',
  'USED_EVIDENCE','EXCLUDED_EVIDENCE','UNCERTAINTY','COMPLIANCE');

CREATE TYPE public.method_spec_section_key AS ENUM (
  'PURPOSE','INTENDED_USE','APPLICABILITY','NON_APPLICABILITY','REQUIRED_INPUTS','OPTIONAL_INPUTS',
  'DATA_REQUIREMENTS','RULES','FORMULAS','ASSUMPTIONS','DIAGNOSTICS','LIMITATIONS','OUTPUTS',
  'UNCERTAINTY','REPORTING_REQUIREMENTS','SOURCE_REFERENCES','TEST_REQUIREMENTS','KNOWN_RISKS');

/* ------------------------------------------------------ unit registry --- */
CREATE TABLE public.methodology_units (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now());

INSERT INTO public.methodology_units (code, name, description) VALUES
  ('BRL','Real brasileiro','Valor monetário em reais'),
  ('M2','Metro quadrado','Área'),
  ('M','Metro','Comprimento'),
  ('KM','Quilômetro','Distância'),
  ('DAY','Dia','Intervalo temporal em dias'),
  ('YEAR','Ano','Intervalo temporal em anos'),
  ('PERCENT','Percentual','Valor percentual (0–100)'),
  ('RATIO','Razão','Número adimensional'),
  ('COUNT','Contagem','Quantidade inteira'),
  ('BOOLEAN','Booleano','Verdadeiro/falso'),
  ('DATE','Data','Data de calendário');

/* --------------------------------------------------- data dictionary --- */
CREATE TABLE public.methodology_data_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  concept_code text NOT NULL,
  name text NOT NULL,
  description text,
  data_type public.methodology_data_type NOT NULL,
  unit_code text REFERENCES public.methodology_units(code),
  semantic_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, concept_code));

/* ---------------------------------------------------------- sources ---- */
CREATE TABLE public.methodology_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title text NOT NULL,
  short_title text,
  source_type public.methodology_source_type NOT NULL,
  issuing_body text,
  authors text,
  edition text,
  publication_year int,
  publication_date date,
  effective_from date,
  effective_until date,
  jurisdiction public.methodology_jurisdiction NOT NULL DEFAULT 'NOT_SPECIFIED',
  jurisdiction_detail text,
  language text,
  identifier text,
  isbn text,
  doi text,
  external_url text,
  access_status public.methodology_access_status NOT NULL DEFAULT 'METADATA_ONLY',
  authority_level public.methodology_authority_level NOT NULL,
  status public.methodology_source_status NOT NULL DEFAULT 'DRAFT',
  supersedes_source_id uuid REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX idx_meth_sources_org ON public.methodology_sources(organization_id);
CREATE INDEX idx_meth_sources_type ON public.methodology_sources(source_type, status);

CREATE TABLE public.methodology_source_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  evidence_artifact_id uuid NOT NULL REFERENCES public.evidence_artifacts(id) ON DELETE RESTRICT,
  access_basis public.methodology_access_status NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, evidence_artifact_id));

CREATE INDEX idx_meth_source_artifacts_source ON public.methodology_source_artifacts(source_id);
CREATE INDEX idx_meth_source_artifacts_org ON public.methodology_source_artifacts(organization_id);

CREATE TABLE public.methodology_source_locators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  artifact_id uuid REFERENCES public.evidence_artifacts(id) ON DELETE RESTRICT,
  locator_type public.methodology_locator_type NOT NULL,
  section text,
  clause text,
  page text,
  chapter text,
  figure text,
  table_reference text,
  external_anchor text,
  support_excerpt text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_excerpt_short_chk CHECK (support_excerpt IS NULL OR length(support_excerpt) <= 1200));

CREATE INDEX idx_meth_locators_source ON public.methodology_source_locators(source_id);

CREATE TABLE public.methodology_source_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  locator_id uuid REFERENCES public.methodology_source_locators(id) ON DELETE RESTRICT,
  verification_type public.methodology_verification_type NOT NULL,
  notes text,
  verified_by uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX idx_meth_verif_source ON public.methodology_source_verifications(source_id, verification_type);

CREATE TABLE public.methodology_source_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_a_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  source_b_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  description text,
  is_critical boolean NOT NULL DEFAULT false,
  resolution_status public.methodology_conflict_status NOT NULL DEFAULT 'OPEN',
  professional_resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conflict_distinct_sources_chk CHECK (source_a_id <> source_b_id));

CREATE TABLE public.methodology_crosswalks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  left_source_id uuid REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  right_source_id uuid REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  relationship public.methodology_crosswalk_relationship NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now());

/* ------------------------------------------------ families / methods --- */
CREATE TABLE public.methodology_families (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.valuation_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  family_code text NOT NULL REFERENCES public.methodology_families(code),
  description text,
  status public.method_lifecycle_status NOT NULL DEFAULT 'CONCEPT',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code));

/* --------------------------------------------------- specifications --- */
CREATE TABLE public.method_specifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  valuation_method_id uuid NOT NULL REFERENCES public.valuation_methods(id) ON DELETE RESTRICT,
  version text NOT NULL,
  title text NOT NULL,
  purpose text,
  scope text,
  jurisdiction public.methodology_jurisdiction NOT NULL DEFAULT 'NOT_SPECIFIED',
  status public.method_spec_status NOT NULL DEFAULT 'DRAFT',
  effective_from date,
  effective_until date,
  specification_manifest jsonb,
  specification_hash text,
  hash_algorithm text,
  manifest_schema_version text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_for_review_at timestamptz,
  submitted_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  review_notes text,
  supersedes_specification_id uuid REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  UNIQUE (valuation_method_id, version));

CREATE INDEX idx_spec_method ON public.method_specifications(valuation_method_id, status);

CREATE TABLE public.method_specification_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  section_key public.method_spec_section_key NOT NULL,
  content text,
  ordinal int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, section_key));

CREATE TABLE public.method_specification_source_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  requirement_code text NOT NULL,
  description text NOT NULL,
  satisfied_by_source_id uuid REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  is_satisfied boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, requirement_code));

/* ------------------------------------------------------------- rules --- */
CREATE TABLE public.methodology_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  rule_code text NOT NULL,
  title text NOT NULL,
  rule_type public.methodology_rule_type NOT NULL,
  description text,
  normative_strength public.methodology_normative_strength NOT NULL,
  status public.methodology_rule_status NOT NULL DEFAULT 'DRAFT',
  priority int NOT NULL DEFAULT 100,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, rule_code));

CREATE TABLE public.methodology_rule_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL REFERENCES public.methodology_rules(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  source_locator_id uuid REFERENCES public.methodology_source_locators(id) ON DELETE RESTRICT,
  support_excerpt text,
  relationship_type public.methodology_source_relationship NOT NULL,
  interpretation_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rule_source_excerpt_short_chk CHECK (support_excerpt IS NULL OR length(support_excerpt) <= 1200));

CREATE INDEX idx_rule_sources_rule ON public.methodology_rule_sources(rule_id);
CREATE INDEX idx_rule_sources_source ON public.methodology_rule_sources(source_id);

/* --------------------------------------------- formulas / variables --- */
CREATE TABLE public.methodology_formulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  rule_id uuid NOT NULL REFERENCES public.methodology_rules(id) ON DELETE RESTRICT,
  formula_code text NOT NULL,
  name text NOT NULL,
  expression text NOT NULL,
  expression_language public.methodology_expression_language NOT NULL DEFAULT 'SYMBOLIC',
  description text,
  status public.methodology_formula_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, formula_code));

CREATE TABLE public.methodology_formula_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  formula_id uuid NOT NULL REFERENCES public.methodology_formulas(id) ON DELETE RESTRICT,
  variable_code text NOT NULL,
  name text NOT NULL,
  description text,
  data_type public.methodology_data_type NOT NULL,
  unit_code text REFERENCES public.methodology_units(code),
  input_semantic text,
  required boolean NOT NULL DEFAULT true,
  constraints text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_id, variable_code));

/* --------------------------------------------------------- parameters -- */
CREATE TABLE public.methodology_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  parameter_code text NOT NULL,
  name text NOT NULL,
  data_type public.methodology_data_type NOT NULL,
  unit_code text REFERENCES public.methodology_units(code),
  default_value numeric,
  min_value numeric,
  max_value numeric,
  source_required boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, parameter_code));

CREATE TABLE public.method_parameter_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  set_code text NOT NULL,
  version text NOT NULL,
  scope_description text,
  effective_from date,
  effective_until date,
  status public.method_spec_status NOT NULL DEFAULT 'DRAFT',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, set_code, version));

CREATE TABLE public.method_parameter_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  parameter_set_id uuid NOT NULL REFERENCES public.method_parameter_sets(id) ON DELETE RESTRICT,
  parameter_id uuid NOT NULL REFERENCES public.methodology_parameters(id) ON DELETE RESTRICT,
  numeric_value numeric,
  text_value text,
  source_id uuid REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  justification text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parameter_set_id, parameter_id));

/* ------------------------------------------------------ applicability -- */
CREATE TABLE public.method_applicability_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  criterion_code text NOT NULL,
  criterion_description text NOT NULL,
  expected_result public.method_applicability_result NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, criterion_code));

/* ------------------------------------------------------ tests/outputs -- */
CREATE TABLE public.method_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  test_code text NOT NULL,
  title text NOT NULL,
  test_type public.method_test_type NOT NULL,
  input_fixture jsonb,
  expected_result jsonb,
  expected_status text,
  source_reference text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, test_code));

CREATE TABLE public.method_output_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  output_type public.methodology_output_type NOT NULL,
  description text,
  unit_code text REFERENCES public.methodology_units(code),
  required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (method_specification_id, output_type));

/* ----------------------------------------------------- implementation -- */
CREATE TABLE public.method_implementations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  implementation_code text NOT NULL,
  version text NOT NULL,
  status public.method_implementation_status NOT NULL DEFAULT 'NOT_IMPLEMENTED',
  runtime text,
  checksum text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  UNIQUE (method_specification_id, implementation_code, version));

CREATE TABLE public.method_compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'NOT_IMPLEMENTED',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT compliance_not_implemented_chk CHECK (status = 'NOT_IMPLEMENTED'));

CREATE TABLE public.document_requirement_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  profile_code text NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'NOT_IMPLEMENTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_code));

/* ----------------------------------------------------- change control -- */
CREATE TABLE public.methodology_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  target_type text NOT NULL,
  target_id uuid,
  change_type public.methodology_change_type NOT NULL,
  description text NOT NULL,
  reason text NOT NULL,
  proposed_by uuid NOT NULL,
  status public.methodology_change_status NOT NULL DEFAULT 'OPEN',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

/* ============================== GRANTS ================================= */
GRANT SELECT ON public.methodology_units, public.methodology_families TO authenticated;
GRANT ALL ON public.methodology_units, public.methodology_families TO service_role;

GRANT SELECT, INSERT, UPDATE ON
  public.methodology_sources, public.methodology_source_locators,
  public.methodology_source_conflicts, public.methodology_data_dictionary,
  public.valuation_methods, public.method_specifications,
  public.method_specification_sections, public.method_specification_source_requirements,
  public.methodology_rules, public.methodology_formulas,
  public.methodology_formula_variables, public.methodology_parameters,
  public.method_parameter_sets, public.method_applicability_rules,
  public.method_test_cases, public.method_output_contracts,
  public.method_implementations, public.methodology_change_requests,
  public.document_requirement_profiles
TO authenticated;

GRANT SELECT, INSERT ON
  public.methodology_source_artifacts, public.methodology_source_verifications,
  public.methodology_rule_sources, public.method_parameter_values,
  public.methodology_crosswalks
TO authenticated;

GRANT SELECT ON public.method_compliance_assessments TO authenticated;

GRANT ALL ON
  public.methodology_sources, public.methodology_source_artifacts,
  public.methodology_source_locators, public.methodology_source_verifications,
  public.methodology_source_conflicts, public.methodology_crosswalks,
  public.methodology_data_dictionary, public.valuation_methods,
  public.method_specifications, public.method_specification_sections,
  public.method_specification_source_requirements, public.methodology_rules,
  public.methodology_rule_sources, public.methodology_formulas,
  public.methodology_formula_variables, public.methodology_parameters,
  public.method_parameter_sets, public.method_parameter_values,
  public.method_applicability_rules, public.method_test_cases,
  public.method_output_contracts, public.method_implementations,
  public.method_compliance_assessments, public.document_requirement_profiles,
  public.methodology_change_requests
TO service_role;

/* =============================== RLS =================================== */
ALTER TABLE public.methodology_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_source_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_source_locators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_source_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_source_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_crosswalks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_data_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_specification_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_specification_source_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_rule_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_formula_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_parameter_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_parameter_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_applicability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_output_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_implementations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requirement_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methodology_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY meth_units_select ON public.methodology_units FOR SELECT TO authenticated USING (true);
CREATE POLICY meth_families_select ON public.methodology_families FOR SELECT TO authenticated USING (true);

/* shared global-or-org readable + org writable pattern */
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'methodology_sources','methodology_source_locators','methodology_data_dictionary',
    'valuation_methods','method_specifications','method_specification_sections',
    'method_specification_source_requirements','methodology_rules','methodology_formulas',
    'methodology_formula_variables','methodology_parameters','method_applicability_rules',
    'method_test_cases','method_output_contracts','method_implementations',
    'document_requirement_profiles','methodology_crosswalks','methodology_rule_sources']
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_select ON public.%1$s FOR SELECT TO authenticated
         USING (organization_id IS NULL OR public.is_org_member(organization_id))', t);
    EXECUTE format(
      'CREATE POLICY %1$s_insert ON public.%1$s FOR INSERT TO authenticated
         WITH CHECK (organization_id IS NOT NULL AND public.can_write(organization_id))', t);
    EXECUTE format(
      'CREATE POLICY %1$s_update ON public.%1$s FOR UPDATE TO authenticated
         USING (organization_id IS NOT NULL AND public.can_write(organization_id))
         WITH CHECK (organization_id IS NOT NULL AND public.can_write(organization_id))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'methodology_source_artifacts','methodology_source_verifications',
    'methodology_source_conflicts','method_parameter_sets','method_parameter_values',
    'methodology_change_requests','method_compliance_assessments']
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_select ON public.%1$s FOR SELECT TO authenticated
         USING (public.is_org_member(organization_id))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'methodology_source_artifacts','methodology_source_conflicts',
    'method_parameter_sets','method_parameter_values','methodology_change_requests']
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_insert ON public.%1$s FOR INSERT TO authenticated
         WITH CHECK (public.can_write(organization_id))', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['methodology_source_conflicts','method_parameter_sets','methodology_change_requests']
  LOOP
    EXECUTE format(
      'CREATE POLICY %1$s_update ON public.%1$s FOR UPDATE TO authenticated
         USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id))', t);
  END LOOP;
END $do$;

CREATE POLICY methodology_source_verifications_insert ON public.methodology_source_verifications
  FOR INSERT TO authenticated WITH CHECK (public.can_review(organization_id) AND verified_by = auth.uid());

/* ============================ TRIGGERS ================================= */
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'methodology_sources','methodology_source_artifacts','methodology_source_locators',
    'methodology_source_verifications','methodology_source_conflicts','methodology_crosswalks',
    'methodology_data_dictionary','valuation_methods','method_specifications',
    'method_specification_sections','method_specification_source_requirements',
    'methodology_rules','methodology_rule_sources','methodology_formulas',
    'methodology_formula_variables','methodology_parameters','method_parameter_sets',
    'method_parameter_values','method_applicability_rules','method_test_cases',
    'method_output_contracts','method_implementations','method_compliance_assessments',
    'document_requirement_profiles','methodology_change_requests']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_nodelete BEFORE DELETE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.block_delete()', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'methodology_sources','methodology_source_locators','methodology_source_conflicts',
    'methodology_data_dictionary','valuation_methods','method_specifications',
    'method_specification_sections','method_specification_source_requirements',
    'methodology_rules','methodology_formulas','methodology_formula_variables',
    'methodology_parameters','method_parameter_sets','method_applicability_rules',
    'method_test_cases','method_output_contracts','method_implementations',
    'methodology_change_requests']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $do$;

CREATE TRIGGER trg_meth_verif_noupdate BEFORE UPDATE ON public.methodology_source_verifications
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();
CREATE TRIGGER trg_meth_rule_sources_noupdate BEFORE UPDATE ON public.methodology_rule_sources
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();
CREATE TRIGGER trg_meth_source_artifacts_noupdate BEFORE UPDATE ON public.methodology_source_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();
CREATE TRIGGER trg_meth_param_values_noupdate BEFORE UPDATE ON public.method_parameter_values
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();
CREATE TRIGGER trg_meth_crosswalks_noupdate BEFORE UPDATE ON public.methodology_crosswalks
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* approved specification is frozen -------------------------------------- */
CREATE OR REPLACE FUNCTION public.guard_method_specification_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF public.in_privileged_op() THEN RETURN NEW; END IF;
  IF OLD.status IN ('APPROVED','SUPERSEDED','REJECTED') THEN
    RAISE EXCEPTION 'Especificação % está %: registro imutável, alteração exige nova versão',
      OLD.version, OLD.status;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Status de especificação só muda pelas operações oficiais (submissão/aprovação/rejeição)';
  END IF;
  IF NEW.specification_hash IS DISTINCT FROM OLD.specification_hash
     OR NEW.specification_manifest IS DISTINCT FROM OLD.specification_manifest
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
    RAISE EXCEPTION 'Manifesto, hash e dados de aprovação são gravados apenas pela operação oficial';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_spec_guard BEFORE UPDATE ON public.method_specifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_method_specification_update();

/* children of a non-draft specification are frozen ----------------------- */
CREATE OR REPLACE FUNCTION public.guard_specification_child()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_spec uuid; v_status public.method_spec_status;
BEGIN
  IF public.in_privileged_op() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('methodology_formulas','methodology_formula_variables') THEN
    IF TG_TABLE_NAME = 'methodology_formulas' THEN
      SELECT r.method_specification_id INTO v_spec FROM public.methodology_rules r WHERE r.id = NEW.rule_id;
    ELSE
      SELECT r.method_specification_id INTO v_spec
        FROM public.methodology_formulas f JOIN public.methodology_rules r ON r.id = f.rule_id
       WHERE f.id = NEW.formula_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'methodology_rule_sources' THEN
    SELECT r.method_specification_id INTO v_spec FROM public.methodology_rules r WHERE r.id = NEW.rule_id;
  ELSE
    v_spec := NEW.method_specification_id;
  END IF;

  IF v_spec IS NULL THEN RETURN NEW; END IF;
  SELECT status INTO v_status FROM public.method_specifications WHERE id = v_spec;
  IF v_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Especificação em % não aceita alteração de conteúdo (%): gere nova versão',
      v_status, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END; $$;

DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'method_specification_sections','method_specification_source_requirements',
    'methodology_rules','methodology_rule_sources','methodology_formulas',
    'methodology_formula_variables','methodology_parameters','method_applicability_rules',
    'method_test_cases','method_output_contracts']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_specguard BEFORE INSERT OR UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.guard_specification_child()', t);
  END LOOP;
END $do$;

/* formula expression safety --------------------------------------------- */
CREATE OR REPLACE FUNCTION public.guard_methodology_formula()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.expression_language <> 'SYMBOLIC' THEN
    RAISE EXCEPTION 'Somente expressão SYMBOLIC é aceita no registro de fórmulas';
  END IF;
  IF btrim(coalesce(NEW.expression,'')) = '' THEN
    RAISE EXCEPTION 'Expressão simbólica obrigatória';
  END IF;
  IF NEW.expression !~ '^[A-Za-z0-9_ .,()+*/^%<>=:''\-\r\n]+$' THEN
    RAISE EXCEPTION 'Expressão contém caracteres não permitidos: apenas notação simbólica é aceita (código executável é recusado)';
  END IF;
  IF NEW.expression ~* '(\meval\M|\mfunction\M|=>|\mrequire\M|\mimport\M|\mprocess\M|\mnew\M|\mwindow\M|\mglobalThis\M|\mawait\M|\mselect\M|\mdrop\M)' THEN
    RAISE EXCEPTION 'Expressão rejeitada: token de código executável detectado';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_formula_guard BEFORE INSERT OR UPDATE ON public.methodology_formulas
  FOR EACH ROW EXECUTE FUNCTION public.guard_methodology_formula();

/* source verification honesty ------------------------------------------- */
CREATE OR REPLACE FUNCTION public.guard_source_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_access public.methodology_access_status; v_org uuid;
BEGIN
  SELECT access_status, organization_id INTO v_access, v_org
    FROM public.methodology_sources WHERE id = NEW.source_id;
  IF v_access IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;
  IF v_org IS NOT NULL AND v_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Fonte pertence a outra organização';
  END IF;
  IF NEW.verification_type IN ('CONTENT_VERIFIED','LOCATOR_VERIFIED')
     AND v_access = 'METADATA_ONLY' THEN
    RAISE EXCEPTION 'Fonte com acesso METADATA_ONLY não pode receber verificação de conteúdo: o texto integral não está disponível no projeto';
  END IF;
  IF NEW.verification_type = 'LOCATOR_VERIFIED' AND NEW.locator_id IS NULL THEN
    RAISE EXCEPTION 'Verificação de localizador exige o localizador correspondente';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_source_verification_guard BEFORE INSERT ON public.methodology_source_verifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_source_verification();

/* rule <-> source provenance honesty ------------------------------------ */
CREATE OR REPLACE FUNCTION public.guard_rule_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_authority public.methodology_authority_level; v_content_verified boolean;
BEGIN
  SELECT authority_level INTO v_authority FROM public.methodology_sources WHERE id = NEW.source_id;
  IF v_authority IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;

  IF v_authority = 'INTERNAL_SPECIFICATION' AND NEW.relationship_type <> 'INTERNAL_DESIGN' THEN
    RAISE EXCEPTION 'Especificação interna só pode sustentar regra como INTERNAL_DESIGN: controle interno nunca é apresentado como exigência normativa externa';
  END IF;
  IF NEW.relationship_type = 'INTERNAL_DESIGN' AND v_authority <> 'INTERNAL_SPECIFICATION' THEN
    RAISE EXCEPTION 'INTERNAL_DESIGN exige fonte classificada como INTERNAL_SPECIFICATION';
  END IF;

  IF NEW.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION') THEN
    SELECT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                    WHERE v.source_id = NEW.source_id AND v.verification_type = 'CONTENT_VERIFIED')
      INTO v_content_verified;
    IF NOT v_content_verified THEN
      RAISE EXCEPTION 'Afirmação normativa direta exige conteúdo da fonte verificado (CONTENT_VERIFIED)';
    END IF;
    IF NEW.source_locator_id IS NULL THEN
      RAISE EXCEPTION 'Afirmação normativa direta exige localizador (cláusula/seção/página) da fonte';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_rule_source_guard BEFORE INSERT ON public.methodology_rule_sources
  FOR EACH ROW EXECUTE FUNCTION public.guard_rule_source();

/* implementation cannot be validated without an approved specification --- */
CREATE OR REPLACE FUNCTION public.guard_method_implementation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status public.method_spec_status;
BEGIN
  IF NEW.status IN ('AVAILABLE','VALIDATED') THEN
    SELECT status INTO v_status FROM public.method_specifications WHERE id = NEW.method_specification_id;
    IF v_status <> 'APPROVED' THEN
      RAISE EXCEPTION 'Implementação só pode ser marcada como % com especificação APROVADA (atual: %)',
        NEW.status, coalesce(v_status::text,'inexistente');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_method_impl_guard BEFORE INSERT OR UPDATE ON public.method_implementations
  FOR EACH ROW EXECUTE FUNCTION public.guard_method_implementation();

/* organization_id immutability ------------------------------------------ */
DO $do$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'methodology_sources','methodology_source_locators','methodology_source_conflicts',
    'methodology_data_dictionary','valuation_methods','method_specifications',
    'method_specification_sections','method_specification_source_requirements',
    'methodology_rules','methodology_formulas','methodology_formula_variables',
    'methodology_parameters','method_parameter_sets','method_applicability_rules',
    'method_test_cases','method_output_contracts','method_implementations',
    'methodology_change_requests','document_requirement_profiles']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_orgimmutable BEFORE UPDATE ON public.%1$s
         FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration()', t);
  END LOOP;
END $do$;

/* ============================ SEED (families) ========================== */
INSERT INTO public.methodology_families (code, name, description) VALUES
  ('MARKET_COMPARISON','Comparativo de mercado','Família baseada em comparação com dados de mercado'),
  ('INCOME','Renda','Família baseada em capitalização de renda'),
  ('COST','Custo','Família baseada em custo de reprodução/substituição'),
  ('EVOLUTIVE','Evolutivo','Família evolutiva (composição de terreno e benfeitorias)'),
  ('INVOLUTIVE','Involutivo','Família involutiva (aproveitamento eficiente hipotético)'),
  ('AVM','Modelo automatizado','Modelos automatizados de avaliação'),
  ('CONVERGENCE','Convergência','Consolidação de resultados de múltiplos métodos');