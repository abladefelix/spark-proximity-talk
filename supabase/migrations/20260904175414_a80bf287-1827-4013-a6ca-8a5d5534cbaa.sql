REVOKE ALL ON FUNCTION public.nearby_people(double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nearby_people(double precision) FROM anon;
GRANT EXECUTE ON FUNCTION public.nearby_people(double precision) TO authenticated, service_role;