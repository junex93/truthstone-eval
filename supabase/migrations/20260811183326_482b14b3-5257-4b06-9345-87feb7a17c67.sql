-- =====================================================================
-- PHASE 5 — MARKET EVIDENCE INTELLIGENCE & SAMPLE READINESS ENGINE
-- Diagnostics only. No valuation engine, no factor, no aggregated score.
-- =====================================================================

/* ------------------------------------------ immutability guard helper -- */
CREATE OR REPLACE FUNCTION public.block_update_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável em % (append-only: gere nova versão)', TG_TABLE_NAME;
END; $$;

/* ------------------------------------------------------------ enums ---- */
CREATE TYPE public.sample_selection_run_status AS ENUM ('DRAFT','IN_PROGRESS','COMPLETED','ABANDONED');
CREATE TYPE public.sample_selection_state AS ENUM ('AVAILABLE','REVIEWING','SELECTED','EXCLUDED');
CREATE TYPE public.sample_readiness_state AS ENUM ('NOT_ASSESSED','READY_FOR_METHOD_REVIEW','READY_WITH_WARNINGS','NOT_READY');
CREATE TYPE public.market_data_issue_type AS ENUM (
  'MISSING_CRITICAL_FIELD','CONFLICTING_ATTRIBUTE','UNRESOLVED_DUPLICATE','SOURCE_CONCENTRATION',
  'TEMPORAL_CONCENTRATION','SPATIAL_CONCENTRATION','UNVERIFIED_PRICE','UNVERIFIED_TRANSACTION',
  'MISSING_GEO','MISSING_DATE','BROKEN_LINEAGE','SUPPORT_CHECK_FAILED','OTHER');
CREATE TYPE public.market_data_issue_severity AS ENUM ('INFO','WARNING','BLOCKER');
CREATE TYPE public.market_data_issue_status AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED','NOT_APPLICABLE');
CREATE TYPE public.issue_resolution_type AS ENUM ('SYSTEM','HUMAN');
CREATE TYPE public.diagnostic_policy_status AS ENUM ('ACTIVE','SUPERSEDED');

/* ------------------------------------------ diagnostic policy version -- */
CREATE TABLE public.market_diagnostic_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  version text NOT NULL,
  name text NOT NULL,
  configuration jsonb NOT NULL,
  status public.diagnostic_policy_status NOT NULL DEFAULT 'ACTIVE',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX market_diagnostic_policies_global_version_idx
  ON public.market_diagnostic_policies (version) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX market_diagnostic_policies_org_version_idx
  ON public.market_diagnostic_policies (organization_id, version) WHERE organization_id IS NOT NULL;

GRANT SELECT ON public.market_diagnostic_policies TO authenticated;
GRANT ALL ON public.market_diagnostic_policies TO service_role;
ALTER TABLE public.market_diagnostic_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY mdp_select ON public.market_diagnostic_policies FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id));
CREATE TRIGGER mdp_no_delete BEFORE DELETE ON public.market_diagnostic_policies
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

-- Operational diagnostic thresholds. NOT normative valuation limits.
INSERT INTO public.market_diagnostic_policies (organization_id, version, name, configuration)
VALUES (NULL, 'valuation.market.diagnostics/1', 'Política diagnóstica operacional padrão',
  jsonb_build_object(
    'source_concentration_warning_pct', 60,
    'development_concentration_warning_pct', 60,
    'missingness_warning_pct', 30,
    'unresolved_duplicate_warning_pct', 10,
    'temporal_buckets', jsonb_build_array(30, 90, 180, 365),
    'outlier_rule', 'IQR_1_5_EXPLORATORY',
    'notes', 'Critérios diagnósticos operacionais — não são limites normativos de avaliação.'
  ));

/* -------------------------------------------- market evidence snapshot -- */
CREATE TABLE public.market_evidence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  version_number integer NOT NULL,
  description text,
  observation_count integer NOT NULL,
  independent_property_count integer NOT NULL,
  market_property_count integer NOT NULL,
  identity_cluster_count integer NOT NULL,
  source_count integer NOT NULL,
  domain_count integer NOT NULL,
  snapshot_manifest jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  hash_algorithm text NOT NULL DEFAULT 'SHA-256',
  schema_version text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (valuation_case_id, version_number),
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX mes_case_idx ON public.market_evidence_snapshots (valuation_case_id, version_number DESC);

GRANT SELECT ON public.market_evidence_snapshots TO authenticated;
GRANT ALL ON public.market_evidence_snapshots TO service_role;
ALTER TABLE public.market_evidence_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY mes_select ON public.market_evidence_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER mes_no_delete BEFORE DELETE ON public.market_evidence_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER mes_immutable BEFORE UPDATE ON public.market_evidence_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* --------------------------------------------------- identity clusters -- */
CREATE TABLE public.market_identity_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  label text,
  representative_market_property_id uuid NOT NULL,
  confirmation_reason text NOT NULL,
  confirmed_by uuid,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, representative_market_property_id)
    REFERENCES public.market_properties (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX mic_case_idx ON public.market_identity_clusters (valuation_case_id);

CREATE TABLE public.market_identity_cluster_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  cluster_id uuid NOT NULL REFERENCES public.market_identity_clusters(id) ON DELETE CASCADE,
  market_property_id uuid NOT NULL,
  source_match_candidate_id uuid REFERENCES public.property_match_candidates(id),
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster_id, market_property_id),
  FOREIGN KEY (organization_id, market_property_id)
    REFERENCES public.market_properties (organization_id, id) ON DELETE CASCADE
);
-- One physical identity per market property, per case.
CREATE UNIQUE INDEX micm_unique_property_idx
  ON public.market_identity_cluster_members (valuation_case_id, market_property_id);
CREATE INDEX micm_cluster_idx ON public.market_identity_cluster_members (cluster_id);

GRANT SELECT ON public.market_identity_clusters TO authenticated;
GRANT SELECT ON public.market_identity_cluster_members TO authenticated;
GRANT ALL ON public.market_identity_clusters TO service_role;
GRANT ALL ON public.market_identity_cluster_members TO service_role;
ALTER TABLE public.market_identity_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_identity_cluster_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY mic_select ON public.market_identity_clusters FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY micm_select ON public.market_identity_cluster_members FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER mic_no_delete BEFORE DELETE ON public.market_identity_clusters
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER mic_no_org_migration BEFORE UPDATE ON public.market_identity_clusters
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();

/* ------------------------------------------ comparable feature snapshot */
CREATE TABLE public.comparable_feature_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  comparable_candidate_id uuid NOT NULL REFERENCES public.comparable_candidates(id) ON DELETE CASCADE,
  subject_property_id uuid NOT NULL,
  market_property_id uuid NOT NULL,
  market_observation_id uuid NOT NULL,
  derivation_version text NOT NULL,
  features jsonb NOT NULL,
  input_references jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX cfs_case_idx ON public.comparable_feature_snapshots (valuation_case_id, derivation_version);
CREATE INDEX cfs_candidate_idx ON public.comparable_feature_snapshots (comparable_candidate_id, calculated_at DESC);

GRANT SELECT ON public.comparable_feature_snapshots TO authenticated;
GRANT ALL ON public.comparable_feature_snapshots TO service_role;
ALTER TABLE public.comparable_feature_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY cfs_select ON public.comparable_feature_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER cfs_no_delete BEFORE DELETE ON public.comparable_feature_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER cfs_immutable BEFORE UPDATE ON public.comparable_feature_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* ------------------------------------------------- sample selection ---- */
CREATE TABLE public.sample_selection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  market_evidence_snapshot_id uuid NOT NULL REFERENCES public.market_evidence_snapshots(id),
  purpose text NOT NULL,
  status public.sample_selection_run_status NOT NULL DEFAULT 'IN_PROGRESS',
  selection_policy_version text NOT NULL DEFAULT 'MANUAL_ASSISTED/1',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid,
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX ssr_case_idx ON public.sample_selection_runs (valuation_case_id, created_at DESC);

CREATE TABLE public.sample_selection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  selection_run_id uuid NOT NULL REFERENCES public.sample_selection_runs(id) ON DELETE CASCADE,
  comparable_candidate_id uuid REFERENCES public.comparable_candidates(id),
  market_property_id uuid NOT NULL,
  market_observation_id uuid NOT NULL,
  initial_state public.sample_selection_state NOT NULL DEFAULT 'AVAILABLE',
  final_state public.sample_selection_state NOT NULL DEFAULT 'AVAILABLE',
  reason text,
  reason_code text,
  actor_user_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_run_id, market_observation_id)
);
CREATE INDEX ssi_run_idx ON public.sample_selection_items (selection_run_id, final_state);

CREATE TABLE public.sample_selection_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  selection_run_id uuid NOT NULL REFERENCES public.sample_selection_runs(id) ON DELETE CASCADE,
  market_evidence_snapshot_id uuid NOT NULL REFERENCES public.market_evidence_snapshots(id),
  version_number integer NOT NULL,
  selected_count integer NOT NULL,
  excluded_count integer NOT NULL,
  feature_derivation_version text NOT NULL,
  snapshot_manifest jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  hash_algorithm text NOT NULL DEFAULT 'SHA-256',
  schema_version text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_run_id)
);
CREATE INDEX sss_case_idx ON public.sample_selection_snapshots (valuation_case_id, created_at DESC);

GRANT SELECT ON public.sample_selection_runs TO authenticated;
GRANT SELECT ON public.sample_selection_items TO authenticated;
GRANT SELECT ON public.sample_selection_snapshots TO authenticated;
GRANT ALL ON public.sample_selection_runs TO service_role;
GRANT ALL ON public.sample_selection_items TO service_role;
GRANT ALL ON public.sample_selection_snapshots TO service_role;
ALTER TABLE public.sample_selection_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_selection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_selection_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ssr_select ON public.sample_selection_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY ssi_select ON public.sample_selection_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY sss_select ON public.sample_selection_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER ssi_no_delete BEFORE DELETE ON public.sample_selection_items
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER sss_no_delete BEFORE DELETE ON public.sample_selection_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER sss_immutable BEFORE UPDATE ON public.sample_selection_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* -------------------------------------------- readiness assessments ---- */
CREATE TABLE public.sample_readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  version_number integer NOT NULL,
  market_evidence_snapshot_id uuid REFERENCES public.market_evidence_snapshots(id),
  sample_selection_snapshot_id uuid REFERENCES public.sample_selection_snapshots(id),
  diagnostic_policy_id uuid REFERENCES public.market_diagnostic_policies(id),
  diagnostic_policy_version text NOT NULL,
  feature_derivation_version text NOT NULL,
  readiness_state public.sample_readiness_state NOT NULL,
  hard_blockers jsonb NOT NULL,
  warnings jsonb NOT NULL,
  metrics jsonb NOT NULL,
  computed_by text NOT NULL DEFAULT 'SYSTEM_DIAGNOSTIC',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  acknowledgement_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (valuation_case_id, version_number),
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX sra_case_idx ON public.sample_readiness_assessments (valuation_case_id, version_number DESC);

GRANT SELECT ON public.sample_readiness_assessments TO authenticated;
GRANT ALL ON public.sample_readiness_assessments TO service_role;
ALTER TABLE public.sample_readiness_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY sra_select ON public.sample_readiness_assessments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER sra_no_delete BEFORE DELETE ON public.sample_readiness_assessments
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

/* ------------------------------------------------ market data issues --- */
CREATE TABLE public.market_data_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  valuation_case_id uuid NOT NULL,
  issue_type public.market_data_issue_type NOT NULL,
  severity public.market_data_issue_severity NOT NULL,
  status public.market_data_issue_status NOT NULL DEFAULT 'OPEN',
  entity_type text NOT NULL,
  entity_id uuid,
  detail text NOT NULL,
  facts jsonb,
  rule_version text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_type public.issue_resolution_type,
  resolution_notes text,
  FOREIGN KEY (organization_id, valuation_case_id)
    REFERENCES public.valuation_cases (organization_id, id) ON DELETE CASCADE
);
CREATE INDEX mdi_case_idx ON public.market_data_issues (valuation_case_id, status, issue_type);
CREATE UNIQUE INDEX mdi_open_unique_idx ON public.market_data_issues
  (valuation_case_id, issue_type, coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('OPEN','ACKNOWLEDGED');

CREATE TABLE public.market_data_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  valuation_case_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES public.market_data_issues(id) ON DELETE CASCADE,
  previous_status public.market_data_issue_status,
  new_status public.market_data_issue_status NOT NULL,
  actor_user_id uuid,
  resolution_type public.issue_resolution_type,
  notes text,
  rule_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mdie_issue_idx ON public.market_data_issue_events (issue_id, created_at);

GRANT SELECT ON public.market_data_issues TO authenticated;
GRANT SELECT ON public.market_data_issue_events TO authenticated;
GRANT ALL ON public.market_data_issues TO service_role;
GRANT ALL ON public.market_data_issue_events TO service_role;
ALTER TABLE public.market_data_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_data_issue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY mdi_select ON public.market_data_issues FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY mdie_select ON public.market_data_issue_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER mdi_no_delete BEFORE DELETE ON public.market_data_issues
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER mdie_no_delete BEFORE DELETE ON public.market_data_issue_events
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();

/* ---------------------------------------------- performance indexes ---- */
CREATE INDEX IF NOT EXISTS mo_case_type_idx ON public.market_observations (valuation_case_id, observation_type);
CREATE INDEX IF NOT EXISTS mo_case_property_idx ON public.market_observations (valuation_case_id, market_property_id);
CREATE INDEX IF NOT EXISTS mo_case_dates_idx ON public.market_observations (valuation_case_id, observation_date);
CREATE INDEX IF NOT EXISTS mp_case_development_idx ON public.market_properties (valuation_case_id, development_id);
CREATE INDEX IF NOT EXISTS cc_case_status_idx ON public.comparable_candidates (valuation_case_id, candidate_status, inclusion_status);
CREATE INDEX IF NOT EXISTS pmc_case_status_idx ON public.property_match_candidates (valuation_case_id, match_status);
CREATE INDEX IF NOT EXISTS moph_observation_idx ON public.market_observation_price_history (market_observation_id, observed_at);