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
  v_blockers text[] := ARRAY[]::text[];
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

  IF v_basis IS NULL THEN
    v_blockers := array_append(v_blockers, 'NO_AUTHORIZED_ARTIFACT_IN_THIS_ORGANIZATION');
  END IF;
  IF NOT v_metadata THEN v_blockers := array_append(v_blockers, 'METADATA_NOT_VERIFIED'); END IF;
  IF NOT v_content THEN v_blockers := array_append(v_blockers, 'CONTENT_NOT_VERIFIED'); END IF;
  IF v_loc_verified = 0 THEN v_blockers := array_append(v_blockers, 'NO_VERIFIED_LOCATOR'); END IF;

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