-- staff can hide/remove someone's radar presence
create policy locations_update_staff on public.locations
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy locations_delete_staff on public.locations
  for delete to authenticated using (public.is_staff(auth.uid()));
grant update, delete on public.locations to authenticated;

-- wipe all traces of a person's activity (signals, matches, messages)
create or replace function public.admin_wipe_user_activity(_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.messages m using public.matches mt
    where m.match_id = mt.id and (mt.user_a = _user_id or mt.user_b = _user_id);
  delete from public.matches where user_a = _user_id or user_b = _user_id;
  delete from public.signals where from_user = _user_id or to_user = _user_id;
end;
$$;

revoke all on function public.admin_wipe_user_activity(uuid) from public;
grant execute on function public.admin_wipe_user_activity(uuid) to authenticated;

-- clear stale radar locations
create or replace function public.admin_purge_stale_locations()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  delete from public.locations where updated_at < now() - interval '24 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_purge_stale_locations() from public;
grant execute on function public.admin_purge_stale_locations() to authenticated;