alter table public.billing_settings
  add column if not exists pro_chat_ttl_days integer not null default 90,
  add column if not exists pro_extended_chat_history boolean not null default true;

insert into public.pro_features (key, label, description, pro_only, sort_order)
values ('extended_chat_history', 'Longer chat history',
        'Keep your links and conversations for longer before they disappear.', true, 60)
on conflict (key) do nothing;

create or replace function public.chat_retention()
returns table(free_days integer, pro_days integer, effective_days integer, is_pro boolean)
language plpgsql
stable
security definer
set search_path to 'public', 'private'
as $$
declare _free integer; _pro integer; _ext boolean; _billing boolean; _ispro boolean;
begin
  select a.chat_ttl_days into _free from public.app_settings a where a.id = 'global';
  _free := coalesce(_free, 30);
  select b.pro_chat_ttl_days, coalesce(b.pro_extended_chat_history, false), coalesce(b.enabled, false)
    into _pro, _ext, _billing
  from public.billing_settings b where b.id = 'global';
  _pro := coalesce(_pro, _free);
  _ispro := coalesce(private.is_pro(auth.uid()), false);
  return query select _free, _pro,
    case when _billing and _ext and _ispro then greatest(_pro, _free) else _free end,
    _ispro;
end;
$$;

revoke all on function public.chat_retention() from public, anon;
grant execute on function public.chat_retention() to authenticated, service_role;

create or replace function public.purge_old_chats()
returns integer
language plpgsql
security definer
set search_path to 'public', 'private'
as $$
declare _free integer; _pro integer; _ext boolean; _billing boolean; _deleted integer := 0;
begin
  if not private.is_staff(auth.uid()) then
    raise exception 'not authorized';
  end if;

  select chat_ttl_days into _free from public.app_settings where id = 'global';
  if _free is null or _free <= 0 then
    return 0;
  end if;

  select pro_chat_ttl_days, coalesce(pro_extended_chat_history, false), coalesce(enabled, false)
    into _pro, _ext, _billing
  from public.billing_settings where id = 'global';
  _pro := greatest(coalesce(_pro, _free), _free);

  create temporary table _keep on commit drop as
  select m.id,
         case when _billing and _ext and (private.is_pro(m.user_a) or private.is_pro(m.user_b))
              then _pro else _free end as days
  from public.matches m;

  delete from public.messages msg
  using _keep k
  where msg.match_id = k.id
    and msg.created_at < now() - make_interval(days => k.days);
  get diagnostics _deleted = row_count;

  delete from public.matches m
  using _keep k
  where m.id = k.id
    and m.created_at < now() - make_interval(days => k.days)
    and not exists (select 1 from public.messages x where x.match_id = m.id);

  return _deleted;
end;
$$;

revoke all on function public.purge_old_chats() from public, anon;
grant execute on function public.purge_old_chats() to authenticated, service_role;