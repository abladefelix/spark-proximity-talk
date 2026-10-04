-- Repair first-admin bootstrap permissions on the self-hosted production backend.
-- Lovable Cloud received this fix via Drizzle, but the Azure deployment applies
-- only supabase/migrations, so keep the production migration path authoritative.

REVOKE ALL ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO service_role;

REVOKE ALL ON FUNCTION public.admin_exists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO service_role;
