REVOKE UPDATE, DELETE ON public.methodology_source_claims FROM authenticated;
REVOKE UPDATE, DELETE ON public.methodology_claim_reviews FROM authenticated;
REVOKE UPDATE, DELETE ON public.methodology_claim_rule_assessments FROM authenticated;

CREATE OR REPLACE FUNCTION public.block_claim_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Registro append-only (%): correção se faz por nova afirmação candidata.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_claims_append_only ON public.methodology_source_claims;
CREATE TRIGGER trg_claims_append_only
  BEFORE UPDATE OR DELETE ON public.methodology_source_claims
  FOR EACH ROW EXECUTE FUNCTION public.block_claim_mutation();

DROP TRIGGER IF EXISTS trg_claim_assessments_append_only ON public.methodology_claim_rule_assessments;
CREATE TRIGGER trg_claim_assessments_append_only
  BEFORE UPDATE OR DELETE ON public.methodology_claim_rule_assessments
  FOR EACH ROW EXECUTE FUNCTION public.block_claim_mutation();