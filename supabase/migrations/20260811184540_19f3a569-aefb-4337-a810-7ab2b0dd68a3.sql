/* ============================================================ helpers === */
CREATE OR REPLACE FUNCTION public.market_source_domain(_url text, _portal text, _publisher text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(
    nullif(lower(regexp_replace(coalesce(_url,''), '^[a-z]+://(?:www\.)?([^/:?#]+).*$', '\1')), ''),
    nullif(btrim(coalesce(_portal,'')), ''),
    nullif(btrim(coalesce(_publisher,'')), ''),
    'DESCONHECIDO')
  WHERE true;
$$;

CREATE OR REPLACE FUNCTION public.market_universe_metrics(_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; m jsonb; v_obs int; v_props int; v_clusters int; v_clustered int;
  v_top_domain text; v_top_domain_count int; v_top_dev_count int;
BEGIN
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.is_org_member(v_org) THEN RAISE EXCEPTION 'Caso fora do escopo da organização'; END IF;

  SELECT count(*) INTO v_obs FROM public.market_observations WHERE valuation_case_id = _case_id;
  SELECT count(*) INTO v_props FROM public.market_properties WHERE valuation_case_id = _case_id;
  SELECT count(*) INTO v_clusters FROM public.market_identity_clusters WHERE valuation_case_id = _case_id;
  SELECT count(*) INTO v_clustered FROM public.market_identity_cluster_members WHERE valuation_case_id = _case_id;

  SELECT d.domain, d.n INTO v_top_domain, v_top_domain_count
  FROM (SELECT public.market_source_domain(o.listing_url, o.portal_name, o.publisher_name) AS domain,
               count(*) AS n
        FROM public.market_observations o WHERE o.valuation_case_id = _case_id
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1) d;

  SELECT max(n) INTO v_top_dev_count FROM (
    SELECT count(*) AS n FROM public.market_properties p
    WHERE p.valuation_case_id = _case_id AND p.development_id IS NOT NULL
    GROUP BY p.development_id) x;

  m := jsonb_build_object(
    'valuation_case_id', _case_id,
    'observation_count', v_obs,
    'market_property_count', v_props,
    'identity_cluster_count', v_clusters,
    'clustered_property_count', v_clustered,
    'independent_property_count', (v_props - v_clustered) + v_clusters,
    'subject_property_count',
      (SELECT count(*) FROM public.properties WHERE valuation_case_id = _case_id),
    'source_count',
      (SELECT count(DISTINCT o.evidence_source_id) FROM public.market_observations o
        WHERE o.valuation_case_id = _case_id AND o.evidence_source_id IS NOT NULL),
    'domain_count',
      (SELECT count(DISTINCT public.market_source_domain(o.listing_url, o.portal_name, o.publisher_name))
         FROM public.market_observations o WHERE o.valuation_case_id = _case_id),
    'development_count',
      (SELECT count(*) FROM public.developments WHERE valuation_case_id = _case_id),
    'top_domain', v_top_domain,
    'top_domain_observation_count', coalesce(v_top_domain_count, 0),
    'top_development_property_count', coalesce(v_top_dev_count, 0),
    'sale_listing_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type = 'SALE_LISTING'),
    'rent_listing_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type = 'RENT_LISTING'),
    'closed_sale_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type = 'CLOSED_SALE'),
    'closed_rent_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type = 'CLOSED_RENT'),
    'broker_quote_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type = 'BROKER_QUOTE'),
    'other_observation_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id
         AND observation_type NOT IN ('SALE_LISTING','RENT_LISTING','CLOSED_SALE','CLOSED_RENT','BROKER_QUOTE')),
    'asking_listing_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type IN ('SALE_LISTING','RENT_LISTING')),
    'verified_transaction_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type IN ('CLOSED_SALE','CLOSED_RENT')
         AND transaction_evidence_status IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')),
    'declared_transaction_count', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND observation_type IN ('CLOSED_SALE','CLOSED_RENT')
         AND coalesce(transaction_evidence_status::text,'UNVERIFIED') NOT IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')),
    'observations_with_verified_evidence', (
       SELECT count(DISTINCT o.id) FROM public.market_observations o
       JOIN public.evidence_artifacts a ON a.evidence_source_id = o.evidence_source_id
       JOIN public.evidence_extractions e ON e.artifact_id = a.id
       JOIN public.evidence_fields f ON f.extraction_id = e.id AND f.validation_status = 'VERIFIED'
       WHERE o.valuation_case_id = _case_id),
    'observations_without_source', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND evidence_source_id IS NULL),
    'observations_without_artifact', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id AND primary_artifact_id IS NULL),
    'observations_without_date', (SELECT count(*) FROM public.market_observations
       WHERE valuation_case_id = _case_id
         AND observation_date IS NULL AND publication_date IS NULL AND transaction_date IS NULL),
    'properties_without_geo', (SELECT count(*) FROM public.market_properties
       WHERE valuation_case_id = _case_id AND geo_point IS NULL),
    'properties_without_private_area', (SELECT count(*) FROM public.market_properties
       WHERE valuation_case_id = _case_id AND private_area IS NULL),
    'unresolved_duplicate_count', (SELECT count(*) FROM public.property_match_candidates
       WHERE valuation_case_id = _case_id AND match_status IN ('CANDIDATE','UNRESOLVED')),
    'confirmed_duplicate_pair_count', (SELECT count(*) FROM public.property_match_candidates
       WHERE valuation_case_id = _case_id AND match_status = 'CONFIRMED_SAME'),
    'attribute_conflict_count', (SELECT count(*) FROM public.property_attribute_observations
       WHERE valuation_case_id = _case_id AND knowledge_state = 'CONFLICTING'),
    'comparable_candidate_count', (SELECT count(*) FROM public.comparable_candidates
       WHERE valuation_case_id = _case_id),
    'comparable_eligible_count', (SELECT count(*) FROM public.comparable_candidates
       WHERE valuation_case_id = _case_id AND candidate_status = 'ELIGIBLE'),
    'comparable_included_count', (SELECT count(*) FROM public.comparable_candidates
       WHERE valuation_case_id = _case_id AND inclusion_status = 'INCLUDED'),
    'comparable_excluded_count', (SELECT count(*) FROM public.comparable_candidates
       WHERE valuation_case_id = _case_id AND inclusion_status = 'EXCLUDED'),
    'search_result_count', (SELECT count(*) FROM public.research_search_results
       WHERE valuation_case_id = _case_id),
    'captured_source_count', (SELECT count(*) FROM public.research_search_results
       WHERE valuation_case_id = _case_id AND capture_status = 'CAPTURED'),
    'extracted_candidate_count', (SELECT count(*) FROM public.research_entity_candidates
       WHERE valuation_case_id = _case_id AND status IN ('EXTRACTED','REVIEW_REQUIRED','READY_TO_PROMOTE','PROMOTED')),
    'promoted_candidate_count', (SELECT count(*) FROM public.research_entity_candidates
       WHERE valuation_case_id = _case_id AND status = 'PROMOTED'),
    'latest_observation_date', (SELECT max(coalesce(transaction_date, observation_date, publication_date))
       FROM public.market_observations WHERE valuation_case_id = _case_id),
    'oldest_observation_date', (SELECT min(coalesce(transaction_date, observation_date, publication_date))
       FROM public.market_observations WHERE valuation_case_id = _case_id),
    'latest_capture_at', (SELECT max(created_at) FROM public.evidence_artifacts a
       JOIN public.evidence_sources s ON s.id = a.evidence_source_id
       WHERE s.valuation_case_id = _case_id)
  );
  RETURN m;
END; $$;

/* ================================================ market evidence snapshot */
CREATE OR REPLACE FUNCTION public.create_market_evidence_snapshot(_case_id uuid, _description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_version int; v_metrics jsonb; v_manifest jsonb; v_hash text; v_id uuid;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_write(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente para registrar o universo de mercado'; END IF;

  v_metrics := public.market_universe_metrics(_case_id);
  SELECT coalesce(max(version_number), 0) + 1 INTO v_version
    FROM public.market_evidence_snapshots WHERE valuation_case_id = _case_id;

  v_manifest := jsonb_build_object(
    'manifest_schema_version', 'valuation.market.evidence.snapshot/1',
    'hash_algorithm', 'SHA-256',
    'organization_id', v_org,
    'valuation_case_id', _case_id,
    'version_number', v_version,
    'created_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'created_by', auth.uid(),
    'metrics', v_metrics,
    'identity_clusters', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'cluster_id', c.id,
        'representative_market_property_id', c.representative_market_property_id,
        'members', (SELECT jsonb_agg(mm.market_property_id ORDER BY mm.market_property_id)
                      FROM public.market_identity_cluster_members mm WHERE mm.cluster_id = c.id)
      ) ORDER BY c.id) FROM public.market_identity_clusters c
      WHERE c.valuation_case_id = _case_id), '[]'::jsonb),
    'market_properties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'market_property_id', p.id, 'label', p.label, 'property_type_code', p.property_type_code,
        'district', p.district, 'development_id', p.development_id,
        'private_area', p.private_area, 'bedrooms', p.bedrooms, 'parking_spaces', p.parking_spaces,
        'latitude', p.latitude, 'longitude', p.longitude
      ) ORDER BY p.id) FROM public.market_properties p WHERE p.valuation_case_id = _case_id), '[]'::jsonb),
    'market_observations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'market_observation_id', o.id, 'market_property_id', o.market_property_id,
        'observation_type', o.observation_type, 'status', o.status,
        'asking_price', o.asking_price, 'transaction_price', o.transaction_price,
        'asking_monthly_rent', o.asking_monthly_rent, 'contracted_monthly_rent', o.contracted_monthly_rent,
        'observation_date', o.observation_date, 'publication_date', o.publication_date,
        'transaction_date', o.transaction_date,
        'transaction_evidence_status', o.transaction_evidence_status,
        'domain', public.market_source_domain(o.listing_url, o.portal_name, o.publisher_name),
        'evidence_source_id', o.evidence_source_id, 'primary_artifact_id', o.primary_artifact_id,
        'price_history', (SELECT jsonb_agg(jsonb_build_object(
             'observed_at', to_char(h.observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'asking_price', h.asking_price, 'asking_monthly_rent', h.asking_monthly_rent,
             'observation_status', h.observation_status) ORDER BY h.observed_at)
           FROM public.market_observation_price_history h WHERE h.market_observation_id = o.id)
      ) ORDER BY o.id) FROM public.market_observations o WHERE o.valuation_case_id = _case_id), '[]'::jsonb),
    'canonical_facts', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'fact_id', f.id, 'market_property_id', f.market_property_id,
        'subject_property_id', f.subject_property_id, 'attribute_name', f.attribute_name,
        'adopted_value', f.adopted_value, 'adopted_numeric_value', f.adopted_numeric_value
      ) ORDER BY f.id) FROM public.property_canonical_facts f
      WHERE f.valuation_case_id = _case_id AND f.superseded_at IS NULL), '[]'::jsonb)
  );

  v_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.market_evidence_snapshots (
    organization_id, valuation_case_id, version_number, description,
    observation_count, independent_property_count, market_property_count,
    identity_cluster_count, source_count, domain_count,
    snapshot_manifest, snapshot_hash, hash_algorithm, schema_version, created_by, created_at)
  VALUES (v_org, _case_id, v_version, nullif(btrim(coalesce(_description,'')), ''),
    (v_metrics->>'observation_count')::int, (v_metrics->>'independent_property_count')::int,
    (v_metrics->>'market_property_count')::int, (v_metrics->>'identity_cluster_count')::int,
    (v_metrics->>'source_count')::int, (v_metrics->>'domain_count')::int,
    v_manifest, v_hash, 'SHA-256', 'valuation.market.evidence.snapshot/1', auth.uid(), v_now)
  RETURNING id INTO v_id;

  PERFORM public.audit_write_internal(v_org, _case_id, 'MARKET_EVIDENCE_SNAPSHOT_CREATED',
    'market_evidence_snapshot', v_id, NULL,
    jsonb_build_object('version_number', v_version, 'snapshot_hash', v_hash), v_metrics);
  RETURN v_id;
END; $$;

/* ==================================================== identity clusters == */
CREATE OR REPLACE FUNCTION public.confirm_market_identity_cluster(
  _case_id uuid, _market_property_ids uuid[], _representative_market_property_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_cluster uuid; pid uuid; v_first uuid; v_match uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_review(v_org) THEN
    RAISE EXCEPTION 'Identidade física só é confirmada por papel de revisão';
  END IF;
  IF array_length(_market_property_ids, 1) IS NULL OR array_length(_market_property_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Um cluster de identidade exige ao menos dois registros';
  END IF;
  IF nullif(btrim(coalesce(_reason,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Confirmação de identidade exige justificativa técnica';
  END IF;
  IF NOT (_representative_market_property_id = ANY(_market_property_ids)) THEN
    RAISE EXCEPTION 'O representante deve ser um dos membros do cluster';
  END IF;

  FOREACH pid IN ARRAY _market_property_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.market_properties
                   WHERE id = pid AND valuation_case_id = _case_id AND organization_id = v_org) THEN
      RAISE EXCEPTION 'Imóvel de mercado % não pertence a este caso', pid;
    END IF;
    IF EXISTS (SELECT 1 FROM public.market_identity_cluster_members
               WHERE valuation_case_id = _case_id AND market_property_id = pid) THEN
      RAISE EXCEPTION 'Imóvel de mercado % já pertence a um cluster de identidade', pid;
    END IF;
  END LOOP;

  v_first := _market_property_ids[1];
  FOREACH pid IN ARRAY _market_property_ids LOOP
    CONTINUE WHEN pid = v_first;
    SELECT id INTO v_match FROM public.property_match_candidates
     WHERE valuation_case_id = _case_id AND match_status = 'CONFIRMED_SAME'
       AND ((left_market_property_id = v_first AND right_market_property_id = pid)
         OR (left_market_property_id = pid AND right_market_property_id = v_first)
         OR left_market_property_id = ANY(_market_property_ids) AND right_market_property_id = pid
         OR left_market_property_id = pid AND right_market_property_id = ANY(_market_property_ids))
     LIMIT 1;
    IF v_match IS NULL THEN
      RAISE EXCEPTION 'Sem decisão humana CONFIRMED_SAME ligando o imóvel % ao cluster', pid;
    END IF;
  END LOOP;

  PERFORM set_config('valuation.privileged_op', 'on', true);

  INSERT INTO public.market_identity_clusters (
    organization_id, valuation_case_id, representative_market_property_id,
    confirmation_reason, confirmed_by)
  VALUES (v_org, _case_id, _representative_market_property_id, btrim(_reason), auth.uid())
  RETURNING id INTO v_cluster;

  FOREACH pid IN ARRAY _market_property_ids LOOP
    SELECT id INTO v_match FROM public.property_match_candidates
     WHERE valuation_case_id = _case_id AND match_status = 'CONFIRMED_SAME'
       AND (left_market_property_id = pid OR right_market_property_id = pid) LIMIT 1;
    INSERT INTO public.market_identity_cluster_members (
      organization_id, valuation_case_id, cluster_id, market_property_id,
      source_match_candidate_id, added_by)
    VALUES (v_org, _case_id, v_cluster, pid, v_match, auth.uid());
  END LOOP;

  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(v_org, _case_id, 'MARKET_IDENTITY_CLUSTER_CONFIRMED',
    'market_identity_cluster', v_cluster, NULL,
    jsonb_build_object('members', to_jsonb(_market_property_ids),
                       'representative', _representative_market_property_id),
    jsonb_build_object('reason', btrim(_reason)));
  RETURN v_cluster;
END; $$;

/* ============================================ comparable feature snapshot */
CREATE OR REPLACE FUNCTION public.build_comparable_feature_snapshot(_candidate_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.comparable_candidates; s public.properties; p public.market_properties;
  o public.market_observations; v_case public.valuation_cases;
  v_features jsonb; v_id uuid; v_distance numeric; v_ref_date date; v_age int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO c FROM public.comparable_candidates WHERE id = _candidate_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Candidato a comparável não encontrado'; END IF;
  IF NOT public.can_write(c.organization_id) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;

  SELECT * INTO v_case FROM public.valuation_cases WHERE id = c.valuation_case_id;
  SELECT * INTO s FROM public.properties WHERE id = c.subject_property_id;
  SELECT * INTO p FROM public.market_properties WHERE id = c.market_property_id;
  SELECT * INTO o FROM public.market_observations WHERE id = c.market_observation_id;
  IF s.id IS NULL OR p.id IS NULL OR o.id IS NULL THEN
    RAISE EXCEPTION 'Linhagem incompleta: avaliando, imóvel de mercado e observação são obrigatórios';
  END IF;
  IF s.valuation_case_id <> c.valuation_case_id OR p.valuation_case_id <> c.valuation_case_id
     OR o.valuation_case_id <> c.valuation_case_id THEN
    RAISE EXCEPTION 'Contaminação cross-case detectada no cálculo de características';
  END IF;

  v_distance := public.distance_subject_to_market_property_meters(s.id, p.id);
  v_ref_date := coalesce(o.transaction_date, o.observation_date, o.publication_date);
  IF v_ref_date IS NOT NULL AND v_case.valuation_date IS NOT NULL THEN
    v_age := v_case.valuation_date - v_ref_date;
  ELSE
    v_age := NULL;
  END IF;

  -- Factual differences only. No weight, no factor, no adjustment.
  v_features := jsonb_build_object(
    'subject_private_area', s.private_area,
    'reference_private_area', p.private_area,
    'private_area_delta_m2', CASE WHEN s.private_area IS NOT NULL AND p.private_area IS NOT NULL
       THEN p.private_area - s.private_area END,
    'private_area_ratio', CASE WHEN s.private_area IS NOT NULL AND p.private_area IS NOT NULL
       AND s.private_area <> 0 THEN round(p.private_area / s.private_area, 6) END,
    'subject_bedrooms', s.bedrooms, 'reference_bedrooms', p.bedrooms,
    'bedroom_delta', CASE WHEN s.bedrooms IS NOT NULL AND p.bedrooms IS NOT NULL
       THEN p.bedrooms - s.bedrooms END,
    'subject_parking_spaces', s.parking_spaces, 'reference_parking_spaces', p.parking_spaces,
    'parking_delta', CASE WHEN s.parking_spaces IS NOT NULL AND p.parking_spaces IS NOT NULL
       THEN p.parking_spaces - s.parking_spaces END,
    'floor_delta', CASE WHEN s.floor_number IS NOT NULL AND p.floor_number IS NOT NULL
       THEN p.floor_number - s.floor_number END,
    'construction_year_delta', CASE WHEN s.construction_year IS NOT NULL AND p.construction_year IS NOT NULL
       THEN p.construction_year - s.construction_year END,
    'distance_meters', v_distance,
    'same_development', CASE WHEN s.development_id IS NULL OR p.development_id IS NULL THEN NULL
       ELSE s.development_id = p.development_id END,
    'same_district', CASE WHEN nullif(btrim(coalesce(s.district,'')),'') IS NULL
       OR nullif(btrim(coalesce(p.district,'')),'') IS NULL THEN NULL
       ELSE lower(btrim(s.district)) = lower(btrim(p.district)) END,
    'same_property_type', CASE WHEN s.property_type_code IS NULL OR p.property_type_code IS NULL THEN NULL
       ELSE s.property_type_code = p.property_type_code END,
    'observation_age_days', v_age,
    'observation_type', o.observation_type,
    'asking_price', o.asking_price,
    'transaction_price', o.transaction_price,
    'asking_price_per_m2', CASE WHEN o.asking_price IS NOT NULL AND p.private_area IS NOT NULL
       AND p.private_area <> 0 THEN round(o.asking_price / p.private_area, 2) END,
    'transaction_price_per_m2', CASE WHEN o.transaction_price IS NOT NULL AND p.private_area IS NOT NULL
       AND p.private_area <> 0 THEN round(o.transaction_price / p.private_area, 2) END,
    'semantics', 'FACTUAL_DIFFERENCE_ONLY_NOT_AN_ADJUSTMENT');

  PERFORM set_config('valuation.privileged_op', 'on', true);
  INSERT INTO public.comparable_feature_snapshots (
    organization_id, valuation_case_id, comparable_candidate_id, subject_property_id,
    market_property_id, market_observation_id, derivation_version, features,
    input_references, created_by)
  VALUES (c.organization_id, c.valuation_case_id, c.id, s.id, p.id, o.id,
    'valuation.comparable.features/1', v_features,
    jsonb_build_object('subject_property_id', s.id, 'market_property_id', p.id,
      'market_observation_id', o.id, 'valuation_date', v_case.valuation_date,
      'reference_date', v_ref_date, 'geo_source', 'POSTGIS'),
    auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  RETURN v_id;
END; $$;

/* ==================================================== sample selection === */
CREATE OR REPLACE FUNCTION public.start_sample_selection(
  _case_id uuid, _market_evidence_snapshot_id uuid, _purpose text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_run uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_write(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente para iniciar seleção'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.market_evidence_snapshots
                 WHERE id = _market_evidence_snapshot_id AND valuation_case_id = _case_id) THEN
    RAISE EXCEPTION 'Retrato do universo de mercado não pertence a este caso';
  END IF;
  IF nullif(btrim(coalesce(_purpose,'')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe a finalidade da seleção';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sample_selection_runs
             WHERE valuation_case_id = _case_id AND status = 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'Já existe um processo de seleção em andamento neste caso';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  INSERT INTO public.sample_selection_runs (
    organization_id, valuation_case_id, market_evidence_snapshot_id, purpose, notes, created_by)
  VALUES (v_org, _case_id, _market_evidence_snapshot_id, btrim(_purpose),
          nullif(btrim(coalesce(_notes,'')), ''), auth.uid())
  RETURNING id INTO v_run;

  INSERT INTO public.sample_selection_items (
    organization_id, valuation_case_id, selection_run_id, comparable_candidate_id,
    market_property_id, market_observation_id)
  SELECT v_org, _case_id, v_run, cc.id, cc.market_property_id, cc.market_observation_id
  FROM public.comparable_candidates cc
  WHERE cc.valuation_case_id = _case_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(v_org, _case_id, 'SAMPLE_SELECTION_STARTED',
    'sample_selection_run', v_run, NULL,
    jsonb_build_object('purpose', btrim(_purpose),
                       'market_evidence_snapshot_id', _market_evidence_snapshot_id), NULL);
  RETURN v_run;
END; $$;

CREATE OR REPLACE FUNCTION public.decide_sample_selection_item(
  _run_id uuid, _market_observation_id uuid, _final_state public.sample_selection_state,
  _reason_code text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.sample_selection_runs; it public.sample_selection_items;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO r FROM public.sample_selection_runs WHERE id = _run_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Processo de seleção não encontrado'; END IF;
  IF NOT public.can_write(r.organization_id) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;
  IF r.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Processo de seleção já encerrado'; END IF;

  SELECT * INTO it FROM public.sample_selection_items
   WHERE selection_run_id = _run_id AND market_observation_id = _market_observation_id FOR UPDATE;
  IF it.id IS NULL THEN RAISE EXCEPTION 'Observação não faz parte deste processo de seleção'; END IF;

  IF _final_state = 'EXCLUDED' THEN
    IF _reason_code IS NULL THEN RAISE EXCEPTION 'A exclusão exige código de motivo'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.comparable_exclusion_reasons
                   WHERE code = _reason_code AND is_active) THEN
      RAISE EXCEPTION 'Código de exclusão inválido: %', _reason_code;
    END IF;
    IF _reason_code = 'OTHER' AND nullif(btrim(coalesce(_reason,'')), '') IS NULL THEN
      RAISE EXCEPTION 'O motivo "Outro" exige descrição textual';
    END IF;
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.sample_selection_items
     SET final_state = _final_state,
         reason_code = CASE WHEN _final_state = 'EXCLUDED' THEN _reason_code ELSE reason_code END,
         reason = nullif(btrim(coalesce(_reason,'')), ''),
         actor_user_id = auth.uid(), decided_at = now()
   WHERE id = it.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);
  RETURN it.id;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_sample_selection(_run_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.sample_selection_runs; v_selected int; v_excluded int; v_version int;
  v_manifest jsonb; v_hash text; v_id uuid; v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO r FROM public.sample_selection_runs WHERE id = _run_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Processo de seleção não encontrado'; END IF;
  IF NOT public.can_write(r.organization_id) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;
  IF r.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Processo de seleção já encerrado'; END IF;

  SELECT count(*) FILTER (WHERE final_state = 'SELECTED'),
         count(*) FILTER (WHERE final_state = 'EXCLUDED')
    INTO v_selected, v_excluded
    FROM public.sample_selection_items WHERE selection_run_id = _run_id;
  IF v_selected = 0 THEN RAISE EXCEPTION 'Nenhum elemento selecionado: a amostra está vazia'; END IF;
  IF EXISTS (SELECT 1 FROM public.sample_selection_items i
             JOIN public.market_observations o ON o.id = i.market_observation_id
             WHERE i.selection_run_id = _run_id AND o.valuation_case_id <> r.valuation_case_id) THEN
    RAISE EXCEPTION 'Contaminação cross-case detectada na seleção';
  END IF;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_version
    FROM public.sample_selection_snapshots WHERE valuation_case_id = r.valuation_case_id;

  v_manifest := jsonb_build_object(
    'manifest_schema_version', 'valuation.market.sample.selection/1',
    'hash_algorithm', 'SHA-256',
    'organization_id', r.organization_id,
    'valuation_case_id', r.valuation_case_id,
    'selection_run_id', r.id,
    'market_evidence_snapshot_id', r.market_evidence_snapshot_id,
    'selection_policy_version', r.selection_policy_version,
    'feature_derivation_version', 'valuation.comparable.features/1',
    'version_number', v_version,
    'purpose', r.purpose,
    'completed_at', to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'completed_by', auth.uid(),
    'subject_property_ids', coalesce((SELECT jsonb_agg(id ORDER BY id) FROM public.properties
       WHERE valuation_case_id = r.valuation_case_id), '[]'::jsonb),
    'selected_count', v_selected,
    'excluded_count', v_excluded,
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'market_observation_id', i.market_observation_id,
        'market_property_id', i.market_property_id,
        'comparable_candidate_id', i.comparable_candidate_id,
        'final_state', i.final_state, 'reason_code', i.reason_code, 'reason', i.reason,
        'actor_user_id', i.actor_user_id,
        'decided_at', to_char(i.decided_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'evidence_source_id', o.evidence_source_id,
        'primary_artifact_id', o.primary_artifact_id,
        'feature_snapshot_ids', (SELECT jsonb_agg(fs.id ORDER BY fs.calculated_at)
           FROM public.comparable_feature_snapshots fs
           WHERE fs.comparable_candidate_id = i.comparable_candidate_id)
      ) ORDER BY i.market_observation_id)
      FROM public.sample_selection_items i
      JOIN public.market_observations o ON o.id = i.market_observation_id
      WHERE i.selection_run_id = r.id), '[]'::jsonb));

  v_hash := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  PERFORM set_config('valuation.privileged_op', 'on', true);
  INSERT INTO public.sample_selection_snapshots (
    organization_id, valuation_case_id, selection_run_id, market_evidence_snapshot_id,
    version_number, selected_count, excluded_count, feature_derivation_version,
    snapshot_manifest, snapshot_hash, hash_algorithm, schema_version, created_by, created_at)
  VALUES (r.organization_id, r.valuation_case_id, r.id, r.market_evidence_snapshot_id,
    v_version, v_selected, v_excluded, 'valuation.comparable.features/1',
    v_manifest, v_hash, 'SHA-256', 'valuation.market.sample.selection/1', auth.uid(), v_now)
  RETURNING id INTO v_id;

  UPDATE public.sample_selection_runs
     SET status = 'COMPLETED', completed_at = v_now, completed_by = auth.uid(),
         notes = coalesce(nullif(btrim(coalesce(_notes,'')), ''), notes)
   WHERE id = r.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(r.organization_id, r.valuation_case_id,
    'SAMPLE_SELECTION_SNAPSHOT_CREATED', 'sample_selection_snapshot', v_id, NULL,
    jsonb_build_object('selected_count', v_selected, 'excluded_count', v_excluded,
                       'snapshot_hash', v_hash), NULL);
  RETURN v_id;
END; $$;

/* ==================================================== market data issues = */
CREATE OR REPLACE FUNCTION public.refresh_market_data_issues(_case_id uuid, _policy_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; pol public.market_diagnostic_policies; v_metrics jsonb;
  v_opened int := 0; v_resolved int := 0; v_rule text; rec record;
  v_src_pct numeric; v_dev_pct numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_write(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;

  IF _policy_id IS NULL THEN
    SELECT * INTO pol FROM public.market_diagnostic_policies
     WHERE status = 'ACTIVE' AND (organization_id = v_org OR organization_id IS NULL)
     ORDER BY organization_id NULLS LAST, created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO pol FROM public.market_diagnostic_policies WHERE id = _policy_id;
  END IF;
  IF pol.id IS NULL THEN RAISE EXCEPTION 'Política diagnóstica não encontrada'; END IF;
  v_rule := pol.version;
  v_metrics := public.market_universe_metrics(_case_id);

  PERFORM set_config('valuation.privileged_op', 'on', true);

  -- per-entity deterministic issues
  FOR rec IN
    SELECT 'MISSING_GEO'::public.market_data_issue_type AS t, 'market_property' AS et, p.id AS eid,
           'Imóvel de mercado sem coordenada geográfica.' AS d, 'INFO'::public.market_data_issue_severity AS sev
      FROM public.market_properties p
     WHERE p.valuation_case_id = _case_id AND p.geo_point IS NULL
    UNION ALL
    SELECT 'MISSING_CRITICAL_FIELD', 'market_property', p.id,
           'Imóvel de mercado sem área privativa conhecida.', 'WARNING'
      FROM public.market_properties p
     WHERE p.valuation_case_id = _case_id AND p.private_area IS NULL
    UNION ALL
    SELECT 'MISSING_DATE', 'market_observation', o.id,
           'Observação sem data de observação, publicação ou transação.', 'WARNING'
      FROM public.market_observations o
     WHERE o.valuation_case_id = _case_id AND o.observation_date IS NULL
       AND o.publication_date IS NULL AND o.transaction_date IS NULL
    UNION ALL
    SELECT 'BROKEN_LINEAGE', 'market_observation', o.id,
           'Observação de mercado sem fonte de evidência vinculada.', 'BLOCKER'
      FROM public.market_observations o
     WHERE o.valuation_case_id = _case_id AND o.evidence_source_id IS NULL
    UNION ALL
    SELECT 'UNVERIFIED_TRANSACTION', 'market_observation', o.id,
           'Transação declarada sem documentação verificada.', 'WARNING'
      FROM public.market_observations o
     WHERE o.valuation_case_id = _case_id AND o.observation_type IN ('CLOSED_SALE','CLOSED_RENT')
       AND coalesce(o.transaction_evidence_status::text, 'UNVERIFIED')
           NOT IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')
    UNION ALL
    SELECT 'UNRESOLVED_DUPLICATE', 'property_match_candidate', mc.id,
           'Possível duplicidade sem decisão humana.', 'WARNING'
      FROM public.property_match_candidates mc
     WHERE mc.valuation_case_id = _case_id AND mc.match_status IN ('CANDIDATE','UNRESOLVED')
    UNION ALL
    SELECT 'CONFLICTING_ATTRIBUTE', 'property_attribute_observation', ao.id,
           'Atributo divergente entre observações, sem adoção humana.', 'WARNING'
      FROM public.property_attribute_observations ao
     WHERE ao.valuation_case_id = _case_id AND ao.knowledge_state = 'CONFLICTING'
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.market_data_issues
                   WHERE valuation_case_id = _case_id AND issue_type = rec.t
                     AND entity_id = rec.eid AND status IN ('OPEN','ACKNOWLEDGED')) THEN
      INSERT INTO public.market_data_issues (organization_id, valuation_case_id, issue_type,
        severity, entity_type, entity_id, detail, facts, rule_version)
      VALUES (v_org, _case_id, rec.t, rec.sev, rec.et, rec.eid, rec.d, NULL, v_rule);
      v_opened := v_opened + 1;
    END IF;
  END LOOP;

  -- case-level concentration issues (threshold comes from the versioned policy)
  IF (v_metrics->>'observation_count')::int > 0 THEN
    v_src_pct := round(100.0 * (v_metrics->>'top_domain_observation_count')::numeric
                       / (v_metrics->>'observation_count')::numeric, 2);
    IF v_src_pct >= (pol.configuration->>'source_concentration_warning_pct')::numeric THEN
      IF NOT EXISTS (SELECT 1 FROM public.market_data_issues WHERE valuation_case_id = _case_id
                     AND issue_type = 'SOURCE_CONCENTRATION' AND entity_id IS NULL
                     AND status IN ('OPEN','ACKNOWLEDGED')) THEN
        INSERT INTO public.market_data_issues (organization_id, valuation_case_id, issue_type,
          severity, entity_type, entity_id, detail, facts, rule_version)
        VALUES (v_org, _case_id, 'SOURCE_CONCENTRATION', 'WARNING', 'valuation_case', NULL,
          format('Concentração de %s%% das observações em uma única origem (%s).',
                 v_src_pct, coalesce(v_metrics->>'top_domain','DESCONHECIDO')),
          jsonb_build_object('pct', v_src_pct, 'domain', v_metrics->>'top_domain'), v_rule);
        v_opened := v_opened + 1;
      END IF;
    END IF;
  END IF;

  IF (v_metrics->>'market_property_count')::int > 0 THEN
    v_dev_pct := round(100.0 * (v_metrics->>'top_development_property_count')::numeric
                       / (v_metrics->>'market_property_count')::numeric, 2);
    IF v_dev_pct >= (pol.configuration->>'development_concentration_warning_pct')::numeric THEN
      IF NOT EXISTS (SELECT 1 FROM public.market_data_issues WHERE valuation_case_id = _case_id
                     AND issue_type = 'SPATIAL_CONCENTRATION' AND entity_id IS NULL
                     AND status IN ('OPEN','ACKNOWLEDGED')) THEN
        INSERT INTO public.market_data_issues (organization_id, valuation_case_id, issue_type,
          severity, entity_type, entity_id, detail, facts, rule_version)
        VALUES (v_org, _case_id, 'SPATIAL_CONCENTRATION', 'WARNING', 'valuation_case', NULL,
          format('Concentração de %s%% dos imóveis de mercado em um único empreendimento.', v_dev_pct),
          jsonb_build_object('pct', v_dev_pct), v_rule);
        v_opened := v_opened + 1;
      END IF;
    END IF;
  END IF;

  -- deterministic auto-resolution: the condition no longer holds
  FOR rec IN
    SELECT i.* FROM public.market_data_issues i
     WHERE i.valuation_case_id = _case_id AND i.status IN ('OPEN','ACKNOWLEDGED')
  LOOP
    IF (rec.issue_type = 'MISSING_GEO' AND NOT EXISTS (
          SELECT 1 FROM public.market_properties WHERE id = rec.entity_id AND geo_point IS NULL))
    OR (rec.issue_type = 'MISSING_CRITICAL_FIELD' AND NOT EXISTS (
          SELECT 1 FROM public.market_properties WHERE id = rec.entity_id AND private_area IS NULL))
    OR (rec.issue_type = 'MISSING_DATE' AND NOT EXISTS (
          SELECT 1 FROM public.market_observations WHERE id = rec.entity_id
            AND observation_date IS NULL AND publication_date IS NULL AND transaction_date IS NULL))
    OR (rec.issue_type = 'BROKEN_LINEAGE' AND NOT EXISTS (
          SELECT 1 FROM public.market_observations WHERE id = rec.entity_id AND evidence_source_id IS NULL))
    OR (rec.issue_type = 'UNVERIFIED_TRANSACTION' AND NOT EXISTS (
          SELECT 1 FROM public.market_observations WHERE id = rec.entity_id
            AND coalesce(transaction_evidence_status::text,'UNVERIFIED')
                NOT IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')))
    OR (rec.issue_type = 'UNRESOLVED_DUPLICATE' AND NOT EXISTS (
          SELECT 1 FROM public.property_match_candidates WHERE id = rec.entity_id
            AND match_status IN ('CANDIDATE','UNRESOLVED')))
    OR (rec.issue_type = 'CONFLICTING_ATTRIBUTE' AND NOT EXISTS (
          SELECT 1 FROM public.property_attribute_observations WHERE id = rec.entity_id
            AND knowledge_state = 'CONFLICTING'))
    OR (rec.issue_type = 'SOURCE_CONCENTRATION' AND coalesce(v_src_pct, 0)
          < (pol.configuration->>'source_concentration_warning_pct')::numeric)
    OR (rec.issue_type = 'SPATIAL_CONCENTRATION' AND coalesce(v_dev_pct, 0)
          < (pol.configuration->>'development_concentration_warning_pct')::numeric)
    THEN
      UPDATE public.market_data_issues
         SET status = 'RESOLVED', resolved_at = now(), resolution_type = 'SYSTEM',
             resolution_notes = 'Condição determinística deixou de existir.'
       WHERE id = rec.id;
      INSERT INTO public.market_data_issue_events (organization_id, valuation_case_id, issue_id,
        previous_status, new_status, actor_user_id, resolution_type, notes, rule_version)
      VALUES (v_org, _case_id, rec.id, rec.status, 'RESOLVED', NULL, 'SYSTEM',
        'Condição determinística deixou de existir.', v_rule);
      v_resolved := v_resolved + 1;
    END IF;
  END LOOP;

  PERFORM set_config('valuation.privileged_op', 'off', true);

  IF v_opened > 0 THEN
    PERFORM public.audit_write_internal(v_org, _case_id, 'MARKET_DATA_ISSUE_OPENED',
      'valuation_case', _case_id, NULL,
      jsonb_build_object('opened', v_opened, 'rule_version', v_rule), NULL);
  END IF;
  IF v_resolved > 0 THEN
    PERFORM public.audit_write_internal(v_org, _case_id, 'MARKET_DATA_ISSUE_RESOLVED',
      'valuation_case', _case_id, NULL,
      jsonb_build_object('resolved', v_resolved, 'rule_version', v_rule), NULL);
  END IF;

  RETURN jsonb_build_object('opened', v_opened, 'resolved', v_resolved,
    'rule_version', v_rule, 'policy_id', pol.id);
END; $$;

CREATE OR REPLACE FUNCTION public.acknowledge_market_data_issue(_issue_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.market_data_issues;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO i FROM public.market_data_issues WHERE id = _issue_id FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Questão não encontrada'; END IF;
  IF NOT public.can_write(i.organization_id) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;
  IF i.status <> 'OPEN' THEN RAISE EXCEPTION 'Somente uma questão aberta pode receber ciência'; END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.market_data_issues
     SET status = 'ACKNOWLEDGED', acknowledged_by = auth.uid(), acknowledged_at = now()
   WHERE id = i.id;
  INSERT INTO public.market_data_issue_events (organization_id, valuation_case_id, issue_id,
    previous_status, new_status, actor_user_id, notes, rule_version)
  VALUES (i.organization_id, i.valuation_case_id, i.id, i.status, 'ACKNOWLEDGED', auth.uid(),
    nullif(btrim(coalesce(_notes,'')), ''), i.rule_version);
  PERFORM set_config('valuation.privileged_op', 'off', true);
  RETURN i.id;
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_market_data_issue(_issue_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i public.market_data_issues;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO i FROM public.market_data_issues WHERE id = _issue_id FOR UPDATE;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Questão não encontrada'; END IF;
  IF NOT public.can_review(i.organization_id) THEN
    RAISE EXCEPTION 'Resolução humana exige papel de revisão';
  END IF;
  IF i.status NOT IN ('OPEN','ACKNOWLEDGED') THEN RAISE EXCEPTION 'Questão já encerrada'; END IF;
  IF nullif(btrim(coalesce(_notes,'')), '') IS NULL THEN
    RAISE EXCEPTION 'A resolução exige justificativa';
  END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  UPDATE public.market_data_issues
     SET status = 'RESOLVED', resolved_at = now(), resolved_by = auth.uid(),
         resolution_type = 'HUMAN', resolution_notes = btrim(_notes)
   WHERE id = i.id;
  INSERT INTO public.market_data_issue_events (organization_id, valuation_case_id, issue_id,
    previous_status, new_status, actor_user_id, resolution_type, notes, rule_version)
  VALUES (i.organization_id, i.valuation_case_id, i.id, i.status, 'RESOLVED', auth.uid(),
    'HUMAN', btrim(_notes), i.rule_version);
  PERFORM set_config('valuation.privileged_op', 'off', true);
  RETURN i.id;
END; $$;

/* ======================================================= readiness ====== */
CREATE OR REPLACE FUNCTION public.assess_sample_readiness(
  _case_id uuid, _market_evidence_snapshot_id uuid, _sample_selection_snapshot_id uuid, _policy_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; pol public.market_diagnostic_policies; snap public.market_evidence_snapshots;
  sel public.sample_selection_snapshots; v_metrics jsonb; v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb; v_state public.sample_readiness_state; v_version int;
  v_id uuid; v_obs int; v_missing_area_pct numeric; v_missing_geo_pct numeric;
  v_src_pct numeric; v_dev_pct numeric; v_dup_pct numeric; v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id INTO v_org FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.can_write(v_org) THEN RAISE EXCEPTION 'Permissão insuficiente'; END IF;

  IF _policy_id IS NULL THEN
    SELECT * INTO pol FROM public.market_diagnostic_policies
     WHERE status = 'ACTIVE' AND (organization_id = v_org OR organization_id IS NULL)
     ORDER BY organization_id NULLS LAST, created_at DESC LIMIT 1;
  ELSE
    SELECT * INTO pol FROM public.market_diagnostic_policies WHERE id = _policy_id;
  END IF;
  IF pol.id IS NULL THEN RAISE EXCEPTION 'Política diagnóstica não encontrada'; END IF;

  IF _market_evidence_snapshot_id IS NOT NULL THEN
    SELECT * INTO snap FROM public.market_evidence_snapshots
     WHERE id = _market_evidence_snapshot_id AND valuation_case_id = _case_id;
    IF snap.id IS NULL THEN RAISE EXCEPTION 'Retrato do universo não pertence a este caso'; END IF;
  END IF;
  IF _sample_selection_snapshot_id IS NOT NULL THEN
    SELECT * INTO sel FROM public.sample_selection_snapshots
     WHERE id = _sample_selection_snapshot_id AND valuation_case_id = _case_id;
    IF sel.id IS NULL THEN RAISE EXCEPTION 'Retrato da amostra não pertence a este caso'; END IF;
  END IF;

  v_metrics := public.market_universe_metrics(_case_id);
  v_obs := (v_metrics->>'observation_count')::int;

  /* -------- hard blockers: structural and objective only ---------------- */
  IF (v_metrics->>'subject_property_count')::int = 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'NO_SUBJECT_PROPERTY',
      'detail', 'O caso não possui imóvel avaliando cadastrado.');
  END IF;
  IF v_obs = 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'NO_MARKET_OBSERVATIONS',
      'detail', 'Nenhuma observação de mercado registrada.');
  END IF;
  IF (v_metrics->>'observations_with_verified_evidence')::int = 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'NO_VERIFIED_MARKET_EVIDENCE',
      'detail', 'Nenhuma observação de mercado possui campo de evidência verificado.');
  END IF;
  IF (v_metrics->>'observations_without_source')::int > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'UNRESOLVED_CRITICAL_LINEAGE',
      'detail', format('%s observação(ões) sem fonte de evidência vinculada.',
                       v_metrics->>'observations_without_source'));
  END IF;
  IF sel.id IS NULL OR sel.selected_count = 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'NO_SELECTED_SAMPLE',
      'detail', 'Nenhum retrato de amostra selecionada foi produzido.');
  END IF;
  IF sel.id IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.sample_selection_items i
       JOIN public.market_observations o ON o.id = i.market_observation_id
       WHERE i.selection_run_id = sel.selection_run_id AND o.valuation_case_id <> _case_id) THEN
    v_blockers := v_blockers || jsonb_build_object('code', 'CROSS_CASE_INCONSISTENCY',
      'detail', 'Há elementos de outro caso na amostra selecionada.');
  END IF;
  IF snap.id IS NOT NULL THEN
    v_hash := encode(extensions.digest(convert_to(snap.snapshot_manifest::text, 'UTF8'), 'sha256'), 'hex');
    IF v_hash <> snap.snapshot_hash THEN
      v_blockers := v_blockers || jsonb_build_object('code', 'SNAPSHOT_INTEGRITY_FAILURE',
        'detail', 'A impressão digital do retrato do universo não confere com o manifesto.');
    END IF;
  END IF;

  /* -------- warnings: versioned, explainable, non-normative ------------- */
  IF v_obs > 0 THEN
    IF (v_metrics->>'asking_listing_count')::int = v_obs THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'ONLY_ASKING_LISTINGS',
        'detail', 'Base atualmente composta apenas por ofertas.',
        'facts', jsonb_build_object('listing_dependency_pct', 100));
    END IF;
    IF (v_metrics->>'verified_transaction_count')::int = 0 THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'NO_VERIFIED_TRANSACTIONS',
        'detail', 'Nenhuma transação verificada disponível.');
    END IF;
    v_src_pct := round(100.0 * (v_metrics->>'top_domain_observation_count')::numeric / v_obs, 2);
    IF v_src_pct >= (pol.configuration->>'source_concentration_warning_pct')::numeric THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'HIGH_SOURCE_CONCENTRATION',
        'detail', format('%s%% das observações vêm da mesma origem (%s).',
                         v_src_pct, coalesce(v_metrics->>'top_domain','DESCONHECIDO')),
        'facts', jsonb_build_object('pct', v_src_pct,
                 'threshold', (pol.configuration->>'source_concentration_warning_pct')::numeric));
    END IF;
    IF (v_metrics->>'observations_without_date')::int > 0 THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'UNKNOWN_OBSERVATION_DATES',
        'detail', format('%s observação(ões) sem qualquer data factual.',
                         v_metrics->>'observations_without_date'));
    END IF;
    IF (v_metrics->>'observations_with_verified_evidence')::int < v_obs THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'LOW_VERIFIED_FIELD_COVERAGE',
        'detail', format('%s de %s observações possuem campo verificado.',
                         v_metrics->>'observations_with_verified_evidence', v_obs));
    END IF;
  END IF;

  IF (v_metrics->>'market_property_count')::int > 0 THEN
    v_missing_geo_pct := round(100.0 * (v_metrics->>'properties_without_geo')::numeric
                               / (v_metrics->>'market_property_count')::numeric, 2);
    v_missing_area_pct := round(100.0 * (v_metrics->>'properties_without_private_area')::numeric
                               / (v_metrics->>'market_property_count')::numeric, 2);
    v_dev_pct := round(100.0 * (v_metrics->>'top_development_property_count')::numeric
                               / (v_metrics->>'market_property_count')::numeric, 2);
    IF v_missing_geo_pct >= (pol.configuration->>'missingness_warning_pct')::numeric THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'LIMITED_GEO_COVERAGE',
        'detail', format('%s%% dos imóveis de mercado não possuem coordenada.', v_missing_geo_pct),
        'facts', jsonb_build_object('pct', v_missing_geo_pct));
    END IF;
    IF v_missing_area_pct >= (pol.configuration->>'missingness_warning_pct')::numeric THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'HIGH_MISSINGNESS',
        'detail', format('%s%% dos imóveis de mercado não possuem área privativa.', v_missing_area_pct),
        'facts', jsonb_build_object('pct', v_missing_area_pct, 'attribute', 'private_area'));
    END IF;
    IF v_dev_pct >= (pol.configuration->>'development_concentration_warning_pct')::numeric THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'HIGH_DEVELOPMENT_CONCENTRATION',
        'detail', format('%s%% dos imóveis estão no mesmo empreendimento.', v_dev_pct),
        'facts', jsonb_build_object('pct', v_dev_pct));
    END IF;
    v_dup_pct := round(100.0 * (v_metrics->>'unresolved_duplicate_count')::numeric
                       / (v_metrics->>'market_property_count')::numeric, 2);
    IF (v_metrics->>'unresolved_duplicate_count')::int > 0
       AND v_dup_pct >= (pol.configuration->>'unresolved_duplicate_warning_pct')::numeric THEN
      v_warnings := v_warnings || jsonb_build_object('code', 'MANY_UNRESOLVED_DUPLICATES',
        'detail', format('%s possível(is) duplicidade(s) sem decisão humana.',
                         v_metrics->>'unresolved_duplicate_count'),
        'facts', jsonb_build_object('pct', v_dup_pct));
    END IF;
  END IF;

  IF (v_metrics->>'attribute_conflict_count')::int > 0 THEN
    v_warnings := v_warnings || jsonb_build_object('code', 'ATTRIBUTE_CONFLICTS',
      'detail', format('%s atributo(s) divergente(s) sem adoção humana.',
                       v_metrics->>'attribute_conflict_count'));
  END IF;
  IF v_obs > 0 AND (v_metrics->>'oldest_observation_date') IS NOT NULL
     AND (v_metrics->>'latest_observation_date') = (v_metrics->>'oldest_observation_date') THEN
    v_warnings := v_warnings || jsonb_build_object('code', 'LIMITED_TEMPORAL_COVERAGE',
      'detail', 'Todas as observações datadas concentram-se em uma única data.');
  END IF;

  v_state := CASE
    WHEN jsonb_array_length(v_blockers) > 0 THEN 'NOT_READY'
    WHEN jsonb_array_length(v_warnings) > 0 THEN 'READY_WITH_WARNINGS'
    ELSE 'READY_FOR_METHOD_REVIEW' END;

  SELECT coalesce(max(version_number), 0) + 1 INTO v_version
    FROM public.sample_readiness_assessments WHERE valuation_case_id = _case_id;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  INSERT INTO public.sample_readiness_assessments (
    organization_id, valuation_case_id, version_number, market_evidence_snapshot_id,
    sample_selection_snapshot_id, diagnostic_policy_id, diagnostic_policy_version,
    feature_derivation_version, readiness_state, hard_blockers, warnings, metrics,
    computed_by, created_by)
  VALUES (v_org, _case_id, v_version, _market_evidence_snapshot_id, _sample_selection_snapshot_id,
    pol.id, pol.version, 'valuation.comparable.features/1', v_state, v_blockers, v_warnings,
    v_metrics, 'SYSTEM_DIAGNOSTIC', auth.uid())
  RETURNING id INTO v_id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(v_org, _case_id, 'READINESS_ASSESSED',
    'sample_readiness_assessment', v_id, NULL,
    jsonb_build_object('state', v_state, 'version_number', v_version,
                       'policy_version', pol.version),
    jsonb_build_object('hard_blockers', v_blockers, 'warnings', v_warnings));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.acknowledge_readiness_warnings(_assessment_id uuid, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.sample_readiness_assessments;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT * INTO a FROM public.sample_readiness_assessments WHERE id = _assessment_id FOR UPDATE;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Avaliação de prontidão não encontrada'; END IF;
  IF NOT public.can_review(a.organization_id) THEN
    RAISE EXCEPTION 'Ciência dos alertas exige papel de revisão';
  END IF;
  IF nullif(btrim(coalesce(_notes,'')), '') IS NULL THEN
    RAISE EXCEPTION 'A ciência dos alertas exige registro textual';
  END IF;
  IF a.acknowledged_at IS NOT NULL THEN RAISE EXCEPTION 'Alertas já receberam ciência'; END IF;

  PERFORM set_config('valuation.privileged_op', 'on', true);
  -- Acknowledgement never erases warnings and never changes the readiness state.
  UPDATE public.sample_readiness_assessments
     SET acknowledged_by = auth.uid(), acknowledged_at = now(),
         acknowledgement_notes = btrim(_notes)
   WHERE id = a.id;
  PERFORM set_config('valuation.privileged_op', 'off', true);

  PERFORM public.audit_write_internal(a.organization_id, a.valuation_case_id,
    'READINESS_WARNING_ACKNOWLEDGED', 'sample_readiness_assessment', a.id, NULL,
    jsonb_build_object('readiness_state', a.readiness_state),
    jsonb_build_object('notes', btrim(_notes)));
  RETURN a.id;
END; $$;

/* ================================================== least privilege ===== */
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('market_universe_metrics','create_market_evidence_snapshot',
        'confirm_market_identity_cluster','build_comparable_feature_snapshot',
        'start_sample_selection','decide_sample_selection_item','complete_sample_selection',
        'refresh_market_data_issues','acknowledge_market_data_issue','resolve_market_data_issue',
        'assess_sample_readiness','acknowledge_readiness_warnings','market_source_domain')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, PUBLIC', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn.sig);
  END LOOP;
END $$;