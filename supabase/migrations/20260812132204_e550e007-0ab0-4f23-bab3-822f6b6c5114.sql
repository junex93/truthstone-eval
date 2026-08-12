CREATE OR REPLACE FUNCTION public.approve_method_specification(_spec_id uuid, _notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_spec record;
  v_org uuid;
  v_check jsonb;
  v_manifest jsonb;
  v_hash text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;

  v_org := coalesce(v_spec.organization_id, public.current_actor_organization());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Nenhuma organização ativa vinculada ao usuário'; END IF;
  IF NOT public.can_review(v_org) THEN
    RAISE EXCEPTION 'Permissão insuficiente: aprovação de especificação exige REVIEWER, ADMIN ou OWNER (VALUER não aprova)';
  END IF;
  IF v_spec.status <> 'UNDER_REVIEW' THEN
    RAISE EXCEPTION 'Somente especificação em UNDER_REVIEW pode ser aprovada (atual: %)', v_spec.status;
  END IF;
  IF v_spec.submitted_by IS NOT NULL AND v_spec.submitted_by = v_user THEN
    RAISE EXCEPTION 'Separação de funções: quem submeteu a especificação não pode aprová-la';
  END IF;

  v_check := public.specification_completeness(_spec_id);
  IF NOT (v_check->>'is_approvable')::boolean THEN
    RAISE EXCEPTION 'Aprovação bloqueada. Faltando: %. Bloqueadores: %',
      v_check->>'missing_requirements', v_check->>'blockers';
  END IF;

  v_manifest := public.build_specification_manifest(_spec_id);
  v_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.method_specifications
     SET status = 'APPROVED',
         approved_by = v_user,
         approved_at = now(),
         specification_manifest = v_manifest,
         specification_hash = v_hash,
         hash_algorithm = 'SHA-256',
         manifest_schema_version = 'methodology-spec-manifest/1',
         review_notes = coalesce(nullif(btrim(coalesce(_notes,'')),''), review_notes)
   WHERE id = _spec_id;

  UPDATE public.method_specifications
     SET status = 'SUPERSEDED'
   WHERE id = v_spec.supersedes_specification_id AND status = 'APPROVED';
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    v_org, NULL, 'METHOD_SPECIFICATION_APPROVED', 'method_specifications', _spec_id,
    jsonb_build_object('status', 'UNDER_REVIEW'),
    jsonb_build_object('status', 'APPROVED', 'approved_by', v_user,
                       'specification_hash', v_hash, 'hash_algorithm', 'SHA-256',
                       'manifest_schema_version', 'methodology-spec-manifest/1'),
    jsonb_build_object('completeness', v_check, 'notes', _notes));

  RETURN jsonb_build_object('specification_id', _spec_id, 'specification_hash', v_hash,
                            'hash_algorithm', 'SHA-256',
                            'manifest_schema_version', 'methodology-spec-manifest/1');
END; $function$;

CREATE OR REPLACE FUNCTION public.verify_specification_integrity(_spec_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_spec record;
  v_manifest jsonb;
  v_hash text;
BEGIN
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;
  IF v_spec.organization_id IS NOT NULL AND NOT public.is_org_member(v_spec.organization_id) THEN
    RAISE EXCEPTION 'Especificação fora do escopo da organização atual';
  END IF;
  IF v_spec.specification_hash IS NULL THEN
    RETURN jsonb_build_object('specification_id', _spec_id, 'result', 'NOT_SEALED',
                              'status', v_spec.status::text);
  END IF;

  v_manifest := public.build_specification_manifest(_spec_id);
  v_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'specification_id', _spec_id,
    'result', CASE WHEN v_hash = v_spec.specification_hash THEN 'VALID' ELSE 'INVALID' END,
    'stored_hash', v_spec.specification_hash,
    'recomputed_hash', v_hash,
    'hash_algorithm', coalesce(v_spec.hash_algorithm, 'SHA-256'),
    'manifest_schema_version', coalesce(v_spec.manifest_schema_version, 'methodology-spec-manifest/1'),
    'manifest_equal', (v_manifest = v_spec.specification_manifest));
END; $function$;

REVOKE ALL ON FUNCTION public.approve_method_specification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_specification_integrity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_method_specification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_specification_integrity(uuid) TO authenticated;
