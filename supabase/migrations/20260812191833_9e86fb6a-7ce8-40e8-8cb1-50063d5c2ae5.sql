CREATE OR REPLACE FUNCTION public.specification_completeness(_spec_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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

  FOREACH v_key IN ARRAY v_required LOOP
    SELECT content INTO v_content FROM public.method_specification_sections
     WHERE method_specification_id = _spec_id AND section_key = v_key;
    IF coalesce(btrim(coalesce(v_content,'')),'') = '' THEN
      v_missing := v_missing || ('SECTION_' || v_key::text)::text;
    ELSE
      v_completed := v_completed || ('SECTION_' || v_key::text)::text;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.methodology_rules WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'RULES_REGISTERED'::text;
  ELSE
    v_completed := v_completed || 'RULES_REGISTERED'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.method_test_cases WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'TEST_CASES'::text;
  ELSE
    v_completed := v_completed || 'TEST_CASES'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.method_output_contracts WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'OUTPUT_CONTRACT'::text;
  ELSE
    v_completed := v_completed || 'OUTPUT_CONTRACT'::text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.method_applicability_rules WHERE method_specification_id = _spec_id) THEN
    v_missing := v_missing || 'APPLICABILITY_CRITERIA'::text;
  ELSE
    v_completed := v_completed || 'APPLICABILITY_CRITERIA'::text;
  END IF;

  FOR r IN SELECT requirement_code FROM public.method_specification_source_requirements
            WHERE method_specification_id = _spec_id AND is_satisfied = false
            ORDER BY requirement_code LOOP
    v_missing := v_missing || ('SOURCE_REQUIREMENT_' || r.requirement_code)::text;
  END LOOP;

  FOR r IN SELECT ru.rule_code, ru.normative_strength
             FROM public.methodology_rules ru
            WHERE ru.method_specification_id = _spec_id
              AND ru.normative_strength IN ('MANDATORY','PROHIBITED')
              AND NOT EXISTS (SELECT 1 FROM public.methodology_rule_sources rs
                               WHERE rs.rule_id = ru.id
                                 AND rs.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION'))
            ORDER BY ru.rule_code LOOP
    v_blockers := v_blockers || ('NORMATIVE_RULE_WITHOUT_DIRECT_SOURCE:' || r.rule_code)::text;
  END LOOP;

  FOR r IN SELECT ru.rule_code, rs.source_id, rs.source_locator_id, rs.relationship_type
             FROM public.methodology_rule_sources rs
             JOIN public.methodology_rules ru ON ru.id = rs.rule_id
            WHERE ru.method_specification_id = _spec_id
              AND rs.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION')
            ORDER BY ru.rule_code, rs.source_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                    WHERE v.source_id = r.source_id AND v.verification_type = 'CONTENT_VERIFIED') THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_CONTENT_VERIFICATION:' || r.rule_code)::text;
    END IF;
    IF r.source_locator_id IS NULL THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_LOCATOR:' || r.rule_code)::text;
    ELSIF NOT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                       WHERE v.locator_id = r.source_locator_id AND v.verification_type = 'LOCATOR_VERIFIED') THEN
      v_blockers := v_blockers || ('DIRECT_CLAIM_WITHOUT_LOCATOR_VERIFICATION:' || r.rule_code)::text;
    END IF;
  END LOOP;

  FOR r IN SELECT f.id, f.formula_code, f.expression, f.rule_id
             FROM public.methodology_formulas f
             JOIN public.methodology_rules ru ON ru.id = f.rule_id
            WHERE ru.method_specification_id = _spec_id
            ORDER BY f.formula_code LOOP

    IF NOT EXISTS (SELECT 1 FROM public.methodology_rule_sources rs WHERE rs.rule_id = r.rule_id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_PROVENANCE:' || r.formula_code)::text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.methodology_formula_variables fv WHERE fv.formula_id = r.id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_VARIABLES:' || r.formula_code)::text;
    END IF;

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
      v_blockers := v_blockers || ('FORMULA_UNKNOWN_VARIABLE:' || r.formula_code)::text;
    END IF;

    IF EXISTS (SELECT 1 FROM public.methodology_formula_variables fv
                WHERE fv.formula_id = r.id AND fv.unit_code IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM public.methodology_units u WHERE u.code = fv.unit_code)) THEN
      v_blockers := v_blockers || ('FORMULA_UNKNOWN_UNIT:' || r.formula_code)::text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.method_test_cases tc
                    WHERE tc.method_specification_id = _spec_id) THEN
      v_blockers := v_blockers || ('FORMULA_WITHOUT_TESTS:' || r.formula_code)::text;
    END IF;
  END LOOP;

  FOR r IN SELECT p.id, p.parameter_code, p.unit_code, p.source_required
             FROM public.methodology_parameters p
            WHERE p.method_specification_id = _spec_id
            ORDER BY p.parameter_code LOOP
    IF public.p_unit_unknown(r.unit_code) THEN
      v_blockers := v_blockers || ('PARAMETER_UNKNOWN_UNIT:' || r.parameter_code)::text;
    END IF;
    IF r.source_required AND NOT EXISTS (
        SELECT 1 FROM public.method_parameter_values pv
         WHERE pv.parameter_id = r.id AND pv.source_id IS NOT NULL) THEN
      v_blockers := v_blockers || ('VALUE_AFFECTING_PARAMETER_WITHOUT_PROVENANCE:' || r.parameter_code)::text;
    END IF;
  END LOOP;

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
    v_blockers := v_blockers || ('UNRESOLVED_CRITICAL_SOURCE_CONFLICT:' || r.id::text)::text;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.methodology_parameters WHERE method_specification_id = _spec_id) THEN
    v_warnings := v_warnings || 'NO_PARAMETERS_REGISTERED'::text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.methodology_formulas f
                  JOIN public.methodology_rules ru ON ru.id = f.rule_id
                 WHERE ru.method_specification_id = _spec_id) THEN
    v_warnings := v_warnings || 'NO_FORMULA_REGISTERED'::text;
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