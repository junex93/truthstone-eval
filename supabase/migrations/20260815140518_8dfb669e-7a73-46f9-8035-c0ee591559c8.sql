-- =============================================================================
-- FASE 7H.1 — CONVITE SEGURO DE SEGUNDO MEMBRO / REVIEWER
-- Onboarding humano auditável. Nenhuma matemática, nenhuma verificação
-- normativa, nenhuma alteração de specification.
-- =============================================================================

CREATE TYPE public.invitation_status AS ENUM ('INVITED', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- 1. TABELA -------------------------------------------------------------------
CREATE TABLE public.organization_invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email             text NOT NULL,
  invited_role      public.org_role NOT NULL,
  status            public.invitation_status NOT NULL DEFAULT 'INVITED',
  -- Apenas o digest do token. O token em texto puro nunca é persistido.
  token_hash        text NOT NULL UNIQUE,
  invited_by        uuid NOT NULL REFERENCES auth.users(id),
  invited_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,
  last_sent_at      timestamptz,
  send_count        integer NOT NULL DEFAULT 0,
  accepted_by       uuid REFERENCES auth.users(id),
  accepted_at       timestamptz,
  revoked_by        uuid REFERENCES auth.users(id),
  revoked_at        timestamptz,
  revoked_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_invitation_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT chk_invitation_email_shape CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  -- Escalada de privilégio pelo fluxo de convite é impossível por construção.
  CONSTRAINT chk_invitation_role_not_owner CHECK (invited_role <> 'OWNER'),
  CONSTRAINT chk_invitation_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_invitation_accept_shape CHECK (
    (status = 'ACCEPTED' AND accepted_by IS NOT NULL AND accepted_at IS NOT NULL)
    OR (status <> 'ACCEPTED' AND accepted_by IS NULL AND accepted_at IS NULL)
  ),
  CONSTRAINT chk_invitation_revoke_shape CHECK (
    (status = 'REVOKED' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
    OR (status <> 'REVOKED')
  )
);

-- Um único convite pendente por (organização, e-mail): sem duplicidade silenciosa.
CREATE UNIQUE INDEX uq_invitation_pending_per_email
  ON public.organization_invitations (organization_id, email)
  WHERE status = 'INVITED';

CREATE INDEX idx_invitation_org_status ON public.organization_invitations (organization_id, status);
CREATE INDEX idx_invitation_email ON public.organization_invitations (email);

CREATE TRIGGER trg_invitation_touch
BEFORE UPDATE ON public.organization_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. GRANTS -------------------------------------------------------------------
-- Somente leitura pela Data API. Toda mutação passa por RPC governada.
GRANT SELECT ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;

-- 3. RLS ----------------------------------------------------------------------
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitation_admin_read" ON public.organization_invitations
FOR SELECT TO authenticated
USING (public.is_org_admin(organization_id));

CREATE POLICY "invitation_invitee_read" ON public.organization_invitations
FOR SELECT TO authenticated
USING (email = lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) AND status = 'INVITED');

-- 4. HELPERS ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_invitations(_organization_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_row record;
BEGIN
  FOR v_row IN
    SELECT id, email, invited_role FROM public.organization_invitations
    WHERE organization_id = _organization_id AND status = 'INVITED' AND expires_at <= now()
    FOR UPDATE
  LOOP
    UPDATE public.organization_invitations SET status = 'EXPIRED' WHERE id = v_row.id;
    INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, before_data, after_data)
    VALUES (_organization_id, auth.uid(), 'INVITE_EXPIRED', 'organization_invitation', v_row.id,
            jsonb_build_object('status', 'INVITED'),
            jsonb_build_object('status', 'EXPIRED', 'email', v_row.email, 'role', v_row.invited_role));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;

REVOKE ALL ON FUNCTION public.expire_stale_invitations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_invitations(uuid) TO authenticated;

-- 5. CRIAÇÃO ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organization_invitation(
  _organization_id uuid,
  _email text,
  _role public.org_role,
  _token_hash text,
  _ttl_hours integer DEFAULT 168
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(_email));
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  -- Autorização explícita: apenas OWNER/ADMIN ATIVO da própria organização.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _organization_id AND user_id = v_actor
      AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente: apenas titular ou administrador da organização pode convidar';
  END IF;

  IF _role = 'OWNER' THEN
    RAISE EXCEPTION 'Não é permitido convidar alguém como titular por este fluxo';
  END IF;
  IF _ttl_hours IS NULL OR _ttl_hours < 1 OR _ttl_hours > 720 THEN
    RAISE EXCEPTION 'Prazo de expiração inválido';
  END IF;

  PERFORM public.expire_stale_invitations(_organization_id);

  IF EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.organization_id = _organization_id AND m.status = 'ACTIVE'
      AND lower(btrim(coalesce(p.email, ''))) = v_email
  ) THEN
    RAISE EXCEPTION 'Este usuário já pertence à organização.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_invitations
    WHERE organization_id = _organization_id AND email = v_email AND status = 'INVITED'
  ) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para este e-mail.';
  END IF;

  INSERT INTO public.organization_invitations (
    organization_id, email, invited_role, token_hash, invited_by, expires_at, send_count, last_sent_at
  ) VALUES (
    _organization_id, v_email, _role, _token_hash, v_actor,
    now() + make_interval(hours => _ttl_hours), 1, now()
  ) RETURNING id INTO v_id;

  INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, after_data)
  VALUES (_organization_id, v_actor, 'INVITE_CREATED', 'organization_invitation', v_id,
          jsonb_build_object('email', v_email, 'role', _role, 'status', 'INVITED'));

  INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, after_data)
  VALUES (_organization_id, v_actor, 'INVITE_SENT', 'organization_invitation', v_id,
          jsonb_build_object('email', v_email, 'send_count', 1));

  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.create_organization_invitation(uuid, text, public.org_role, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization_invitation(uuid, text, public.org_role, text, integer) TO authenticated;

-- 6. REENVIO (rotaciona token, estende prazo) ---------------------------------
CREATE OR REPLACE FUNCTION public.resend_organization_invitation(
  _invitation_id uuid,
  _token_hash text,
  _ttl_hours integer DEFAULT 168
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_inv record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO v_inv FROM public.organization_invitations WHERE id = _invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_inv.organization_id AND user_id = v_actor
      AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente: apenas titular ou administrador da organização pode reenviar convite';
  END IF;

  IF v_inv.status <> 'INVITED' THEN
    RAISE EXCEPTION 'Somente convite pendente pode ser reenviado';
  END IF;
  IF _ttl_hours IS NULL OR _ttl_hours < 1 OR _ttl_hours > 720 THEN
    RAISE EXCEPTION 'Prazo de expiração inválido';
  END IF;

  UPDATE public.organization_invitations
  SET token_hash = _token_hash,
      expires_at = now() + make_interval(hours => _ttl_hours),
      send_count = send_count + 1,
      last_sent_at = now()
  WHERE id = _invitation_id;

  INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, after_data)
  VALUES (v_inv.organization_id, v_actor, 'INVITE_SENT', 'organization_invitation', _invitation_id,
          jsonb_build_object('email', v_inv.email, 'send_count', v_inv.send_count + 1, 'token_rotated', true));

  RETURN _invitation_id;
END; $$;

REVOKE ALL ON FUNCTION public.resend_organization_invitation(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resend_organization_invitation(uuid, text, integer) TO authenticated;

-- 7. REVOGAÇÃO ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_organization_invitation(
  _invitation_id uuid,
  _reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor uuid := auth.uid(); v_inv record;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO v_inv FROM public.organization_invitations WHERE id = _invitation_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_inv.organization_id AND user_id = v_actor
      AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Permissão insuficiente: apenas titular ou administrador da organização pode revogar convite';
  END IF;

  IF v_inv.status <> 'INVITED' THEN
    RAISE EXCEPTION 'Somente convite pendente pode ser revogado';
  END IF;

  UPDATE public.organization_invitations
  SET status = 'REVOKED', revoked_by = v_actor, revoked_at = now(), revoked_reason = _reason
  WHERE id = _invitation_id;

  INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, before_data, after_data)
  VALUES (v_inv.organization_id, v_actor, 'INVITE_REVOKED', 'organization_invitation', _invitation_id,
          jsonb_build_object('status', 'INVITED'),
          jsonb_build_object('status', 'REVOKED', 'email', v_inv.email, 'reason', _reason));

  RETURN _invitation_id;
END; $$;

REVOKE ALL ON FUNCTION public.revoke_organization_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_organization_invitation(uuid, text) TO authenticated;

-- 8. INSPEÇÃO DO CONVITE PELO CONVIDADO (sem revelar token) -------------------
CREATE OR REPLACE FUNCTION public.inspect_organization_invitation(_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_inv record;
  v_org_name text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;

  SELECT * INTO v_inv FROM public.organization_invitations WHERE token_hash = _token_hash;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'reason', 'NOT_FOUND');
  END IF;

  SELECT name INTO v_org_name FROM public.organizations WHERE id = v_inv.organization_id;

  RETURN jsonb_build_object(
    'found', true,
    'organization_id', v_inv.organization_id,
    'organization_name', v_org_name,
    'invited_role', v_inv.invited_role,
    'status', v_inv.status,
    'expires_at', v_inv.expires_at,
    'expired', v_inv.expires_at <= now(),
    'email_matches', v_inv.email = v_actor_email,
    'already_member', EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = v_inv.organization_id AND user_id = v_actor AND status = 'ACTIVE'
    )
  );
END; $$;

REVOKE ALL ON FUNCTION public.inspect_organization_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inspect_organization_invitation(text) TO authenticated;

-- 9. ACEITE ATÔMICO -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_inv record;
  v_member_id uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
  IF v_actor_email = '' THEN RAISE EXCEPTION 'Conta autenticada sem e-mail verificável'; END IF;

  SELECT * INTO v_inv FROM public.organization_invitations
  WHERE token_hash = _token_hash FOR UPDATE;

  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Convite inválido.'; END IF;

  IF v_inv.status = 'ACCEPTED' THEN RAISE EXCEPTION 'Este convite já foi utilizado.'; END IF;
  IF v_inv.status = 'REVOKED' THEN RAISE EXCEPTION 'Este convite foi revogado.'; END IF;
  IF v_inv.status = 'EXPIRED' THEN RAISE EXCEPTION 'Este convite expirou.'; END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.organization_invitations SET status = 'EXPIRED' WHERE id = v_inv.id;
    INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, after_data)
    VALUES (v_inv.organization_id, v_actor, 'INVITE_EXPIRED', 'organization_invitation', v_inv.id,
            jsonb_build_object('status', 'EXPIRED'));
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  -- O e-mail autenticado precisa ser exatamente o e-mail convidado.
  IF v_inv.email <> v_actor_email THEN
    RAISE EXCEPTION 'Este convite foi endereçado a outro e-mail.';
  END IF;

  IF v_inv.invited_role = 'OWNER' THEN
    RAISE EXCEPTION 'Papel de convite não autorizado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = v_inv.organization_id AND user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'Este usuário já pertence à organização.';
  END IF;

  INSERT INTO public.profiles (id, email)
  VALUES (v_actor, v_actor_email)
  ON CONFLICT (id) DO UPDATE SET email = coalesce(public.profiles.email, excluded.email);

  -- O papel vem do convite aprovado, nunca do payload do convidado.
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_inv.organization_id, v_actor, v_inv.invited_role, 'ACTIVE')
  RETURNING id INTO v_member_id;

  UPDATE public.organization_invitations
  SET status = 'ACCEPTED', accepted_by = v_actor, accepted_at = now()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_log (organization_id, actor_user_id, event_type, entity_type, entity_id, before_data, after_data)
  VALUES (v_inv.organization_id, v_actor, 'INVITE_ACCEPTED', 'organization_invitation', v_inv.id,
          jsonb_build_object('status', 'INVITED'),
          jsonb_build_object('status', 'ACCEPTED', 'role', v_inv.invited_role, 'member_id', v_member_id));

  RETURN jsonb_build_object(
    'organization_id', v_inv.organization_id,
    'member_id', v_member_id,
    'role', v_inv.invited_role
  );
END; $$;

REVOKE ALL ON FUNCTION public.accept_organization_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation(text) TO authenticated;