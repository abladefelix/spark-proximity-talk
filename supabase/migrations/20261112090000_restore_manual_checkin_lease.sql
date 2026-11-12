-- Internal screen navigation must not terminate a manually-created lease.
-- The app may restore this private expiry when Radar is opened again; it cannot
-- extend or create a check-in through this read-only function.
create or replace function public.get_my_location_checkin()
returns timestamptz
language sql
stable
security definer
set search_path = private, pg_temp
as $$
  select c.expires_at
  from private.location_checkins c
  where c.user_id = auth.uid()
    and c.expires_at > now()
  limit 1;
$$;

revoke all on function public.get_my_location_checkin() from public, anon;
grant execute on function public.get_my_location_checkin() to authenticated;
