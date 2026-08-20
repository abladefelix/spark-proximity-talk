create or replace function private.is_pro(_user_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public','private'
as $function$
begin
  if auth.uid() is not null and _user_id <> auth.uid() and not private.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;
  return exists (
    select 1 from public.subscriptions s
    where s.user_id = _user_id
      and s.status = 'active'
      and (s.expires_at is null or s.expires_at > now())
  );
end;
$function$;
revoke all on function private.is_pro(uuid) from public, anon;
grant execute on function private.is_pro(uuid) to authenticated, service_role;