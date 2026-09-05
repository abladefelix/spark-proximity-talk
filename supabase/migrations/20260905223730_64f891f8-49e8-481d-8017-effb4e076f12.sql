alter table public.app_settings
  add column if not exists max_vanish_hours integer not null default 168;

alter table public.matches
  alter column vanish_hours set default 168;

-- clamp existing chats to the admin maximum
update public.matches m
set vanish_hours = s.max_vanish_hours
from public.app_settings s
where s.id = 'global'
  and s.max_vanish_hours > 0
  and (m.vanish_hours = 0 or m.vanish_hours > s.max_vanish_hours);

create or replace function public.set_chat_vanish(_match_id uuid, _hours integer, _on_leave boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  cap integer;
  hours integer;
begin
  if me is null then raise exception 'Not signed in'; end if;

  select coalesce(max_vanish_hours, 0) into cap from public.app_settings where id = 'global';
  cap := coalesce(cap, 0);

  hours := greatest(coalesce(_hours, 0), 0);
  if cap > 0 then
    if hours = 0 or hours > cap then
      hours := cap;
    end if;
  end if;

  update public.matches m
     set vanish_hours = hours,
         vanish_on_leave = coalesce(_on_leave, false)
   where m.id = _match_id and (m.user_a = me or m.user_b = me);
  if not found then raise exception 'Not your chat'; end if;
end;
$$;
revoke execute on function public.set_chat_vanish(uuid, integer, boolean) from anon, public;
grant execute on function public.set_chat_vanish(uuid, integer, boolean) to authenticated;

-- new chats inherit the admin maximum
create or replace function public.apply_match_vanish_default()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare cap integer;
begin
  select coalesce(max_vanish_hours, 0) into cap from public.app_settings where id = 'global';
  cap := coalesce(cap, 0);
  if cap > 0 and (new.vanish_hours is null or new.vanish_hours = 0 or new.vanish_hours > cap) then
    new.vanish_hours := cap;
  end if;
  return new;
end;
$$;

drop trigger if exists match_vanish_default on public.matches;
create trigger match_vanish_default
  before insert on public.matches
  for each row execute function public.apply_match_vanish_default();