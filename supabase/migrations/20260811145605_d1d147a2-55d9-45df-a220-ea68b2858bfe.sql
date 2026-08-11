-- =====================================================================
-- PROPERTY INTELLIGENCE RESEARCH ENGINE V1
-- AI discovers. Source supports. System checks. Human verifies.
-- =====================================================================

-- 1) Vocabulário -------------------------------------------------------
CREATE TYPE public.research_type AS ENUM (
  'SUBJECT_PROPERTY_FACTS','COMPARABLE_DISCOVERY','TRANSACTION_DISCOVERY','MARKET_DISCOVERY');

CREATE TYPE public.research_run_status AS ENUM (
  'DRAFT','PLANNING','PLAN_READY','SEARCHING','RESULTS_READY','CAPTURING','EXTRACTING',
  'REVIEW_REQUIRED','COMPLETED','FAILED','CANCELLED');

CREATE TYPE public.research_query_origin AS ENUM ('AI','USER');

CREATE TYPE public.research_query_status AS ENUM ('PROPOSED','APPROVED','EXECUTED','DISCARDED','FAILED');

CREATE TYPE public.research_selection_status AS ENUM ('UNREVIEWED','SELECTED','REJECTED');

CREATE TYPE public.research_capture_status AS ENUM (
  'NOT_CAPTURED','CAPTURING','CAPTURED','FAILED','ACCESS_RESTRICTED','BLOCKED_BY_POLICY','DUPLICATE');

CREATE TYPE public.capture_method AS ENUM (
  'ANTHROPIC_WEB_SEARCH_RESULT','ANTHROPIC_WEB_FETCH','DIRECT_HTTP','USER_UPLOAD','EXTERNAL_API','OTHER');

CREATE TYPE public.domain_policy_status AS ENUM ('ALLOWED','REVIEW_REQUIRED','BLOCKED');

CREATE TYPE public.research_candidate_type AS ENUM (
  'MARKET_PROPERTY','SALE_LISTING','CLOSED_SALE','RENT_LISTING','CLOSED_RENT','SUBJECT_PROPERTY_INFORMATION');

CREATE TYPE public.research_candidate_status AS ENUM (
  'DISCOVERED','CAPTURED','EXTRACTED','REVIEW_REQUIRED','READY_TO_PROMOTE','PROMOTED','REJECTED');

CREATE TYPE public.extraction_support_status AS ENUM (
  'EXPLICIT_TEXT','EXPLICIT_STRUCTURED_DATA','VISUAL_EVIDENCE','AMBIGUOUS','NOT_FOUND','UNSUPPORTED');

CREATE TYPE public.support_check_status AS ENUM (
  'EXACT_MATCH','NORMALIZED_MATCH','VISUAL_ONLY','FAILED','NOT_APPLICABLE');

-- 2) Research run ------------------------------------------------------
CREATE TABLE public.property_research_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  subject_property_id uuid,
  research_type public.research_type NOT NULL,
  objective text NOT NULL,
  status public.research_run_status NOT NULL DEFAULT 'DRAFT',
  requested_by uuid NOT NULL,
  provider text NOT NULL DEFAULT 'ANTHROPIC',
  research_model text,
  extraction_model text,
  max_search_uses integer NOT NULL DEFAULT 4,
  max_sources integer NOT NULL DEFAULT 20,
  max_fetches integer NOT NULL DEFAULT 10,
  max_extractions integer NOT NULL DEFAULT 10,
  search_uses_actual integer NOT NULL DEFAULT 0,
  fetches_actual integer NOT NULL DEFAULT 0,
  extractions_actual integer NOT NULL DEFAULT 0,
  ai_calls_actual integer NOT NULL DEFAULT 0,
  location_city text,
  location_region text,
  location_country text DEFAULT 'BR',
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prr_case_fk FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases(organization_id, id),
  CONSTRAINT prr_subject_fk FOREIGN KEY (organization_id, subject_property_id)
    REFERENCES public.properties(organization_id, id),
  CONSTRAINT prr_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT prr_org_id_uniq UNIQUE (organization_id, id),
  CONSTRAINT prr_budget_chk CHECK (
    max_search_uses BETWEEN 1 AND 10 AND max_sources BETWEEN 1 AND 50
    AND max_fetches BETWEEN 1 AND 25 AND max_extractions BETWEEN 1 AND 25)
);

GRANT SELECT, INSERT, UPDATE ON public.property_research_runs TO authenticated;
GRANT ALL ON public.property_research_runs TO service_role;
ALTER TABLE public.property_research_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY prr_select ON public.property_research_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY prr_insert ON public.property_research_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND requested_by = auth.uid());
CREATE POLICY prr_update ON public.property_research_runs FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- 3) Immutable research context snapshot -------------------------------
CREATE TABLE public.research_context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_run_id uuid NOT NULL,
  subject_property_id uuid,
  schema_version text NOT NULL DEFAULT 'valuation.research.context/1',
  facts jsonb NOT NULL,
  fact_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rcs_run_fk FOREIGN KEY (organization_id, valuation_case_id, research_run_id)
    REFERENCES public.property_research_runs(organization_id, valuation_case_id, id),
  CONSTRAINT rcs_run_uniq UNIQUE (research_run_id)
);

GRANT SELECT, INSERT ON public.research_context_snapshots TO authenticated;
GRANT ALL ON public.research_context_snapshots TO service_role;
ALTER TABLE public.research_context_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY rcs_select ON public.research_context_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rcs_insert ON public.research_context_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());

-- 4) Queries -----------------------------------------------------------
CREATE TABLE public.research_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_run_id uuid NOT NULL,
  query_text text NOT NULL,
  purpose text,
  generated_by public.research_query_origin NOT NULL,
  input_fact_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.research_query_status NOT NULL DEFAULT 'PROPOSED',
  executed_at timestamptz,
  result_count integer NOT NULL DEFAULT 0,
  ai_run_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rq_run_fk FOREIGN KEY (organization_id, valuation_case_id, research_run_id)
    REFERENCES public.property_research_runs(organization_id, valuation_case_id, id),
  CONSTRAINT rq_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT rq_text_chk CHECK (btrim(query_text) <> '')
);

GRANT SELECT, INSERT, UPDATE ON public.research_queries TO authenticated;
GRANT ALL ON public.research_queries TO service_role;
ALTER TABLE public.research_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY rq_select ON public.research_queries FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rq_insert ON public.research_queries FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY rq_update ON public.research_queries FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- An executed query is a historical record: its text can never be rewritten.
CREATE OR REPLACE FUNCTION public.guard_research_query_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'EXECUTED' AND NEW.query_text IS DISTINCT FROM OLD.query_text THEN
    RAISE EXCEPTION 'Consulta já executada é registro histórico e não pode ser reescrita';
  END IF;
  IF OLD.status = 'EXECUTED' AND NEW.status <> 'EXECUTED' THEN
    RAISE EXCEPTION 'Consulta já executada não pode voltar de estado';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_research_query_update BEFORE UPDATE ON public.research_queries
  FOR EACH ROW EXECUTE FUNCTION public.guard_research_query_update();

-- 5) Search results ----------------------------------------------------
CREATE TABLE public.research_search_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_run_id uuid NOT NULL,
  research_query_id uuid,
  provider text NOT NULL,
  provider_result_reference text,
  rank integer,
  title text,
  url text NOT NULL,
  canonical_url text NOT NULL,
  domain text NOT NULL,
  snippet text,
  page_age text,
  returned_at timestamptz NOT NULL DEFAULT now(),
  raw_result_payload jsonb,
  raw_payload_hash text,
  selection_status public.research_selection_status NOT NULL DEFAULT 'UNREVIEWED',
  capture_status public.research_capture_status NOT NULL DEFAULT 'NOT_CAPTURED',
  capture_failure_reason text,
  evidence_source_id uuid,
  evidence_artifact_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rsr_run_fk FOREIGN KEY (organization_id, valuation_case_id, research_run_id)
    REFERENCES public.property_research_runs(organization_id, valuation_case_id, id),
  CONSTRAINT rsr_query_fk FOREIGN KEY (organization_id, valuation_case_id, research_query_id)
    REFERENCES public.research_queries(organization_id, valuation_case_id, id),
  CONSTRAINT rsr_source_fk FOREIGN KEY (organization_id, evidence_source_id)
    REFERENCES public.evidence_sources(organization_id, id),
  CONSTRAINT rsr_artifact_fk FOREIGN KEY (organization_id, evidence_artifact_id)
    REFERENCES public.evidence_artifacts(organization_id, id),
  CONSTRAINT rsr_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT rsr_canonical_uniq UNIQUE (research_run_id, canonical_url),
  CONSTRAINT rsr_url_scheme_chk CHECK (canonical_url ~* '^https?://')
);

GRANT SELECT, INSERT, UPDATE ON public.research_search_results TO authenticated;
GRANT ALL ON public.research_search_results TO service_role;
ALTER TABLE public.research_search_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsr_select ON public.research_search_results FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rsr_insert ON public.research_search_results FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY rsr_update ON public.research_search_results FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

CREATE INDEX idx_rsr_run ON public.research_search_results(research_run_id);
CREATE INDEX idx_rsr_domain ON public.research_search_results(organization_id, domain);

-- 6) Result <-> query hits (one source, many queries) ------------------
CREATE TABLE public.research_result_query_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_search_result_id uuid NOT NULL,
  research_query_id uuid NOT NULL,
  rank integer,
  returned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rqh_result_fk FOREIGN KEY (organization_id, valuation_case_id, research_search_result_id)
    REFERENCES public.research_search_results(organization_id, valuation_case_id, id),
  CONSTRAINT rqh_query_fk FOREIGN KEY (organization_id, valuation_case_id, research_query_id)
    REFERENCES public.research_queries(organization_id, valuation_case_id, id),
  CONSTRAINT rqh_uniq UNIQUE (research_search_result_id, research_query_id)
);

GRANT SELECT, INSERT ON public.research_result_query_hits TO authenticated;
GRANT ALL ON public.research_result_query_hits TO service_role;
ALTER TABLE public.research_result_query_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY rqh_select ON public.research_result_query_hits FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rqh_insert ON public.research_result_query_hits FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id));

-- 7) Domain policy -----------------------------------------------------
CREATE TABLE public.research_source_domain_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  domain text NOT NULL,
  policy_status public.domain_policy_status NOT NULL DEFAULT 'REVIEW_REQUIRED',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rsdp_uniq UNIQUE (organization_id, domain)
);

GRANT SELECT, INSERT, UPDATE ON public.research_source_domain_policies TO authenticated;
GRANT ALL ON public.research_source_domain_policies TO service_role;
ALTER TABLE public.research_source_domain_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY rsdp_select ON public.research_source_domain_policies FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rsdp_insert ON public.research_source_domain_policies FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY rsdp_update ON public.research_source_domain_policies FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- 8) Field taxonomy (closed allowlist, versioned) ----------------------
CREATE TABLE public.research_field_taxonomy (
  field_name text PRIMARY KEY,
  data_kind text NOT NULL,
  applies_to text NOT NULL,
  taxonomy_version text NOT NULL DEFAULT 'valuation.research.fields/1',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.research_field_taxonomy TO authenticated;
GRANT ALL ON public.research_field_taxonomy TO service_role;
ALTER TABLE public.research_field_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY rft_select ON public.research_field_taxonomy FOR SELECT TO authenticated USING (true);

INSERT INTO public.research_field_taxonomy (field_name, data_kind, applies_to) VALUES
 ('property_type','TEXT','PROPERTY'),('address_raw','TEXT','PROPERTY'),
 ('street_name','TEXT','PROPERTY'),('street_number','TEXT','PROPERTY'),
 ('complement','TEXT','PROPERTY'),('district','TEXT','PROPERTY'),
 ('city','TEXT','PROPERTY'),('state','TEXT','PROPERTY'),
 ('postal_code','TEXT','PROPERTY'),('development_name','TEXT','PROPERTY'),
 ('private_area','NUMBER','PROPERTY'),('usable_area','NUMBER','PROPERTY'),
 ('built_area','NUMBER','PROPERTY'),('total_area','NUMBER','PROPERTY'),
 ('land_area','NUMBER','PROPERTY'),('bedrooms','NUMBER','PROPERTY'),
 ('suites','NUMBER','PROPERTY'),('bathrooms','NUMBER','PROPERTY'),
 ('parking_spaces','NUMBER','PROPERTY'),('floor_number','NUMBER','PROPERTY'),
 ('construction_year','NUMBER','PROPERTY'),('condition_status','TEXT','PROPERTY'),
 ('asking_price','MONEY','OBSERVATION'),('transaction_price','MONEY','OBSERVATION'),
 ('asking_monthly_rent','MONEY','OBSERVATION'),('contracted_monthly_rent','MONEY','OBSERVATION'),
 ('publication_date','DATE','OBSERVATION'),('transaction_date','DATE','OBSERVATION'),
 ('condo_fee','MONEY','OBSERVATION'),('property_tax','MONEY','OBSERVATION'),
 ('broker_name','TEXT','OBSERVATION'),('external_listing_id','TEXT','OBSERVATION'),
 ('listing_status','TEXT','OBSERVATION');

-- 9) Provenance columns on the evidence engine -------------------------
ALTER TABLE public.evidence_artifacts
  ADD COLUMN capture_method public.capture_method NOT NULL DEFAULT 'USER_UPLOAD',
  ADD COLUMN provider_metadata jsonb,
  ADD COLUMN source_content_text text;

ALTER TABLE public.evidence_fields
  ADD COLUMN ai_support_status public.extraction_support_status,
  ADD COLUMN support_check_status public.support_check_status,
  ADD COLUMN support_check_details jsonb;

-- A field whose deterministic excerpt check FAILED can never become VERIFIED.
CREATE OR REPLACE FUNCTION public.guard_support_check_before_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.validation_status = 'VERIFIED' AND NEW.support_check_status = 'FAILED' THEN
    RAISE EXCEPTION 'Campo com verificação determinística de trecho FAILED não pode ser VERIFICADO';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_support_check BEFORE INSERT OR UPDATE ON public.evidence_fields
  FOR EACH ROW EXECUTE FUNCTION public.guard_support_check_before_verification();

-- 10) Extraction issues -------------------------------------------------
CREATE TABLE public.research_extraction_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_run_id uuid,
  evidence_extraction_id uuid,
  evidence_field_id uuid,
  issue_type text NOT NULL,
  detail text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rei_field_fk FOREIGN KEY (organization_id, evidence_field_id)
    REFERENCES public.evidence_fields(organization_id, id)
);
GRANT SELECT ON public.research_extraction_issues TO authenticated;
GRANT ALL ON public.research_extraction_issues TO service_role;
ALTER TABLE public.research_extraction_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY rei_select ON public.research_extraction_issues FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

-- 11) Research entity candidates ---------------------------------------
CREATE TABLE public.research_entity_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  research_run_id uuid NOT NULL,
  research_search_result_id uuid,
  evidence_source_id uuid,
  evidence_artifact_id uuid,
  evidence_extraction_id uuid,
  candidate_type public.research_candidate_type NOT NULL,
  status public.research_candidate_status NOT NULL DEFAULT 'DISCOVERED',
  rejection_reason text,
  promoted_market_property_id uuid,
  promoted_market_observation_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rec_run_fk FOREIGN KEY (organization_id, valuation_case_id, research_run_id)
    REFERENCES public.property_research_runs(organization_id, valuation_case_id, id),
  CONSTRAINT rec_result_fk FOREIGN KEY (organization_id, valuation_case_id, research_search_result_id)
    REFERENCES public.research_search_results(organization_id, valuation_case_id, id),
  CONSTRAINT rec_source_fk FOREIGN KEY (organization_id, evidence_source_id)
    REFERENCES public.evidence_sources(organization_id, id),
  CONSTRAINT rec_artifact_fk FOREIGN KEY (organization_id, evidence_artifact_id)
    REFERENCES public.evidence_artifacts(organization_id, id),
  CONSTRAINT rec_extraction_fk FOREIGN KEY (organization_id, evidence_extraction_id)
    REFERENCES public.evidence_extractions(organization_id, id),
  CONSTRAINT rec_scope_uniq UNIQUE (organization_id, valuation_case_id, id),
  CONSTRAINT rec_extraction_uniq UNIQUE (evidence_extraction_id, candidate_type)
);

GRANT SELECT, INSERT, UPDATE ON public.research_entity_candidates TO authenticated;
GRANT ALL ON public.research_entity_candidates TO service_role;
ALTER TABLE public.research_entity_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY rec_select ON public.research_entity_candidates FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY rec_insert ON public.research_entity_candidates FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid()
              AND status IN ('DISCOVERED','CAPTURED','EXTRACTED','REVIEW_REQUIRED'));
CREATE POLICY rec_update ON public.research_entity_candidates FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- PROMOTED and the promoted ids are written only by the official operation.
CREATE OR REPLACE FUNCTION public.guard_research_candidate_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.in_privileged_op() THEN
    IF NEW.status = 'PROMOTED' AND OLD.status <> 'PROMOTED' THEN
      RAISE EXCEPTION 'Promoção só pode ocorrer pela operação oficial promote_research_candidate';
    END IF;
    IF NEW.promoted_market_property_id IS DISTINCT FROM OLD.promoted_market_property_id
       OR NEW.promoted_market_observation_id IS DISTINCT FROM OLD.promoted_market_observation_id THEN
      RAISE EXCEPTION 'Vínculo de promoção só é gravado pela operação oficial';
    END IF;
  END IF;
  IF OLD.status = 'PROMOTED' AND NEW.status <> 'PROMOTED' THEN
    RAISE EXCEPTION 'Candidato promovido não retorna de estado';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_research_candidate BEFORE UPDATE ON public.research_entity_candidates
  FOR EACH ROW EXECUTE FUNCTION public.guard_research_candidate_update();

CREATE TABLE public.research_entity_candidate_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  evidence_field_id uuid NOT NULL,
  semantic_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recf_candidate_fk FOREIGN KEY (organization_id, valuation_case_id, candidate_id)
    REFERENCES public.research_entity_candidates(organization_id, valuation_case_id, id),
  CONSTRAINT recf_field_fk FOREIGN KEY (organization_id, evidence_field_id)
    REFERENCES public.evidence_fields(organization_id, id),
  CONSTRAINT recf_uniq UNIQUE (candidate_id, evidence_field_id)
);

GRANT SELECT, INSERT ON public.research_entity_candidate_fields TO authenticated;
GRANT ALL ON public.research_entity_candidate_fields TO service_role;
ALTER TABLE public.research_entity_candidate_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY recf_select ON public.research_entity_candidate_fields FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY recf_insert ON public.research_entity_candidate_fields FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id));

-- 12) Usage / rate limiting (factual counters, no billing) --------------
CREATE TABLE public.research_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  valuation_case_id uuid,
  research_run_id uuid,
  actor_user_id uuid NOT NULL,
  usage_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  cache_write_tokens integer,
  server_tool_uses integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.research_usage_events TO authenticated;
GRANT ALL ON public.research_usage_events TO service_role;
ALTER TABLE public.research_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY rue_select ON public.research_usage_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE INDEX idx_rue_window ON public.research_usage_events(organization_id, actor_user_id, created_at DESC);

-- 13) Immutability / hygiene triggers ----------------------------------
CREATE TRIGGER trg_prr_no_org_migration BEFORE UPDATE ON public.property_research_runs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_rq_no_org_migration BEFORE UPDATE ON public.research_queries
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_rsr_no_org_migration BEFORE UPDATE ON public.research_search_results
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_rec_no_org_migration BEFORE UPDATE ON public.research_entity_candidates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();

CREATE TRIGGER trg_prr_block_delete BEFORE DELETE ON public.property_research_runs
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rcs_block_delete BEFORE DELETE ON public.research_context_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rq_block_delete BEFORE DELETE ON public.research_queries
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rsr_block_delete BEFORE DELETE ON public.research_search_results
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rqh_block_delete BEFORE DELETE ON public.research_result_query_hits
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rec_block_delete BEFORE DELETE ON public.research_entity_candidates
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_recf_block_delete BEFORE DELETE ON public.research_entity_candidate_fields
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rei_block_delete BEFORE DELETE ON public.research_extraction_issues
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_rue_block_delete BEFORE DELETE ON public.research_usage_events
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

-- 14) Official operation: promote a research candidate to market -------
CREATE OR REPLACE FUNCTION public.promote_research_candidate(
  _candidate_id uuid,
  _field_ids uuid[],
  _observation_type public.market_observation_type,
  _observation_status public.market_observation_status,
  _market_property_id uuid,
  _label text,
  _notes text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.research_entity_candidates;
  r public.research_search_results;
  f public.evidence_fields;
  v jsonb := '{}'::jsonb;
  v_prop uuid;
  v_obs uuid;
  v_used jsonb := '[]'::jsonb;
  v_has_transaction_price boolean := false;
  v_listing_url text;
  v_ext_id text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO c FROM public.research_entity_candidates WHERE id = _candidate_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Candidato de pesquisa não encontrado'; END IF;
  IF NOT public.can_write(c.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para promover candidato de pesquisa';
  END IF;
  IF c.status = 'PROMOTED' THEN RAISE EXCEPTION 'Candidato já promovido'; END IF;
  IF c.status = 'REJECTED' THEN RAISE EXCEPTION 'Candidato rejeitado não pode ser promovido'; END IF;
  IF _field_ids IS NULL OR array_length(_field_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum campo verificado selecionado para promoção';
  END IF;

  IF c.research_search_result_id IS NOT NULL THEN
    SELECT * INTO r FROM public.research_search_results WHERE id = c.research_search_result_id;
    v_listing_url := r.canonical_url;
  END IF;

  -- Only VERIFIED fields of this candidate, this org and this case may be used.
  FOR f IN
    SELECT ef.* FROM public.evidence_fields ef
    JOIN public.research_entity_candidate_fields recf ON recf.evidence_field_id = ef.id
    WHERE ef.id = ANY(_field_ids) AND recf.candidate_id = c.id
  LOOP
    IF f.organization_id <> c.organization_id THEN
      RAISE EXCEPTION 'Contaminação cross-org bloqueada na promoção';
    END IF;
    IF f.validation_status <> 'VERIFIED' THEN
      RAISE EXCEPTION 'Campo % não está VERIFICADO: dado pendente nunca vira fato de mercado', f.field_name;
    END IF;
    IF f.support_check_status = 'FAILED' THEN
      RAISE EXCEPTION 'Campo % reprovou a verificação determinística de trecho', f.field_name;
    END IF;
    v := v || jsonb_build_object(f.field_name, jsonb_build_object(
      'field_id', f.id, 'raw', f.raw_value, 'normalized', f.normalized_value, 'numeric', f.numeric_value));
    v_used := v_used || jsonb_build_array(jsonb_build_object('field_id', f.id, 'field_name', f.field_name));
    IF f.field_name IN ('transaction_price','contracted_monthly_rent') THEN
      v_has_transaction_price := true;
    END IF;
  END LOOP;

  IF jsonb_typeof(v) <> 'object' OR v = '{}'::jsonb THEN
    RAISE EXCEPTION 'Nenhum campo elegível vinculado a este candidato';
  END IF;

  -- ASKING is never TRANSACTION: a closed transaction needs its own verified price.
  IF _observation_type IN ('CLOSED_SALE','CLOSED_RENT') AND NOT v_has_transaction_price THEN
    RAISE EXCEPTION 'Transação concluída exige preço transacionado verificado; oferta nunca vira transação';
  END IF;
  IF v_has_transaction_price AND _observation_type NOT IN ('CLOSED_SALE','CLOSED_RENT') THEN
    RAISE EXCEPTION 'Preço transacionado não pode ser gravado em observação de oferta';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);

  IF _market_property_id IS NOT NULL THEN
    SELECT id INTO v_prop FROM public.market_properties
     WHERE id = _market_property_id AND organization_id = c.organization_id
       AND valuation_case_id = c.valuation_case_id;
    IF v_prop IS NULL THEN
      PERFORM set_config('valuation.privileged_op', 'off', true);
      RAISE EXCEPTION 'Imóvel de mercado informado não pertence a este caso';
    END IF;
  ELSE
    INSERT INTO public.market_properties (
      organization_id, valuation_case_id, label, address_raw, street_name, street_number,
      complement, district, city, state, postal_code,
      private_area, usable_area, built_area, total_area, land_area,
      bedrooms, suites, bathrooms, parking_spaces, floor_number, construction_year, created_by)
    VALUES (
      c.organization_id, c.valuation_case_id,
      coalesce(_label, v#>>'{address_raw,normalized}', 'Imóvel de pesquisa'),
      v#>>'{address_raw,normalized}', v#>>'{street_name,normalized}', v#>>'{street_number,normalized}',
      v#>>'{complement,normalized}', v#>>'{district,normalized}', v#>>'{city,normalized}',
      v#>>'{state,normalized}', v#>>'{postal_code,normalized}',
      (v#>>'{private_area,numeric}')::numeric, (v#>>'{usable_area,numeric}')::numeric,
      (v#>>'{built_area,numeric}')::numeric, (v#>>'{total_area,numeric}')::numeric,
      (v#>>'{land_area,numeric}')::numeric,
      (v#>>'{bedrooms,numeric}')::integer, (v#>>'{suites,numeric}')::integer,
      (v#>>'{bathrooms,numeric}')::integer, (v#>>'{parking_spaces,numeric}')::integer,
      (v#>>'{floor_number,numeric}')::integer, (v#>>'{construction_year,numeric}')::integer,
      auth.uid())
    RETURNING id INTO v_prop;
  END IF;

  v_ext_id := v#>>'{external_listing_id,normalized}';

  INSERT INTO public.market_observations (
    organization_id, valuation_case_id, market_property_id, observation_type, status,
    asking_price, asking_monthly_rent, transaction_price, contracted_monthly_rent,
    transaction_evidence_status, publication_date, external_listing_id, listing_url,
    evidence_source_id, primary_artifact_id, notes, created_by)
  VALUES (
    c.organization_id, c.valuation_case_id, v_prop, _observation_type, _observation_status,
    CASE WHEN _observation_type IN ('CLOSED_SALE','CLOSED_RENT') THEN NULL
         ELSE (v#>>'{asking_price,numeric}')::numeric END,
    CASE WHEN _observation_type IN ('CLOSED_SALE','CLOSED_RENT') THEN NULL
         ELSE (v#>>'{asking_monthly_rent,numeric}')::numeric END,
    CASE WHEN _observation_type = 'CLOSED_SALE' THEN (v#>>'{transaction_price,numeric}')::numeric END,
    CASE WHEN _observation_type = 'CLOSED_RENT' THEN (v#>>'{contracted_monthly_rent,numeric}')::numeric END,
    CASE WHEN _observation_type IN ('CLOSED_SALE','CLOSED_RENT') THEN 'DECLARED'::public.transaction_evidence_status END,
    (v#>>'{publication_date,normalized}')::date, v_ext_id, v_listing_url,
    c.evidence_source_id, c.evidence_artifact_id, _notes, auth.uid())
  RETURNING id INTO v_obs;

  -- Attribute observations preserve provenance field by field. UNKNOWN stays UNKNOWN.
  INSERT INTO public.property_attribute_observations (
    organization_id, valuation_case_id, market_property_id, attribute_name,
    raw_value, normalized_value, numeric_value, knowledge_state, value_origin,
    evidence_field_id, evidence_source_id, observed_at, created_by)
  SELECT c.organization_id, c.valuation_case_id, v_prop, ef.field_name,
         ef.raw_value, ef.normalized_value, ef.numeric_value, 'KNOWN', 'EVIDENCE_EXTRACTION',
         ef.id, c.evidence_source_id, now(), auth.uid()
  FROM public.evidence_fields ef
  JOIN public.research_entity_candidate_fields recf ON recf.evidence_field_id = ef.id
  WHERE ef.id = ANY(_field_ids) AND recf.candidate_id = c.id
    AND ef.validation_status = 'VERIFIED';

  IF (v#>>'{asking_price,numeric}') IS NOT NULL AND _observation_type NOT IN ('CLOSED_SALE','CLOSED_RENT') THEN
    INSERT INTO public.market_observation_price_history (
      organization_id, valuation_case_id, market_observation_id, observed_at,
      asking_price, asking_monthly_rent, observation_status,
      evidence_source_id, evidence_field_id, notes, created_by)
    VALUES (c.organization_id, c.valuation_case_id, v_obs, now(),
      (v#>>'{asking_price,numeric}')::numeric, (v#>>'{asking_monthly_rent,numeric}')::numeric,
      _observation_status, c.evidence_source_id, (v#>>'{asking_price,field_id}')::uuid,
      'Primeira leitura registrada na promoção do candidato de pesquisa', auth.uid());
  END IF;

  UPDATE public.research_entity_candidates
     SET status = 'PROMOTED', promoted_market_property_id = v_prop,
         promoted_market_observation_id = v_obs, updated_at = now()
   WHERE id = c.id;

  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    c.organization_id, c.valuation_case_id, 'RESEARCH_CANDIDATE_PROMOTED',
    'research_entity_candidate', c.id, NULL,
    jsonb_build_object('market_property_id', v_prop, 'market_observation_id', v_obs,
                       'observation_type', _observation_type),
    jsonb_build_object('fields_used', v_used, 'listing_url', v_listing_url));

  RETURN jsonb_build_object('market_property_id', v_prop, 'market_observation_id', v_obs);
END; $$;

REVOKE ALL ON FUNCTION public.promote_research_candidate(uuid, uuid[], public.market_observation_type, public.market_observation_status, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_research_candidate(uuid, uuid[], public.market_observation_type, public.market_observation_status, uuid, text, text) TO authenticated;

-- 15) updated_at hygiene ------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_prr_touch BEFORE UPDATE ON public.property_research_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_rsr_touch BEFORE UPDATE ON public.research_search_results
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_rsdp_touch BEFORE UPDATE ON public.research_source_domain_policies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();