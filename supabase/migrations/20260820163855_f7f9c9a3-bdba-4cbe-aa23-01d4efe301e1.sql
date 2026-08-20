-- Lock down profiles for anonymous role (no policies exist for it anyway)
REVOKE ALL ON public.profiles FROM anon;

-- Ensure sensitive profile columns are never readable through the table API
REVOKE SELECT (date_of_birth, banned, banned_reason, banned_at) ON public.profiles FROM authenticated, anon;
REVOKE UPDATE (banned, banned_reason, banned_at, verified) ON public.profiles FROM authenticated, anon;

-- Restrict the profiles SELECT policy to the non-sensitive discovery surface
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Internal RLS helpers must not be callable directly by signed-in users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_match_member(uuid, uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_pro(uuid) FROM authenticated, anon, public;
