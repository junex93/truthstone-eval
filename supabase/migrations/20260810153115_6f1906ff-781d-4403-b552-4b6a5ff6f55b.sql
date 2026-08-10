
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_write(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_review(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.write_audit_event(uuid,uuid,text,text,uuid,jsonb,jsonb,jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, public.org_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_event(uuid,uuid,text,text,uuid,jsonb,jsonb,jsonb) TO authenticated;
