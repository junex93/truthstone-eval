-- ============================================================
-- FASE 02 — HARDENING (parte 2): operações oficiais e grants
-- ============================================================

-- 1. Fecha o Data API para anon em todo o schema ---------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Trigger functions nunca são chamadas diretamente
REVOKE ALL ON FUNCTION public.block_delete() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.record_field_revision() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_field_validation_rules() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_case_status() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_evidence_field_insert() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_evidence_field_update() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_membership_changes() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_property_mutability() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_org_migration() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_artifact_immutability() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_extraction_immutability() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_frozen_dataset() FROM authenticated;
REVOKE ALL ON FUNCTION public.protect_frozen_dataset_items() FROM authenticated;
REVOKE ALL ON FUNCTION public.in_privileged_op() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_role(uuid) TO authenticated;

-- record_field_revision passa a gravar com privilégio próprio
ALTER FUNCTION public.record_field_revision() SECURITY DEFINER;

-- 2. Audit log e históricos: somente leitura para o cliente ----
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.evidence_field_revisions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.evidence_reviews FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dataset_item_snapshots FROM authenticated;
-- Validação e congelamento só por operação oficial
REVOKE UPDATE ON public.evidence_fields FROM authenticated;
REVOKE UPDATE ON public.dataset_versions FROM authenticated;
-- Artefatos: somente pelo fluxo controlado do servidor (hash server-side)
REVOKE INSERT, UPDATE ON public.evidence_artifacts FROM authenticated;
-- Auditoria não é chamável pelo cliente
REVOKE ALL ON FUNCTION public.write_audit_event(uuid, uuid, text, text, uuid, jsonb, jsonb, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public.audit_write_internal(
  _org uuid, _case uuid, _event_type text, _entity_type text, _entity_id uuid,
  _before jsonb, _after jsonb, _metadata jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.audit_log (organization_id, valuation_case_id, actor_user_id, event_type,
                                entity_type, entity_id, before_data, after_data, metadata)
  VALUES (_org, _case, auth.uid(), _event_type, _entity_type, _entity_id, _before, _after, _metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.audit_write_internal(uuid, uuid, text, text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- 3. Operação oficial: verificar campo -------------------------
CREATE OR REPLACE FUNCTION public.verify_evidence_field(_field_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.evidence_fields; v_case uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF coalesce(btrim(_notes), '') = '' OR length(btrim(_notes)) < 3 THEN
    RAISE EXCEPTION 'A verificação exige nota de fundamentação técnica';
  END IF;

  SELECT * INTO f FROM public.evidence_fields WHERE id = _field_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Campo de evidência não encontrado'; END IF;
  IF NOT public.can_review(f.organization_id) THEN
    RAISE EXCEPTION 'Somente REVIEWER, ADMIN ou OWNER podem verificar evidência';
  END IF;
  IF f.validation_status = 'VERIFIED' THEN RAISE EXCEPTION 'Campo já verificado'; END IF;
  IF f.validation_status = 'REJECTED' THEN
    RAISE EXCEPTION 'Campo rejeitado não pode ser verificado; abra nova revisão';
  END IF;
  IF coalesce(btrim(f.source_excerpt), '') = '' AND f.source_locator IS NULL THEN
    RAISE EXCEPTION 'Sem trecho da fonte ou localizador o campo não pode ser VERIFIED';
  END IF;

  PERFORM set_config('fluxa.privileged_op', 'on', true);
  PERFORM set_config('fluxa.change_reason', 'VERIFICATION', true);

  UPDATE public.evidence_fields
  SET validation_status = 'VERIFIED', verified_by = auth.uid(), verified_at = now(),
      verification_notes = btrim(_notes),
      rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL
  WHERE id = f.id;

  INSERT INTO public.evidence_reviews (organization_id, field_id, decision, notes, reviewer_id)
  VALUES (f.organization_id, f.id, 'VERIFIED', btrim(_notes), auth.uid());

  SELECT s.valuation_case_id INTO v_case
  FROM public.evidence_extractions e
  JOIN public.evidence_artifacts a ON a.id = e.artifact_id
  JOIN public.evidence_sources s ON s.id = a.evidence_source_id
  WHERE e.id = f.extraction_id;

  PERFORM public.audit_write_internal(
    f.organization_id, v_case, 'FIELD_VERIFIED', 'evidence_field', f.id,
    jsonb_build_object('validation_status', f.validation_status),
    jsonb_build_object('validation_status', 'VERIFIED'),
    jsonb_build_object('notes', btrim(_notes), 'revision_number', f.revision_number));

  PERFORM set_config('fluxa.privileged_op', 'off', true);
  RETURN f.id;
END; $$;
REVOKE ALL ON FUNCTION public.verify_evidence_field(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_evidence_field(uuid, text) TO authenticated;

-- 4. Operação oficial: rejeitar campo -------------------------
CREATE OR REPLACE FUNCTION public.reject_evidence_field(_field_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.evidence_fields; v_case uuid; v_in_frozen int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF coalesce(btrim(_reason), '') = '' OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A rejeição exige motivo registrado';
  END IF;

  SELECT * INTO f FROM public.evidence_fields WHERE id = _field_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Campo de evidência não encontrado'; END IF;
  IF NOT public.can_review(f.organization_id) THEN
    RAISE EXCEPTION 'Somente REVIEWER, ADMIN ou OWNER podem rejeitar evidência';
  END IF;
  IF f.validation_status = 'REJECTED' THEN RAISE EXCEPTION 'Campo já rejeitado'; END IF;

  SELECT count(*) INTO v_in_frozen
  FROM public.dataset_items di
  JOIN public.dataset_versions dv ON dv.id = di.dataset_version_id
  WHERE di.evidence_field_id = f.id AND dv.frozen_at IS NOT NULL;
  IF v_in_frozen > 0 THEN
    RAISE EXCEPTION 'Campo já compõe dataset congelado; a correção exige nova versão de dataset';
  END IF;

  PERFORM set_config('fluxa.privileged_op', 'on', true);
  PERFORM set_config('fluxa.change_reason', 'REJECTION', true);

  UPDATE public.evidence_fields
  SET validation_status = 'REJECTED', rejected_by = auth.uid(), rejected_at = now(),
      rejection_reason = btrim(_reason),
      verified_by = NULL, verified_at = NULL
  WHERE id = f.id;

  DELETE FROM public.dataset_items WHERE evidence_field_id = f.id;

  INSERT INTO public.evidence_reviews (organization_id, field_id, decision, notes, reviewer_id)
  VALUES (f.organization_id, f.id, 'REJECTED', btrim(_reason), auth.uid());

  SELECT s.valuation_case_id INTO v_case
  FROM public.evidence_extractions e
  JOIN public.evidence_artifacts a ON a.id = e.artifact_id
  JOIN public.evidence_sources s ON s.id = a.evidence_source_id
  WHERE e.id = f.extraction_id;

  PERFORM public.audit_write_internal(
    f.organization_id, v_case, 'FIELD_REJECTED', 'evidence_field', f.id,
    jsonb_build_object('validation_status', f.validation_status),
    jsonb_build_object('validation_status', 'REJECTED'),
    jsonb_build_object('reason', btrim(_reason)));

  PERFORM set_config('fluxa.privileged_op', 'off', true);
  RETURN f.id;
END; $$;
REVOKE ALL ON FUNCTION public.reject_evidence_field(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_evidence_field(uuid, text) TO authenticated;

-- 5. Operação oficial: revisar campo (correção rastreada) -----
CREATE OR REPLACE FUNCTION public.revise_evidence_field(
  _field_id uuid, _reason text, _raw_value text, _normalized_value text,
  _numeric_value numeric, _unit text, _field_state public.field_state,
  _source_excerpt text, _source_locator jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.evidence_fields; v_case uuid; v_in_frozen int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF coalesce(btrim(_reason), '') = '' OR length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'A revisão exige motivo registrado';
  END IF;

  SELECT * INTO f FROM public.evidence_fields WHERE id = _field_id FOR UPDATE;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Campo de evidência não encontrado'; END IF;
  IF NOT public.can_write(f.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para revisar evidência';
  END IF;

  SELECT count(*) INTO v_in_frozen
  FROM public.dataset_items di
  JOIN public.dataset_versions dv ON dv.id = di.dataset_version_id
  WHERE di.evidence_field_id = f.id AND dv.frozen_at IS NOT NULL;
  IF v_in_frozen > 0 THEN
    RAISE EXCEPTION 'Campo pertence a dataset congelado; crie nova versão de dataset';
  END IF;

  PERFORM set_config('fluxa.privileged_op', 'on', true);
  PERFORM set_config('fluxa.change_reason', btrim(_reason), true);

  -- Toda revisão invalida a verificação anterior: volta à fila de revisão humana.
  UPDATE public.evidence_fields
  SET raw_value = _raw_value, normalized_value = _normalized_value,
      numeric_value = _numeric_value, unit = _unit,
      field_state = coalesce(_field_state, f.field_state),
      source_excerpt = _source_excerpt, source_locator = _source_locator,
      validation_status = 'PENDING_REVIEW',
      verified_by = NULL, verified_at = NULL, verification_notes = NULL,
      rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL
  WHERE id = f.id;

  DELETE FROM public.dataset_items WHERE evidence_field_id = f.id;

  SELECT s.valuation_case_id INTO v_case
  FROM public.evidence_extractions e
  JOIN public.evidence_artifacts a ON a.id = e.artifact_id
  JOIN public.evidence_sources s ON s.id = a.evidence_source_id
  WHERE e.id = f.extraction_id;

  PERFORM public.audit_write_internal(
    f.organization_id, v_case, 'FIELD_REVISED', 'evidence_field', f.id,
    to_jsonb(f) - 'organization_id',
    jsonb_build_object('raw_value', _raw_value, 'normalized_value', _normalized_value,
                       'unit', _unit, 'field_state', _field_state,
                       'validation_status', 'PENDING_REVIEW'),
    jsonb_build_object('reason', btrim(_reason)));

  PERFORM set_config('fluxa.privileged_op', 'off', true);
  RETURN f.id;
END; $$;
REVOKE ALL ON FUNCTION public.revise_evidence_field(uuid, text, text, text, numeric, text, public.field_state, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revise_evidence_field(uuid, text, text, text, numeric, text, public.field_state, text, jsonb) TO authenticated;

-- 6. Operação oficial: congelar dataset (snapshot + manifesto) -
CREATE OR REPLACE FUNCTION public.freeze_dataset(_dataset_version_id uuid, _confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dv public.dataset_versions;
  v_now timestamptz := now();
  v_items jsonb;
  v_count int;
  v_manifest jsonb;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF _confirmation IS DISTINCT FROM 'CONGELAR' THEN
    RAISE EXCEPTION 'Confirmação explícita obrigatória para congelar o dataset';
  END IF;

  SELECT * INTO dv FROM public.dataset_versions WHERE id = _dataset_version_id FOR UPDATE;
  IF dv.id IS NULL THEN RAISE EXCEPTION 'Versão de dataset não encontrada'; END IF;
  IF NOT public.can_write(dv.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para congelar dataset';
  END IF;
  IF dv.frozen_at IS NOT NULL THEN RAISE EXCEPTION 'Dataset já congelado'; END IF;

  PERFORM set_config('fluxa.privileged_op', 'on', true);

  -- Snapshot imutável: cópia integral do estado de cada campo no instante do freeze.
  INSERT INTO public.dataset_item_snapshots (
    organization_id, dataset_version_id, dataset_item_id, evidence_field_id,
    evidence_field_revision, field_name, raw_value_at_freeze, normalized_value_at_freeze,
    numeric_value_at_freeze, unit_at_freeze, field_state_at_freeze, validation_status_at_freeze,
    verified_by_at_freeze, verified_at_at_freeze, source_excerpt_at_freeze, source_locator_at_freeze,
    extraction_id, extraction_version, artifact_id, artifact_sha256, evidence_source_id,
    valuation_case_id, role_in_dataset, item_ordinal
  )
  SELECT
    dv.organization_id, dv.id, di.id, f.id,
    f.revision_number, f.field_name, f.raw_value, f.normalized_value,
    f.numeric_value, f.unit, f.field_state, f.validation_status,
    f.verified_by, f.verified_at, f.source_excerpt, f.source_locator,
    e.id, e.version_number, a.id, a.sha256_hash, s.id,
    s.valuation_case_id, di.role_in_dataset,
    row_number() OVER (ORDER BY f.id)
  FROM public.dataset_items di
  JOIN public.evidence_fields f ON f.id = di.evidence_field_id
  JOIN public.evidence_extractions e ON e.id = f.extraction_id
  JOIN public.evidence_artifacts a ON a.id = e.artifact_id
  JOIN public.evidence_sources s ON s.id = a.evidence_source_id
  WHERE di.dataset_version_id = dv.id;

  SELECT count(*) INTO v_count FROM public.dataset_item_snapshots WHERE dataset_version_id = dv.id;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Não é possível congelar um dataset sem elementos';
  END IF;
  IF v_count <> (SELECT count(*) FROM public.dataset_items WHERE dataset_version_id = dv.id) THEN
    RAISE EXCEPTION 'Linhagem incompleta: há elementos sem cadeia de proveniência íntegra';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dataset_item_snapshots
             WHERE dataset_version_id = dv.id AND validation_status_at_freeze <> 'VERIFIED') THEN
    RAISE EXCEPTION 'Congelamento bloqueado: existem campos não VERIFIED na composição';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dataset_item_snapshots
             WHERE dataset_version_id = dv.id AND valuation_case_id <> dv.valuation_case_id) THEN
    RAISE EXCEPTION 'Congelamento bloqueado: contaminação cross-case detectada';
  END IF;

  -- Manifesto canônico: ordenação determinística e chaves estáveis.
  SELECT jsonb_agg(jsonb_build_object(
           'ordinal', sn.item_ordinal,
           'evidence_field_id', sn.evidence_field_id,
           'field_revision', sn.evidence_field_revision,
           'field_name', sn.field_name,
           'normalized_value', sn.normalized_value_at_freeze,
           'raw_value', sn.raw_value_at_freeze,
           'numeric_value', sn.numeric_value_at_freeze,
           'unit', sn.unit_at_freeze,
           'field_state', sn.field_state_at_freeze,
           'validation_status', sn.validation_status_at_freeze,
           'verified_by', sn.verified_by_at_freeze,
           'verified_at', to_char(sn.verified_at_at_freeze AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'extraction_id', sn.extraction_id,
           'extraction_version', sn.extraction_version,
           'artifact_id', sn.artifact_id,
           'artifact_sha256', sn.artifact_sha256,
           'evidence_source_id', sn.evidence_source_id,
           'role_in_dataset', sn.role_in_dataset
         ) ORDER BY sn.item_ordinal)
    INTO v_items
  FROM public.dataset_item_snapshots sn
  WHERE sn.dataset_version_id = dv.id;

  v_manifest := jsonb_build_object(
    'manifest_schema_version', 'fluxa.dataset.manifest/1',
    'hash_algorithm', 'SHA-256',
    'organization_id', dv.organization_id,
    'valuation_case_id', dv.valuation_case_id,
    'dataset_version_id', dv.id,
    'version_number', dv.version_number,
    'name', dv.name,
    'purpose', dv.purpose,
    'inclusion_criteria', dv.inclusion_criteria,
    'exclusion_criteria', dv.exclusion_criteria,
    'known_limitations', dv.known_limitations,
    'geographic_scope', dv.geographic_scope,
    'temporal_scope', dv.temporal_scope,
    'frozen_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'frozen_by', auth.uid(),
    'item_count', v_count,
    'items', v_items
  );

  v_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  UPDATE public.dataset_versions
  SET frozen_at = v_now, frozen_by = auth.uid(), dataset_hash = v_hash,
      dataset_manifest = v_manifest, hash_algorithm = 'SHA-256',
      manifest_schema_version = 'fluxa.dataset.manifest/1'
  WHERE id = dv.id;

  PERFORM public.audit_write_internal(
    dv.organization_id, dv.valuation_case_id, 'DATASET_FROZEN', 'dataset_version', dv.id,
    NULL,
    jsonb_build_object('frozen_at', v_now, 'dataset_hash', v_hash, 'item_count', v_count),
    jsonb_build_object('manifest_schema_version', 'fluxa.dataset.manifest/1',
                       'hash_algorithm', 'SHA-256'));

  PERFORM set_config('fluxa.privileged_op', 'off', true);

  RETURN jsonb_build_object('dataset_hash', v_hash, 'frozen_at', v_now, 'item_count', v_count);
END; $$;
REVOKE ALL ON FUNCTION public.freeze_dataset(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.freeze_dataset(uuid, text) TO authenticated;

-- 7. Operação oficial: transição de status do caso ------------
CREATE OR REPLACE FUNCTION public.transition_case_status(
  _case_id uuid, _next_status public.case_status, _reason text
) RETURNS public.case_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.valuation_cases;
  v_allowed public.case_status[];
  v_frozen int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO c FROM public.valuation_cases WHERE id = _case_id FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_write(c.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para alterar o status do caso';
  END IF;

  v_allowed := CASE c.status
    WHEN 'DRAFT'               THEN ARRAY['EVIDENCE_COLLECTION','ARCHIVED']
    WHEN 'EVIDENCE_COLLECTION' THEN ARRAY['DATA_REVIEW','DRAFT','ARCHIVED']
    WHEN 'DATA_REVIEW'         THEN ARRAY['EVIDENCE_COLLECTION','DATASET_FROZEN','ARCHIVED']
    WHEN 'DATASET_FROZEN'      THEN ARRAY['VALUATION','DATA_REVIEW','ARCHIVED']
    WHEN 'VALUATION'           THEN ARRAY['REVIEW','ARCHIVED']
    WHEN 'REVIEW'              THEN ARRAY['VALUATION','COMPLETED','ARCHIVED']
    WHEN 'COMPLETED'           THEN ARRAY['ARCHIVED']
    ELSE ARRAY[]::text[]
  END::public.case_status[];

  IF NOT (_next_status = ANY(v_allowed)) THEN
    RAISE EXCEPTION 'Transição inválida: % não pode ir para %', c.status, _next_status;
  END IF;

  IF _next_status = 'DATASET_FROZEN' THEN
    SELECT count(*) INTO v_frozen FROM public.dataset_versions
    WHERE valuation_case_id = c.id AND frozen_at IS NOT NULL;
    IF v_frozen = 0 THEN
      RAISE EXCEPTION 'Nenhum dataset congelado neste caso: a fase exige base factual imutável';
    END IF;
  END IF;

  IF _next_status = 'COMPLETED' AND NOT public.is_org_admin(c.organization_id) THEN
    RAISE EXCEPTION 'Somente ADMIN ou OWNER podem concluir um caso';
  END IF;

  -- Retrocessos e arquivamento exigem justificativa registrada.
  IF (_next_status = 'ARCHIVED'
      OR (c.status = 'DATASET_FROZEN' AND _next_status = 'DATA_REVIEW')
      OR (c.status = 'EVIDENCE_COLLECTION' AND _next_status = 'DRAFT')
      OR (c.status = 'DATA_REVIEW' AND _next_status = 'EVIDENCE_COLLECTION')
      OR (c.status = 'REVIEW' AND _next_status = 'VALUATION'))
     AND (coalesce(btrim(_reason), '') = '' OR length(btrim(_reason)) < 3) THEN
    RAISE EXCEPTION 'Reversão ou arquivamento exige justificativa técnica registrada';
  END IF;

  PERFORM set_config('fluxa.privileged_op', 'on', true);

  UPDATE public.valuation_cases SET status = _next_status WHERE id = c.id;

  PERFORM public.audit_write_internal(
    c.organization_id, c.id, 'CASE_STATUS_CHANGED', 'valuation_case', c.id,
    jsonb_build_object('status', c.status),
    jsonb_build_object('status', _next_status),
    jsonb_build_object('reason', nullif(btrim(coalesce(_reason, '')), '')));

  PERFORM set_config('fluxa.privileged_op', 'off', true);
  RETURN _next_status;
END; $$;
REVOKE ALL ON FUNCTION public.transition_case_status(uuid, public.case_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_case_status(uuid, public.case_status, text) TO authenticated;

-- 8. Storage: caminho organização/caso/arquivo validado -------
DROP POLICY IF EXISTS evidence_insert_own_org ON storage.objects;
CREATE POLICY evidence_insert_scoped ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'evidence-originals'
  AND array_length(storage.foldername(name), 1) >= 2
  AND public.can_write(((storage.foldername(name))[1])::uuid)
  AND EXISTS (
    SELECT 1 FROM public.valuation_cases vc
    WHERE vc.id = ((storage.foldername(name))[2])::uuid
      AND vc.organization_id = ((storage.foldername(name))[1])::uuid
      AND vc.status NOT IN ('COMPLETED', 'ARCHIVED')
  )
);

DROP POLICY IF EXISTS property_media_insert_own_org ON storage.objects;
CREATE POLICY property_media_insert_scoped ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND public.can_write(((storage.foldername(name))[1])::uuid)
  AND EXISTS (
    SELECT 1 FROM public.valuation_cases vc
    WHERE vc.id = ((storage.foldername(name))[2])::uuid
      AND vc.organization_id = ((storage.foldername(name))[1])::uuid
      AND vc.status NOT IN ('COMPLETED', 'ARCHIVED')
  )
);