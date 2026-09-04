REVOKE EXECUTE ON FUNCTION public.billing_public_info() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_public_info() TO authenticated, service_role;