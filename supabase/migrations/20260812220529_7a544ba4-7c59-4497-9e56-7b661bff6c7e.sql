CREATE OR REPLACE FUNCTION public.guard_methodology_source_artifact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_art record; v_src_org uuid; v_src_found boolean;
BEGIN
  -- METADATA_ONLY não é base de acesso: documento exige base legítima.
  IF NEW.access_basis NOT IN
     ('USER_PROVIDED_COPY','LICENSED_COPY','INTERNAL_AUTHORIZED_COPY','PUBLICLY_ACCESSIBLE') THEN
    RAISE EXCEPTION 'Base de acesso inválida para documento autorizado: % não é base de acesso', NEW.access_basis;
  END IF;

  SELECT organization_id, true INTO v_src_org, v_src_found
    FROM public.methodology_sources WHERE id = NEW.source_id;
  IF NOT coalesce(v_src_found, false) THEN RAISE EXCEPTION 'Fonte metodológica inexistente'; END IF;
  IF v_src_org IS NOT NULL AND v_src_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Fonte metodológica pertence a outra organização';
  END IF;

  SELECT organization_id, sha256_hash, hash_computed_by, storage_bucket
    INTO v_art FROM public.evidence_artifacts WHERE id = NEW.evidence_artifact_id;
  IF v_art IS NULL THEN RAISE EXCEPTION 'Artefato inexistente'; END IF;
  IF v_art.organization_id <> NEW.organization_id THEN
    RAISE EXCEPTION 'Artefato pertence a outra organização: cópia de terceiro nunca habilita esta organização';
  END IF;
  IF v_art.sha256_hash IS NULL OR v_art.hash_computed_by <> 'SERVER' THEN
    RAISE EXCEPTION 'Documento sem SHA-256 calculado pelo servidor não pode sustentar a fonte';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_meth_source_artifact_guard ON public.methodology_source_artifacts;
CREATE TRIGGER trg_meth_source_artifact_guard
BEFORE INSERT ON public.methodology_source_artifacts
FOR EACH ROW EXECUTE FUNCTION public.guard_methodology_source_artifact();