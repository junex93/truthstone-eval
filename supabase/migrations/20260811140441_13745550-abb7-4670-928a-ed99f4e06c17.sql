-- 1) record_price_observation: lineage validation for evidence references
CREATE OR REPLACE FUNCTION public.record_price_observation(
  _observation_id uuid, _asking_price numeric, _asking_monthly_rent numeric,
  _observed_at timestamptz, _status public.market_observation_status,
  _evidence_source_id uuid, _evidence_field_id uuid, _notes text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.market_observations;
  v_id uuid;
  v_src_org uuid; v_src_case uuid;
  v_fld_org uuid; v_fld_case uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO o FROM public.market_observations WHERE id = _observation_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Observação de mercado não encontrada'; END IF;
  IF NOT public.can_write(o.organization_id) THEN
    RAISE EXCEPTION 'Permissão insuficiente para registrar preço observado';
  END IF;

  -- Evidence source lineage derived from the real row, never from the payload.
  IF _evidence_source_id IS NOT NULL THEN
    SELECT organization_id, valuation_case_id INTO v_src_org, v_src_case
    FROM public.evidence_sources WHERE id = _evidence_source_id;
    IF v_src_org IS NULL THEN
      RAISE EXCEPTION 'Fonte de evidência inexistente';
    END IF;
    IF v_src_org <> o.organization_id THEN
      RAISE EXCEPTION 'Contaminação cross-org bloqueada: a fonte de evidência pertence a outra organização';
    END IF;
    IF v_src_case IS NULL OR v_src_case <> o.valuation_case_id THEN
      RAISE EXCEPTION 'Contaminação cross-case bloqueada: a fonte de evidência pertence a outro caso';
    END IF;
  END IF;

  -- Evidence field lineage: field -> extraction -> artifact -> source -> org/case.
  IF _evidence_field_id IS NOT NULL THEN
    SELECT es.organization_id, es.valuation_case_id INTO v_fld_org, v_fld_case
    FROM public.evidence_fields ef
    JOIN public.evidence_extractions ex ON ex.id = ef.extraction_id
    JOIN public.evidence_artifacts ea ON ea.id = ex.artifact_id
    JOIN public.evidence_sources es ON es.id = ea.evidence_source_id
    WHERE ef.id = _evidence_field_id;
    IF v_fld_org IS NULL THEN
      RAISE EXCEPTION 'Campo de evidência inexistente ou sem linhagem completa';
    END IF;
    IF v_fld_org <> o.organization_id THEN
      RAISE EXCEPTION 'Contaminação cross-org bloqueada: o campo de evidência pertence a outra organização';
    END IF;
    IF v_fld_case IS NULL OR v_fld_case <> o.valuation_case_id THEN
      RAISE EXCEPTION 'Contaminação cross-case bloqueada: o campo de evidência pertence a outro caso';
    END IF;
  END IF;

  INSERT INTO public.market_observation_price_history (
    organization_id, valuation_case_id, market_observation_id, observed_at, currency_code,
    asking_price, asking_monthly_rent, observation_status, evidence_source_id,
    evidence_field_id, notes, created_by)
  VALUES (o.organization_id, o.valuation_case_id, o.id, coalesce(_observed_at, now()),
          o.currency_code, _asking_price, _asking_monthly_rent, _status, _evidence_source_id,
          _evidence_field_id, _notes, auth.uid())
  RETURNING id INTO v_id;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.market_observations
  SET asking_price = coalesce(_asking_price, asking_price),
      asking_monthly_rent = coalesce(_asking_monthly_rent, asking_monthly_rent),
      status = coalesce(_status, status),
      last_seen_at = greatest(coalesce(last_seen_at, coalesce(_observed_at, now())), coalesce(_observed_at, now()))
  WHERE id = o.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(o.organization_id, o.valuation_case_id,
    'PRICE_OBSERVATION_ADDED', 'market_observation_price_history', v_id, NULL,
    jsonb_build_object('asking_price', _asking_price, 'asking_monthly_rent', _asking_monthly_rent,
                       'status', _status, 'evidence_field_id', _evidence_field_id,
                       'evidence_source_id', _evidence_source_id), NULL);
  RETURN v_id;
END; $function$;

-- 2) Least privilege on append-only / RPC-only phase 3 tables
REVOKE INSERT, UPDATE, DELETE ON public.comparable_decision_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.property_canonical_facts FROM authenticated;
REVOKE UPDATE, DELETE ON public.property_attribute_observations FROM authenticated;
REVOKE UPDATE, DELETE ON public.market_observation_price_history FROM authenticated;
REVOKE UPDATE, DELETE ON public.property_match_candidates FROM authenticated;
REVOKE UPDATE, DELETE ON public.comparable_candidates FROM authenticated;
REVOKE UPDATE, DELETE ON public.derived_values FROM authenticated;
REVOKE DELETE ON public.market_source_quality_assessments FROM authenticated;
REVOKE DELETE ON public.market_observations FROM authenticated;
REVOKE DELETE ON public.market_properties FROM authenticated;
REVOKE DELETE ON public.developments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comparable_exclusion_reasons FROM authenticated;