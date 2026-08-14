-- ============================================================
-- FASE 7E — CANDIDATE CLAIMS DE FONTE PRIMÁRIA
-- Nenhum cálculo. Nenhuma regra normativa promovida.
-- Claim é candidato append-only, sempre ancorado em localizador
-- de fonte com CONTEÚDO VERIFICADO por revisor humano.
-- ============================================================

CREATE TYPE public.methodology_claim_kind AS ENUM (
  'DEFINITION',
  'NORMATIVE_TEXT',
  'NUMERIC_NORMATIVE_CANDIDATE',
  'TABLE_REFERENCE',
  'DEFERRED_REFERENCE'
);

CREATE TYPE public.methodology_claim_decision AS ENUM (
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE public.methodology_claim_rule_assessment AS ENUM (
  'SUPPORTS_EXISTING_RULE',
  'CONTRADICTS_EXISTING_RULE',
  'NOT_COVERED_BY_EXISTING_RULE',
  'NEEDS_NEW_RULE'
);

/* ----------------------------------------------------- claims candidatas */
CREATE TABLE public.methodology_source_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.methodology_sources(id) ON DELETE RESTRICT,
  locator_id uuid NOT NULL REFERENCES public.methodology_source_locators(id) ON DELETE RESTRICT,
  method_specification_id uuid NOT NULL REFERENCES public.method_specifications(id) ON DELETE RESTRICT,
  requirement_code text NOT NULL,
  claim_code text NOT NULL,
  claim_kind public.methodology_claim_kind NOT NULL,
  statement text NOT NULL,
  verbatim_excerpt text,
  numeric_payload jsonb,
  deferred_target text,
  extraction_method text NOT NULL,
  reviewer_alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, method_specification_id, claim_code)
);
CREATE INDEX msc_requirement_idx
  ON public.methodology_source_claims (method_specification_id, requirement_code);
CREATE INDEX msc_source_idx ON public.methodology_source_claims (source_id, created_at DESC);

GRANT SELECT, INSERT ON public.methodology_source_claims TO authenticated;
GRANT ALL ON public.methodology_source_claims TO service_role;
ALTER TABLE public.methodology_source_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY msc_select ON public.methodology_source_claims FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY msc_insert ON public.methodology_source_claims FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE TRIGGER msc_no_delete BEFORE DELETE ON public.methodology_source_claims
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER msc_immutable BEFORE UPDATE ON public.methodology_source_claims
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* ------------------------------------------- decisões humanas sobre claim */
CREATE TABLE public.methodology_claim_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.methodology_source_claims(id) ON DELETE RESTRICT,
  decision public.methodology_claim_decision NOT NULL,
  justification text NOT NULL,
  reviewer_id uuid NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcr_claim_idx ON public.methodology_claim_reviews (claim_id, reviewed_at DESC);

GRANT SELECT ON public.methodology_claim_reviews TO authenticated;
GRANT ALL ON public.methodology_claim_reviews TO service_role;
ALTER TABLE public.methodology_claim_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcr_select ON public.methodology_claim_reviews FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE TRIGGER mcr_no_delete BEFORE DELETE ON public.methodology_claim_reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER mcr_immutable BEFORE UPDATE ON public.methodology_claim_reviews
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* ------------------------------ proposta de confronto com regra existente */
CREATE TABLE public.methodology_claim_rule_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.methodology_source_claims(id) ON DELETE RESTRICT,
  rule_id uuid REFERENCES public.methodology_rules(id) ON DELETE RESTRICT,
  assessment public.methodology_claim_rule_assessment NOT NULL,
  proposed_relationship public.methodology_source_relationship,
  proposed_normative_strength public.methodology_normative_strength,
  rationale text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mcra_claim_idx ON public.methodology_claim_rule_assessments (claim_id);

GRANT SELECT, INSERT ON public.methodology_claim_rule_assessments TO authenticated;
GRANT ALL ON public.methodology_claim_rule_assessments TO service_role;
ALTER TABLE public.methodology_claim_rule_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcra_select ON public.methodology_claim_rule_assessments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
CREATE POLICY mcra_insert ON public.methodology_claim_rule_assessments FOR INSERT TO authenticated
  WITH CHECK (public.can_write(organization_id) AND created_by = auth.uid());
CREATE TRIGGER mcra_no_delete BEFORE DELETE ON public.methodology_claim_rule_assessments
  FOR EACH ROW EXECUTE FUNCTION public.block_delete();
CREATE TRIGGER mcra_immutable BEFORE UPDATE ON public.methodology_claim_rule_assessments
  FOR EACH ROW EXECUTE FUNCTION public.block_update_immutable();

/* ================== GUARDA: citação exige conteúdo verificado ========== */

-- Trecho literal em localizador só existe se a organização tiver artefato
-- autorizado E verificação humana de CONTEÚDO na mesma fonte.
CREATE OR REPLACE FUNCTION public.guard_locator_excerpt_requires_content()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_ok boolean;
BEGIN
  IF NEW.support_excerpt IS NULL OR btrim(NEW.support_excerpt) = '' THEN
    RETURN NEW;
  END IF;
  v_org := coalesce(NEW.organization_id, public.current_actor_organization());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Trecho literal exige organização identificada.';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.methodology_source_verifications v
     WHERE v.source_id = NEW.source_id
       AND v.organization_id = v_org
       AND v.verification_type = 'CONTENT_VERIFIED') INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Trecho literal recusado: fonte % sem CONTENT_VERIFIED nesta organização.', NEW.source_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER msl_excerpt_requires_content
  BEFORE INSERT OR UPDATE ON public.methodology_source_locators
  FOR EACH ROW EXECUTE FUNCTION public.guard_locator_excerpt_requires_content();

/* ==================== GUARDA: linhagem e gate da claim ================= */
CREATE OR REPLACE FUNCTION public.guard_methodology_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loc record;
  v_spec record;
  v_content boolean;
  v_basis public.methodology_access_status;
  v_req int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO v_loc FROM public.methodology_source_locators WHERE id = NEW.locator_id;
  IF v_loc IS NULL THEN RAISE EXCEPTION 'Localizador inexistente ou fora de escopo.'; END IF;
  IF v_loc.source_id <> NEW.source_id THEN
    RAISE EXCEPTION 'Localizador não pertence à fonte informada.';
  END IF;
  IF v_loc.organization_id IS NOT NULL AND v_loc.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Localizador de outra organização.';
  END IF;

  SELECT * INTO v_spec FROM public.method_specifications WHERE id = NEW.method_specification_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente ou fora de escopo.'; END IF;
  IF v_spec.organization_id IS NOT NULL AND v_spec.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Especificação de outra organização.';
  END IF;
  IF v_spec.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Especificação % está %: claim candidata só entra em DRAFT.', v_spec.version, v_spec.status;
  END IF;

  SELECT count(*) INTO v_req FROM public.method_specification_source_requirements r
   WHERE r.method_specification_id = NEW.method_specification_id
     AND r.requirement_code = NEW.requirement_code;
  IF v_req = 0 THEN
    RAISE EXCEPTION 'Tema % não existe no mapa de requisitos desta especificação.', NEW.requirement_code;
  END IF;

  v_basis := public.methodology_source_org_access_basis(NEW.source_id, NEW.organization_id);
  IF v_basis IS NULL OR v_basis = 'METADATA_ONLY' THEN
    RAISE EXCEPTION 'Claim recusada: nenhuma base de acesso autorizada à fonte % nesta organização.', NEW.source_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.methodology_source_verifications v
     WHERE v.source_id = NEW.source_id
       AND v.organization_id = NEW.organization_id
       AND v.verification_type = 'CONTENT_VERIFIED') INTO v_content;
  IF NOT v_content THEN
    RAISE EXCEPTION 'Claim recusada: fonte % sem CONTENT_VERIFIED humano nesta organização.', NEW.source_id;
  END IF;

  IF NEW.claim_kind IN ('DEFINITION','NORMATIVE_TEXT','NUMERIC_NORMATIVE_CANDIDATE')
     AND (NEW.verbatim_excerpt IS NULL OR btrim(NEW.verbatim_excerpt) = '') THEN
    RAISE EXCEPTION 'Claim de conteúdo exige trecho literal do documento.';
  END IF;
  IF NEW.claim_kind = 'NUMERIC_NORMATIVE_CANDIDATE' AND NEW.numeric_payload IS NULL THEN
    RAISE EXCEPTION 'Claim numérica exige payload numérico explícito.';
  END IF;
  IF NEW.claim_kind = 'DEFERRED_REFERENCE'
     AND (NEW.deferred_target IS NULL OR btrim(NEW.deferred_target) = '') THEN
    RAISE EXCEPTION 'Referência diferida exige alvo declarado.';
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER msc_guard BEFORE INSERT ON public.methodology_source_claims
  FOR EACH ROW EXECUTE FUNCTION public.guard_methodology_claim();

/* ------------- guarda: avaliação de regra segue linhagem da claim ------- */
CREATE OR REPLACE FUNCTION public.guard_claim_rule_assessment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claim record; v_rule record;
BEGIN
  SELECT * INTO v_claim FROM public.methodology_source_claims WHERE id = NEW.claim_id;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'Claim inexistente ou fora de escopo.'; END IF;
  IF v_claim.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Claim de outra organização.';
  END IF;
  IF NEW.rule_id IS NULL THEN
    IF NEW.assessment <> 'NEEDS_NEW_RULE' THEN
      RAISE EXCEPTION 'Avaliação sobre regra existente exige rule_id.';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO v_rule FROM public.methodology_rules WHERE id = NEW.rule_id;
  IF v_rule IS NULL THEN RAISE EXCEPTION 'Regra inexistente ou fora de escopo.'; END IF;
  IF v_rule.method_specification_id <> v_claim.method_specification_id THEN
    RAISE EXCEPTION 'Regra pertence a outra especificação.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER mcra_guard BEFORE INSERT ON public.methodology_claim_rule_assessments
  FOR EACH ROW EXECUTE FUNCTION public.guard_claim_rule_assessment();

/* ============ OPERAÇÃO OFICIAL: decisão humana sobre claim ============== */
CREATE OR REPLACE FUNCTION public.review_methodology_claim(
  _claim_id uuid,
  _decision public.methodology_claim_decision,
  _justification text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_claim record;
  v_locator_verified boolean;
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF _justification IS NULL OR length(btrim(_justification)) < 20 THEN
    RAISE EXCEPTION 'Justificativa profissional obrigatória (mínimo 20 caracteres).';
  END IF;

  SELECT * INTO v_claim FROM public.methodology_source_claims WHERE id = _claim_id;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'Claim inexistente'; END IF;
  IF NOT public.can_review(v_claim.organization_id) THEN
    RAISE EXCEPTION 'Papel sem competência de revisão nesta organização.';
  END IF;
  IF v_claim.created_by = v_user AND _decision = 'ACCEPTED' THEN
    RAISE EXCEPTION 'Separação de funções: quem propôs a claim não pode aceitá-la.';
  END IF;

  IF _decision = 'ACCEPTED' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.methodology_source_verifications v
       WHERE v.source_id = v_claim.source_id
         AND v.organization_id = v_claim.organization_id
         AND v.locator_id = v_claim.locator_id
         AND v.verification_type = 'LOCATOR_VERIFIED') INTO v_locator_verified;
    IF NOT v_locator_verified THEN
      RAISE EXCEPTION 'Aceite recusado: localizador da claim sem LOCATOR_VERIFIED.';
    END IF;
  END IF;

  INSERT INTO public.methodology_claim_reviews
    (organization_id, claim_id, decision, justification, reviewer_id)
  VALUES (v_claim.organization_id, _claim_id, _decision, btrim(_justification), v_user)
  RETURNING id INTO v_id;

  PERFORM public.write_audit_event(
    v_claim.organization_id, v_user, 'METHODOLOGY_CLAIM_REVIEWED',
    'methodology_source_claims', _claim_id, NULL,
    jsonb_build_object('decision', _decision::text, 'claim_code', v_claim.claim_code,
                       'requirement_code', v_claim.requirement_code),
    jsonb_build_object('justification', btrim(_justification)));
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.review_methodology_claim(uuid, public.methodology_claim_decision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_methodology_claim(uuid, public.methodology_claim_decision, text) TO authenticated;

/* ====== OPERAÇÃO OFICIAL: satisfazer tema do mapa por claim aceita ===== */
CREATE OR REPLACE FUNCTION public.satisfy_specification_requirement(
  _requirement_id uuid,
  _claim_id uuid,
  _justification text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_req record;
  v_claim record;
  v_accepted boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF _justification IS NULL OR length(btrim(_justification)) < 20 THEN
    RAISE EXCEPTION 'Justificativa profissional obrigatória (mínimo 20 caracteres).';
  END IF;
  SELECT * INTO v_req FROM public.method_specification_source_requirements WHERE id = _requirement_id;
  IF v_req IS NULL THEN RAISE EXCEPTION 'Tema inexistente'; END IF;
  SELECT * INTO v_claim FROM public.methodology_source_claims WHERE id = _claim_id;
  IF v_claim IS NULL THEN RAISE EXCEPTION 'Claim inexistente'; END IF;
  IF NOT public.can_review(v_claim.organization_id) THEN
    RAISE EXCEPTION 'Papel sem competência de revisão nesta organização.';
  END IF;
  IF v_claim.requirement_code <> v_req.requirement_code
     OR v_claim.method_specification_id <> v_req.method_specification_id THEN
    RAISE EXCEPTION 'Claim não corresponde ao tema informado.';
  END IF;

  SELECT (r.decision = 'ACCEPTED') INTO v_accepted
    FROM public.methodology_claim_reviews r
   WHERE r.claim_id = _claim_id
   ORDER BY r.reviewed_at DESC LIMIT 1;
  IF coalesce(v_accepted, false) = false THEN
    RAISE EXCEPTION 'Tema só é satisfeito por claim com decisão ACCEPTED vigente.';
  END IF;

  UPDATE public.method_specification_source_requirements
     SET is_satisfied = true,
         satisfied_by_source_id = v_claim.source_id,
         notes = coalesce(notes || E'\n', '') || 'SATISFEITO por claim ' || v_claim.claim_code
                 || ': ' || btrim(_justification),
         updated_at = now()
   WHERE id = _requirement_id;

  PERFORM public.write_audit_event(
    v_claim.organization_id, v_user, 'METHODOLOGY_REQUIREMENT_SATISFIED',
    'method_specification_source_requirements', _requirement_id, NULL,
    jsonb_build_object('requirement_code', v_req.requirement_code, 'claim_id', _claim_id),
    jsonb_build_object('justification', btrim(_justification)));
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.satisfy_specification_requirement(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.satisfy_specification_requirement(uuid, uuid, text) TO authenticated;

/* ============ DIAGNÓSTICO: dossiê de claims por especificação ========== */
CREATE OR REPLACE FUNCTION public.methodology_claim_dossier(
  _specification_id uuid,
  _requirement_codes text[] DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := public.current_actor_organization();
  v_spec record;
  v_rows jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Nenhuma organização ativa'; END IF;
  SELECT * INTO v_spec FROM public.method_specifications WHERE id = _specification_id;
  IF v_spec IS NULL THEN RAISE EXCEPTION 'Especificação inexistente'; END IF;
  IF v_spec.organization_id IS NOT NULL AND v_spec.organization_id <> v_org THEN
    RAISE EXCEPTION 'Especificação fora do escopo desta organização';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'requirement_code'), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'requirement_code', r.requirement_code,
      'description', r.description,
      'is_satisfied', r.is_satisfied,
      'claims_total', (SELECT count(*) FROM public.methodology_source_claims c
                        WHERE c.method_specification_id = _specification_id
                          AND c.organization_id = v_org
                          AND c.requirement_code = r.requirement_code),
      'claims_accepted', (SELECT count(*) FROM public.methodology_source_claims c
                           WHERE c.method_specification_id = _specification_id
                             AND c.organization_id = v_org
                             AND c.requirement_code = r.requirement_code
                             AND (SELECT rv.decision FROM public.methodology_claim_reviews rv
                                   WHERE rv.claim_id = c.id
                                   ORDER BY rv.reviewed_at DESC LIMIT 1) = 'ACCEPTED'),
      'claims_pending', (SELECT count(*) FROM public.methodology_source_claims c
                          WHERE c.method_specification_id = _specification_id
                            AND c.organization_id = v_org
                            AND c.requirement_code = r.requirement_code
                            AND NOT EXISTS (SELECT 1 FROM public.methodology_claim_reviews rv
                                             WHERE rv.claim_id = c.id))
    ) AS x
    FROM public.method_specification_source_requirements r
    WHERE r.method_specification_id = _specification_id
      AND (_requirement_codes IS NULL OR r.requirement_code = ANY(_requirement_codes))
  ) s;

  RETURN jsonb_build_object(
    'specification_id', _specification_id,
    'specification_status', v_spec.status::text,
    'organization_id', v_org,
    'requirements', v_rows);
END; $$;
REVOKE ALL ON FUNCTION public.methodology_claim_dossier(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.methodology_claim_dossier(uuid, text[]) TO authenticated;