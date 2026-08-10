-- ============================================================
-- FASE 02 — FORENSIC INTEGRITY HARDENING (parte 1)
-- Princípio: UI SECURITY != DATABASE SECURITY
-- ============================================================

-- 0. Contexto de operação privilegiada -----------------------
-- Somente as funções oficiais (SECURITY DEFINER) ligam esta flag.
-- Clientes autenticados não têm caminho para definir este GUC via Data API.
CREATE OR REPLACE FUNCTION public.in_privileged_op()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(current_setting('fluxa.privileged_op', true), 'off') = 'on';
$$;
REVOKE ALL ON FUNCTION public.in_privileged_op() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.current_org_role(_org uuid)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.organization_members m
  WHERE m.organization_id = _org AND m.user_id = auth.uid() AND m.status = 'ACTIVE'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_org_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_role(uuid) TO authenticated;

-- 1. Integridade de tenant: chaves compostas ------------------
ALTER TABLE public.valuation_cases     ADD CONSTRAINT valuation_cases_org_id_uniq     UNIQUE (organization_id, id);
ALTER TABLE public.evidence_sources    ADD CONSTRAINT evidence_sources_org_id_uniq    UNIQUE (organization_id, id);
ALTER TABLE public.evidence_artifacts  ADD CONSTRAINT evidence_artifacts_org_id_uniq  UNIQUE (organization_id, id);
ALTER TABLE public.evidence_extractions ADD CONSTRAINT evidence_extractions_org_id_uniq UNIQUE (organization_id, id);
ALTER TABLE public.evidence_fields     ADD CONSTRAINT evidence_fields_org_id_uniq     UNIQUE (organization_id, id);
ALTER TABLE public.dataset_versions    ADD CONSTRAINT dataset_versions_org_id_uniq    UNIQUE (organization_id, id);

ALTER TABLE public.properties           ADD CONSTRAINT properties_case_org_fk   FOREIGN KEY (organization_id, valuation_case_id) REFERENCES public.valuation_cases(organization_id, id) ON DELETE CASCADE;
ALTER TABLE public.evidence_sources     ADD CONSTRAINT sources_case_org_fk      FOREIGN KEY (organization_id, valuation_case_id) REFERENCES public.valuation_cases(organization_id, id);
ALTER TABLE public.evidence_artifacts   ADD CONSTRAINT artifacts_source_org_fk  FOREIGN KEY (organization_id, evidence_source_id) REFERENCES public.evidence_sources(organization_id, id);
ALTER TABLE public.evidence_extractions ADD CONSTRAINT extractions_artifact_org_fk FOREIGN KEY (organization_id, artifact_id) REFERENCES public.evidence_artifacts(organization_id, id);
ALTER TABLE public.evidence_fields      ADD CONSTRAINT fields_extraction_org_fk FOREIGN KEY (organization_id, extraction_id) REFERENCES public.evidence_extractions(organization_id, id);
ALTER TABLE public.evidence_reviews     ADD CONSTRAINT reviews_field_org_fk     FOREIGN KEY (organization_id, field_id) REFERENCES public.evidence_fields(organization_id, id);
ALTER TABLE public.evidence_reviews     ADD CONSTRAINT reviews_artifact_org_fk  FOREIGN KEY (organization_id, artifact_id) REFERENCES public.evidence_artifacts(organization_id, id);
ALTER TABLE public.evidence_field_revisions ADD CONSTRAINT revisions_field_org_fk FOREIGN KEY (organization_id, field_id) REFERENCES public.evidence_fields(organization_id, id);
ALTER TABLE public.dataset_versions     ADD CONSTRAINT dsv_case_org_fk          FOREIGN KEY (organization_id, valuation_case_id) REFERENCES public.valuation_cases(organization_id, id);
ALTER TABLE public.dataset_items        ADD CONSTRAINT dsi_version_org_fk       FOREIGN KEY (organization_id, dataset_version_id) REFERENCES public.dataset_versions(organization_id, id);
ALTER TABLE public.dataset_items        ADD CONSTRAINT dsi_field_org_fk         FOREIGN KEY (organization_id, evidence_field_id) REFERENCES public.evidence_fields(organization_id, id);
ALTER TABLE public.ai_runs              ADD CONSTRAINT ai_runs_case_org_fk      FOREIGN KEY (organization_id, valuation_case_id) REFERENCES public.valuation_cases(organization_id, id);

-- 2. organization_id imutável ---------------------------------
CREATE OR REPLACE FUNCTION public.prevent_org_migration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id é imutável em % (transferência exige operação administrativa formal)', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.valuation_cases       FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.properties            FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.evidence_sources      FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.evidence_artifacts    FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.evidence_extractions  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.evidence_fields       FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.dataset_versions      FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();
CREATE TRIGGER trg_org_immutable BEFORE UPDATE ON public.ai_runs               FOR EACH ROW EXECUTE FUNCTION public.prevent_org_migration();

-- 3. Revisões de campo: estado histórico completo -------------
ALTER TABLE public.evidence_field_revisions
  ADD COLUMN IF NOT EXISTS numeric_value numeric,
  ADD COLUMN IF NOT EXISTS field_name text,
  ADD COLUMN IF NOT EXISTS source_excerpt text,
  ADD COLUMN IF NOT EXISTS source_locator jsonb,
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS extraction_id uuid;

CREATE OR REPLACE FUNCTION public.record_field_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.evidence_field_revisions (
    organization_id, field_id, revision_number, field_name, raw_value, normalized_value,
    numeric_value, unit, field_state, source_excerpt, source_locator, validation_status,
    verification_notes, verified_by, verified_at, rejected_by, rejected_at, rejection_reason,
    extraction_id, changed_by, change_reason
  ) VALUES (
    OLD.organization_id, OLD.id, OLD.revision_number, OLD.field_name, OLD.raw_value, OLD.normalized_value,
    OLD.numeric_value, OLD.unit, OLD.field_state, OLD.source_excerpt, OLD.source_locator, OLD.validation_status,
    OLD.verification_notes, OLD.verified_by, OLD.verified_at, OLD.rejected_by, OLD.rejected_at, OLD.rejection_reason,
    OLD.extraction_id, auth.uid(), nullif(current_setting('fluxa.change_reason', true), '')
  );
  NEW.revision_number = OLD.revision_number + 1;
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_revisions_noupdate BEFORE UPDATE ON public.evidence_field_revisions
FOR EACH ROW EXECUTE FUNCTION public.block_delete();

-- 4. evidence_fields: validação só por operação oficial -------
CREATE OR REPLACE FUNCTION public.guard_evidence_field_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE substantive boolean;
BEGIN
  IF NEW.extraction_id IS DISTINCT FROM OLD.extraction_id THEN
    RAISE EXCEPTION 'extraction_id é proveniência imutável de um campo de evidência';
  END IF;

  IF public.in_privileged_op() THEN
    RETURN NEW;
  END IF;

  IF NEW.validation_status IS DISTINCT FROM OLD.validation_status
     OR NEW.verified_by       IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at       IS DISTINCT FROM OLD.verified_at
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
     OR NEW.rejected_by       IS DISTINCT FROM OLD.rejected_by
     OR NEW.rejected_at       IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejection_reason  IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Decisão de validação exige verify_evidence_field/reject_evidence_field (não é permitida por UPDATE direto)';
  END IF;

  substantive :=
       NEW.field_name      IS DISTINCT FROM OLD.field_name
    OR NEW.raw_value       IS DISTINCT FROM OLD.raw_value
    OR NEW.normalized_value IS DISTINCT FROM OLD.normalized_value
    OR NEW.numeric_value   IS DISTINCT FROM OLD.numeric_value
    OR NEW.unit            IS DISTINCT FROM OLD.unit
    OR NEW.field_state     IS DISTINCT FROM OLD.field_state
    OR NEW.source_excerpt  IS DISTINCT FROM OLD.source_excerpt
    OR NEW.source_locator  IS DISTINCT FROM OLD.source_locator;

  IF substantive AND OLD.validation_status IN ('VERIFIED', 'REJECTED') THEN
    RAISE EXCEPTION 'Campo % não pode ser editado no lugar; use revise_evidence_field para abrir nova revisão candidata', OLD.validation_status;
  END IF;

  IF substantive AND NOT public.can_write(OLD.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para editar valores de evidência';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_field_guard BEFORE UPDATE ON public.evidence_fields
FOR EACH ROW EXECUTE FUNCTION public.guard_evidence_field_update();

-- Campo não pode nascer VERIFIED/REJECTED por INSERT direto
CREATE OR REPLACE FUNCTION public.guard_evidence_field_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.in_privileged_op() THEN
    IF NEW.validation_status IN ('VERIFIED', 'REJECTED')
       OR NEW.verified_by IS NOT NULL OR NEW.verified_at IS NOT NULL
       OR NEW.rejected_by IS NOT NULL OR NEW.rejected_at IS NOT NULL THEN
      RAISE EXCEPTION 'Um campo candidato não pode ser criado já validado';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_field_guard_insert BEFORE INSERT ON public.evidence_fields
FOR EACH ROW EXECUTE FUNCTION public.guard_evidence_field_insert();

-- 5. Proveniência de extração ---------------------------------
CREATE OR REPLACE FUNCTION public.protect_extraction_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.artifact_id       IS DISTINCT FROM OLD.artifact_id
     OR NEW.version_number IS DISTINCT FROM OLD.version_number
     OR NEW.processor_type IS DISTINCT FROM OLD.processor_type THEN
    RAISE EXCEPTION 'Proveniência da extração é imutável; gere nova versão de extração';
  END IF;

  IF OLD.status IN ('COMPLETED', 'REVIEW_REQUIRED') THEN
    IF NEW.raw_output        IS DISTINCT FROM OLD.raw_output
       OR NEW.processor_name IS DISTINCT FROM OLD.processor_name
       OR NEW.processor_version IS DISTINCT FROM OLD.processor_version
       OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
       OR NEW.extraction_type IS DISTINCT FROM OLD.extraction_type THEN
      RAISE EXCEPTION 'Extração concluída é registro de proveniência; gere nova versão de extração';
    END IF;
  END IF;

  IF NEW.raw_output IS DISTINCT FROM OLD.raw_output AND OLD.raw_output IS NOT NULL THEN
    RAISE EXCEPTION 'raw_output da extração é imutável; gere nova versão de extração';
  END IF;

  RETURN NEW;
END; $$;

-- 6. Dataset: manifesto e snapshot imutável -------------------
ALTER TABLE public.dataset_versions
  ADD COLUMN IF NOT EXISTS dataset_manifest jsonb,
  ADD COLUMN IF NOT EXISTS hash_algorithm text,
  ADD COLUMN IF NOT EXISTS manifest_schema_version text;

CREATE TABLE public.dataset_item_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  dataset_version_id uuid NOT NULL,
  dataset_item_id uuid,
  evidence_field_id uuid NOT NULL,
  evidence_field_revision integer NOT NULL,
  field_name text NOT NULL,
  raw_value_at_freeze text,
  normalized_value_at_freeze text,
  numeric_value_at_freeze numeric,
  unit_at_freeze text,
  field_state_at_freeze public.field_state NOT NULL,
  validation_status_at_freeze public.validation_status NOT NULL,
  verified_by_at_freeze uuid,
  verified_at_at_freeze timestamptz,
  source_excerpt_at_freeze text,
  source_locator_at_freeze jsonb,
  extraction_id uuid NOT NULL,
  extraction_version integer NOT NULL,
  artifact_id uuid NOT NULL,
  artifact_sha256 text,
  evidence_source_id uuid NOT NULL,
  valuation_case_id uuid NOT NULL,
  role_in_dataset text,
  item_ordinal integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dsis_version_org_fk FOREIGN KEY (organization_id, dataset_version_id)
    REFERENCES public.dataset_versions(organization_id, id),
  CONSTRAINT dsis_unique_field UNIQUE (dataset_version_id, evidence_field_id)
);

-- Somente leitura para clientes; escrita apenas pela operação oficial de freeze.
GRANT SELECT ON public.dataset_item_snapshots TO authenticated;
GRANT ALL ON public.dataset_item_snapshots TO service_role;
ALTER TABLE public.dataset_item_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY dsis_select ON public.dataset_item_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

CREATE TRIGGER trg_dsis_noupdate BEFORE UPDATE ON public.dataset_item_snapshots
FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER trg_dsis_nodelete BEFORE DELETE ON public.dataset_item_snapshots
FOR EACH ROW EXECUTE FUNCTION public.block_delete();

CREATE INDEX idx_dsis_version ON public.dataset_item_snapshots (dataset_version_id);
CREATE INDEX idx_dsis_org ON public.dataset_item_snapshots (organization_id);

-- Metadados de freeze não podem ser definidos por UPDATE direto
CREATE OR REPLACE FUNCTION public.protect_frozen_dataset()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Versões de dataset não podem ser excluídas';
  END IF;

  IF NOT public.in_privileged_op() THEN
    IF NEW.frozen_at IS DISTINCT FROM OLD.frozen_at
       OR NEW.frozen_by IS DISTINCT FROM OLD.frozen_by
       OR NEW.dataset_hash IS DISTINCT FROM OLD.dataset_hash
       OR NEW.dataset_manifest IS DISTINCT FROM OLD.dataset_manifest
       OR NEW.hash_algorithm IS DISTINCT FROM OLD.hash_algorithm
       OR NEW.manifest_schema_version IS DISTINCT FROM OLD.manifest_schema_version THEN
      RAISE EXCEPTION 'Metadados de congelamento são definidos exclusivamente pela operação freeze_dataset';
    END IF;
    IF NEW.version_number IS DISTINCT FROM OLD.version_number
       OR NEW.valuation_case_id IS DISTINCT FROM OLD.valuation_case_id THEN
      RAISE EXCEPTION 'Identidade da versão de dataset é imutável';
    END IF;
  END IF;

  IF OLD.frozen_at IS NOT NULL AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Versão de dataset congelada não pode ser modificada; crie nova versão';
  END IF;

  RETURN NEW;
END; $$;

-- Itens: bloqueio de dataset congelado, exigência de VERIFIED e lineage por caso
CREATE OR REPLACE FUNCTION public.protect_frozen_dataset_items()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_frozen timestamptz;
  v_dataset_case uuid;
  v_field_case uuid;
  v_status public.validation_status;
BEGIN
  SELECT frozen_at, valuation_case_id INTO v_frozen, v_dataset_case
  FROM public.dataset_versions
  WHERE id = COALESCE(NEW.dataset_version_id, OLD.dataset_version_id);

  IF v_frozen IS NOT NULL THEN
    RAISE EXCEPTION 'Dataset congelado: itens não podem ser incluídos, alterados ou removidos';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT f.validation_status, s.valuation_case_id
    INTO v_status, v_field_case
  FROM public.evidence_fields f
  JOIN public.evidence_extractions e ON e.id = f.extraction_id
  JOIN public.evidence_artifacts a ON a.id = e.artifact_id
  JOIN public.evidence_sources s ON s.id = a.evidence_source_id
  WHERE f.id = NEW.evidence_field_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Campo de evidência inexistente ou sem linhagem completa';
  END IF;
  IF v_status <> 'VERIFIED' THEN
    RAISE EXCEPTION 'Somente campos VERIFIED podem compor um dataset';
  END IF;
  IF v_field_case IS NULL THEN
    RAISE EXCEPTION 'Evidência sem caso vinculado não pode compor dataset de avaliação';
  END IF;
  IF v_field_case <> v_dataset_case THEN
    RAISE EXCEPTION 'Contaminação cross-case bloqueada: a evidência pertence a outro caso de avaliação';
  END IF;

  RETURN NEW;
END; $$;

-- 7. Imóvel avaliando: bloqueio em fases avançadas ------------
CREATE OR REPLACE FUNCTION public.guard_property_mutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_status public.case_status;
BEGIN
  SELECT status INTO v_status FROM public.valuation_cases WHERE id = NEW.valuation_case_id;
  IF v_status IN ('DATASET_FROZEN', 'VALUATION', 'REVIEW', 'COMPLETED', 'ARCHIVED')
     AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Imóvel avaliando não pode ser alterado com o caso em %; é necessária reversão formal de status', v_status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_property_guard BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.guard_property_mutability();

-- 8. Status do caso somente por operação oficial --------------
CREATE OR REPLACE FUNCTION public.guard_case_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.in_privileged_op() THEN
    RAISE EXCEPTION 'Transição de status exige transition_case_status (não é permitida por UPDATE direto)';
  END IF;
  IF NEW.case_code IS DISTINCT FROM OLD.case_code AND OLD.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Código do caso só pode ser alterado em DRAFT';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_case_status_guard BEFORE UPDATE ON public.valuation_cases
FOR EACH ROW EXECUTE FUNCTION public.guard_case_status();

-- 9. Organização precisa manter OWNER; papel próprio protegido
CREATE OR REPLACE FUNCTION public.guard_membership_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_owner_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
      RAISE EXCEPTION 'Vínculo de membro é imutável; remova e crie novo convite';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role
       AND OLD.user_id = auth.uid()
       AND NOT public.in_privileged_op() THEN
      RAISE EXCEPTION 'Um usuário não pode alterar o próprio papel';
    END IF;
  END IF;

  IF (TG_OP = 'DELETE' AND OLD.role = 'OWNER' AND OLD.status = 'ACTIVE')
     OR (TG_OP = 'UPDATE' AND OLD.role = 'OWNER' AND OLD.status = 'ACTIVE'
         AND (NEW.role <> 'OWNER' OR NEW.status <> 'ACTIVE')) THEN
    SELECT count(*) INTO v_owner_count FROM public.organization_members
    WHERE organization_id = OLD.organization_id AND role = 'OWNER' AND status = 'ACTIVE';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'A organização deve manter ao menos um OWNER ativo';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_member_guard BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.guard_membership_changes();
CREATE TRIGGER trg_member_guard_delete BEFORE DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.guard_membership_changes();

-- 10. Índices para predicados de RLS e linhagem ---------------
CREATE INDEX IF NOT EXISTS idx_members_user_org_status ON public.organization_members (user_id, organization_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_org_status ON public.valuation_cases (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_properties_case ON public.properties (valuation_case_id);
CREATE INDEX IF NOT EXISTS idx_sources_org_case ON public.evidence_sources (organization_id, valuation_case_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_source ON public.evidence_artifacts (evidence_source_id);
CREATE INDEX IF NOT EXISTS idx_extractions_artifact ON public.evidence_extractions (artifact_id);
CREATE INDEX IF NOT EXISTS idx_fields_extraction ON public.evidence_fields (extraction_id);
CREATE INDEX IF NOT EXISTS idx_fields_org_status ON public.evidence_fields (organization_id, validation_status);
CREATE INDEX IF NOT EXISTS idx_reviews_field ON public.evidence_reviews (field_id);
CREATE INDEX IF NOT EXISTS idx_dsv_org_case ON public.dataset_versions (organization_id, valuation_case_id);
CREATE INDEX IF NOT EXISTS idx_dsi_version ON public.dataset_items (dataset_version_id);
CREATE INDEX IF NOT EXISTS idx_dsi_field ON public.dataset_items (evidence_field_id);
CREATE INDEX IF NOT EXISTS idx_audit_org_created ON public.audit_log (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_runs_org_case ON public.ai_runs (organization_id, valuation_case_id);
CREATE INDEX IF NOT EXISTS idx_revisions_field ON public.evidence_field_revisions (field_id, revision_number DESC);