-- ============================================================================
-- PHASE 3 — PROPERTY & COMPARABLE INTELLIGENCE FOUNDATION
-- No valuation math. Classification, provenance, lineage and human decisions.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ---------------------------------------------------------------- taxonomies
CREATE TYPE public.property_type_code AS ENUM (
  'APARTMENT','HOUSE','CONDOMINIUM_HOUSE','PENTHOUSE','STUDIO','RESIDENTIAL_LAND',
  'COMMERCIAL_ROOM','OFFICE','RETAIL','WAREHOUSE','LOGISTICS_PROPERTY',
  'INDUSTRIAL_PROPERTY','COMMERCIAL_BUILDING','MIXED_USE','URBAN_LAND',
  'RURAL_PROPERTY','OTHER');

CREATE TYPE public.knowledge_state AS ENUM (
  'KNOWN','UNKNOWN','NOT_APPLICABLE','CONFLICTING','PENDING_VERIFICATION');

CREATE TYPE public.address_normalization_status AS ENUM (
  'NOT_ATTEMPTED','CANDIDATE','VERIFIED','AMBIGUOUS','FAILED');

CREATE TYPE public.development_type AS ENUM (
  'BUILDING','GATED_COMMUNITY','CONDOMINIUM','MIXED_USE_COMPLEX',
  'COMMERCIAL_COMPLEX','INDUSTRIAL_COMPLEX','OTHER');

CREATE TYPE public.market_observation_type AS ENUM (
  'SALE_LISTING','CLOSED_SALE','RENT_LISTING','CLOSED_RENT','BROKER_QUOTE',
  'APPRAISAL_REFERENCE','OTHER');

CREATE TYPE public.market_observation_status AS ENUM (
  'ACTIVE','INACTIVE','REMOVED','EXPIRED','UNKNOWN');

CREATE TYPE public.transaction_evidence_status AS ENUM (
  'DOCUMENTED','MULTI_SOURCE_CONFIRMED','DECLARED','UNVERIFIED');

CREATE TYPE public.value_origin AS ENUM (
  'MANUAL_USER_INPUT','EVIDENCE_EXTRACTION','EXTERNAL_API',
  'DETERMINISTIC_DERIVATION','FIELD_INSPECTION');

CREATE TYPE public.property_match_status AS ENUM (
  'CANDIDATE','CONFIRMED_SAME','CONFIRMED_DIFFERENT','UNRESOLVED');

CREATE TYPE public.comparable_candidate_status AS ENUM (
  'DISCOVERED','UNDER_REVIEW','ELIGIBLE','INELIGIBLE');

CREATE TYPE public.comparable_inclusion_status AS ENUM (
  'NOT_DECIDED','INCLUDED','EXCLUDED');

CREATE TYPE public.seller_type AS ENUM (
  'OWNER','BROKER','REAL_ESTATE_AGENCY','DEVELOPER','UNKNOWN');

CREATE TYPE public.quality_dimension_state AS ENUM (
  'NOT_ASSESSED','LOW','MEDIUM','HIGH','NOT_APPLICABLE');

CREATE TYPE public.occupancy_status AS ENUM (
  'UNKNOWN','VACANT','OWNER_OCCUPIED','TENANT_OCCUPIED','UNDER_CONSTRUCTION','OTHER');

CREATE TYPE public.furnished_status AS ENUM (
  'UNKNOWN','UNFURNISHED','PARTIALLY_FURNISHED','FURNISHED');

CREATE TYPE public.condition_status AS ENUM (
  'UNKNOWN','NEW','RENOVATED','GOOD','REGULAR','POOR','UNDER_RENOVATION','RUIN');

-- ------------------------------------------------- subject property expansion
ALTER TABLE public.properties
  ADD CONSTRAINT properties_org_id_uniq UNIQUE (organization_id, id);

ALTER TABLE public.properties
  ADD COLUMN property_type_code public.property_type_code,
  ADD COLUMN usable_area numeric,
  ADD COLUMN total_area numeric,
  ADD COLUMN common_area numeric,
  ADD COLUMN suites integer,
  ADD COLUMN half_bathrooms integer,
  ADD COLUMN elevators integer,
  ADD COLUMN total_floors integer,
  ADD COLUMN units_per_floor integer,
  ADD COLUMN building_units integer,
  ADD COLUMN renovation_year integer,
  ADD COLUMN ceiling_height numeric,
  ADD COLUMN frontage numeric,
  ADD COLUMN depth numeric,
  ADD COLUMN topography text,
  ADD COLUMN occupancy_status public.occupancy_status,
  ADD COLUMN furnished_status public.furnished_status,
  ADD COLUMN condition_status public.condition_status,
  ADD COLUMN view_type text,
  ADD COLUMN orientation text,
  ADD COLUMN position_in_building text,
  ADD COLUMN country_code text,
  ADD COLUMN subdistrict text,
  ADD COLUMN street_type text,
  ADD COLUMN street_name text,
  ADD COLUMN street_number text,
  ADD COLUMN address_raw text,
  ADD COLUMN address_normalized text,
  ADD COLUMN address_normalization_status public.address_normalization_status
    NOT NULL DEFAULT 'NOT_ATTEMPTED',
  ADD COLUMN development_id uuid,
  ADD COLUMN geo_point extensions.geography(Point, 4326);

COMMENT ON COLUMN public.properties.geo_point IS
  'Canonical geographic position. latitude/longitude are kept for interoperability and are synchronised by trigger sync_geo_point; divergence is impossible.';

-- ------------------------------------------------------------- developments
CREATE TABLE public.developments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  name text NOT NULL,
  development_type public.development_type NOT NULL DEFAULT 'BUILDING',
  address_raw text,
  address_normalized text,
  address_normalization_status public.address_normalization_status NOT NULL DEFAULT 'NOT_ATTEMPTED',
  postal_code text,
  district text,
  city text,
  state text,
  country_code text DEFAULT 'BR',
  geo_point extensions.geography(Point, 4326),
  latitude numeric,
  longitude numeric,
  construction_year integer,
  number_of_floors integer,
  number_of_units integer,
  developer_name text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developments_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT developments_scope_uniq UNIQUE (organization_id, valuation_case_id, id)
);

ALTER TABLE public.properties
  ADD CONSTRAINT properties_development_fk
  FOREIGN KEY (organization_id, valuation_case_id, development_id)
  REFERENCES public.developments(organization_id, valuation_case_id, id);

-- --------------------------------------------------------- market properties
CREATE TABLE public.market_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  development_id uuid,
  label text,
  property_type_code public.property_type_code,
  address_raw text,
  address_normalized text,
  address_normalization_status public.address_normalization_status NOT NULL DEFAULT 'NOT_ATTEMPTED',
  street_type text,
  street_name text,
  street_number text,
  complement text,
  district text,
  subdistrict text,
  city text,
  state text,
  postal_code text,
  country_code text DEFAULT 'BR',
  latitude numeric,
  longitude numeric,
  geo_point extensions.geography(Point, 4326),
  private_area numeric,
  usable_area numeric,
  built_area numeric,
  total_area numeric,
  land_area numeric,
  common_area numeric,
  bedrooms integer,
  suites integer,
  bathrooms integer,
  half_bathrooms integer,
  parking_spaces integer,
  floor_number integer,
  total_floors integer,
  construction_year integer,
  renovation_year integer,
  condition_status public.condition_status,
  occupancy_status public.occupancy_status,
  furnished_status public.furnished_status,
  unit_identifier text,
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_properties_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT market_properties_development_fk
    FOREIGN KEY (organization_id, valuation_case_id, development_id)
    REFERENCES public.developments(organization_id, valuation_case_id, id),
  CONSTRAINT market_properties_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT market_properties_org_id_uniq UNIQUE (organization_id, id)
);

COMMENT ON TABLE public.market_properties IS
  'Physical property observed in the market. NOT a listing: a listing is a market_observation. Case-scoped in this phase (no cross-case library).';

-- ------------------------------------------------------- market observations
CREATE TABLE public.market_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  market_property_id uuid NOT NULL,
  observation_type public.market_observation_type NOT NULL,
  status public.market_observation_status NOT NULL DEFAULT 'UNKNOWN',
  currency_code text NOT NULL DEFAULT 'BRL',
  -- ASKING is never TRANSACTION. Separate columns by constitutional rule.
  asking_price numeric(18,2),
  transaction_price numeric(18,2),
  asking_monthly_rent numeric(18,2),
  contracted_monthly_rent numeric(18,2),
  observation_date date,
  publication_date date,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  transaction_date date,
  transaction_document_type text,
  registry_reference text,
  transaction_evidence_status public.transaction_evidence_status,
  publisher_name text,
  portal_name text,
  external_listing_id text,
  listing_url text,
  broker_reference text,
  broker_name text,
  seller_type public.seller_type NOT NULL DEFAULT 'UNKNOWN',
  notes text,
  evidence_source_id uuid,
  primary_artifact_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_observations_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT market_observations_property_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT market_observations_source_fk FOREIGN KEY (organization_id, evidence_source_id)
    REFERENCES public.evidence_sources(organization_id, id),
  CONSTRAINT market_observations_artifact_fk FOREIGN KEY (organization_id, primary_artifact_id)
    REFERENCES public.evidence_artifacts(organization_id, id),
  CONSTRAINT market_observations_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT market_observations_currency_chk CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT market_observations_transaction_scope_chk CHECK (
    (transaction_price IS NULL AND contracted_monthly_rent IS NULL AND transaction_date IS NULL
     AND transaction_evidence_status IS NULL)
    OR observation_type IN ('CLOSED_SALE','CLOSED_RENT')
  ),
  CONSTRAINT market_observations_asking_scope_chk CHECK (
    (asking_price IS NULL AND asking_monthly_rent IS NULL)
    OR observation_type IN ('SALE_LISTING','RENT_LISTING','BROKER_QUOTE','APPRAISAL_REFERENCE','OTHER')
  )
);

COMMENT ON TABLE public.market_observations IS
  'A market occurrence about a market_property. SALE_LISTING is never a CLOSED_SALE and status REMOVED never means SOLD.';

-- ------------------------------------------------------------ price history
CREATE TABLE public.market_observation_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  market_observation_id uuid NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  currency_code text NOT NULL DEFAULT 'BRL',
  asking_price numeric(18,2),
  asking_monthly_rent numeric(18,2),
  observation_status public.market_observation_status,
  evidence_source_id uuid,
  evidence_field_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_history_observation_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_observation_id)
    REFERENCES public.market_observations(organization_id, valuation_case_id, id),
  CONSTRAINT price_history_source_fk FOREIGN KEY (organization_id, evidence_source_id)
    REFERENCES public.evidence_sources(organization_id, id),
  CONSTRAINT price_history_field_fk FOREIGN KEY (organization_id, evidence_field_id)
    REFERENCES public.evidence_fields(organization_id, id)
);

-- --------------------------------------------- attribute provenance (facts)
CREATE TABLE public.property_attribute_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  subject_property_id uuid,
  market_property_id uuid,
  attribute_name text NOT NULL,
  raw_value text,
  normalized_value text,
  numeric_value numeric,
  unit text,
  knowledge_state public.knowledge_state NOT NULL DEFAULT 'KNOWN',
  value_origin public.value_origin NOT NULL,
  evidence_field_id uuid,
  evidence_source_id uuid,
  observed_at timestamptz,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attr_obs_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT attr_obs_subject_fk FOREIGN KEY (organization_id, subject_property_id)
    REFERENCES public.properties(organization_id, id),
  CONSTRAINT attr_obs_market_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT attr_obs_field_fk FOREIGN KEY (organization_id, evidence_field_id)
    REFERENCES public.evidence_fields(organization_id, id),
  CONSTRAINT attr_obs_source_fk FOREIGN KEY (organization_id, evidence_source_id)
    REFERENCES public.evidence_sources(organization_id, id),
  CONSTRAINT attr_obs_exactly_one_entity_chk CHECK (
    (subject_property_id IS NOT NULL AND market_property_id IS NULL)
    OR (subject_property_id IS NULL AND market_property_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.property_attribute_observations IS
  'What a given evidence asserts about a property. Conflicting assertions are all preserved; nothing is silently reconciled.';

ALTER TABLE public.property_attribute_observations
  ADD CONSTRAINT attr_obs_org_id_uniq UNIQUE (organization_id, id);

-- ------------------------------------------------------------ canonical fact
CREATE TABLE public.property_canonical_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  subject_property_id uuid,
  market_property_id uuid,
  attribute_name text NOT NULL,
  adopted_value text,
  adopted_numeric_value numeric,
  adopted_unit text,
  adopted_from_observation_id uuid,
  adopted_by uuid NOT NULL,
  adopted_at timestamptz NOT NULL DEFAULT now(),
  adoption_reason text NOT NULL,
  superseded_at timestamptz,
  superseded_by_fact_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT canonical_subject_fk FOREIGN KEY (organization_id, subject_property_id)
    REFERENCES public.properties(organization_id, id),
  CONSTRAINT canonical_market_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT canonical_observation_fk FOREIGN KEY (organization_id, adopted_from_observation_id)
    REFERENCES public.property_attribute_observations(organization_id, id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT canonical_exactly_one_entity_chk CHECK (
    (subject_property_id IS NOT NULL AND market_property_id IS NULL)
    OR (subject_property_id IS NULL AND market_property_id IS NOT NULL)
  )
);

COMMENT ON TABLE public.property_canonical_facts IS
  'Value ADOPTED by the professional for this work. Not universal truth. Written only by adopt_canonical_fact; divergent observations are never removed.';

-- ---------------------------------------------------------- deduplication
CREATE TABLE public.property_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  left_market_property_id uuid NOT NULL,
  right_market_property_id uuid NOT NULL,
  match_status public.property_match_status NOT NULL DEFAULT 'CANDIDATE',
  reason_codes text[] NOT NULL DEFAULT '{}',
  deterministic_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT match_left_fk FOREIGN KEY (organization_id, valuation_case_id, left_market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT match_right_fk FOREIGN KEY (organization_id, valuation_case_id, right_market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT match_not_self_chk CHECK (left_market_property_id <> right_market_property_id),
  CONSTRAINT match_ordered_chk CHECK (left_market_property_id < right_market_property_id),
  CONSTRAINT match_pair_uniq UNIQUE (valuation_case_id, left_market_property_id, right_market_property_id)
);

-- ------------------------------------------------------ comparable taxonomy
CREATE TABLE public.comparable_exclusion_reasons (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  taxonomy_version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.comparable_exclusion_reasons (code, label) VALUES
  ('WRONG_PROPERTY_TYPE','Tipologia incompatível'),
  ('LOCATION_OUT_OF_SCOPE','Localização fora do escopo'),
  ('AREA_OUT_OF_SCOPE','Área fora do escopo'),
  ('AGE_OUT_OF_SCOPE','Idade fora do escopo'),
  ('CONDITION_INCOMPATIBLE','Estado de conservação incompatível'),
  ('INSUFFICIENT_DATA','Dados insuficientes'),
  ('DUPLICATE','Duplicidade'),
  ('STALE_OBSERVATION','Observação desatualizada'),
  ('PRICE_NOT_VERIFIABLE','Preço não verificável'),
  ('ADDRESS_AMBIGUOUS','Endereço ambíguo'),
  ('TRANSACTION_NOT_VERIFIABLE','Transação não verificável'),
  ('OTHER','Outro');

-- ----------------------------------------------------- comparable candidates
CREATE TABLE public.comparable_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  subject_property_id uuid NOT NULL,
  market_property_id uuid NOT NULL,
  market_observation_id uuid NOT NULL,
  candidate_status public.comparable_candidate_status NOT NULL DEFAULT 'DISCOVERED',
  inclusion_status public.comparable_inclusion_status NOT NULL DEFAULT 'NOT_DECIDED',
  inclusion_reason text,
  exclusion_reason_code text REFERENCES public.comparable_exclusion_reasons(code),
  exclusion_notes text,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comp_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT comp_subject_fk FOREIGN KEY (organization_id, subject_property_id)
    REFERENCES public.properties(organization_id, id),
  CONSTRAINT comp_market_fk FOREIGN KEY (organization_id, valuation_case_id, market_property_id)
    REFERENCES public.market_properties(organization_id, valuation_case_id, id),
  CONSTRAINT comp_observation_fk FOREIGN KEY (organization_id, valuation_case_id, market_observation_id)
    REFERENCES public.market_observations(organization_id, valuation_case_id, id),
  CONSTRAINT comp_unique_observation UNIQUE (valuation_case_id, subject_property_id, market_observation_id)
);

CREATE TABLE public.comparable_decision_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.comparable_candidates(id),
  previous_candidate_status public.comparable_candidate_status,
  new_candidate_status public.comparable_candidate_status,
  previous_inclusion_status public.comparable_inclusion_status,
  new_inclusion_status public.comparable_inclusion_status,
  reason_code text,
  notes text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------- qualitative source dimensions
CREATE TABLE public.market_source_quality_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  market_observation_id uuid NOT NULL,
  source_reliability public.quality_dimension_state NOT NULL DEFAULT 'NOT_ASSESSED',
  temporal_relevance public.quality_dimension_state NOT NULL DEFAULT 'NOT_ASSESSED',
  spatial_relevance public.quality_dimension_state NOT NULL DEFAULT 'NOT_ASSESSED',
  data_completeness public.quality_dimension_state NOT NULL DEFAULT 'NOT_ASSESSED',
  cross_source_confirmation public.quality_dimension_state NOT NULL DEFAULT 'NOT_ASSESSED',
  notes text,
  assessed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_observation_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_observation_id)
    REFERENCES public.market_observations(organization_id, valuation_case_id, id),
  CONSTRAINT quality_observation_uniq UNIQUE (market_observation_id)
);

COMMENT ON TABLE public.market_source_quality_assessments IS
  'Qualitative dimensions only. These categories carry NO mathematical weight and must never be aggregated into a confidence score.';

-- --------------------------------------------------------- derived values
CREATE TABLE public.derived_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  subject_property_id uuid,
  market_property_id uuid,
  market_observation_id uuid,
  derivation_type text NOT NULL,
  derivation_version text NOT NULL DEFAULT 'v1',
  input_references jsonb NOT NULL DEFAULT '{}'::jsonb,
  area_basis text,
  calculated_value numeric,
  unit text,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  CONSTRAINT derived_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT derived_observation_fk
    FOREIGN KEY (organization_id, valuation_case_id, market_observation_id)
    REFERENCES public.market_observations(organization_id, valuation_case_id, id)
);

COMMENT ON TABLE public.derived_values IS
  'Deterministic derivations (e.g. price per area). A derived value is never presented as an observed value.';

-- ============================================================== GRANTS
GRANT SELECT, INSERT, UPDATE ON public.developments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_properties TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_observations TO authenticated;
GRANT SELECT, INSERT ON public.market_observation_price_history TO authenticated;
GRANT SELECT, INSERT ON public.property_attribute_observations TO authenticated;
GRANT SELECT ON public.property_canonical_facts TO authenticated;
GRANT SELECT, INSERT ON public.property_match_candidates TO authenticated;
GRANT SELECT ON public.comparable_exclusion_reasons TO authenticated;
GRANT SELECT, INSERT ON public.comparable_candidates TO authenticated;
GRANT SELECT ON public.comparable_decision_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.market_source_quality_assessments TO authenticated;
GRANT SELECT, INSERT ON public.derived_values TO authenticated;

GRANT ALL ON public.developments TO service_role;
GRANT ALL ON public.market_properties TO service_role;
GRANT ALL ON public.market_observations TO service_role;
GRANT ALL ON public.market_observation_price_history TO service_role;
GRANT ALL ON public.property_attribute_observations TO service_role;
GRANT ALL ON public.property_canonical_facts TO service_role;
GRANT ALL ON public.property_match_candidates TO service_role;
GRANT ALL ON public.comparable_exclusion_reasons TO service_role;
GRANT ALL ON public.comparable_candidates TO service_role;
GRANT ALL ON public.comparable_decision_history TO service_role;
GRANT ALL ON public.market_source_quality_assessments TO service_role;
GRANT ALL ON public.derived_values TO service_role;

-- ============================================================== RLS
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_observation_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_attribute_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_canonical_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparable_exclusion_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparable_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparable_decision_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_source_quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derived_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY dev_select ON public.developments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY dev_insert ON public.developments FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY dev_update ON public.developments FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

CREATE POLICY mp_select ON public.market_properties FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY mp_insert ON public.market_properties FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY mp_update ON public.market_properties FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

CREATE POLICY mo_select ON public.market_observations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY mo_insert ON public.market_observations FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY mo_update ON public.market_observations FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

CREATE POLICY mph_select ON public.market_observation_price_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY mph_insert ON public.market_observation_price_history FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());

CREATE POLICY pao_select ON public.property_attribute_observations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY pao_insert ON public.property_attribute_observations FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());

CREATE POLICY pcf_select ON public.property_canonical_facts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY pmc_select ON public.property_match_candidates FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY pmc_insert ON public.property_match_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());

CREATE POLICY cer_select ON public.comparable_exclusion_reasons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY cc_select ON public.comparable_candidates FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY cc_insert ON public.comparable_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid()
              AND candidate_status = 'DISCOVERED' AND inclusion_status = 'NOT_DECIDED');

CREATE POLICY cdh_select ON public.comparable_decision_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY sq_select ON public.market_source_quality_assessments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY sq_insert ON public.market_source_quality_assessments FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND assessed_by = auth.uid());
CREATE POLICY sq_update ON public.market_source_quality_assessments FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

CREATE POLICY dvl_select ON public.derived_values FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY dvl_insert ON public.derived_values FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());

-- ============================================================== TRIGGERS
CREATE OR REPLACE FUNCTION public.sync_geo_point()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Single canonical position. lat/long are interoperability mirrors and can
  -- never diverge from geo_point.
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.geo_point = extensions.ST_SetSRID(
      extensions.ST_MakePoint(NEW.longitude::float8, NEW.latitude::float8), 4326)::extensions.geography;
  ELSIF NEW.geo_point IS NOT NULL THEN
    NEW.latitude = extensions.ST_Y(NEW.geo_point::extensions.geometry)::numeric;
    NEW.longitude = extensions.ST_X(NEW.geo_point::extensions.geometry)::numeric;
  ELSE
    NEW.geo_point = NULL;
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_properties_geo BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_geo_point();
CREATE TRIGGER trg_market_properties_geo BEFORE INSERT OR UPDATE ON public.market_properties
  FOR EACH ROW EXECUTE FUNCTION public.sync_geo_point();
CREATE TRIGGER trg_developments_geo BEFORE INSERT OR UPDATE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.sync_geo_point();

CREATE TRIGGER trg_dev_updated BEFORE UPDATE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mp_updated BEFORE UPDATE ON public.market_properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_mo_updated BEFORE UPDATE ON public.market_observations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.comparable_candidates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sq_updated BEFORE UPDATE ON public.market_source_quality_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_dev_org_immutable BEFORE UPDATE ON public.developments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_mp_org_immutable BEFORE UPDATE ON public.market_properties
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_mo_org_immutable BEFORE UPDATE ON public.market_observations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_cc_org_immutable BEFORE UPDATE ON public.comparable_candidates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_sq_org_immutable BEFORE UPDATE ON public.market_source_quality_assessments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();

-- Nothing in the market record is deletable: an inconvenient observation must
-- remain in the record. Exclusion is a decision, never a deletion.
CREATE TRIGGER trg_mp_nodelete BEFORE DELETE ON public.market_properties
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_mo_nodelete BEFORE DELETE ON public.market_observations
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_mph_nodelete BEFORE DELETE ON public.market_observation_price_history
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_mph_noupdate BEFORE UPDATE ON public.market_observation_price_history
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_pao_nodelete BEFORE DELETE ON public.property_attribute_observations
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_pao_noupdate BEFORE UPDATE ON public.property_attribute_observations
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_cdh_nodelete BEFORE DELETE ON public.comparable_decision_history
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_cdh_noupdate BEFORE UPDATE ON public.comparable_decision_history
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_cc_nodelete BEFORE DELETE ON public.comparable_candidates
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_pmc_nodelete BEFORE DELETE ON public.property_match_candidates
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_dv_nodelete BEFORE DELETE ON public.derived_values
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_dv_noupdate BEFORE UPDATE ON public.derived_values
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

CREATE OR REPLACE FUNCTION public.guard_canonical_fact()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Fatos adotados são append-only; nova adoção substitui a anterior';
  END IF;
  IF TG_OP = 'INSERT' AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Adoção de fato canônico exige a operação oficial adopt_canonical_fact';
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_pcf_guard BEFORE INSERT OR UPDATE ON public.property_canonical_facts
  FOR EACH ROW EXECUTE FUNCTION public.guard_canonical_fact();
CREATE TRIGGER trg_pcf_nodelete BEFORE DELETE ON public.property_canonical_facts
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

-- An observation can never be re-typed after the fact: an asking price cannot
-- become a transaction price through an UPDATE.
CREATE OR REPLACE FUNCTION public.guard_market_observation_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.observation_type IS DISTINCT FROM OLD.observation_type THEN
    RAISE EXCEPTION 'Tipo de observação é imutável: registre nova observação de mercado';
  END IF;
  IF NEW.market_property_id IS DISTINCT FROM OLD.market_property_id
     OR NEW.valuation_case_id IS DISTINCT FROM OLD.valuation_case_id THEN
    RAISE EXCEPTION 'Vínculo de imóvel/caso da observação é imutável';
  END IF;
  IF (NEW.asking_price IS DISTINCT FROM OLD.asking_price
      OR NEW.asking_monthly_rent IS DISTINCT FROM OLD.asking_monthly_rent)
     AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Alteração de preço pedido exige registro no histórico (record_price_observation)';
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_mo_guard BEFORE UPDATE ON public.market_observations
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_observation_update();

-- Evidence lineage stays inside the same case.
CREATE OR REPLACE FUNCTION public.guard_market_evidence_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE v_src_case uuid;
BEGIN
  IF NEW.evidence_source_id IS NOT NULL THEN
    SELECT valuation_case_id INTO v_src_case FROM public.evidence_sources WHERE id = NEW.evidence_source_id;
    IF v_src_case IS NOT NULL AND v_src_case <> NEW.valuation_case_id THEN
      RAISE EXCEPTION 'Contaminação cross-case bloqueada: a fonte pertence a outro caso';
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_mo_evidence_scope BEFORE INSERT OR UPDATE ON public.market_observations
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_evidence_scope();
CREATE TRIGGER trg_mph_evidence_scope BEFORE INSERT ON public.market_observation_price_history
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_evidence_scope();
CREATE TRIGGER trg_pao_evidence_scope BEFORE INSERT ON public.property_attribute_observations
  FOR EACH ROW EXECUTE FUNCTION public.guard_market_evidence_scope();

-- Comparable decisions cannot be written directly: only decide_comparable.
CREATE OR REPLACE FUNCTION public.guard_comparable_candidate_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Decisão de comparável exige a operação oficial decide_comparable';
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_cc_guard BEFORE UPDATE ON public.comparable_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_comparable_candidate_update();

CREATE OR REPLACE FUNCTION public.guard_match_candidate_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Decisão de duplicidade exige a operação oficial resolve_property_match';
  END IF;
  RETURN NEW;
END; $function$;

CREATE TRIGGER trg_pmc_guard BEFORE UPDATE ON public.property_match_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_match_candidate_update();

-- ============================================================== RPCs
CREATE OR REPLACE FUNCTION public.record_price_observation(
  _observation_id uuid, _asking_price numeric, _asking_monthly_rent numeric,
  _observed_at timestamptz, _status public.market_observation_status,
  _evidence_source_id uuid, _evidence_field_id uuid, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o public.market_observations; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO o FROM public.market_observations WHERE id = _observation_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Observação de mercado não encontrada'; END IF;
  IF NOT public.can_write(o.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para registrar preço observado';
  END IF;

  INSERT INTO public.market_observation_price_history (
    organization_id, valuation_case_id, market_observation_id, observed_at, currency_code,
    asking_price, asking_monthly_rent, observation_status, evidence_source_id,
    evidence_field_id, notes, created_by)
  VALUES (o.organization_id, o.valuation_case_id, o.id, coalesce(_observed_at, now()),
          o.currency_code, _asking_price, _asking_monthly_rent, _status, _evidence_source_id,
          _evidence_field_id, _notes, auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.market_observations
  SET asking_price = coalesce(_asking_price, asking_price),
      asking_monthly_rent = coalesce(_asking_monthly_rent, asking_monthly_rent),
      status = coalesce(_status, status),
      last_seen_at = greatest(coalesce(last_seen_at, coalesce(_observed_at, now())), coalesce(_observed_at, now()))
  WHERE id = o.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    o.organization_id, o.valuation_case_id, 'PRICE_OBSERVATION_ADDED', 'market_observation', o.id,
    jsonb_build_object('asking_price', o.asking_price, 'status', o.status),
    jsonb_build_object('asking_price', _asking_price, 'status', _status),
    jsonb_build_object('price_history_id', v_id, 'observed_at', coalesce(_observed_at, now())));

  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.adopt_canonical_fact(
  _subject_property_id uuid, _market_property_id uuid, _attribute_name text,
  _observation_id uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ob public.property_attribute_observations; v_id uuid; v_field public.evidence_fields;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF coalesce(btrim(_reason), '') = '' OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A adoção de fato exige justificativa registrada';
  END IF;

  SELECT * INTO ob FROM public.property_attribute_observations WHERE id = _observation_id;
  IF ob.id IS NULL THEN RAISE EXCEPTION 'Observação de atributo não encontrada'; END IF;
  IF NOT public.can_review(ob.organization_id) THEN
    RAISE EXCEPTION 'Somente REVIEWER, ADMIN ou OWNER podem adotar um fato';
  END IF;
  IF ob.attribute_name <> _attribute_name THEN
    RAISE EXCEPTION 'A observação não corresponde ao atributo informado';
  END IF;
  IF (_subject_property_id IS NOT NULL) = (_market_property_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Informe exatamente uma entidade (avaliando OU imóvel de mercado)';
  END IF;
  IF ob.subject_property_id IS DISTINCT FROM _subject_property_id
     OR ob.market_property_id IS DISTINCT FROM _market_property_id THEN
    RAISE EXCEPTION 'A observação pertence a outra entidade';
  END IF;

  -- Machine-produced content is never adopted as fact by itself: an extraction
  -- may only be adopted after human verification of the underlying field.
  IF ob.value_origin = 'EXTERNAL_API' THEN
    RAISE EXCEPTION 'Valor de origem automatizada não pode ser adotado como fato';
  END IF;
  IF ob.value_origin = 'EVIDENCE_EXTRACTION' THEN
    IF ob.evidence_field_id IS NULL THEN
      RAISE EXCEPTION 'Extração sem campo de evidência vinculado não pode ser adotada';
    END IF;
    SELECT * INTO v_field FROM public.evidence_fields WHERE id = ob.evidence_field_id;
    IF v_field.validation_status IS DISTINCT FROM 'VERIFIED' THEN
      RAISE EXCEPTION 'Somente campo VERIFIED pode ser adotado como fato';
    END IF;
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);

  UPDATE public.property_canonical_facts
  SET superseded_at = now()
  WHERE organization_id = ob.organization_id
    AND valuation_case_id = ob.valuation_case_id
    AND attribute_name = _attribute_name
    AND subject_property_id IS NOT DISTINCT FROM _subject_property_id
    AND market_property_id IS NOT DISTINCT FROM _market_property_id
    AND superseded_at IS NULL;

  INSERT INTO public.property_canonical_facts (
    organization_id, valuation_case_id, subject_property_id, market_property_id,
    attribute_name, adopted_value, adopted_numeric_value, adopted_unit,
    adopted_from_observation_id, adopted_by, adoption_reason)
  VALUES (ob.organization_id, ob.valuation_case_id, _subject_property_id, _market_property_id,
          _attribute_name, coalesce(ob.normalized_value, ob.raw_value), ob.numeric_value, ob.unit,
          ob.id, auth.uid(), btrim(_reason))
  RETURNING id INTO v_id;

  UPDATE public.property_canonical_facts SET superseded_by_fact_id = v_id
  WHERE organization_id = ob.organization_id
    AND valuation_case_id = ob.valuation_case_id
    AND attribute_name = _attribute_name
    AND subject_property_id IS NOT DISTINCT FROM _subject_property_id
    AND market_property_id IS NOT DISTINCT FROM _market_property_id
    AND superseded_at IS NOT NULL AND superseded_by_fact_id IS NULL;

  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    ob.organization_id, ob.valuation_case_id, 'CANONICAL_FACT_ADOPTED',
    'property_canonical_fact', v_id, NULL,
    jsonb_build_object('attribute_name', _attribute_name,
                       'adopted_from_observation_id', ob.id,
                       'value_origin', ob.value_origin),
    jsonb_build_object('reason', btrim(_reason)));

  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.resolve_property_match(
  _match_id uuid, _status public.property_match_status, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE m public.property_match_candidates;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO m FROM public.property_match_candidates WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'Par de duplicidade não encontrado'; END IF;
  IF NOT public.can_review(m.organization_id) THEN
    RAISE EXCEPTION 'Somente REVIEWER, ADMIN ou OWNER podem decidir duplicidade';
  END IF;
  IF _status IN ('CONFIRMED_SAME','CONFIRMED_DIFFERENT')
     AND (coalesce(btrim(_notes), '') = '' OR length(btrim(_notes)) < 3) THEN
    RAISE EXCEPTION 'Decisão de duplicidade exige justificativa registrada';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.property_match_candidates
  SET match_status = _status, reviewed_by = auth.uid(), reviewed_at = now(),
      review_notes = nullif(btrim(coalesce(_notes, '')), '')
  WHERE id = m.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    m.organization_id, m.valuation_case_id, 'DUPLICATE_MATCH_CONFIRMED',
    'property_match_candidate', m.id,
    jsonb_build_object('match_status', m.match_status),
    jsonb_build_object('match_status', _status),
    jsonb_build_object('notes', nullif(btrim(coalesce(_notes, '')), '')));

  RETURN m.id;
END; $function$;

CREATE OR REPLACE FUNCTION public.decide_comparable(
  _candidate_id uuid, _candidate_status public.comparable_candidate_status,
  _inclusion_status public.comparable_inclusion_status,
  _reason_code text, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.comparable_candidates; v_event text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO c FROM public.comparable_candidates WHERE id = _candidate_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Candidato a comparável não encontrado'; END IF;
  IF NOT public.can_write(c.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para decidir sobre comparável';
  END IF;

  IF _inclusion_status = 'INCLUDED' AND coalesce(_candidate_status, c.candidate_status) <> 'ELIGIBLE' THEN
    RAISE EXCEPTION 'Somente um candidato ELIGIBLE pode ser incluído';
  END IF;
  IF _inclusion_status = 'EXCLUDED' THEN
    IF _reason_code IS NULL THEN
      RAISE EXCEPTION 'Exclusão exige código de motivo da taxonomia';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.comparable_exclusion_reasons
                   WHERE code = _reason_code AND is_active) THEN
      RAISE EXCEPTION 'Código de exclusão inválido: %', _reason_code;
    END IF;
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);

  UPDATE public.comparable_candidates
  SET candidate_status = coalesce(_candidate_status, candidate_status),
      inclusion_status = coalesce(_inclusion_status, inclusion_status),
      inclusion_reason = CASE WHEN _inclusion_status = 'INCLUDED'
                              THEN nullif(btrim(coalesce(_notes,'')), '') ELSE inclusion_reason END,
      exclusion_reason_code = CASE WHEN _inclusion_status = 'EXCLUDED'
                              THEN _reason_code ELSE exclusion_reason_code END,
      exclusion_notes = CASE WHEN _inclusion_status = 'EXCLUDED'
                              THEN nullif(btrim(coalesce(_notes,'')), '') ELSE exclusion_notes END,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = c.id;

  INSERT INTO public.comparable_decision_history (
    organization_id, valuation_case_id, candidate_id,
    previous_candidate_status, new_candidate_status,
    previous_inclusion_status, new_inclusion_status,
    reason_code, notes, actor_user_id)
  VALUES (c.organization_id, c.valuation_case_id, c.id,
          c.candidate_status, coalesce(_candidate_status, c.candidate_status),
          c.inclusion_status, coalesce(_inclusion_status, c.inclusion_status),
          _reason_code, nullif(btrim(coalesce(_notes,'')), ''), auth.uid());

  PERFORM set_config('valuation.privileged_op', 'off', true);

  v_event := CASE
    WHEN _inclusion_status = 'INCLUDED' THEN 'COMPARABLE_INCLUDED'
    WHEN _inclusion_status = 'EXCLUDED' THEN 'COMPARABLE_EXCLUDED'
    WHEN _candidate_status = 'ELIGIBLE' THEN 'COMPARABLE_MARKED_ELIGIBLE'
    WHEN _candidate_status = 'INELIGIBLE' THEN 'COMPARABLE_MARKED_INELIGIBLE'
    ELSE 'COMPARABLE_DISCOVERED' END;

  PERFORM public.audit_write_internal(
    c.organization_id, c.valuation_case_id, v_event, 'comparable_candidate', c.id,
    jsonb_build_object('candidate_status', c.candidate_status,
                       'inclusion_status', c.inclusion_status),
    jsonb_build_object('candidate_status', coalesce(_candidate_status, c.candidate_status),
                       'inclusion_status', coalesce(_inclusion_status, c.inclusion_status)),
    jsonb_build_object('reason_code', _reason_code,
                       'notes', nullif(btrim(coalesce(_notes,'')), '')));

  RETURN c.id;
END; $function$;

-- Distance is factual evidence, not a methodological decision.
CREATE OR REPLACE FUNCTION public.distance_between_properties_meters(
  _left_market_property_id uuid, _right_market_property_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a extensions.geography; b extensions.geography; org_a uuid; org_b uuid;
BEGIN
  SELECT geo_point, organization_id INTO a, org_a FROM public.market_properties WHERE id = _left_market_property_id;
  SELECT geo_point, organization_id INTO b, org_b FROM public.market_properties WHERE id = _right_market_property_id;
  IF org_a IS NULL OR org_b IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_org_member(org_a) OR NOT public.is_org_member(org_b) THEN
    RAISE EXCEPTION 'Acesso negado a imóvel fora da organização';
  END IF;
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  RETURN round(extensions.ST_Distance(a, b)::numeric, 2);
END; $function$;

CREATE OR REPLACE FUNCTION public.distance_subject_to_market_property_meters(
  _subject_property_id uuid, _market_property_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a extensions.geography; b extensions.geography; org_a uuid; org_b uuid;
BEGIN
  SELECT geo_point, organization_id INTO a, org_a FROM public.properties WHERE id = _subject_property_id;
  SELECT geo_point, organization_id INTO b, org_b FROM public.market_properties WHERE id = _market_property_id;
  IF org_a IS NULL OR org_b IS NULL THEN RETURN NULL; END IF;
  IF NOT public.is_org_member(org_a) OR NOT public.is_org_member(org_b) THEN
    RAISE EXCEPTION 'Acesso negado a imóvel fora da organização';
  END IF;
  IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
  RETURN round(extensions.ST_Distance(a, b)::numeric, 2);
END; $function$;

REVOKE ALL ON FUNCTION public.record_price_observation(uuid, numeric, numeric, timestamptz, public.market_observation_status, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.adopt_canonical_fact(uuid, uuid, text, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_property_match(uuid, public.property_match_status, text) FROM anon;
REVOKE ALL ON FUNCTION public.decide_comparable(uuid, public.comparable_candidate_status, public.comparable_inclusion_status, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.distance_between_properties_meters(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.distance_subject_to_market_property_meters(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.sync_geo_point() FROM anon;

GRANT EXECUTE ON FUNCTION public.record_price_observation(uuid, numeric, numeric, timestamptz, public.market_observation_status, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adopt_canonical_fact(uuid, uuid, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_property_match(uuid, public.property_match_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_comparable(uuid, public.comparable_candidate_status, public.comparable_inclusion_status, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distance_between_properties_meters(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.distance_subject_to_market_property_meters(uuid, uuid) TO authenticated;

-- ============================================================== INDEXES
CREATE INDEX idx_dev_org ON public.developments(organization_id);
CREATE INDEX idx_dev_case ON public.developments(valuation_case_id);
CREATE INDEX idx_dev_geo ON public.developments USING GIST(geo_point);

CREATE INDEX idx_mp_org ON public.market_properties(organization_id);
CREATE INDEX idx_mp_case ON public.market_properties(valuation_case_id);
CREATE INDEX idx_mp_development ON public.market_properties(development_id);
CREATE INDEX idx_mp_postal ON public.market_properties(postal_code);
CREATE INDEX idx_mp_geo ON public.market_properties USING GIST(geo_point);
CREATE INDEX idx_properties_geo ON public.properties USING GIST(geo_point);
CREATE INDEX idx_properties_development ON public.properties(development_id);

CREATE INDEX idx_mo_org ON public.market_observations(organization_id);
CREATE INDEX idx_mo_case ON public.market_observations(valuation_case_id);
CREATE INDEX idx_mo_property ON public.market_observations(market_property_id);
CREATE INDEX idx_mo_type ON public.market_observations(observation_type);
CREATE INDEX idx_mo_date ON public.market_observations(observation_date);
CREATE INDEX idx_mo_external ON public.market_observations(external_listing_id);
CREATE INDEX idx_mo_source ON public.market_observations(evidence_source_id);
CREATE INDEX idx_mo_artifact ON public.market_observations(primary_artifact_id);

CREATE INDEX idx_mph_org ON public.market_observation_price_history(organization_id);
CREATE INDEX idx_mph_case ON public.market_observation_price_history(valuation_case_id);
CREATE INDEX idx_mph_observation ON public.market_observation_price_history(market_observation_id, observed_at DESC);
CREATE INDEX idx_mph_source ON public.market_observation_price_history(organization_id, evidence_source_id);
CREATE INDEX idx_mph_field ON public.market_observation_price_history(organization_id, evidence_field_id);

CREATE INDEX idx_pao_org ON public.property_attribute_observations(organization_id);
CREATE INDEX idx_pao_case ON public.property_attribute_observations(valuation_case_id);
CREATE INDEX idx_pao_subject ON public.property_attribute_observations(subject_property_id, attribute_name);
CREATE INDEX idx_pao_market ON public.property_attribute_observations(market_property_id, attribute_name);
CREATE INDEX idx_pao_field ON public.property_attribute_observations(organization_id, evidence_field_id);
CREATE INDEX idx_pao_source ON public.property_attribute_observations(organization_id, evidence_source_id);

CREATE INDEX idx_pcf_org ON public.property_canonical_facts(organization_id);
CREATE INDEX idx_pcf_case ON public.property_canonical_facts(valuation_case_id);
CREATE INDEX idx_pcf_subject ON public.property_canonical_facts(subject_property_id, attribute_name);
CREATE INDEX idx_pcf_market ON public.property_canonical_facts(market_property_id, attribute_name);
CREATE INDEX idx_pcf_observation ON public.property_canonical_facts(organization_id, adopted_from_observation_id);

CREATE INDEX idx_pmc_org ON public.property_match_candidates(organization_id);
CREATE INDEX idx_pmc_case ON public.property_match_candidates(valuation_case_id);
CREATE INDEX idx_pmc_left ON public.property_match_candidates(left_market_property_id);
CREATE INDEX idx_pmc_right ON public.property_match_candidates(right_market_property_id);
CREATE INDEX idx_pmc_status ON public.property_match_candidates(match_status);

CREATE INDEX idx_cc_org ON public.comparable_candidates(organization_id);
CREATE INDEX idx_cc_case ON public.comparable_candidates(valuation_case_id);
CREATE INDEX idx_cc_subject ON public.comparable_candidates(subject_property_id);
CREATE INDEX idx_cc_market ON public.comparable_candidates(market_property_id);
CREATE INDEX idx_cc_observation ON public.comparable_candidates(market_observation_id);
CREATE INDEX idx_cc_candidate_status ON public.comparable_candidates(candidate_status);
CREATE INDEX idx_cc_inclusion_status ON public.comparable_candidates(inclusion_status);
CREATE INDEX idx_cc_reason ON public.comparable_candidates(exclusion_reason_code);

CREATE INDEX idx_cdh_org ON public.comparable_decision_history(organization_id);
CREATE INDEX idx_cdh_case ON public.comparable_decision_history(valuation_case_id);
CREATE INDEX idx_cdh_candidate ON public.comparable_decision_history(candidate_id, created_at DESC);

CREATE INDEX idx_sq_org ON public.market_source_quality_assessments(organization_id);
CREATE INDEX idx_sq_case ON public.market_source_quality_assessments(valuation_case_id);

CREATE INDEX idx_dv_org ON public.derived_values(organization_id);
CREATE INDEX idx_dv_case ON public.derived_values(valuation_case_id);
CREATE INDEX idx_dv_observation ON public.derived_values(market_observation_id);