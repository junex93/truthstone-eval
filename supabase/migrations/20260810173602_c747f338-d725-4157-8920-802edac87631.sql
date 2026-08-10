-- Performance advisor remediation: unindexed foreign keys.
CREATE INDEX IF NOT EXISTS idx_properties_org ON public.properties (organization_id);
CREATE INDEX IF NOT EXISTS idx_field_revisions_org ON public.evidence_field_revisions (organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_reviews_org ON public.evidence_reviews (organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_reviews_artifact ON public.evidence_reviews (artifact_id);
CREATE INDEX IF NOT EXISTS idx_dataset_items_org ON public.dataset_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_runs_case ON public.ai_runs (valuation_case_id);