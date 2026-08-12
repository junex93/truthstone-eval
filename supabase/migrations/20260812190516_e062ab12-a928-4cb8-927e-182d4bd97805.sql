-- 1. Lineage de artefato em fonte metodológica
CREATE OR REPLACE FUNCTION public.guard_methodology_source_artifact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_src_org uuid; v_art_org uuid; v_found boolean;
BEGIN
  SELECT organization_id INTO v_src_org FROM public.methodology_sources WHERE id = NEW.source_id;
  SELECT organization_id, true INTO v_art_org, v_found FROM public.evidence_artifacts WHERE id = NEW.evidence_artifact_id;
  IF NOT coalesce(v_found, false) THEN
    RAISE EXCEPTION 'Artefato inexistente';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM v_art_org THEN
    RAISE EXCEPTION 'Artefato pertence a outra organização: linhagem incompatível com a fonte metodológica';
  END IF;
  IF v_src_org IS NOT NULL AND v_src_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Fonte metodológica pertence a outra organização';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_methodology_source_artifacts_lineage ON public.methodology_source_artifacts;
CREATE TRIGGER trg_methodology_source_artifacts_lineage
BEFORE INSERT ON public.methodology_source_artifacts
FOR EACH ROW EXECUTE FUNCTION public.guard_methodology_source_artifact();

-- 2. Localizador citando artefato
CREATE OR REPLACE FUNCTION public.guard_methodology_locator_artifact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_src_org uuid; v_art_org uuid; v_found boolean;
BEGIN
  SELECT organization_id INTO v_src_org FROM public.methodology_sources WHERE id = NEW.source_id;
  IF v_src_org IS NOT NULL AND NEW.organization_id IS NOT NULL AND v_src_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Localizador fora do escopo da organização da fonte metodológica';
  END IF;
  IF NEW.artifact_id IS NOT NULL THEN
    SELECT organization_id, true INTO v_art_org, v_found FROM public.evidence_artifacts WHERE id = NEW.artifact_id;
    IF NOT coalesce(v_found, false) THEN
      RAISE EXCEPTION 'Artefato inexistente';
    END IF;
    IF NEW.organization_id IS DISTINCT FROM v_art_org THEN
      RAISE EXCEPTION 'Artefato pertence a outra organização: linhagem incompatível com o localizador';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_methodology_source_locators_lineage ON public.methodology_source_locators;
CREATE TRIGGER trg_methodology_source_locators_lineage
BEFORE INSERT ON public.methodology_source_locators
FOR EACH ROW EXECUTE FUNCTION public.guard_methodology_locator_artifact();

-- 3. Conteúdo de especificação: mesma organização da especificação
CREATE OR REPLACE FUNCTION public.guard_specification_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_spec uuid; v_status public.method_spec_status; v_org uuid; v_found boolean;
BEGIN
  IF public.in_privileged_op() THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME IN ('methodology_formulas','methodology_formula_variables') THEN
    IF TG_TABLE_NAME = 'methodology_formulas' THEN
      SELECT r.method_specification_id INTO v_spec FROM public.methodology_rules r WHERE r.id = NEW.rule_id;
    ELSE
      SELECT r.method_specification_id INTO v_spec
        FROM public.methodology_formulas f JOIN public.methodology_rules r ON r.id = f.rule_id
       WHERE f.id = NEW.formula_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'methodology_rule_sources' THEN
    SELECT r.method_specification_id INTO v_spec FROM public.methodology_rules r WHERE r.id = NEW.rule_id;
  ELSE
    v_spec := NEW.method_specification_id;
  END IF;

  IF v_spec IS NULL THEN RETURN NEW; END IF;
  SELECT status, organization_id, true INTO v_status, v_org, v_found
    FROM public.method_specifications WHERE id = v_spec;
  IF NOT coalesce(v_found, false) THEN
    RAISE EXCEPTION 'Especificação inexistente';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'Conteúdo metodológico fora do escopo da organização da especificação (%)', TG_TABLE_NAME;
  END IF;
  IF v_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Especificação em % não aceita alteração de conteúdo (%): gere nova versão',
      v_status, TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END; $$;

-- 4. Vínculo regra-fonte: fonte global ou da mesma organização
CREATE OR REPLACE FUNCTION public.guard_rule_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_authority public.methodology_authority_level; v_src_org uuid; v_content_verified boolean;
BEGIN
  SELECT authority_level, organization_id INTO v_authority, v_src_org
    FROM public.methodology_sources WHERE id = NEW.source_id;
  IF v_authority IS NULL THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;
  IF v_src_org IS NOT NULL AND NEW.organization_id IS NOT NULL AND v_src_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Fonte metodológica pertence a outra organização';
  END IF;

  IF v_authority = 'INTERNAL_SPECIFICATION' AND NEW.relationship_type <> 'INTERNAL_DESIGN' THEN
    RAISE EXCEPTION 'Especificação interna só pode sustentar regra como INTERNAL_DESIGN: controle interno nunca é apresentado como exigência normativa externa';
  END IF;
  IF NEW.relationship_type = 'INTERNAL_DESIGN' AND v_authority <> 'INTERNAL_SPECIFICATION' THEN
    RAISE EXCEPTION 'INTERNAL_DESIGN exige fonte classificada como INTERNAL_SPECIFICATION';
  END IF;

  IF NEW.source_locator_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.methodology_source_locators l
                      WHERE l.id = NEW.source_locator_id AND l.source_id = NEW.source_id) THEN
    RAISE EXCEPTION 'Localizador não pertence à fonte vinculada';
  END IF;

  IF NEW.relationship_type IN ('DIRECT_REQUIREMENT','DIRECT_PROHIBITION') THEN
    SELECT EXISTS (SELECT 1 FROM public.methodology_source_verifications v
                    WHERE v.source_id = NEW.source_id AND v.verification_type = 'CONTENT_VERIFIED')
      INTO v_content_verified;
    IF NOT v_content_verified THEN
      RAISE EXCEPTION 'Afirmação normativa direta exige conteúdo da fonte verificado (CONTENT_VERIFIED)';
    END IF;
    IF NEW.source_locator_id IS NULL THEN
      RAISE EXCEPTION 'Afirmação normativa direta exige localizador (cláusula/seção/página) da fonte';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 5. Conflito de fontes: escopo das fontes
CREATE OR REPLACE FUNCTION public.guard_source_conflict_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_a uuid; v_b uuid; v_found_a boolean; v_found_b boolean;
BEGIN
  SELECT organization_id, true INTO v_a, v_found_a FROM public.methodology_sources WHERE id = NEW.source_a_id;
  SELECT organization_id, true INTO v_b, v_found_b FROM public.methodology_sources WHERE id = NEW.source_b_id;
  IF NOT coalesce(v_found_a, false) OR NOT coalesce(v_found_b, false) THEN
    RAISE EXCEPTION 'Fonte metodológica inexistente';
  END IF;
  IF NEW.source_a_id = NEW.source_b_id THEN
    RAISE EXCEPTION 'Conflito exige duas fontes distintas';
  END IF;
  IF (v_a IS NOT NULL AND v_a <> NEW.organization_id)
     OR (v_b IS NOT NULL AND v_b <> NEW.organization_id) THEN
    RAISE EXCEPTION 'Conflito de fontes fora do escopo da organização';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_methodology_source_conflicts_scope ON public.methodology_source_conflicts;
CREATE TRIGGER trg_methodology_source_conflicts_scope
BEFORE INSERT ON public.methodology_source_conflicts
FOR EACH ROW EXECUTE FUNCTION public.guard_source_conflict_insert();