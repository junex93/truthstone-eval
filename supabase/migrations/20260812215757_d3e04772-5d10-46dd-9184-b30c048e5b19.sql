-- FASE 7C — Ingestão e verificação de fonte primária metodológica.
-- Nenhuma regra normativa, fórmula ou parâmetro é criado aqui.

/* 1. Políticas do bucket privado de documentos normativos --------------- */
-- Caminho canônico: <organization_id>/<source_id>/<arquivo>.
-- Cópia licenciada/privada NUNCA se torna global por a fonte ser global.
DROP POLICY IF EXISTS methodology_sources_bucket_insert ON storage.objects;
CREATE POLICY methodology_sources_bucket_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'methodology-sources'
  AND array_length(storage.foldername(name), 1) >= 2
  AND public.can_write(((storage.foldername(name))[1])::uuid)
  AND EXISTS (
    SELECT 1 FROM public.methodology_sources s
    WHERE s.id = ((storage.foldername(name))[2])::uuid
      AND (s.organization_id IS NULL
           OR s.organization_id = ((storage.foldername(name))[1])::uuid)
  )
);

DROP POLICY IF EXISTS methodology_sources_bucket_read ON storage.objects;
CREATE POLICY methodology_sources_bucket_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'methodology-sources'
  AND array_length(storage.foldername(name), 1) >= 1
  AND public.is_org_member(((storage.foldername(name))[1])::uuid)
);

/* 2. Vínculo artefato↔fonte é append-only ------------------------------- */
REVOKE UPDATE, DELETE ON public.methodology_source_artifacts FROM authenticated;

DROP TRIGGER IF EXISTS trg_meth_source_artifact_no_update ON public.methodology_source_artifacts;
CREATE TRIGGER trg_meth_source_artifact_no_update
BEFORE UPDATE ON public.methodology_source_artifacts
FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

DROP TRIGGER IF EXISTS trg_meth_source_artifact_no_delete ON public.methodology_source_artifacts;
CREATE TRIGGER trg_meth_source_artifact_no_delete
BEFORE DELETE ON public.methodology_source_artifacts
FOR EACH ROW EXECUTE FUNCTION public.block_delete();

CREATE UNIQUE INDEX IF NOT EXISTS uq_meth_source_artifact_org
  ON public.methodology_source_artifacts(organization_id, source_id, evidence_artifact_id);

/* 3. Localizador precisa apontar para artefato realmente vinculado ------ */
CREATE OR REPLACE FUNCTION public.guard_methodology_locator_artifact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_src_org uuid; v_src_found boolean; v_art_org uuid; v_found boolean;
BEGIN
  SELECT organization_id, true INTO v_src_org, v_src_found
    FROM public.methodology_sources WHERE id = NEW.source_id;
  IF NOT coalesce(v_src_found, false) THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;
  IF v_src_org IS NOT NULL AND NEW.organization_id IS NOT NULL AND v_src_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Localizador fora do escopo da organização da fonte metodológica';
  END IF;
  IF NEW.artifact_id IS NOT NULL THEN
    SELECT organization_id, true INTO v_art_org, v_found
      FROM public.evidence_artifacts WHERE id = NEW.artifact_id;
    IF NOT coalesce(v_found, false) THEN RAISE EXCEPTION 'Artefato inexistente'; END IF;
    IF NEW.organization_id IS DISTINCT FROM v_art_org THEN
      RAISE EXCEPTION 'Artefato pertence a outra organização: linhagem incompatível com o localizador';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.methodology_source_artifacts a
       WHERE a.evidence_artifact_id = NEW.artifact_id
         AND a.source_id = NEW.source_id
         AND a.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Artefato não está vinculado a esta fonte metodológica: localizador cruzado é recusado';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

/* 4. Gate de verificação: base de acesso é POR ORGANIZAÇÃO -------------- */
CREATE OR REPLACE FUNCTION public.methodology_source_org_access_basis(_source_id uuid, _org uuid)
RETURNS public.methodology_access_status
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.access_basis
    FROM public.methodology_source_artifacts a
   WHERE a.source_id = _source_id
     AND a.organization_id = _org
     AND a.access_basis IN ('USER_PROVIDED_COPY','LICENSED_COPY','INTERNAL_AUTHORIZED_COPY','PUBLICLY_ACCESSIBLE')
   ORDER BY a.created_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.methodology_source_org_access_basis(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.methodology_source_org_access_basis(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_source_verification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_access public.methodology_access_status; v_org uuid; v_basis public.methodology_access_status;
BEGIN
  SELECT access_status, organization_id INTO v_access, v_org
    FROM public.methodology_sources WHERE id = NEW.source_id;
  IF v_access IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;
  IF v_org IS NOT NULL AND v_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Fonte pertence a outra organização';
  END IF;

  v_basis := public.methodology_source_org_access_basis(NEW.source_id, NEW.organization_id);

  IF NEW.verification_type IN ('CONTENT_VERIFIED','LOCATOR_VERIFIED')
     AND v_access = 'METADATA_ONLY' AND v_basis IS NULL THEN
    RAISE EXCEPTION 'Fonte com acesso METADATA_ONLY e sem artefato autorizado nesta organização não pode receber verificação de conteúdo';
  END IF;
  IF NEW.verification_type = 'LOCATOR_VERIFIED' AND NEW.locator_id IS NULL THEN
    RAISE EXCEPTION 'Verificação de localizador exige o localizador correspondente';
  END IF;
  IF NEW.locator_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.methodology_source_locators l
                      WHERE l.id = NEW.locator_id AND l.source_id = NEW.source_id) THEN
    RAISE EXCEPTION 'Localizador não pertence a esta fonte';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.verify_methodology_source(
  _source_id uuid,
  _verification_type public.methodology_verification_type,
  _locator_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_src record;
  v_basis public.methodology_access_status;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO v_src FROM public.methodology_sources WHERE id = _source_id;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;

  v_org := coalesce(v_src.organization_id, public.current_actor_organization());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Nenhuma organização ativa vinculada ao usuário'; END IF;
  IF v_src.organization_id IS NOT NULL AND v_src.organization_id <> v_org THEN
    RAISE EXCEPTION 'Fonte fora do escopo da organização atual';
  END IF;
  IF NOT public.can_review(v_org) THEN
    RAISE EXCEPTION 'Permissão insuficiente: verificação de fonte exige REVIEWER, ADMIN ou OWNER';
  END IF;

  v_basis := public.methodology_source_org_access_basis(_source_id, v_org);

  IF _verification_type IN ('CONTENT_VERIFIED','LOCATOR_VERIFIED') THEN
    IF v_basis IS NULL AND v_src.access_status = 'METADATA_ONLY' THEN
      RAISE EXCEPTION 'BLOCKED_BY_USER_ARTIFACT: a fonte permanece METADATA_ONLY e esta organização não possui artefato autorizado com base de acesso legítima';
    END IF;
    IF v_basis IS NULL AND v_src.access_status <> 'PUBLICLY_ACCESSIBLE' THEN
      RAISE EXCEPTION 'BLOCKED_BY_USER_ARTIFACT: verificação de conteúdo exige artefato autorizado registrado nesta organização';
    END IF;
    IF v_basis IS NULL AND v_src.access_status = 'PUBLICLY_ACCESSIBLE'
       AND coalesce(btrim(v_src.external_url),'') = '' THEN
      RAISE EXCEPTION 'Fonte publicamente acessível exige URL registrada para verificação de conteúdo';
    END IF;
  END IF;

  IF _verification_type = 'LOCATOR_VERIFIED' THEN
    IF _locator_id IS NULL THEN
      RAISE EXCEPTION 'Verificação de localizador exige o localizador correspondente';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.methodology_source_locators l
                    WHERE l.id = _locator_id AND l.source_id = _source_id
                      AND (l.organization_id IS NULL OR l.organization_id = v_org)) THEN
      RAISE EXCEPTION 'Localizador não pertence a esta fonte no escopo desta organização';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                    WHERE v.source_id = _source_id AND v.organization_id = v_org
                      AND v.verification_type = 'CONTENT_VERIFIED') THEN
      RAISE EXCEPTION 'Verificação de localizador exige verificação de conteúdo previamente registrada nesta organização';
    END IF;
  END IF;

  IF _verification_type = 'METADATA_VERIFIED' AND _locator_id IS NOT NULL THEN
    RAISE EXCEPTION 'Verificação de metadados não recebe localizador';
  END IF;

  INSERT INTO public.methodology_source_verifications
    (organization_id, source_id, locator_id, verification_type, notes, verified_by, verified_at)
  VALUES (v_org, _source_id, _locator_id, _verification_type,
          nullif(btrim(coalesce(_notes,'')),''), v_user, now())
  RETURNING id INTO v_id;

  PERFORM public.audit_write_internal(
    v_org, NULL,
    CASE _verification_type
      WHEN 'METADATA_VERIFIED' THEN 'METHODOLOGY_SOURCE_METADATA_VERIFIED'
      WHEN 'CONTENT_VERIFIED' THEN 'METHODOLOGY_SOURCE_CONTENT_VERIFIED'
      ELSE 'METHODOLOGY_SOURCE_LOCATOR_VERIFIED'
    END,
    'methodology_sources', _source_id, NULL,
    jsonb_build_object('verification_id', v_id, 'verification_type', _verification_type::text,
                       'locator_id', _locator_id, 'access_status', v_src.access_status::text,
                       'org_access_basis', v_basis::text),
    jsonb_build_object('notes', _notes));

  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.verify_methodology_source(uuid, public.methodology_verification_type, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_methodology_source(uuid, public.methodology_verification_type, uuid, text) TO authenticated;

/* 5. Diagnóstico determinístico de prontidão da fonte ------------------- */
CREATE OR REPLACE FUNCTION public.methodology_source_readiness(_source_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_src record;
  v_basis public.methodology_access_status;
  v_artifacts int;
  v_metadata boolean;
  v_content boolean;
  v_loc_total int;
  v_loc_verified int;
  v_blockers text[] := '{}';
  v_state text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO v_src FROM public.methodology_sources WHERE id = _source_id;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;

  v_org := coalesce(v_src.organization_id, public.current_actor_organization());
  IF v_org IS NULL OR NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'Fonte fora do escopo da organização atual';
  END IF;

  v_basis := public.methodology_source_org_access_basis(_source_id, v_org);
  SELECT count(*) INTO v_artifacts FROM public.methodology_source_artifacts a
    WHERE a.source_id = _source_id AND a.organization_id = v_org;
  SELECT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                  WHERE v.source_id = _source_id AND v.organization_id = v_org
                    AND v.verification_type = 'METADATA_VERIFIED') INTO v_metadata;
  SELECT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                  WHERE v.source_id = _source_id AND v.organization_id = v_org
                    AND v.verification_type = 'CONTENT_VERIFIED') INTO v_content;
  SELECT count(*) INTO v_loc_total FROM public.methodology_source_locators l
    WHERE l.source_id = _source_id AND (l.organization_id IS NULL OR l.organization_id = v_org);
  SELECT count(DISTINCT v.locator_id) INTO v_loc_verified
    FROM public.methodology_source_verifications v
   WHERE v.source_id = _source_id AND v.organization_id = v_org
     AND v.verification_type = 'LOCATOR_VERIFIED' AND v.locator_id IS NOT NULL;

  IF v_basis IS NULL THEN v_blockers := v_blockers || 'NO_AUTHORIZED_ARTIFACT_IN_THIS_ORGANIZATION'; END IF;
  IF NOT v_metadata THEN v_blockers := v_blockers || 'METADATA_NOT_VERIFIED'; END IF;
  IF NOT v_content THEN v_blockers := v_blockers || 'CONTENT_NOT_VERIFIED'; END IF;
  IF v_loc_verified = 0 THEN v_blockers := v_blockers || 'NO_VERIFIED_LOCATOR'; END IF;

  v_state := CASE
    WHEN v_basis IS NULL THEN 'BLOCKED_BY_USER_ARTIFACT'
    WHEN NOT v_metadata THEN 'PENDING_METADATA_VERIFICATION'
    WHEN NOT v_content THEN 'PENDING_CONTENT_VERIFICATION'
    ELSE 'SOURCE_READY_FOR_RULE_REVIEW'
  END;

  RETURN jsonb_build_object(
    'source_id', _source_id,
    'scope', CASE WHEN v_src.organization_id IS NULL THEN 'GLOBAL_METADATA' ELSE 'ORGANIZATION' END,
    'global_access_status', v_src.access_status::text,
    'organization_access_basis', v_basis::text,
    'artifacts_in_organization', v_artifacts,
    'metadata_verified', v_metadata,
    'content_verified', v_content,
    'locators_total', v_loc_total,
    'locators_verified', v_loc_verified,
    'state', v_state,
    'locator_backed_claims_allowed', (v_state = 'SOURCE_READY_FOR_RULE_REVIEW' AND v_loc_verified > 0),
    'blockers', to_jsonb(v_blockers));
END; $$;
REVOKE ALL ON FUNCTION public.methodology_source_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.methodology_source_readiness(uuid) TO authenticated;