ALTER TABLE public.methodology_source_claims
  ADD COLUMN IF NOT EXISTS supersedes_claim_id uuid NULL;

ALTER TABLE public.methodology_source_claims
  ADD CONSTRAINT methodology_source_claims_org_id_key UNIQUE (organization_id, id);

ALTER TABLE public.methodology_source_claims
  ADD CONSTRAINT methodology_source_claims_supersedes_fk
  FOREIGN KEY (organization_id, supersedes_claim_id)
  REFERENCES public.methodology_source_claims (organization_id, id);

ALTER TABLE public.methodology_source_claims
  ADD CONSTRAINT methodology_source_claims_no_self_supersede
  CHECK (supersedes_claim_id IS NULL OR supersedes_claim_id <> id);

CREATE INDEX IF NOT EXISTS methodology_source_claims_supersedes_idx
  ON public.methodology_source_claims (supersedes_claim_id);

CREATE OR REPLACE FUNCTION public.guard_claim_supersession()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev public.methodology_source_claims;
  v_decision text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.supersedes_claim_id::text, '') <> COALESCE(OLD.supersedes_claim_id::text, '') THEN
      RAISE EXCEPTION 'Linhagem de claim é imutável: supersedes_claim_id não pode ser alterado.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.supersedes_claim_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_prev
  FROM public.methodology_source_claims
  WHERE id = NEW.supersedes_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim antecessora inexistente ou fora de escopo.';
  END IF;

  IF v_prev.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Claim antecessora pertence a outra organização.';
  END IF;

  IF v_prev.method_specification_id IS DISTINCT FROM NEW.method_specification_id
     OR v_prev.requirement_code IS DISTINCT FROM NEW.requirement_code THEN
    RAISE EXCEPTION 'Substituição exige mesma especificação e mesmo tema (requirement_code).';
  END IF;

  IF v_prev.supersedes_claim_id IS NOT NULL AND v_prev.supersedes_claim_id = NEW.id THEN
    RAISE EXCEPTION 'Ciclo de substituição de claim não é permitido.';
  END IF;

  SELECT decision::text INTO v_decision
  FROM public.methodology_claim_reviews
  WHERE claim_id = v_prev.id
  ORDER BY reviewed_at DESC
  LIMIT 1;

  IF v_decision IS NULL THEN
    RAISE EXCEPTION 'Claim antecessora ainda não foi revisada: substituição exige rejeição ou supersessão humana explícita.';
  END IF;

  IF v_decision NOT IN ('REJECTED', 'SUPERSEDED') THEN
    RAISE EXCEPTION 'Somente claim REJECTED ou SUPERSEDED pode ser substituída (estado atual: %).', v_decision;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_claim_supersession_trg ON public.methodology_source_claims;
CREATE TRIGGER guard_claim_supersession_trg
  BEFORE INSERT OR UPDATE ON public.methodology_source_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_claim_supersession();