-- helper: admin or moderator
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'moderator')
$$;

revoke all on function public.is_staff(uuid) from public;
grant execute on function public.is_staff(uuid) to authenticated;

-- role management (admins only)
create policy user_roles_insert_admin on public.user_roles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy user_roles_delete_admin on public.user_roles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
grant insert, delete on public.user_roles to authenticated;

-- staff oversight
create policy profiles_update_staff on public.profiles
  for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy profiles_delete_admin on public.profiles
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
grant delete on public.profiles to authenticated;

create policy signals_select_staff on public.signals
  for select to authenticated using (public.is_staff(auth.uid()));
create policy signals_delete_staff on public.signals
  for delete to authenticated using (public.is_staff(auth.uid()));

create policy matches_select_staff on public.matches
  for select to authenticated using (public.is_staff(auth.uid()));
create policy matches_delete_staff on public.matches
  for delete to authenticated using (public.is_staff(auth.uid()));
grant delete on public.matches to authenticated;

create policy messages_delete_staff on public.messages
  for delete to authenticated using (public.is_staff(auth.uid()));
grant delete on public.messages to authenticated;

create policy blocks_select_staff on public.blocks
  for select to authenticated using (public.is_staff(auth.uid()));

create policy reports_delete_staff on public.reports
  for delete to authenticated using (public.is_staff(auth.uid()));
grant delete on public.reports to authenticated;

create policy locations_select_staff on public.locations
  for select to authenticated using (public.is_staff(auth.uid()));

-- one-time bootstrap: first caller becomes admin if no admin exists
create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return false; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then return false; end if;
  insert into public.user_roles (user_id, role) values (me, 'admin')
    on conflict (user_id, role) do nothing;
  return true;
end;
$$;

revoke all on function public.claim_first_admin() from public;
grant execute on function public.claim_first_admin() to authenticated;

-- has an admin been claimed yet?
create or replace function public.admin_exists()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'admin')
$$;

revoke all on function public.admin_exists() from public;
grant execute on function public.admin_exists() to authenticated;

-- dashboard stats
create or replace function public.admin_stats()
returns table(people bigint, online bigint, verified bigint, signals bigint, matches bigint, messages bigint, reports bigint, blocks bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.locations where updated_at > now() - interval '5 minutes' and is_visible),
    (select count(*) from public.profiles where verified),
    (select count(*) from public.signals),
    (select count(*) from public.matches),
    (select count(*) from public.messages),
    (select count(*) from public.reports),
    (select count(*) from public.blocks);
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;