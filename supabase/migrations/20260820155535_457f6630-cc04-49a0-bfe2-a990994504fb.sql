-- 1. Column-level protection for profiles: hide birthdate and moderation fields
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username, display_name, bio, avatar_url, created_at, updated_at,
  verified, last_seen, gender, chat_background, radar_sound, radar_tone)
  ON public.profiles TO authenticated;

-- owner reads of sensitive own fields via definer function
CREATE OR REPLACE FUNCTION public.my_profile_private()
RETURNS TABLE(banned boolean, banned_reason text, banned_at timestamptz, date_of_birth date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select p.banned, p.banned_reason, p.banned_at, p.date_of_birth
  from public.profiles p where p.id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.my_profile_private() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_private() TO authenticated;

-- staff listing including moderation fields
CREATE OR REPLACE FUNCTION public.staff_profiles(_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, username text, display_name text, bio text, avatar_url text,
  gender text, verified boolean, banned boolean, banned_reason text,
  last_seen timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query
    select p.id, p.username, p.display_name, p.bio, p.avatar_url, p.gender, p.verified,
           p.banned, p.banned_reason, p.last_seen, p.created_at
    from public.profiles p
    order by p.created_at desc
    limit greatest(least(coalesce(_limit, 200), 1000), 1);
end;
$$;
REVOKE ALL ON FUNCTION public.staff_profiles(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.staff_profiles(integer) TO authenticated;

-- 2. Restrict is_pro so signed-in users can only check themselves (or staff can check anyone)
CREATE OR REPLACE FUNCTION public.is_pro(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is not null and _user_id <> auth.uid() and not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;
  return exists (
    select 1 from public.subscriptions s
    where s.user_id = _user_id and s.active and (s.expires_at is null or s.expires_at > now())
  );
end;
$$;
REVOKE ALL ON FUNCTION public.is_pro(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated;

-- 3. Internal helpers must not be callable by signed-in users
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_match_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;