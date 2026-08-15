CREATE OR REPLACE FUNCTION public.list_my_pending_invitations()
RETURNS TABLE (
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  invited_role public.org_role,
  email text,
  invited_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.organization_id,
    o.name,
    i.invited_role,
    i.email,
    i.invited_at,
    i.expires_at
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE auth.uid() IS NOT NULL
    AND lower(btrim(coalesce(auth.jwt() ->> 'email', ''))) <> ''
    AND i.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    AND i.status = 'INVITED'
    AND i.expires_at > now()
  ORDER BY i.invited_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_my_pending_invitations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_pending_invitations() TO authenticated;