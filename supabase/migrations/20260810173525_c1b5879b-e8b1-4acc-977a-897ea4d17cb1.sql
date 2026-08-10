-- Hardening fix: the guard triggers (case status, org immutability, verified-field
-- protection, membership guard, frozen dataset) all call public.in_privileged_op().
-- Trigger functions run as the invoking role, so signed-in users need EXECUTE on it,
-- otherwise every legitimate UPDATE fails with "permission denied for function".
-- The function only READS a transaction-local GUC; it grants no privilege by itself,
-- and the GUC can only be set inside the SECURITY DEFINER official operations.
GRANT EXECUTE ON FUNCTION public.in_privileged_op() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.in_privileged_op() FROM anon;