DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.market_intelligence_report(uuid)'::regprocedure);
  d := replace(d, '''similarity_score'', c.similarity_score', '''reason_codes'', c.reason_codes');
  EXECUTE d;
END $$;