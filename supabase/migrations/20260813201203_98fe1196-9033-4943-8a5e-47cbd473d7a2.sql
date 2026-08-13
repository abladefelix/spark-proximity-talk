
REVOKE ALL ON FUNCTION public.handle_signal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_match_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_match_member(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.nearby_people(double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_people(double precision) TO authenticated;
