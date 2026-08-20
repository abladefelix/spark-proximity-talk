CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.is_staff(uuid) SET SCHEMA private;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION public.is_match_member(uuid, uuid) SET SCHEMA private;
ALTER FUNCTION public.is_pro(uuid) SET SCHEMA private;

ALTER FUNCTION private.is_staff(uuid) SET search_path = public, private;
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public, private;
ALTER FUNCTION private.is_match_member(uuid, uuid) SET search_path = public, private;
ALTER FUNCTION private.is_pro(uuid) SET search_path = public, private;

GRANT EXECUTE ON FUNCTION private.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_match_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_pro(uuid) TO authenticated, service_role;