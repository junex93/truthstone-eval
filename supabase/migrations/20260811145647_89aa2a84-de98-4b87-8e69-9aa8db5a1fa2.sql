REVOKE ALL ON FUNCTION public.guard_research_query_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_research_candidate_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_support_check_before_verification() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;