CREATE OR REPLACE FUNCTION public.is_org_creator(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = _org AND o.created_by = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.is_org_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_creator(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.org_has_members(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m WHERE m.organization_id = _org
  )
$$;

REVOKE ALL ON FUNCTION public.org_has_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_has_members(uuid) TO authenticated;

DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations
FOR SELECT TO authenticated
USING (is_org_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS member_insert ON public.organization_members;
CREATE POLICY member_insert ON public.organization_members
FOR INSERT TO authenticated
WITH CHECK (
  is_org_admin(organization_id)
  OR (
    user_id = auth.uid()
    AND role = 'OWNER'::org_role
    AND public.is_org_creator(organization_id)
    AND NOT public.org_has_members(organization_id)
  )
);