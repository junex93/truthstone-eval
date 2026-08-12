-- ============================================================
-- FASE 6 / MIGRATION B — OPERAÇÕES OFICIAIS DO REGISTRO METODOLÓGICO
-- ============================================================

-- ---------- 0. GRANTS (a camada estava sem GRANT: inalcançável pela Data API) ----------
GRANT SELECT ON public.methodology_families TO authenticated;
GRANT SELECT ON public.methodology_units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.valuation_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_sources TO authenticated;
GRANT SELECT, INSERT ON public.methodology_source_artifacts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_source_locators TO authenticated;
GRANT SELECT ON public.methodology_source_verifications TO authenticated;
GRANT SELECT, INSERT ON public.methodology_source_conflicts TO authenticated;
GRANT SELECT, INSERT ON public.methodology_crosswalks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_data_dictionary TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_specifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_specification_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_specification_source_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_rules TO authenticated;
GRANT SELECT, INSERT ON public.methodology_rule_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_formulas TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_formula_variables TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_parameters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_parameter_sets TO authenticated;
GRANT SELECT, INSERT ON public.method_parameter_values TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_applicability_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_test_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_output_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.method_implementations TO authenticated;
GRANT SELECT ON public.method_compliance_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.methodology_change_requests TO authenticated;
GRANT SELECT ON public.document_requirement_profiles TO authenticated;

GRANT ALL ON public.methodology_families, public.methodology_units, public.valuation_methods,
  public.methodology_sources, public.methodology_source_artifacts, public.methodology_source_locators,
  public.methodology_source_verifications, public.methodology_source_conflicts, public.methodology_crosswalks,
  public.methodology_data_dictionary, public.method_specifications, public.method_specification_sections,
  public.method_specification_source_requirements, public.methodology_rules, public.methodology_rule_sources,
  public.methodology_formulas, public.methodology_formula_variables, public.methodology_parameters,
  public.method_parameter_sets, public.method_parameter_values, public.method_applicability_rules,
  public.method_test_cases, public.method_output_contracts, public.method_implementations,
  public.method_compliance_assessments, public.methodology_change_requests,
  public.document_requirement_profiles TO service_role;

-- ---------- 1. Campos de rejeição (não destrutivo) ----------
ALTER TABLE public.method_specifications
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- guarda ampliada: rejeição também é exclusiva da operação oficial
CREATE OR REPLACE FUNCTION public.guard_method_specification_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
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
     OR NEW.hash_algorithm IS DISTINCT FROM OLD.hash_algorithm
     OR NEW.manifest_schema_version IS DISTINCT FROM OLD.manifest_schema_version
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
     OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.submitted_for_review_at IS DISTINCT FROM OLD.submitted_for_review_at THEN
    RAISE EXCEPTION 'Manifesto, hash e dados de submissão/aprovação/rejeição são gravados apenas pela operação oficial';
  END IF;
  RETURN NEW;
END; $function$;

-- guarda de conflito de fontes: resolução só pela operação oficial
CREATE OR REPLACE FUNCTION public.guard_source_conflict_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.in_privileged_op() THEN RETURN NEW; END IF;
  IF NEW.source_a_id IS DISTINCT FROM OLD.source_a_id
     OR NEW.source_b_id IS DISTINCT FROM OLD.source_b_id
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.is_critical IS DISTINCT FROM OLD.is_critical
     OR NEW.resolution_status IS DISTINCT FROM OLD.resolution_status
     OR NEW.professional_resolution IS DISTINCT FROM OLD.professional_resolution
     OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    RAISE EXCEPTION 'Conflito de fontes: resolução e identidade do conflito só mudam pela operação oficial resolve_methodology_source_conflict';
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_methodology_source_conflicts_guard ON public.methodology_source_conflicts;
CREATE TRIGGER trg_methodology_source_conflicts_guard
  BEFORE UPDATE ON public.methodology_source_conflicts
  FOR EACH ROW EXECUTE FUNCTION public.guard_source_conflict_update();

-- ---------- 2. Organização efetiva do ator (biblioteca global usa a org ativa) ----------
CREATE OR REPLACE FUNCTION public.current_actor_organization()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT m.organization_id
    FROM public.organization_members m
   WHERE m.user_id = auth.uid() AND m.status = 'ACTIVE'
   ORDER BY m.created_at ASC
   LIMIT 1;
$function$;

-- ---------- 3. verify_methodology_source ----------
CREATE OR REPLACE FUNCTION public.verify_methodology_source(
  _source_id uuid,
  _verification_type public.methodology_verification_type,
  _locator_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_src record;
  v_has_artifact boolean;
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

  IF _verification_type IN ('CONTENT_VERIFIED','LOCATOR_VERIFIED')
     AND v_src.access_status = 'METADATA_ONLY' THEN
    RAISE EXCEPTION 'Fonte METADATA_ONLY não pode receber verificação de conteúdo/localizador: o texto integral não está legitimamente disponível';
  END IF;

  IF _verification_type = 'CONTENT_VERIFIED' THEN
    SELECT EXISTS (SELECT 1 FROM public.methodology_source_artifacts a WHERE a.source_id = _source_id)
      INTO v_has_artifact;
    IF NOT v_has_artifact AND v_src.access_status <> 'PUBLICLY_ACCESSIBLE' THEN
      RAISE EXCEPTION 'Verificação de conteúdo exige artefato autorizado registrado (base de acesso legítima) ou fonte publicamente acessível';
    END IF;
    IF v_src.access_status = 'PUBLICLY_ACCESSIBLE' AND coalesce(btrim(v_src.external_url),'') = '' THEN
      RAISE EXCEPTION 'Fonte publicamente acessível exige URL registrada para verificação de conteúdo';
    END IF;
  END IF;

  IF _verification_type = 'LOCATOR_VERIFIED' THEN
    IF _locator_id IS NULL THEN
      RAISE EXCEPTION 'Verificação de localizador exige o localizador correspondente';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.methodology_source_locators l
                    WHERE l.id = _locator_id AND l.source_id = _source_id) THEN
      RAISE EXCEPTION 'Localizador não pertence a esta fonte';
    END IF;
  END IF;

  IF _verification_type = 'METADATA_VERIFIED' AND _locator_id IS NOT NULL THEN
    RAISE EXCEPTION 'Verificação de metadados não recebe localizador';
  END IF;

  INSERT INTO public.methodology_source_verifications
    (organization_id, source_id, locator_id, verification_type, notes, verified_by, verified_at)
  VALUES (v_org, _source_id, _locator_id, _verification_type, nullif(btrim(coalesce(_notes,'')),''), v_user, now())
  RETURNING id INTO v_id;

  PERFORM public.audit_write_internal(
    v_org, NULL, 'METHODOLOGY_SOURCE_VERIFIED', 'methodology_sources', _source_id,
    NULL,
    jsonb_build_object('verification_id', v_id, 'verification_type', _verification_type::text,
                       'locator_id', _locator_id, 'access_status', v_src.access_status::text),
    jsonb_build_object('notes', _notes));

  RETURN v_id;
END; $function$;

-- ---------- 4. specification_completeness ----------
CREATE OR REPLACE FUNCTION public.specification_completeness(_spec_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_spec record;
  v_completed text[] := '{}';
  v_missing text[] := '{}';
  v_blockers text[] := '{}';
  v_warnings text[] := '{}';
  v_required public.method_spec_section_key[] := ARRAY[
    'PURPOSE','INTENDED_USE','APPLICABILITY','NON_APPLICABILITY','REQUIRED_INPUTS',
    'DATA_REQUIREMENTS','RULES','LIMITATIONS','TEST_REQUIREMENTS','OUTPUTS'
  ]::public.method_spec_section_key[];
  v_key public.method_spec_section_key;
  v_content text;
  r record;
BEGIN
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;
  IF v_spec.organization_id IS NOT NULL AND NOT public.is_org_member(v_spec.organization_id) THEN
    RAISE EXCEPTION 'Especificação fora do escopo da organização atual';
  END IF;

  -- seções obrigatórias
  FOREACH v_key IN ARRAY v_required LOOP
    SELECT content INTO v_content FROM public.method_specification_sections
     WHERE method_specification_id = _spec_id AND section_key = v_key;
    IF coalesce(btrim(coalesce(v_content,'')),'') = '' THEN
      v_missing := v_missing || ('SECTION_' || v_key::text);
    ELSE
      v_completed := v_completed || ('SECTION_' || v_key::text);
    END IF;
  END LOOP;

  -- regras
  IF NOT EXISTS (SELECT 1 FROM public.methodology_rules WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'RULES_REGISTERED';
  ELSE
    v_completed := v_completed || 'RULES_REGISTERED';
  END IF;

  -- casos de teste
  IF NOT EXISTS (SELECT 1 FROM public.method_test_cases WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'TEST_CASES';
  ELSE
    v_completed := v_completed || 'TEST_CASES';
  END IF;

  -- contrato de saída
  IF NOT EXISTS (SELECT 1 FROM public.method_output_contracts WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'OUTPUT_CONTRACT';
  ELSE
    v_completed := v_completed || 'OUTPUT_CONTRACT';
  END IF;

  -- aplicabilidade estruturada
  IF NOT EXISTS (SELECT 1 FROM public.method_applicability_rules WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'APPLICABILITY_CRITERIA';
  ELSE
    v_completed := v_completed || 'APPLICABILITY_CRITERIA';
  END IF;

  -- requisitos de fonte pendentes
  FOR r IN SELECT requirement_code FROM public.method_specification_source_requirements
            WHERE method_specification_id = _spec_id AND is_satisfied = false
            ORDER BY requirement_code LOOP
    v_missing := v_missing || ('SOURCE_REQUIREMENT_' || r.requirement_code);
  END LOOP;

  -- regra normativa sem vínculo de fonte adequado
  FOR r IN SELECT ru.rule_code, ru.normative_strength
             FROM public.methodology_rules ru
            WHERE ru.method_specification_id = _spec_id
              AND ru.normative_strength IN ('MANDATORY','PROHIBITED')
              AND NOT EXISTS (SELECT 1 FROM public.methodology_rule_sources rs
                               WHERE rs.rule_id = ru.id
                                 AND rs.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION'))
            ORDER BY ru.rule_code LOOP
    v_blockers := v_blockers || ('NORMATIVE_RULE_WITHOUT_DIRECT_SOURCE:' || r.rule_code);
  END LOOP;

  -- afirmação normativa direta sem conteúdo verificado / sem localizador / sem localizador verificado
  FOR r IN SELECT ru.rule_code, rs.source_id, rs.source_locator_id, rs.relationship_type
             FROM public.methodology_rule_sources rs
             JOIN public.methodology_rules ru ON ru.id = rs.rule_id
            WHERE ru.method_specification_id = _spec_id
              AND rs.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION')
            ORDER BY ru.rule_code, rs.source_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                    WHERE v.source_id = r.source_id AND v.verification_type = 'CONTENT_VERIFIED') THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_CONTENT_VERIFICATION:' || r.rule_code);
    END IF;
    IF r.source_locator_id IS NULL THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_LOCATOR:' || r.rule_code);
    ELSIF NOT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                       WHERE v.locator_id = r.source_locator_id AND v.verification_type = 'LOCATOR_VERIFIED') THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_LOCATOR_VERIFICATION:' || r.rule_code);
    END IF;
  END LOOP;

  -- fórmulas: proveniência, variáveis, unidades, testes
  FOR r IN SELECT f.id, f.formula_code, f.expression, f.rule_id
             FROM public.methodology_formulas f
             JOIN public.methodology_rules ru ON ru.id = f.rule_id
            WHERE ru.method_specification_id = _spec_id
            ORDER BY f.formula_code LOOP

    IF NOT EXISTS (SELECT 1 FROM public.methodology_rule_sources rs WHERE rs.rule_id = r.rule_id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_PROVENANCE:' || r.formula_code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.methodology_formula_variables fv WHERE fv.formula_id = r.id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_VARIABLES:' || r.formula_code);
    END IF;

    -- variável desconhecida: identificador na expressão sem registro
    IF EXISTS (
      SELECT 1 FROM (
        SELECT DISTINCT (regexp_matches(r.expression, '[A-Za-z_][A-Za-z0-9_]*', 'g'))[1] AS token
      ) t
      WHERE upper(t.token) NOT IN ('LN','LOG','EXP','SQRT','ABS','MIN','MAX','SUM','MEAN','MEDIAN','E','PI')
        AND NOT EXISTS (SELECT 1 FROM public.methodology_formula_variables fv
                         WHERE fv.formula_id = r.id AND fv.variable_code = t.token)
        AND NOT EXISTS (SELECT 1 FROM public.methodology_parameters p
                         WHERE p.method_specification_id = _spec_id AND p.parameter_code = t.token)
    ) THEN
      v_blockers := v_blockers || ('FORMULA_UNKNOWN_VARIABLE:' || r.formula_code);
    END IF;

    -- unidade desconhecida
    IF EXISTS (SELECT 1 FROM public.methodology_formula_variables fv
                WHERE fv.formula_id = r.id AND fv.unit_code IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM public.methodology_units u WHERE u.code = fv.unit_code)) THEN
      v_blockers := v_blockers || ('FORMULA_UNKNOWN_UNIT:' || r.formula_code);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.method_test_cases tc
                    WHERE tc.method_specification_id = _spec_id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_TESTS:' || r.formula_code);
    END IF;
  END LOOP;

  -- parâmetros que afetam valor sem proveniência
  FOR r IN SELECT p.id, p.parameter_code, p.unit_code, p.source_required
             FROM public.methodology_parameters p
            WHERE p.method_specification_id = _spec_id
            ORDER BY p.parameter_code LOOP
    IF p_unit_unknown(r.unit_code) THEN
      v_blockers := v_blockers || ('PARAMETER_UNKNOWN_UNIT:' || r.parameter_code);
    END IF;
    IF r.source_required AND NOT EXISTS (
        SELECT 1 FROM public.method_parameter_values pv
         WHERE pv.parameter_id = r.id AND pv.source_id IS NOT NULL) THEN
      v_blockers := v_blockers || ('VALUE_AFFECTING_PARAMETER_WITHOUT_PROVENANCE:' || r.parameter_code);
    END IF;
  END LOOP;

  -- conflito crítico não resolvido em fonte usada pela especificação
  FOR r IN SELECT DISTINCT c.id, c.subject
             FROM public.methodology_source_conflicts c
            WHERE c.is_critical
              AND c.resolution_status IN ('OPEN','UNDER_ANALYSIS')
              AND EXISTS (
                SELECT 1 FROM public.methodology_rule_sources rs
                  JOIN public.methodology_rules ru ON ru.id = rs.rule_id
                 WHERE ru.method_specification_id = _spec_id
                   AND rs.source_id IN (c.source_a_id, c.source_b_id))
            ORDER BY c.id LOOP
    v_blockers := v_blockers || ('UNRESOLVED_CRITICAL_SOURCE_CONFLICT:' || r.id::text);
  END LOOP;

  -- avisos (não bloqueiam)
  IF NOT EXISTS (SELECT 1 FROM public.methodology_parameters WHERE method_specification_id = _spec_id) THEN
    v_warnings := v_warnings || 'NO_PARAMETERS_REGISTERED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.methodology_formulas f
                  JOIN public.methodology_rules ru ON ru.id = f.rule_id
                 WHERE ru.method_specification_id = _spec_id) THEN
    v_warnings := v_warnings || 'NO_FORMULA_REGISTERED';
  END IF;

  RETURN jsonb_build_object(
    'specification_id', _spec_id,
    'status', v_spec.status::text,
    'is_complete', (array_length(v_missing,1) IS NULL),
    'is_approvable', (array_length(v_missing,1) IS NULL AND array_length(v_blockers,1) IS NULL),
    'completed_requirements', to_jsonb(v_completed),
    'missing_requirements', to_jsonb(v_missing),
    'blockers', to_jsonb(v_blockers),
    'warnings', to_jsonb(v_warnings));
END; $function$;

-- helper determinístico de unidade
CREATE OR REPLACE FUNCTION public.p_unit_unknown(_unit text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT _unit IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.methodology_units u WHERE u.code = _unit);
$function$;

-- ---------- 5. Manifesto canônico ----------
CREATE OR REPLACE FUNCTION public.build_specification_manifest(_spec_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_spec record;
  v_method record;
  v_manifest jsonb;
BEGIN
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;
  SELECT * INTO v_method FROM public.valuation_methods WHERE id = v_spec.valuation_method_id;

  v_manifest := jsonb_build_object(
    'manifest_schema_version', 'methodology-spec-manifest/1',
    'canonicalization', 'jsonb-sorted-keys; arrays ordered by declared canonical key',
    'metadata', jsonb_build_object(
      'specification_id', v_spec.id,
      'version', v_spec.version,
      'title', v_spec.title,
      'purpose', v_spec.purpose,
      'scope', v_spec.scope,
      'jurisdiction', v_spec.jurisdiction::text,
      'effective_from', v_spec.effective_from,
      'effective_until', v_spec.effective_until,
      'supersedes_specification_id', v_spec.supersedes_specification_id,
      'method', jsonb_build_object(
        'method_id', v_method.id,
        'code', v_method.code,
        'name', v_method.name,
        'family_code', v_method.family_code)),

    'sections', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'section_key', s.section_key::text, 'ordinal', s.ordinal, 'content', s.content)
             ORDER BY s.section_key::text)
        FROM public.method_specification_sections s
       WHERE s.method_specification_id = _spec_id), '[]'::jsonb),

    'rules', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'rule_code', ru.rule_code,
               'title', ru.title,
               'rule_type', ru.rule_type::text,
               'normative_strength', ru.normative_strength::text,
               'status', ru.status::text,
               'priority', ru.priority,
               'description', ru.description,
               'sources', coalesce((
                  SELECT jsonb_agg(jsonb_build_object(
                           'source_id', rs.source_id,
                           'locator_id', rs.source_locator_id,
                           'relationship_type', rs.relationship_type::text,
                           'interpretation_notes', rs.interpretation_notes)
                         ORDER BY rs.source_id::text, rs.relationship_type::text)
                    FROM public.methodology_rule_sources rs
                   WHERE rs.rule_id = ru.id), '[]'::jsonb))
             ORDER BY ru.rule_code)
        FROM public.methodology_rules ru
       WHERE ru.method_specification_id = _spec_id), '[]'::jsonb),

    'sources', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'source_id', src.id,
               'title', src.title,
               'issuing_body', src.issuing_body,
               'source_type', src.source_type::text,
               'authority_level', src.authority_level::text,
               'access_status', src.access_status::text,
               'jurisdiction', src.jurisdiction::text,
               'edition', src.edition,
               'publication_year', src.publication_year,
               'status', src.status::text,
               'verifications', coalesce((
                  SELECT jsonb_agg(DISTINCT v.verification_type::text)
                    FROM public.methodology_source_verifications v
                   WHERE v.source_id = src.id), '[]'::jsonb),
               'artifacts', coalesce((
                  SELECT jsonb_agg(jsonb_build_object(
                           'artifact_id', a.evidence_artifact_id,
                           'sha256', ea.sha256_hash,
                           'access_basis', a.access_basis::text)
                         ORDER BY a.evidence_artifact_id::text)
                    FROM public.methodology_source_artifacts a
                    LEFT JOIN public.evidence_artifacts ea ON ea.id = a.evidence_artifact_id
                   WHERE a.source_id = src.id), '[]'::jsonb))
             ORDER BY src.id::text)
        FROM public.methodology_sources src
       WHERE src.id IN (
         SELECT rs.source_id FROM public.methodology_rule_sources rs
           JOIN public.methodology_rules ru ON ru.id = rs.rule_id
          WHERE ru.method_specification_id = _spec_id)), '[]'::jsonb),

    'locators', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'locator_id', l.id, 'source_id', l.source_id, 'locator_type', l.locator_type::text,
               'section', l.section, 'clause', l.clause, 'page', l.page, 'chapter', l.chapter,
               'annex_or_table', l.table_reference, 'external_anchor', l.external_anchor,
               'verified', EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                                    WHERE v.locator_id = l.id AND v.verification_type = 'LOCATOR_VERIFIED'))
             ORDER BY l.id::text)
        FROM public.methodology_source_locators l
       WHERE l.id IN (
         SELECT rs.source_locator_id FROM public.methodology_rule_sources rs
           JOIN public.methodology_rules ru ON ru.id = rs.rule_id
          WHERE ru.method_specification_id = _spec_id AND rs.source_locator_id IS NOT NULL)), '[]'::jsonb),

    'formulas', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'formula_code', f.formula_code,
               'name', f.name,
               'expression', f.expression,
               'expression_language', f.expression_language::text,
               'status', f.status::text,
               'rule_code', ru.rule_code,
               'variables', coalesce((
                  SELECT jsonb_agg(jsonb_build_object(
                           'variable_code', fv.variable_code, 'name', fv.name,
                           'data_type', fv.data_type::text, 'unit_code', fv.unit_code,
                           'required', fv.required, 'constraints', fv.constraints)
                         ORDER BY fv.variable_code)
                    FROM public.methodology_formula_variables fv
                   WHERE fv.formula_id = f.id), '[]'::jsonb))
             ORDER BY f.formula_code)
        FROM public.methodology_formulas f
        JOIN public.methodology_rules ru ON ru.id = f.rule_id
       WHERE ru.method_specification_id = _spec_id), '[]'::jsonb),

    'parameters', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'parameter_code', p.parameter_code, 'name', p.name, 'data_type', p.data_type::text,
               'unit_code', p.unit_code, 'source_required', p.source_required,
               'default_value', p.default_value, 'min_value', p.min_value, 'max_value', p.max_value,
               'provenance', coalesce((
                  SELECT jsonb_agg(jsonb_build_object(
                           'parameter_set_id', pv.parameter_set_id, 'source_id', pv.source_id,
                           'numeric_value', pv.numeric_value, 'text_value', pv.text_value,
                           'justification', pv.justification)
                         ORDER BY pv.parameter_set_id::text, pv.id::text)
                    FROM public.method_parameter_values pv
                   WHERE pv.parameter_id = p.id), '[]'::jsonb))
             ORDER BY p.parameter_code)
        FROM public.methodology_parameters p
       WHERE p.method_specification_id = _spec_id), '[]'::jsonb),

    'applicability', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'criterion_code', ar.criterion_code, 'criterion_description', ar.criterion_description,
               'expected_result', ar.expected_result::text, 'notes', ar.notes)
             ORDER BY ar.criterion_code)
        FROM public.method_applicability_rules ar
       WHERE ar.method_specification_id = _spec_id), '[]'::jsonb),

    'test_cases', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'test_code', tc.test_code, 'title', tc.title, 'test_type', tc.test_type::text,
               'input_fixture', tc.input_fixture, 'expected_result', tc.expected_result,
               'expected_status', tc.expected_status, 'source_reference', tc.source_reference)
             ORDER BY tc.test_code)
        FROM public.method_test_cases tc
       WHERE tc.method_specification_id = _spec_id), '[]'::jsonb),

    'output_contracts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'output_type', oc.output_type::text, 'description', oc.description,
               'unit_code', oc.unit_code, 'required', oc.required)
             ORDER BY oc.output_type::text)
        FROM public.method_output_contracts oc
       WHERE oc.method_specification_id = _spec_id), '[]'::jsonb),

    'source_requirements', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'requirement_code', sr.requirement_code, 'description', sr.description,
               'is_satisfied', sr.is_satisfied, 'satisfied_by_source_id', sr.satisfied_by_source_id)
             ORDER BY sr.requirement_code)
        FROM public.method_specification_source_requirements sr
       WHERE sr.method_specification_id = _spec_id), '[]'::jsonb),

    'implementation_requirements', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'implementation_code', mi.implementation_code, 'version', mi.version,
               'status', mi.status::text, 'runtime', mi.runtime, 'checksum', mi.checksum)
             ORDER BY mi.implementation_code, mi.version)
        FROM public.method_implementations mi
       WHERE mi.method_specification_id = _spec_id), '[]'::jsonb)
  );

  RETURN v_manifest;
END; $function$;

-- ---------- 6. submit_method_specification ----------
CREATE OR REPLACE FUNCTION public.submit_method_specification(_spec_id uuid, _notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_spec record;
  v_org uuid;
  v_check jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;

  v_org := coalesce(v_spec.organization_id, public.current_actor_organization());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Nenhuma organização ativa vinculada ao usuário'; END IF;
  IF NOT public.can_write(v_org) THEN
    RAISE EXCEPTION 'Permissão insuficiente: submissão exige VALUER, ADMIN ou OWNER';
  END IF;
  IF v_spec.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Somente especificação em DRAFT pode ser submetida (atual: %)', v_spec.status;
  END IF;

  v_check := public.specification_completeness(_spec_id);
  IF NOT (v_check->>'is_complete')::boolean THEN
    RAISE EXCEPTION 'Especificação incompleta: %', v_check->>'missing_requirements';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.method_specifications
     SET status = 'UNDER_REVIEW', submitted_by = v_user, submitted_for_review_at = now(),
         review_notes = nullif(btrim(coalesce(_notes,'')),'')
   WHERE id = _spec_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    v_org, NULL, 'METHOD_SPECIFICATION_SUBMITTED', 'method_specifications', _spec_id,
    jsonb_build_object('status', 'DRAFT'),
    jsonb_build_object('status', 'UNDER_REVIEW', 'submitted_by', v_user),
    jsonb_build_object('completeness', v_check, 'notes', _notes));

  RETURN _spec_id;
END; $function$;

-- ---------- 7. approve_method_specification ----------
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
  v_hash := encode(digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

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

-- ---------- 8. reject_method_specification ----------
CREATE OR REPLACE FUNCTION public.reject_method_specification(_spec_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_spec record;
  v_org uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 10 THEN
    RAISE EXCEPTION 'Rejeição exige motivo técnico registrado (mínimo 10 caracteres)';
  END IF;
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _spec_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;

  v_org := coalesce(v_spec.organization_id, public.current_actor_organization());
  IF v_org IS NULL THEN RAISE EXCEPTION 'Nenhuma organização ativa vinculada ao usuário'; END IF;
  IF NOT public.can_review(v_org) THEN
    RAISE EXCEPTION 'Permissão insuficiente: rejeição exige REVIEWER, ADMIN ou OWNER';
  END IF;
  IF v_spec.status NOT IN ('DRAFT','UNDER_REVIEW') THEN
    RAISE EXCEPTION 'Somente especificação em DRAFT ou UNDER_REVIEW pode ser rejeitada (atual: %)', v_spec.status;
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.method_specifications
     SET status = 'REJECTED', rejected_by = v_user, rejected_at = now(),
         rejection_reason = btrim(_reason)
   WHERE id = _spec_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    v_org, NULL, 'METHOD_SPECIFICATION_REJECTED', 'method_specifications', _spec_id,
    jsonb_build_object('status', v_spec.status::text),
    jsonb_build_object('status', 'REJECTED', 'rejected_by', v_user),
    jsonb_build_object('reason', btrim(_reason)));

  RETURN _spec_id;
END; $function$;

-- ---------- 9. verify_specification_integrity ----------
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
  IF v_spec.status <> 'APPROVED' AND v_spec.specification_hash IS NULL THEN
    RETURN jsonb_build_object('specification_id', _spec_id, 'result', 'NOT_SEALED',
                              'status', v_spec.status::text);
  END IF;

  v_manifest := public.build_specification_manifest(_spec_id);
  v_hash := encode(digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'specification_id', _spec_id,
    'result', CASE WHEN v_hash = v_spec.specification_hash THEN 'VALID' ELSE 'INVALID' END,
    'stored_hash', v_spec.specification_hash,
    'recomputed_hash', v_hash,
    'hash_algorithm', coalesce(v_spec.hash_algorithm, 'SHA-256'),
    'manifest_schema_version', coalesce(v_spec.manifest_schema_version, 'methodology-spec-manifest/1'),
    'manifest_equal', (v_manifest = v_spec.specification_manifest));
END; $function$;

-- ---------- 10. resolve_methodology_source_conflict ----------
CREATE OR REPLACE FUNCTION public.resolve_methodology_source_conflict(
  _conflict_id uuid,
  _resolution_status public.methodology_conflict_status,
  _professional_resolution text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_conflict record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF _resolution_status NOT IN ('RESOLVED','NOT_A_CONFLICT','UNDER_ANALYSIS') THEN
    RAISE EXCEPTION 'Resolução inválida para conflito de fontes';
  END IF;
  IF length(btrim(coalesce(_professional_resolution,''))) < 20 THEN
    RAISE EXCEPTION 'Resolução de conflito exige fundamentação profissional registrada (mínimo 20 caracteres)';
  END IF;

  SELECT * INTO v_conflict FROM public.methodology_source_conflicts WHERE id = _conflict_id;
  IF v_conflict IS NULL THEN RAISE EXCEPTION 'Conflito inexistente'; END IF;
  IF NOT public.can_review(v_conflict.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente: resolução de conflito exige REVIEWER, ADMIN ou OWNER';
  END IF;
  IF v_conflict.resolution_status IN ('RESOLVED','NOT_A_CONFLICT') THEN
    RAISE EXCEPTION 'Conflito já encerrado: registre novo conflito em vez de reescrever a decisão';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.methodology_source_conflicts
     SET resolution_status = _resolution_status,
         professional_resolution = btrim(_professional_resolution),
         resolved_by = CASE WHEN _resolution_status = 'UNDER_ANALYSIS' THEN NULL ELSE v_user END,
         resolved_at = CASE WHEN _resolution_status = 'UNDER_ANALYSIS' THEN NULL ELSE now() END
   WHERE id = _conflict_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(
    v_conflict.organization_id, NULL, 'METHODOLOGY_SOURCE_CONFLICT_RESOLVED',
    'methodology_source_conflicts', _conflict_id,
    jsonb_build_object('resolution_status', v_conflict.resolution_status::text,
                       'source_a_id', v_conflict.source_a_id,
                       'source_b_id', v_conflict.source_b_id,
                       'subject', v_conflict.subject),
    jsonb_build_object('resolution_status', _resolution_status::text, 'resolved_by', v_user),
    jsonb_build_object('professional_resolution', btrim(_professional_resolution)));

  RETURN _conflict_id;
END; $function$;

-- ---------- 11. Execução das operações oficiais ----------
REVOKE ALL ON FUNCTION public.current_actor_organization() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.p_unit_unknown(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_methodology_source(uuid, public.methodology_verification_type, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.specification_completeness(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.build_specification_manifest(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_method_specification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_method_specification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_method_specification(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_specification_integrity(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_methodology_source_conflict(uuid, public.methodology_conflict_status, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_actor_organization() TO authenticated;
GRANT EXECUTE ON FUNCTION public.p_unit_unknown(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_methodology_source(uuid, public.methodology_verification_type, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.specification_completeness(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.build_specification_manifest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_method_specification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_method_specification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_method_specification(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_specification_integrity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_methodology_source_conflict(uuid, public.methodology_conflict_status, text) TO authenticated;

-- ---------- 12. SEED — fontes (SOMENTE METADADOS, sem texto normativo) ----------
INSERT INTO public.methodology_sources
  (id, organization_id, title, short_title, source_type, issuing_body, edition, publication_year,
   jurisdiction, jurisdiction_detail, language, identifier, external_url, access_status,
   authority_level, status, notes)
VALUES
  ('11111111-0000-4000-8000-000000000001', NULL,
   'ABNT NBR 14653 — Avaliação de bens (família de normas)', 'NBR 14653',
   'TECHNICAL_STANDARD', 'ABNT — Associação Brasileira de Normas Técnicas', NULL, NULL,
   'BRAZIL', 'Brasil', 'pt-BR', 'NBR 14653', NULL, 'METADATA_ONLY',
   'PRIMARY_NORMATIVE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Edição, ano e conteúdo não confirmados neste projeto. Nenhuma exigência normativa foi derivada desta entrada.'),
  ('11111111-0000-4000-8000-000000000002', NULL,
   'ABNT NBR 14653-1 — Avaliação de bens: Procedimentos gerais', 'NBR 14653-1',
   'TECHNICAL_STANDARD', 'ABNT — Associação Brasileira de Normas Técnicas', NULL, NULL,
   'BRAZIL', 'Brasil', 'pt-BR', 'NBR 14653-1', NULL, 'METADATA_ONLY',
   'PRIMARY_NORMATIVE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Edição/ano pendentes de confirmação. Sem conteúdo verificado.'),
  ('11111111-0000-4000-8000-000000000003', NULL,
   'ABNT NBR 14653-2 — Avaliação de bens: Imóveis urbanos', 'NBR 14653-2',
   'TECHNICAL_STANDARD', 'ABNT — Associação Brasileira de Normas Técnicas', NULL, NULL,
   'BRAZIL', 'Brasil', 'pt-BR', 'NBR 14653-2', NULL, 'METADATA_ONLY',
   'PRIMARY_NORMATIVE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Edição/ano pendentes de confirmação. Sem conteúdo verificado.'),
  ('11111111-0000-4000-8000-000000000004', NULL,
   'International Valuation Standards (IVS)', 'IVS',
   'PROFESSIONAL_STANDARD', 'IVSC — International Valuation Standards Council', NULL, NULL,
   'INTERNATIONAL', 'Internacional', 'en', 'IVS', NULL, 'METADATA_ONLY',
   'PROFESSIONAL_STANDARD', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Edição/ano pendentes de confirmação. Sem conteúdo verificado.'),
  ('11111111-0000-4000-8000-000000000005', NULL,
   'Resolução COFECI nº 1.066/2007 — CNAI / PTAM', 'COFECI 1.066/2007',
   'REGULATION', 'COFECI — Conselho Federal de Corretores de Imóveis', NULL, 2007,
   'BRAZIL', 'Brasil', 'pt-BR', 'Resolução COFECI 1.066/2007', NULL, 'METADATA_ONLY',
   'PRIMARY_REGULATORY', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Texto integral não incorporado. Sem conteúdo verificado.'),
  ('11111111-0000-4000-8000-000000000006', NULL,
   'RICS — Responsible use of artificial intelligence in surveying practice', 'RICS AI',
   'PROFESSIONAL_GUIDANCE', 'RICS — Royal Institution of Chartered Surveyors', NULL, NULL,
   'INTERNATIONAL', 'Internacional', 'en', NULL, NULL, 'METADATA_ONLY',
   'AUTHORITATIVE_GUIDANCE', 'PENDING_METADATA_REVIEW',
   'Registro bibliográfico. Edição/ano pendentes de confirmação. Sem conteúdo verificado.')
ON CONFLICT (id) DO NOTHING;

-- ---------- 13. SEED — métodos (sem cálculo) ----------
INSERT INTO public.valuation_methods (id, organization_id, code, name, family_code, description, status)
VALUES
  ('22222222-0000-4000-8000-000000000001', NULL, 'DIRECT_MARKET_COMPARISON_FACTORS',
   'MCDDM — Tratamento por Fatores', 'MARKET_COMPARISON',
   'Registro do método. Nenhum fator, coeficiente ou limite foi definido: a especificação está em elaboração.',
   'SPECIFICATION_IN_PROGRESS'),
  ('22222222-0000-4000-8000-000000000002', NULL, 'DIRECT_MARKET_COMPARISON_STATISTICAL_INFERENCE',
   'MCDDM — Inferência Estatística', 'MARKET_COMPARISON',
   'Registro do método. Nenhum modelo, teste ou limiar estatístico foi definido: a especificação está em elaboração.',
   'SPECIFICATION_IN_PROGRESS'),
  ('22222222-0000-4000-8000-000000000003', NULL, 'INCOME_CAPITALIZATION',
   'Método da Renda (capitalização)', 'INCOME', 'Registro do método. Especificação não iniciada.', 'CONCEPT'),
  ('22222222-0000-4000-8000-000000000004', NULL, 'EVOLUTIONARY_METHOD',
   'Método Evolutivo', 'EVOLUTIVE', 'Registro do método. Especificação não iniciada.', 'CONCEPT'),
  ('22222222-0000-4000-8000-000000000005', NULL, 'INVOLUTIONARY_METHOD',
   'Método Involutivo', 'INVOLUTIVE', 'Registro do método. Especificação não iniciada.', 'CONCEPT'),
  ('22222222-0000-4000-8000-000000000006', NULL, 'AUTOMATED_VALUATION_MODEL',
   'AVM — Modelo Automatizado de Avaliação', 'AVM', 'Registro do método. Especificação não iniciada.', 'CONCEPT'),
  ('22222222-0000-4000-8000-000000000007', NULL, 'MULTI_METHOD_CONVERGENCE',
   'Convergência Multimetodológica', 'CONVERGENCE', 'Registro do método. Especificação não iniciada.', 'CONCEPT')
ON CONFLICT (id) DO NOTHING;

-- ---------- 14. SEED — shells de especificação (DRAFT, sem conteúdo metodológico) ----------
INSERT INTO public.method_specifications
  (id, organization_id, valuation_method_id, version, title, purpose, scope, jurisdiction, status)
VALUES
  ('33333333-0000-4000-8000-000000000001', NULL, '22222222-0000-4000-8000-000000000001',
   '0.1.0-draft', 'MCDDM — Tratamento por Fatores (esqueleto de especificação)',
   'Registrar, de forma rastreável, a especificação do método comparativo direto com tratamento por fatores. Nenhum fator, coeficiente ou limite existe nesta versão.',
   'Escopo a definir a partir de fontes normativas verificadas. NÃO PRONTO PARA IMPLEMENTAÇÃO.',
   'BRAZIL', 'DRAFT'),
  ('33333333-0000-4000-8000-000000000002', NULL, '22222222-0000-4000-8000-000000000002',
   '0.1.0-draft', 'MCDDM — Inferência Estatística (esqueleto de especificação)',
   'Registrar, de forma rastreável, a especificação do método comparativo direto por inferência estatística. Nenhum modelo, teste, limiar ou diagnóstico existe nesta versão.',
   'Escopo a definir a partir de fontes normativas verificadas. NÃO PRONTO PARA IMPLEMENTAÇÃO.',
   'BRAZIL', 'DRAFT')
ON CONFLICT (id) DO NOTHING;

-- checklists de fontes exigidas (todas pendentes)
INSERT INTO public.method_specification_source_requirements
  (organization_id, method_specification_id, requirement_code, description, is_satisfied, notes)
SELECT NULL, '33333333-0000-4000-8000-000000000001', code, descr, false, 'PENDENTE: fonte não verificada.'
FROM (VALUES
  ('01_APPLICABLE_NBR_SOURCE','Norma ABNT/NBR aplicável ao tratamento por fatores'),
  ('02_TECHNICAL_LITERATURE','Literatura técnica sobre tratamento por fatores'),
  ('03_FACTOR_PROVENANCE','Proveniência de cada fator adotado'),
  ('04_JURISDICTION_CONTEXT','Fontes de jurisdição/contexto aplicáveis'),
  ('05_DATA_REQUIREMENTS','Requisitos de dados e evidência'),
  ('06_FACTOR_APPLICABILITY','Condições de aplicabilidade de cada fator'),
  ('07_FACTOR_LIMITATIONS','Limitações declaradas do tratamento por fatores'),
  ('08_FORMULA_DEFINITIONS','Definições simbólicas das fórmulas com fonte'),
  ('09_TEST_REQUIREMENTS','Requisitos de teste e reprodutibilidade'),
  ('10_REPORTING_REQUIREMENTS','Requisitos de relato/laudo')
) AS t(code, descr)
ON CONFLICT DO NOTHING;

INSERT INTO public.method_specification_source_requirements
  (organization_id, method_specification_id, requirement_code, description, is_satisfied, notes)
SELECT NULL, '33333333-0000-4000-8000-000000000002', code, descr, false, 'PENDENTE: fonte não verificada.'
FROM (VALUES
  ('01_APPLICABLE_NBR_SOURCE','Norma ABNT/NBR aplicável à inferência estatística'),
  ('02_STATISTICAL_REFERENCES','Referências técnicas de inferência estatística'),
  ('03_MODEL_REQUIREMENTS','Requisitos do modelo de regressão'),
  ('04_DIAGNOSTICS','Diagnósticos exigidos'),
  ('05_ASSUMPTIONS','Pressupostos do modelo'),
  ('06_TRANSFORMATIONS','Transformações admitidas'),
  ('07_UNCERTAINTY','Tratamento de incerteza'),
  ('08_EXTRAPOLATION','Limites de extrapolação'),
  ('09_TEST_REQUIREMENTS','Requisitos de teste e reprodutibilidade'),
  ('10_REPORTING_COMPLIANCE','Requisitos de relato e conformidade')
) AS t(code, descr)
ON CONFLICT DO NOTHING;
