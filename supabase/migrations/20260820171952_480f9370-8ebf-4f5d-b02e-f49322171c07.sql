create or replace function public.enforce_message_limits()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
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
      and s.active
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
$$;

revoke all on function public.enforce_message_limits() from public, anon, authenticated;

drop trigger if exists messages_enforce_limits on public.messages;
create trigger messages_enforce_limits
before insert on public.messages
for each row execute function public.enforce_message_limits();