drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or private.is_staff(auth.uid())
  or exists (
    select 1 from public.matches m
    where (m.user_a = auth.uid() and m.user_b = profiles.id)
       or (m.user_b = auth.uid() and m.user_a = profiles.id)
  )
  or exists (
    select 1 from public.signals s
    where (s.from_user = auth.uid() and s.to_user = profiles.id)
       or (s.to_user = auth.uid() and s.from_user = profiles.id)
  )
);

create or replace function public.enforce_message_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  free_lim integer;
  unlimited boolean;
  billing_on boolean;
  pro boolean;
  sent integer;
begin
  select b.free_messages_per_match,
         coalesce(b.pro_unlimited_messages, false),
         coalesce(b.enabled, false)
    into free_lim, unlimited, billing_on
  from public.billing_settings b where b.id = 'global';

  if not coalesce(billing_on, false) then
    return NEW;
  end if;

  if coalesce(free_lim, 0) <= 0 then
    return NEW;
  end if;

  pro := exists (
    select 1 from public.subscriptions s
    where s.user_id = NEW.sender_id
      and s.status = 'active'
      and (s.expires_at is null or s.expires_at > now())
  );

  if pro and unlimited then
    return NEW;
  end if;

  select count(*) into sent
  from public.messages m
  where m.match_id = NEW.match_id and m.sender_id = NEW.sender_id;

  if sent >= free_lim then
    raise exception 'free message limit reached for this chat';
  end if;

  return NEW;
end;
$function$;