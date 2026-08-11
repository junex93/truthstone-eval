-- ============================================================
-- PHASE 5 CLOSEOUT — read-only diagnostics + integrity verification
-- Additive only. No table changes. No destructive statement.
-- ============================================================

/* 1) residual search_path warning on a pure helper ---------------------- */
CREATE OR REPLACE FUNCTION public.market_source_domain(_url text, _portal text, _publisher text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT coalesce(
    nullif(lower(regexp_replace(coalesce(_url,''), '^[a-z]+://(?:www\.)?([^/:?#]+).*$', '\1')), ''),
    nullif(btrim(coalesce(_portal,'')), ''),
    nullif(btrim(coalesce(_publisher,'')), ''),
    'DESCONHECIDO')
  WHERE true;
$$;

/* 2) official snapshot integrity verification --------------------------- */
CREATE OR REPLACE FUNCTION public.verify_snapshot_integrity(_kind text, _snapshot_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_manifest jsonb; v_stored text; v_recomputed text; v_algo text;
BEGIN
  IF _kind = 'MARKET_EVIDENCE' THEN
    SELECT organization_id, snapshot_manifest, snapshot_hash, hash_algorithm
      INTO v_org, v_manifest, v_stored, v_algo
      FROM public.market_evidence_snapshots WHERE id = _snapshot_id;
  ELSIF _kind = 'SAMPLE_SELECTION' THEN
    SELECT organization_id, snapshot_manifest, snapshot_hash, hash_algorithm
      INTO v_org, v_manifest, v_stored, v_algo
      FROM public.sample_selection_snapshots WHERE id = _snapshot_id;
  ELSE
    RAISE EXCEPTION 'Tipo de retrato desconhecido: %', _kind;
  END IF;

  IF v_org IS NULL THEN RAISE EXCEPTION 'Retrato não encontrado'; END IF;
  IF NOT public.is_org_member(v_org) THEN RAISE EXCEPTION 'Retrato fora do escopo da organização'; END IF;

  v_recomputed := encode(extensions.digest(convert_to(v_manifest::text, 'UTF8'), 'sha256'), 'hex');

  RETURN jsonb_build_object(
    'kind', _kind,
    'snapshot_id', _snapshot_id,
    'hash_algorithm', v_algo,
    'stored_hash', v_stored,
    'recomputed_hash', v_recomputed,
    'result', CASE WHEN v_stored = v_recomputed THEN 'VALID' ELSE 'INVALID' END,
    'verified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
END; $$;

/* 3) aggregated, read-only market intelligence report ------------------- */
CREATE OR REPLACE FUNCTION public.market_intelligence_report(_case_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_ref_date date; v_subject uuid; v_result jsonb;
  v_total_obs int; v_total_ind int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  SELECT organization_id, coalesce(valuation_date, current_date)
    INTO v_org, v_ref_date FROM public.valuation_cases WHERE id = _case_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Caso não encontrado'; END IF;
  IF NOT public.is_org_member(v_org) THEN RAISE EXCEPTION 'Caso fora do escopo da organização'; END IF;

  SELECT id INTO v_subject FROM public.properties
   WHERE valuation_case_id = _case_id ORDER BY created_at LIMIT 1;

  CREATE TEMP TABLE tmp_ident ON COMMIT DROP AS
  SELECT p.id AS market_property_id,
         m.cluster_id,
         coalesce(m.cluster_id::text, 'mp:' || p.id::text) AS identity_key,
         p.label, p.property_type_code, p.district, p.development_id,
         p.private_area, p.bedrooms, p.parking_spaces, p.floor_number,
         p.construction_year, p.geo_point,
         CASE WHEN p.geo_point IS NOT NULL AND s.geo_point IS NOT NULL
              THEN round(ST_Distance(p.geo_point, s.geo_point)::numeric, 1) END AS distance_m
    FROM public.market_properties p
    LEFT JOIN public.market_identity_cluster_members m
           ON m.market_property_id = p.id AND m.valuation_case_id = _case_id
    LEFT JOIN public.properties s ON s.id = v_subject
   WHERE p.valuation_case_id = _case_id;

  CREATE TEMP TABLE tmp_obs ON COMMIT DROP AS
  SELECT o.id AS observation_id, o.market_property_id, i.identity_key, i.cluster_id,
         o.observation_type, o.status, o.transaction_evidence_status,
         o.asking_price, o.transaction_price, o.asking_monthly_rent, o.contracted_monthly_rent,
         coalesce(o.transaction_date, o.observation_date, o.publication_date) AS effective_date,
         o.observation_date, o.publication_date, o.transaction_date,
         o.evidence_source_id, o.primary_artifact_id, o.listing_url,
         public.market_source_domain(o.listing_url, o.portal_name, o.publisher_name) AS domain,
         i.private_area, i.district, i.development_id, i.distance_m,
         CASE WHEN i.private_area > 0 AND o.asking_price IS NOT NULL
              THEN round(o.asking_price / i.private_area, 2) END AS asking_price_sqm,
         CASE WHEN i.private_area > 0 AND o.transaction_price IS NOT NULL
              THEN round(o.transaction_price / i.private_area, 2) END AS transaction_price_sqm,
         CASE WHEN coalesce(o.transaction_date, o.observation_date, o.publication_date) IS NOT NULL
              THEN (v_ref_date - coalesce(o.transaction_date, o.observation_date, o.publication_date)) END AS age_days
    FROM public.market_observations o
    JOIN tmp_ident i ON i.market_property_id = o.market_property_id
   WHERE o.valuation_case_id = _case_id;

  SELECT count(*) INTO v_total_obs FROM tmp_obs;
  SELECT count(DISTINCT identity_key) INTO v_total_ind FROM tmp_ident;

  v_result := jsonb_build_object(
    'valuation_case_id', _case_id,
    'valuation_reference_date', v_ref_date,
    'subject_property_id', v_subject,
    'diagnostics_version', 'valuation.market.diagnostics/1',
    'generated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'header', public.market_universe_metrics(_case_id),

    /* ---- matrix: one row per independent physical property ---- */
    'matrix', coalesce((
      SELECT jsonb_agg(row_json ORDER BY row_json->>'identity_key')
      FROM (
        SELECT jsonb_build_object(
          'identity_key', i.identity_key,
          'cluster_id', max(i.cluster_id::text),
          'is_clustered', bool_or(i.cluster_id IS NOT NULL),
          'label', min(coalesce(i.label, i.market_property_id::text)),
          'market_property_ids', jsonb_agg(DISTINCT i.market_property_id),
          'market_property_count', count(DISTINCT i.market_property_id),
          'property_type_code', min(i.property_type_code::text),
          'district', min(i.district),
          'development_id', max(i.development_id::text),
          'private_area', max(i.private_area),
          'distance_m', min(i.distance_m),
          'observation_count', (SELECT count(*) FROM tmp_obs o WHERE o.identity_key = i.identity_key),
          'source_count', (SELECT count(DISTINCT o.evidence_source_id) FROM tmp_obs o
                            WHERE o.identity_key = i.identity_key AND o.evidence_source_id IS NOT NULL),
          'domains', (SELECT jsonb_agg(DISTINCT o.domain) FROM tmp_obs o WHERE o.identity_key = i.identity_key),
          'latest_asking_price', (SELECT o.asking_price FROM tmp_obs o
             WHERE o.identity_key = i.identity_key AND o.asking_price IS NOT NULL
             ORDER BY o.effective_date DESC NULLS LAST LIMIT 1),
          'transaction_price', (SELECT o.transaction_price FROM tmp_obs o
             WHERE o.identity_key = i.identity_key AND o.transaction_price IS NOT NULL
             ORDER BY o.effective_date DESC NULLS LAST LIMIT 1),
          'asking_price_sqm', (SELECT o.asking_price_sqm FROM tmp_obs o
             WHERE o.identity_key = i.identity_key AND o.asking_price_sqm IS NOT NULL
             ORDER BY o.effective_date DESC NULLS LAST LIMIT 1),
          'transaction_price_sqm', (SELECT o.transaction_price_sqm FROM tmp_obs o
             WHERE o.identity_key = i.identity_key AND o.transaction_price_sqm IS NOT NULL
             ORDER BY o.effective_date DESC NULLS LAST LIMIT 1),
          'latest_date', (SELECT max(o.effective_date) FROM tmp_obs o WHERE o.identity_key = i.identity_key),
          'known_attribute_count', (
             count(*) FILTER (WHERE FALSE) +
             (SELECT count(*) FROM (SELECT unnest(ARRAY[
                 max(i.private_area) IS NOT NULL, min(i.district) IS NOT NULL,
                 max(i.bedrooms) IS NOT NULL, max(i.parking_spaces) IS NOT NULL,
                 max(i.construction_year) IS NOT NULL, bool_or(i.geo_point IS NOT NULL)
               ]) AS k) t WHERE k)),
          'attribute_slots', 6,
          'verified_attribute_count', (SELECT count(DISTINCT a.attribute_name)
             FROM public.property_attribute_observations a
             WHERE a.valuation_case_id = _case_id AND a.knowledge_state = 'KNOWN'
               AND a.evidence_field_id IS NOT NULL
               AND a.market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2
                                             WHERE i2.identity_key = i.identity_key)),
          'conflict_count', (SELECT count(*) FROM public.property_attribute_observations a
             WHERE a.valuation_case_id = _case_id AND a.knowledge_state = 'CONFLICTING'
               AND a.market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2
                                             WHERE i2.identity_key = i.identity_key)),
          'unresolved_duplicate_count', (SELECT count(*) FROM public.property_match_candidates c
             WHERE c.valuation_case_id = _case_id AND c.match_status IN ('CANDIDATE','UNRESOLVED')
               AND (c.left_market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2 WHERE i2.identity_key = i.identity_key)
                 OR c.right_market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2 WHERE i2.identity_key = i.identity_key))),
          'comparable_statuses', (SELECT jsonb_agg(DISTINCT jsonb_build_object(
                'candidate_id', cc.id, 'candidate_status', cc.candidate_status,
                'inclusion_status', cc.inclusion_status,
                'exclusion_reason_code', cc.exclusion_reason_code))
             FROM public.comparable_candidates cc
             WHERE cc.valuation_case_id = _case_id
               AND cc.market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2 WHERE i2.identity_key = i.identity_key)),
          'selection_states', (SELECT jsonb_agg(DISTINCT si.final_state)
             FROM public.sample_selection_items si
             JOIN public.sample_selection_runs sr ON sr.id = si.selection_run_id
             WHERE sr.valuation_case_id = _case_id
               AND si.market_property_id IN (SELECT i2.market_property_id FROM tmp_ident i2 WHERE i2.identity_key = i.identity_key)),
          'observations', (SELECT jsonb_agg(jsonb_build_object(
                'observation_id', o.observation_id, 'market_property_id', o.market_property_id,
                'observation_type', o.observation_type, 'status', o.status,
                'transaction_evidence_status', o.transaction_evidence_status,
                'asking_price', o.asking_price, 'transaction_price', o.transaction_price,
                'asking_monthly_rent', o.asking_monthly_rent,
                'asking_price_sqm', o.asking_price_sqm,
                'transaction_price_sqm', o.transaction_price_sqm,
                'effective_date', o.effective_date, 'age_days', o.age_days,
                'domain', o.domain, 'listing_url', o.listing_url,
                'evidence_source_id', o.evidence_source_id,
                'primary_artifact_id', o.primary_artifact_id,
                'price_history', (SELECT jsonb_agg(jsonb_build_object(
                     'observed_at', h.observed_at, 'asking_price', h.asking_price,
                     'asking_monthly_rent', h.asking_monthly_rent,
                     'observation_status', h.observation_status) ORDER BY h.observed_at)
                   FROM public.market_observation_price_history h
                   WHERE h.market_observation_id = o.observation_id)
              ) ORDER BY o.effective_date DESC NULLS LAST)
             FROM tmp_obs o WHERE o.identity_key = i.identity_key)
        ) AS row_json
        FROM tmp_ident i GROUP BY i.identity_key
      ) rows), '[]'::jsonb),

    /* ---- source diagnostics ---- */
    'domains', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'domain', d.domain,
        'observation_count', d.obs,
        'observation_share_pct', CASE WHEN v_total_obs > 0 THEN round(100.0 * d.obs / v_total_obs, 1) END,
        'independent_property_count', d.ind,
        'independent_property_share_pct', CASE WHEN v_total_ind > 0 THEN round(100.0 * d.ind / v_total_ind, 1) END,
        'first_observed', d.first_obs, 'last_observed', d.last_obs,
        'source_count', d.src, 'artifact_count', d.art
      ) ORDER BY d.obs DESC, d.domain)
      FROM (SELECT o.domain,
                   count(*) AS obs,
                   count(DISTINCT o.identity_key) AS ind,
                   min(o.effective_date) AS first_obs,
                   max(o.effective_date) AS last_obs,
                   count(DISTINCT o.evidence_source_id) AS src,
                   count(DISTINCT o.primary_artifact_id) AS art
              FROM tmp_obs o GROUP BY o.domain) d), '[]'::jsonb),

    'source_types', coalesce((
      SELECT jsonb_agg(jsonb_build_object('source_type', st, 'observation_count', n) ORDER BY n DESC)
      FROM (SELECT coalesce(s.source_type::text, 'SEM_FONTE') AS st, count(*) AS n
              FROM tmp_obs o LEFT JOIN public.evidence_sources s ON s.id = o.evidence_source_id
             GROUP BY 1) x), '[]'::jsonb),

    'source_quality', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'assessment_id', q.id, 'market_observation_id', q.market_observation_id,
        'source_reliability', q.source_reliability, 'temporal_relevance', q.temporal_relevance,
        'spatial_relevance', q.spatial_relevance, 'data_completeness', q.data_completeness,
        'cross_source_confirmation', q.cross_source_confirmation,
        'notes', q.notes, 'assessed_by', q.assessed_by, 'assessed_at', q.updated_at) ORDER BY q.updated_at DESC)
      FROM public.market_source_quality_assessments q WHERE q.valuation_case_id = _case_id), '[]'::jsonb),

    /* ---- temporal ---- */
    'temporal', jsonb_build_object(
      'oldest_observation', (SELECT min(effective_date) FROM tmp_obs),
      'latest_observation', (SELECT max(effective_date) FROM tmp_obs),
      'without_date', (SELECT count(*) FROM tmp_obs WHERE effective_date IS NULL),
      'monthly', coalesce((
        SELECT jsonb_agg(jsonb_build_object('month', m, 'observation_type', t, 'count', n)
                         ORDER BY m, t)
        FROM (SELECT to_char(date_trunc('month', effective_date), 'YYYY-MM') AS m,
                     observation_type::text AS t, count(*) AS n
                FROM tmp_obs WHERE effective_date IS NOT NULL GROUP BY 1, 2) z), '[]'::jsonb),
      'age_buckets', coalesce((
        SELECT jsonb_agg(jsonb_build_object('bucket', b, 'count', n) ORDER BY ord)
        FROM (SELECT CASE WHEN age_days IS NULL THEN 'UNKNOWN'
                          WHEN age_days <= 30 THEN '0-30'
                          WHEN age_days <= 90 THEN '31-90'
                          WHEN age_days <= 180 THEN '91-180'
                          WHEN age_days <= 365 THEN '181-365'
                          ELSE '>365' END AS b,
                     CASE WHEN age_days IS NULL THEN 9
                          WHEN age_days <= 30 THEN 1 WHEN age_days <= 90 THEN 2
                          WHEN age_days <= 180 THEN 3 WHEN age_days <= 365 THEN 4 ELSE 5 END AS ord,
                     count(*) AS n
                FROM tmp_obs GROUP BY 1, 2) z), '[]'::jsonb)),

    /* ---- price history (asking variation only) ---- */
    'price_history', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'observation_id', h.market_observation_id,
        'identity_key', (SELECT o.identity_key FROM tmp_obs o WHERE o.observation_id = h.market_observation_id),
        'first_asking', h.first_asking, 'latest_asking', h.latest_asking,
        'absolute_change', h.latest_asking - h.first_asking,
        'percentage_change', CASE WHEN h.first_asking > 0
             THEN round(100.0 * (h.latest_asking - h.first_asking) / h.first_asking, 2) END,
        'change_count', h.n - 1, 'first_seen', h.first_seen, 'last_seen', h.last_seen))
      FROM (SELECT ph.market_observation_id,
                   count(*) AS n,
                   min(ph.observed_at) AS first_seen, max(ph.observed_at) AS last_seen,
                   (array_agg(ph.asking_price ORDER BY ph.observed_at))[1] AS first_asking,
                   (array_agg(ph.asking_price ORDER BY ph.observed_at DESC))[1] AS latest_asking
              FROM public.market_observation_price_history ph
             WHERE ph.valuation_case_id = _case_id AND ph.asking_price IS NOT NULL
             GROUP BY ph.market_observation_id HAVING count(*) > 1) h), '[]'::jsonb),

    /* ---- asking-to-transaction: confirmed identity + verified evidence only ---- */
    'asking_to_transaction', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'identity_key', k.identity_key,
        'last_verified_asking', k.asking, 'verified_transaction', k.txn,
        'absolute_delta', k.txn - k.asking,
        'percentage_delta', CASE WHEN k.asking > 0 THEN round(100.0 * (k.txn - k.asking) / k.asking, 2) END))
      FROM (SELECT o.identity_key,
                   (SELECT a.asking_price FROM tmp_obs a
                     WHERE a.identity_key = o.identity_key AND a.asking_price IS NOT NULL
                       AND a.observation_type IN ('SALE_LISTING','RENT_LISTING')
                     ORDER BY a.effective_date DESC NULLS LAST LIMIT 1) AS asking,
                   (SELECT t.transaction_price FROM tmp_obs t
                     WHERE t.identity_key = o.identity_key AND t.transaction_price IS NOT NULL
                       AND t.transaction_evidence_status IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')
                     ORDER BY t.effective_date DESC NULLS LAST LIMIT 1) AS txn
              FROM tmp_obs o WHERE o.cluster_id IS NOT NULL GROUP BY o.identity_key) k
      WHERE k.asking IS NOT NULL AND k.txn IS NOT NULL), '[]'::jsonb),

    /* ---- spatial ---- */
    'spatial', jsonb_build_object(
      'with_geo', (SELECT count(*) FROM tmp_ident WHERE geo_point IS NOT NULL),
      'without_geo', (SELECT count(*) FROM tmp_ident WHERE geo_point IS NULL),
      'subject_has_geo', (SELECT geo_point IS NOT NULL FROM public.properties WHERE id = v_subject),
      'min_distance_m', (SELECT min(distance_m) FROM tmp_ident),
      'q1_distance_m', (SELECT round(percentile_cont(0.25) WITHIN GROUP (ORDER BY distance_m)::numeric, 1) FROM tmp_ident WHERE distance_m IS NOT NULL),
      'median_distance_m', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY distance_m)::numeric, 1) FROM tmp_ident WHERE distance_m IS NOT NULL),
      'q3_distance_m', (SELECT round(percentile_cont(0.75) WITHIN GROUP (ORDER BY distance_m)::numeric, 1) FROM tmp_ident WHERE distance_m IS NOT NULL),
      'max_distance_m', (SELECT max(distance_m) FROM tmp_ident),
      'same_district', (SELECT count(*) FROM tmp_ident i
         WHERE i.district IS NOT NULL AND i.district IS NOT DISTINCT FROM
               (SELECT p.district FROM public.properties p WHERE p.id = v_subject)),
      'districts', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'district', coalesce(d.district, 'NÃO INFORMADO'),
             'independent_property_count', d.ind, 'observation_count', d.obs) ORDER BY d.ind DESC)
         FROM (SELECT i.district,
                      count(DISTINCT i.identity_key) AS ind,
                      (SELECT count(*) FROM tmp_obs o WHERE o.district IS NOT DISTINCT FROM i.district) AS obs
                 FROM tmp_ident i GROUP BY i.district) d), '[]'::jsonb),
      'developments', coalesce((SELECT jsonb_agg(jsonb_build_object(
             'development_id', d.development_id,
             'name', (SELECT dv.name FROM public.developments dv WHERE dv.id = d.development_id),
             'independent_property_count', d.ind,
             'share_pct', CASE WHEN v_total_ind > 0 THEN round(100.0 * d.ind / v_total_ind, 1) END) ORDER BY d.ind DESC)
         FROM (SELECT i.development_id, count(DISTINCT i.identity_key) AS ind
                 FROM tmp_ident i WHERE i.development_id IS NOT NULL GROUP BY i.development_id) d), '[]'::jsonb)),

    /* ---- attribute coverage (KNOWN != VERIFIED) ---- */
    'attribute_coverage', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'attribute', a.attr, 'total', v_total_ind, 'known', a.known,
        'verified', (SELECT count(DISTINCT i.identity_key) FROM tmp_ident i
                      JOIN public.property_attribute_observations pao
                        ON pao.market_property_id = i.market_property_id
                       AND pao.attribute_name = a.attr
                       AND pao.knowledge_state = 'KNOWN'
                       AND pao.evidence_field_id IS NOT NULL
                     WHERE pao.valuation_case_id = _case_id),
        'unknown', v_total_ind - a.known,
        'conflicting', (SELECT count(DISTINCT i.identity_key) FROM tmp_ident i
                         JOIN public.property_attribute_observations pao
                           ON pao.market_property_id = i.market_property_id
                          AND pao.attribute_name = a.attr
                          AND pao.knowledge_state = 'CONFLICTING'
                        WHERE pao.valuation_case_id = _case_id)) ORDER BY a.ord)
      FROM (
        SELECT 'property_type' AS attr, 1 AS ord, count(DISTINCT identity_key) FILTER (WHERE property_type_code IS NOT NULL) AS known FROM tmp_ident
        UNION ALL SELECT 'district', 2, count(DISTINCT identity_key) FILTER (WHERE district IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'geo', 3, count(DISTINCT identity_key) FILTER (WHERE geo_point IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'development', 4, count(DISTINCT identity_key) FILTER (WHERE development_id IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'private_area', 5, count(DISTINCT identity_key) FILTER (WHERE private_area IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'bedrooms', 6, count(DISTINCT identity_key) FILTER (WHERE bedrooms IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'parking_spaces', 7, count(DISTINCT identity_key) FILTER (WHERE parking_spaces IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'floor', 8, count(DISTINCT identity_key) FILTER (WHERE floor_number IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'construction_year', 9, count(DISTINCT identity_key) FILTER (WHERE construction_year IS NOT NULL) FROM tmp_ident
        UNION ALL SELECT 'asking_price', 10, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE asking_price IS NOT NULL)
        UNION ALL SELECT 'transaction_price', 11, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE transaction_price IS NOT NULL)
        UNION ALL SELECT 'observation_date', 12, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE observation_date IS NOT NULL)
        UNION ALL SELECT 'publication_date', 13, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE publication_date IS NOT NULL)
        UNION ALL SELECT 'source', 14, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE evidence_source_id IS NOT NULL)
        UNION ALL SELECT 'artifact', 15, (SELECT count(DISTINCT identity_key) FROM tmp_obs WHERE primary_artifact_id IS NOT NULL)
      ) a), '[]'::jsonb),

    'conflict_map', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'attribute', c.attribute_name,
        'properties_affected', c.props, 'observation_count', c.n,
        'open_issues', (SELECT count(*) FROM public.market_data_issues mi
                         WHERE mi.valuation_case_id = _case_id
                           AND mi.issue_type = 'CONFLICTING_ATTRIBUTE'
                           AND mi.status IN ('OPEN','ACKNOWLEDGED'))) ORDER BY c.n DESC)
      FROM (SELECT pao.attribute_name, count(*) AS n, count(DISTINCT pao.market_property_id) AS props
              FROM public.property_attribute_observations pao
             WHERE pao.valuation_case_id = _case_id AND pao.knowledge_state = 'CONFLICTING'
             GROUP BY pao.attribute_name) c), '[]'::jsonb),

    /* ---- price per sqm distributions, kept separate ---- */
    'price_per_sqm', jsonb_build_object(
      'asking', (SELECT jsonb_build_object('count', count(*), 'min', min(asking_price_sqm),
          'q1', round(percentile_cont(0.25) WITHIN GROUP (ORDER BY asking_price_sqm)::numeric, 2),
          'median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY asking_price_sqm)::numeric, 2),
          'q3', round(percentile_cont(0.75) WITHIN GROUP (ORDER BY asking_price_sqm)::numeric, 2),
          'max', max(asking_price_sqm)) FROM tmp_obs WHERE asking_price_sqm IS NOT NULL),
      'transaction', (SELECT jsonb_build_object('count', count(*), 'min', min(transaction_price_sqm),
          'q1', round(percentile_cont(0.25) WITHIN GROUP (ORDER BY transaction_price_sqm)::numeric, 2),
          'median', round(percentile_cont(0.5) WITHIN GROUP (ORDER BY transaction_price_sqm)::numeric, 2),
          'q3', round(percentile_cont(0.75) WITHIN GROUP (ORDER BY transaction_price_sqm)::numeric, 2),
          'max', max(transaction_price_sqm)) FROM tmp_obs WHERE transaction_price_sqm IS NOT NULL)),

    'possible_extreme_observations', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'observation_id', o.observation_id, 'identity_key', o.identity_key,
        'metric', 'ASKING_PRICE_PER_SQM', 'value', o.asking_price_sqm,
        'lower_fence', b.lo, 'upper_fence', b.hi,
        'flag', 'POSSIBLE_EXTREME_OBSERVATION'))
      FROM tmp_obs o,
           (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY asking_price_sqm) -
                   1.5 * (percentile_cont(0.75) WITHIN GROUP (ORDER BY asking_price_sqm) -
                          percentile_cont(0.25) WITHIN GROUP (ORDER BY asking_price_sqm)) AS lo,
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY asking_price_sqm) +
                   1.5 * (percentile_cont(0.75) WITHIN GROUP (ORDER BY asking_price_sqm) -
                          percentile_cont(0.25) WITHIN GROUP (ORDER BY asking_price_sqm)) AS hi,
                   count(*) AS n
              FROM tmp_obs WHERE asking_price_sqm IS NOT NULL) b
      WHERE b.n >= 4 AND o.asking_price_sqm IS NOT NULL
        AND (o.asking_price_sqm < b.lo OR o.asking_price_sqm > b.hi)), '[]'::jsonb),

    /* ---- funnel and losses ---- */
    'funnel', jsonb_build_object(
      'search_results', (SELECT count(*) FROM public.research_search_results WHERE valuation_case_id = _case_id),
      'captured', (SELECT count(*) FROM public.research_search_results WHERE valuation_case_id = _case_id AND capture_status = 'CAPTURED'),
      'extracted', (SELECT count(*) FROM public.research_entity_candidates WHERE valuation_case_id = _case_id
                     AND status IN ('EXTRACTED','REVIEW_REQUIRED','READY_TO_PROMOTE','PROMOTED')),
      'verified_fields', (SELECT count(*) FROM public.evidence_fields f
                           JOIN public.evidence_extractions e ON e.id = f.extraction_id
                           JOIN public.evidence_artifacts a ON a.id = e.artifact_id
                           JOIN public.evidence_sources s ON s.id = a.evidence_source_id
                          WHERE s.valuation_case_id = _case_id AND f.validation_status = 'VERIFIED'),
      'promoted', (SELECT count(*) FROM public.research_entity_candidates WHERE valuation_case_id = _case_id AND status = 'PROMOTED'),
      'market_observations', v_total_obs,
      'independent_properties', v_total_ind,
      'comparable_candidates', (SELECT count(*) FROM public.comparable_candidates WHERE valuation_case_id = _case_id),
      'eligible', (SELECT count(*) FROM public.comparable_candidates WHERE valuation_case_id = _case_id AND candidate_status = 'ELIGIBLE'),
      'included', (SELECT count(*) FROM public.comparable_candidates WHERE valuation_case_id = _case_id AND inclusion_status = 'INCLUDED')),

    'why_lost', coalesce((
      SELECT jsonb_agg(jsonb_build_object('stage', stage, 'reason', reason, 'count', n) ORDER BY stage, reason)
      FROM (
        SELECT 'SEARCH' AS stage, 'REJECTED_SOURCE' AS reason, count(*) AS n
          FROM public.research_search_results WHERE valuation_case_id = _case_id AND selection_status = 'REJECTED'
        UNION ALL
        SELECT 'CAPTURE', coalesce(capture_status::text, 'DESCONHECIDO'), count(*)
          FROM public.research_search_results
         WHERE valuation_case_id = _case_id AND capture_status IN ('FAILED','ACCESS_RESTRICTED','BLOCKED_BY_POLICY','DUPLICATE')
         GROUP BY capture_status
        UNION ALL
        SELECT 'EXTRACTION', 'CANDIDATE_REJECTED', count(*)
          FROM public.research_entity_candidates WHERE valuation_case_id = _case_id AND status = 'REJECTED'
        UNION ALL
        SELECT 'EVIDENCE', 'FIELD_REJECTED', count(*)
          FROM public.evidence_fields f
          JOIN public.evidence_extractions e ON e.id = f.extraction_id
          JOIN public.evidence_artifacts a ON a.id = e.artifact_id
          JOIN public.evidence_sources s ON s.id = a.evidence_source_id
         WHERE s.valuation_case_id = _case_id AND f.validation_status = 'REJECTED'
        UNION ALL
        SELECT 'IDENTITY', 'CONFIRMED_DUPLICATE', count(*)
          FROM public.property_match_candidates WHERE valuation_case_id = _case_id AND match_status = 'CONFIRMED_SAME'
        UNION ALL
        SELECT 'COMPARABLE', coalesce(exclusion_reason_code, 'EXCLUDED'), count(*)
          FROM public.comparable_candidates
         WHERE valuation_case_id = _case_id AND inclusion_status = 'EXCLUDED'
         GROUP BY exclusion_reason_code
        UNION ALL
        SELECT 'COMPARABLE', 'INELIGIBLE', count(*)
          FROM public.comparable_candidates WHERE valuation_case_id = _case_id AND candidate_status = 'INELIGIBLE'
      ) z WHERE n > 0), '[]'::jsonb),

    /* ---- identity ---- */
    'identity_clusters', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'cluster_id', c.id, 'label', c.label,
        'representative_market_property_id', c.representative_market_property_id,
        'confirmation_reason', c.confirmation_reason,
        'confirmed_by', c.confirmed_by, 'confirmed_at', c.confirmed_at,
        'members', (SELECT jsonb_agg(jsonb_build_object(
              'market_property_id', m.market_property_id,
              'label', (SELECT p.label FROM public.market_properties p WHERE p.id = m.market_property_id),
              'source_match_candidate_id', m.source_match_candidate_id))
           FROM public.market_identity_cluster_members m WHERE m.cluster_id = c.id),
        'observation_count', (SELECT count(*) FROM tmp_obs o WHERE o.cluster_id = c.id),
        'source_count', (SELECT count(DISTINCT o.evidence_source_id) FROM tmp_obs o WHERE o.cluster_id = c.id),
        'first_observed', (SELECT min(o.effective_date) FROM tmp_obs o WHERE o.cluster_id = c.id),
        'last_observed', (SELECT max(o.effective_date) FROM tmp_obs o WHERE o.cluster_id = c.id))
        ORDER BY c.confirmed_at DESC)
      FROM public.market_identity_clusters c WHERE c.valuation_case_id = _case_id), '[]'::jsonb),

    'unresolved_identity', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'match_id', c.id, 'left_market_property_id', c.left_market_property_id,
        'right_market_property_id', c.right_market_property_id,
        'match_status', c.match_status, 'similarity_score', c.similarity_score))
      FROM public.property_match_candidates c
      WHERE c.valuation_case_id = _case_id AND c.match_status IN ('CANDIDATE','UNRESOLVED')), '[]'::jsonb),

    /* ---- research gaps, derived deterministically from issues + facts ---- */
    'research_gaps', coalesce((
      SELECT jsonb_agg(jsonb_build_object('code', g.code, 'count', g.n, 'description', g.descr) ORDER BY g.code)
      FROM (
        SELECT 'MISSING_PRIVATE_AREA' AS code, count(*) AS n,
               'imóveis de mercado sem área privativa registrada' AS descr
          FROM tmp_ident WHERE private_area IS NULL
        UNION ALL
        SELECT 'MISSING_GEO', count(*), 'imóveis de mercado sem coordenada'
          FROM tmp_ident WHERE geo_point IS NULL
        UNION ALL
        SELECT 'MISSING_DATE', count(*), 'observações sem qualquer data'
          FROM tmp_obs WHERE effective_date IS NULL
        UNION ALL
        SELECT 'UNRESOLVED_DUPLICATE', count(*), 'possíveis duplicidades não resolvidas'
          FROM public.property_match_candidates
         WHERE valuation_case_id = _case_id AND match_status IN ('CANDIDATE','UNRESOLVED')
        UNION ALL
        SELECT 'NO_VERIFIED_TRANSACTION', count(*), 'transações verificadas no universo'
          FROM tmp_obs WHERE observation_type IN ('CLOSED_SALE','CLOSED_RENT')
            AND transaction_evidence_status IN ('DOCUMENTED','MULTI_SOURCE_CONFIRMED')
        UNION ALL
        SELECT 'ATTRIBUTE_CONFLICT', count(*), 'atributos divergentes não adotados'
          FROM public.property_attribute_observations
         WHERE valuation_case_id = _case_id AND knowledge_state = 'CONFLICTING'
      ) g WHERE (g.code = 'NO_VERIFIED_TRANSACTION' AND g.n = 0) OR (g.code <> 'NO_VERIFIED_TRANSACTION' AND g.n > 0)), '[]'::jsonb)
  );

  DROP TABLE IF EXISTS tmp_obs;
  DROP TABLE IF EXISTS tmp_ident;
  RETURN v_result;
END; $$;

GRANT EXECUTE ON FUNCTION public.verify_snapshot_integrity(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_intelligence_report(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_snapshot_integrity(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.market_intelligence_report(uuid) FROM anon;
