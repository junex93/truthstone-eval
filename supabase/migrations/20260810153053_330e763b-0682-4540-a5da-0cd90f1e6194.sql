
-- ============ ENUMS ============
CREATE TYPE public.org_role AS ENUM ('OWNER','ADMIN','VALUER','REVIEWER','VIEWER');
CREATE TYPE public.member_status AS ENUM ('ACTIVE','SUSPENDED','REMOVED');
CREATE TYPE public.case_status AS ENUM ('DRAFT','EVIDENCE_COLLECTION','DATA_REVIEW','DATASET_FROZEN','VALUATION','REVIEW','COMPLETED','ARCHIVED');
CREATE TYPE public.source_type AS ENUM ('OFFICIAL_PUBLIC_SOURCE','PUBLIC_REGISTRY','PRIVATE_DOCUMENT','TRANSACTION_EVIDENCE','REAL_ESTATE_LISTING','BROKER_INFORMATION','USER_PROVIDED','FIELD_INSPECTION','OTHER');
CREATE TYPE public.processor_type AS ENUM ('MANUAL','DETERMINISTIC_PARSER','OCR','LLM','COMPUTER_VISION','EXTERNAL_API');
CREATE TYPE public.extraction_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','REVIEW_REQUIRED');
CREATE TYPE public.validation_status AS ENUM ('CAPTURED','EXTRACTED','PENDING_REVIEW','VERIFIED','REJECTED');
CREATE TYPE public.field_state AS ENUM ('PRESENT','NOT_FOUND','NOT_INFORMED','NOT_VERIFIABLE','DIVERGENT','PENDING_VALIDATION');
CREATE TYPE public.ai_run_status AS ENUM ('PENDING','RUNNING','COMPLETED','FAILED','DISCARDED');

-- ============ CORE TENANCY ============
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  slug text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  email text,
  professional_registration text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL DEFAULT 'VIEWER',
  status public.member_status NOT NULL DEFAULT 'ACTIVE',
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- ============ AUTHORIZATION HELPERS (SECURITY DEFINER, no RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.status = 'ACTIVE');
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = auth.uid()
      AND m.status = 'ACTIVE' AND m.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.can_write(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['OWNER','ADMIN','VALUER']::public.org_role[]);
$$;

CREATE OR REPLACE FUNCTION public.can_review(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['OWNER','ADMIN','REVIEWER']::public.org_role[]);
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_org_role(_org, ARRAY['OWNER','ADMIN']::public.org_role[]);
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.block_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Physical delete is not allowed on % (immutable audit/evidence record)', TG_TABLE_NAME; END; $$;

-- ============ VALUATION CASE ============
CREATE TABLE public.valuation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  case_code text NOT NULL,
  title text NOT NULL,
  purpose text,
  valuation_date date,
  status public.case_status NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, case_code)
);

CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  valuation_case_id uuid NOT NULL REFERENCES public.valuation_cases(id) ON DELETE RESTRICT,
  property_type text,
  address_line text,
  address_number text,
  complement text,
  district text,
  city text,
  state text,
  postal_code text,
  country text DEFAULT 'BR',
  latitude numeric(10,7),
  longitude numeric(10,7),
  private_area numeric(14,4),
  built_area numeric(14,4),
  land_area numeric(14,4),
  bedrooms integer,
  bathrooms integer,
  parking_spaces integer,
  construction_year integer,
  floor_number integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (valuation_case_id)
);

-- ============ EVIDENCE ENGINE ============
CREATE TABLE public.evidence_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  valuation_case_id uuid REFERENCES public.valuation_cases(id) ON DELETE RESTRICT,
  source_type public.source_type NOT NULL,
  source_name text NOT NULL,
  source_url text,
  publisher_or_owner text,
  accessed_at timestamptz,
  publication_date date,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  evidence_source_id uuid NOT NULL REFERENCES public.evidence_sources(id) ON DELETE RESTRICT,
  storage_bucket text NOT NULL DEFAULT 'evidence-originals',
  storage_path text NOT NULL,
  mime_type text,
  file_name text NOT NULL,
  file_size bigint,
  sha256_hash text,
  hash_computed_by text NOT NULL DEFAULT 'SERVER',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  artifact_id uuid NOT NULL REFERENCES public.evidence_artifacts(id) ON DELETE RESTRICT,
  version_number integer NOT NULL DEFAULT 1,
  extraction_type text,
  processor_type public.processor_type NOT NULL DEFAULT 'MANUAL',
  processor_name text,
  processor_version text,
  prompt_version text,
  status public.extraction_status NOT NULL DEFAULT 'PENDING',
  raw_output jsonb,
  error_message text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artifact_id, version_number)
);

CREATE TABLE public.evidence_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  extraction_id uuid NOT NULL REFERENCES public.evidence_extractions(id) ON DELETE RESTRICT,
  field_name text NOT NULL,
  raw_value text,
  normalized_value text,
  numeric_value numeric(20,6),
  unit text,
  field_state public.field_state NOT NULL DEFAULT 'PENDING_VALIDATION',
  source_excerpt text,
  source_locator jsonb,
  validation_status public.validation_status NOT NULL DEFAULT 'EXTRACTED',
  verified_by uuid,
  verified_at timestamptz,
  verification_notes text,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  revision_number integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_field_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  field_id uuid NOT NULL REFERENCES public.evidence_fields(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  raw_value text,
  normalized_value text,
  unit text,
  field_state public.field_state,
  validation_status public.validation_status,
  changed_by uuid,
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.evidence_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  field_id uuid REFERENCES public.evidence_fields(id) ON DELETE RESTRICT,
  artifact_id uuid REFERENCES public.evidence_artifacts(id) ON DELETE RESTRICT,
  decision public.validation_status NOT NULL,
  notes text,
  reviewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ DATASETS ============
CREATE TABLE public.dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  valuation_case_id uuid NOT NULL REFERENCES public.valuation_cases(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  purpose text,
  inclusion_criteria text,
  exclusion_criteria text,
  known_limitations text,
  geographic_scope text,
  temporal_scope text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  frozen_at timestamptz,
  frozen_by uuid,
  dataset_hash text,
  UNIQUE (valuation_case_id, version_number)
);

CREATE TABLE public.dataset_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  dataset_version_id uuid NOT NULL REFERENCES public.dataset_versions(id) ON DELETE RESTRICT,
  evidence_field_id uuid NOT NULL REFERENCES public.evidence_fields(id) ON DELETE RESTRICT,
  role_in_dataset text,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_version_id, evidence_field_id)
);

-- ============ AI RUNS ============
CREATE TABLE public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  valuation_case_id uuid REFERENCES public.valuation_cases(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  provider text,
  model text,
  model_version text,
  system_prompt_version text,
  task_prompt_version text,
  input_evidence_ids uuid[] NOT NULL DEFAULT '{}',
  output_raw jsonb,
  status public.ai_run_status NOT NULL DEFAULT 'PENDING',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  valuation_case_id uuid,
  actor_user_id uuid,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ INDEXES ============
CREATE INDEX idx_members_user ON public.organization_members(user_id);
CREATE INDEX idx_cases_org ON public.valuation_cases(organization_id, status);
CREATE INDEX idx_sources_case ON public.evidence_sources(valuation_case_id);
CREATE INDEX idx_artifacts_source ON public.evidence_artifacts(evidence_source_id);
CREATE INDEX idx_extractions_artifact ON public.evidence_extractions(artifact_id);
CREATE INDEX idx_fields_extraction ON public.evidence_fields(extraction_id);
CREATE INDEX idx_fields_status ON public.evidence_fields(organization_id, validation_status);
CREATE INDEX idx_items_version ON public.dataset_items(dataset_version_id);
CREATE INDEX idx_audit_org ON public.audit_log(organization_id, created_at DESC);

-- ============ IMMUTABILITY TRIGGERS ============
CREATE OR REPLACE FUNCTION public.protect_artifact_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.sha256_hash IS DISTINCT FROM OLD.sha256_hash
     OR NEW.file_size IS DISTINCT FROM OLD.file_size
     OR NEW.evidence_source_id IS DISTINCT FROM OLD.evidence_source_id
     OR NEW.captured_at IS DISTINCT FROM OLD.captured_at THEN
    RAISE EXCEPTION 'Raw evidence artifacts are immutable';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_artifact_immutable BEFORE UPDATE ON public.evidence_artifacts
FOR EACH ROW EXECUTE FUNCTION public.protect_artifact_immutability();
CREATE TRIGGER trg_artifact_nodelete BEFORE DELETE ON public.evidence_artifacts
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_source_nodelete BEFORE DELETE ON public.evidence_sources
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_audit_nodelete BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_audit_noupdate BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_revisions_nodelete BEFORE DELETE ON public.evidence_field_revisions
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_reviews_nodelete BEFORE DELETE ON public.evidence_reviews
FOR EACH ROW EXECUTE FUNCTION public.block_delete();

CREATE OR REPLACE FUNCTION public.protect_extraction_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.raw_output IS DISTINCT FROM OLD.raw_output AND OLD.raw_output IS NOT NULL THEN
    RAISE EXCEPTION 'Extraction raw_output is immutable; create a new extraction version';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_extraction_immutable BEFORE UPDATE ON public.evidence_extractions
FOR EACH ROW EXECUTE FUNCTION public.protect_extraction_immutability();

-- field history: never overwrite silently
CREATE OR REPLACE FUNCTION public.record_field_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.evidence_field_revisions (
    organization_id, field_id, revision_number, raw_value, normalized_value,
    unit, field_state, validation_status, changed_by
  ) VALUES (
    OLD.organization_id, OLD.id, OLD.revision_number, OLD.raw_value, OLD.normalized_value,
    OLD.unit, OLD.field_state, OLD.validation_status, auth.uid()
  );
  NEW.revision_number = OLD.revision_number + 1;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_field_revision BEFORE UPDATE ON public.evidence_fields
FOR EACH ROW EXECUTE FUNCTION public.record_field_revision();

-- frozen dataset immutability
CREATE OR REPLACE FUNCTION public.protect_frozen_dataset()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.frozen_at IS NOT NULL THEN
    RAISE EXCEPTION 'Dataset version is frozen and cannot be modified; create a new version';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Dataset versions cannot be deleted';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_dataset_frozen BEFORE UPDATE OR DELETE ON public.dataset_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_frozen_dataset();

CREATE OR REPLACE FUNCTION public.protect_frozen_dataset_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_frozen timestamptz; v_version uuid; v_field uuid;
BEGIN
  v_version := COALESCE(NEW.dataset_version_id, OLD.dataset_version_id);
  SELECT frozen_at INTO v_frozen FROM public.dataset_versions WHERE id = v_version;
  IF v_frozen IS NOT NULL THEN
    RAISE EXCEPTION 'Dataset version is frozen; items cannot be added, changed or removed';
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_field := NEW.evidence_field_id;
    IF NOT EXISTS (SELECT 1 FROM public.evidence_fields f
                   WHERE f.id = v_field AND f.validation_status = 'VERIFIED') THEN
      RAISE EXCEPTION 'Only VERIFIED evidence fields can be included in a dataset';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_dataset_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.dataset_items
FOR EACH ROW EXECUTE FUNCTION public.protect_frozen_dataset_items();

-- verification bookkeeping enforced in DB
CREATE OR REPLACE FUNCTION public.enforce_field_validation_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.validation_status = 'VERIFIED' THEN
    IF NEW.verified_by IS NULL OR NEW.verified_at IS NULL THEN
      RAISE EXCEPTION 'VERIFIED fields require verified_by and verified_at';
    END IF;
    IF COALESCE(NEW.source_excerpt, '') = '' AND NEW.source_locator IS NULL THEN
      RAISE EXCEPTION 'A field cannot be VERIFIED without supporting evidence (source_excerpt or source_locator)';
    END IF;
  END IF;
  IF NEW.validation_status = 'REJECTED' THEN
    IF NEW.rejected_by IS NULL OR NEW.rejected_at IS NULL OR COALESCE(NEW.rejection_reason,'') = '' THEN
      RAISE EXCEPTION 'REJECTED fields require rejected_by, rejected_at and rejection_reason';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_field_validation_rules BEFORE INSERT OR UPDATE ON public.evidence_fields
FOR EACH ROW EXECUTE FUNCTION public.enforce_field_validation_rules();

CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cases_updated BEFORE UPDATE ON public.valuation_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_properties_updated BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.evidence_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.valuation_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.properties TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_artifacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_extractions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidence_fields TO authenticated;
GRANT SELECT ON public.evidence_field_revisions TO authenticated;
GRANT SELECT, INSERT ON public.evidence_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.dataset_versions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.dataset_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_runs TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============ RLS ============
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valuation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_field_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY org_select ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY org_insert ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY org_update ON public.organizations FOR UPDATE TO authenticated USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));

-- profiles
CREATE POLICY profile_self_select ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND a.status = 'ACTIVE' AND b.user_id = profiles.id AND b.status = 'ACTIVE')
);
CREATE POLICY profile_self_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profile_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- members
CREATE POLICY member_select ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id));
CREATE POLICY member_insert ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id)
    OR (user_id = auth.uid() AND role = 'OWNER'
        AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = auth.uid())
        AND NOT EXISTS (SELECT 1 FROM public.organization_members m2 WHERE m2.organization_id = organization_id)));
CREATE POLICY member_update ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id)) WITH CHECK (public.is_org_admin(organization_id));
CREATE POLICY member_delete ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- cases
CREATE POLICY case_select ON public.valuation_cases FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY case_insert ON public.valuation_cases FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY case_update ON public.valuation_cases FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- properties
CREATE POLICY property_select ON public.properties FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY property_insert ON public.properties FOR INSERT TO authenticated WITH CHECK (public.can_write(organization_id));
CREATE POLICY property_update ON public.properties FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- evidence sources
CREATE POLICY source_select ON public.evidence_sources FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY source_insert ON public.evidence_sources FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY source_update ON public.evidence_sources FOR UPDATE TO authenticated
  USING (public.can_write(organization_id) OR public.can_review(organization_id))
  WITH CHECK (public.can_write(organization_id) OR public.can_review(organization_id));

-- artifacts
CREATE POLICY artifact_select ON public.evidence_artifacts FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY artifact_insert ON public.evidence_artifacts FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY artifact_update ON public.evidence_artifacts FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- extractions
CREATE POLICY extraction_select ON public.evidence_extractions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY extraction_insert ON public.evidence_extractions FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY extraction_update ON public.evidence_extractions FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- fields
CREATE POLICY field_select ON public.evidence_fields FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY field_insert ON public.evidence_fields FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid()
    AND validation_status IN ('CAPTURED','EXTRACTED','PENDING_REVIEW'));
CREATE POLICY field_update_write ON public.evidence_fields FOR UPDATE TO authenticated
  USING (public.can_write(organization_id) OR public.can_review(organization_id))
  WITH CHECK (public.can_write(organization_id) OR public.can_review(organization_id));

CREATE POLICY field_rev_select ON public.evidence_field_revisions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));

-- reviews
CREATE POLICY review_select ON public.evidence_reviews FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY review_insert ON public.evidence_reviews FOR INSERT TO authenticated
  WITH CHECK (public.can_review(organization_id) AND reviewer_id = auth.uid());

-- datasets
CREATE POLICY dsv_select ON public.dataset_versions FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY dsv_insert ON public.dataset_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid() AND frozen_at IS NULL);
CREATE POLICY dsv_update ON public.dataset_versions FOR UPDATE TO authenticated
  USING (public.can_write(organization_id) OR public.can_review(organization_id))
  WITH CHECK (public.can_write(organization_id) OR public.can_review(organization_id));

CREATE POLICY dsi_select ON public.dataset_items FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY dsi_insert ON public.dataset_items FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY dsi_delete ON public.dataset_items FOR DELETE TO authenticated USING (public.can_write(organization_id));

-- ai runs
CREATE POLICY ai_select ON public.ai_runs FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY ai_insert ON public.ai_runs FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE POLICY ai_update ON public.ai_runs FOR UPDATE TO authenticated
  USING (public.can_write(organization_id)) WITH CHECK (public.can_write(organization_id));

-- audit log: read-only for members, writes only via server (service role) or definer function
CREATE POLICY audit_select ON public.audit_log FOR SELECT TO authenticated USING (public.is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.write_audit_event(
  _org uuid, _case uuid, _event_type text, _entity_type text, _entity_id uuid,
  _before jsonb, _after jsonb, _metadata jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_org_member(_org) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;
  INSERT INTO public.audit_log (organization_id, valuation_case_id, actor_user_id, event_type, entity_type, entity_id, before_data, after_data, metadata)
  VALUES (_org, _case, auth.uid(), _event_type, _entity_type, _entity_id, _before, _after, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.write_audit_event(uuid,uuid,text,text,uuid,jsonb,jsonb,jsonb) TO authenticated;
