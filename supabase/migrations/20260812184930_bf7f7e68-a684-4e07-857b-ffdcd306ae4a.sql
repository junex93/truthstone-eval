CREATE OR REPLACE FUNCTION public.market_universe_metrics(_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'latest_capture_at', (SELECT max(a.created_at) FROM public.evidence_artifacts a
       JOIN public.evidence_sources s ON s.id = a.evidence_source_id
       WHERE s.valuation_case_id = _case_id)
  );
  RETURN m;
END; $function$;