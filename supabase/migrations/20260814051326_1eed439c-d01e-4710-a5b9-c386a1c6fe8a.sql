revoke execute on function public.admin_activity_report(integer) from anon, public;
revoke execute on function public.admin_exists() from anon, public;
revoke execute on function public.admin_purge_stale_locations() from anon, public;
revoke execute on function public.admin_review_reactivation(uuid, boolean) from anon, public;
revoke execute on function public.admin_set_ban(uuid, boolean, text) from anon, public;
revoke execute on function public.admin_stats() from anon, public;
revoke execute on function public.admin_wipe_user_activity(uuid) from anon, public;
revoke execute on function public.claim_first_admin() from anon, public;
revoke execute on function public.is_staff(uuid) from anon, public;
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_match_member(uuid, uuid) from anon, public;
revoke execute on function public.nearby_people(double precision) from anon, public;
revoke execute on function public.purge_expired_signals() from anon, public;

revoke execute on function public.has_role(uuid, public.app_role) from authenticated;
revoke execute on function public.is_staff(uuid) from authenticated;
revoke execute on function public.is_match_member(uuid, uuid) from authenticated;

create or replace function public.purge_expired_signals()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;
  delete from public.signals s
  where s.expires_at < now()
    and not exists (
      select 1 from public.matches m
      where m.user_a = least(s.from_user, s.to_user)
        and m.user_b = greatest(s.from_user, s.to_user)
    );
end;
$$;
revoke execute on function public.purge_expired_signals() from public, anon;
grant execute on function public.purge_expired_signals() to authenticated, service_role;