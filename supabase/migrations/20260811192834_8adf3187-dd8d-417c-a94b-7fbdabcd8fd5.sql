REVOKE ALL ON FUNCTION public.verify_snapshot_integrity(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_intelligence_report(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_snapshot_integrity(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.market_intelligence_report(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_snapshot_integrity(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_intelligence_report(uuid) TO authenticated;