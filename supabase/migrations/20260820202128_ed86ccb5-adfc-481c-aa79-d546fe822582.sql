REVOKE ALL ON FUNCTION public.billing_public_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_public_info() TO anon, authenticated, service_role;