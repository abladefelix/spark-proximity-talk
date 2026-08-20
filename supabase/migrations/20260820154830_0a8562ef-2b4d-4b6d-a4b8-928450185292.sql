create table if not exists public.billing_settings (
  id text primary key default 'global',
  enabled boolean not null default false,
  provider text not null default 'paystack',
  paystack_public_key text,
  paystack_secret_key text,
  currency text not null default 'GHS',
  monthly_amount integer not null default 0,
  yearly_amount integer not null default 0,
  monthly_plan_code text,
  yearly_plan_code text,
  pro_label text not null default 'SKANAROUND Pro',
  pro_pitch text not null default 'Unlock unlimited signals, longer range and more.',
  free_daily_signals integer not null default 5,
  free_max_radius_m integer not null default 500,
  free_messages_per_match integer not null default 0,
  pro_unlimited_signals boolean not null default true,
  pro_extended_radius boolean not null default true,
  pro_unlimited_messages boolean not null default true,
  pro_see_who_signaled boolean not null default true,
  pro_priority_beacon boolean not null default true,
  pro_custom_beacon boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.billing_settings (id) values ('global') on conflict (id) do nothing;

grant select, update on public.billing_settings to authenticated;
grant all on public.billing_settings to service_role;
alter table public.billing_settings enable row level security;

drop policy if exists billing_settings_staff_select on public.billing_settings;
create policy billing_settings_staff_select on public.billing_settings
  for select to authenticated using (public.is_staff(auth.uid()));

drop policy if exists billing_settings_admin_update on public.billing_settings;
create policy billing_settings_admin_update on public.billing_settings
  for update to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists billing_settings_touch on public.billing_settings;
create trigger billing_settings_touch before update on public.billing_settings
  for each row execute function public.touch_updated_at();

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  plan text not null default 'monthly',
  source text not null default 'paystack',
  reference text,
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_own_select on public.subscriptions;
create policy subscriptions_own_select on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists subscriptions_staff_select on public.subscriptions;
create policy subscriptions_staff_select on public.subscriptions
  for select to authenticated using (public.is_staff(auth.uid()));

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  reference text not null unique,
  plan text not null default 'monthly',
  amount integer not null default 0,
  currency text not null default 'GHS',
  status text not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now()
);

grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

drop policy if exists payments_own_select on public.payments;
create policy payments_own_select on public.payments
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists payments_staff_select on public.payments;
create policy payments_staff_select on public.payments
  for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.is_pro(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = _user_id
      and s.status = 'active'
      and (s.expires_at is null or s.expires_at > now())
  )
$$;

revoke all on function public.is_pro(uuid) from public;
revoke all on function public.is_pro(uuid) from anon;
grant execute on function public.is_pro(uuid) to authenticated, service_role;

create or replace function public.billing_public_info()
returns table(
  enabled boolean,
  provider text,
  public_key text,
  currency text,
  monthly_amount integer,
  yearly_amount integer,
  pro_label text,
  pro_pitch text,
  free_daily_signals integer,
  free_max_radius_m integer,
  free_messages_per_match integer,
  pro_unlimited_signals boolean,
  pro_extended_radius boolean,
  pro_unlimited_messages boolean,
  pro_see_who_signaled boolean,
  pro_priority_beacon boolean,
  pro_custom_beacon boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select b.enabled, b.provider, b.paystack_public_key, b.currency,
         b.monthly_amount, b.yearly_amount, b.pro_label, b.pro_pitch,
         b.free_daily_signals, b.free_max_radius_m, b.free_messages_per_match,
         b.pro_unlimited_signals, b.pro_extended_radius, b.pro_unlimited_messages,
         b.pro_see_who_signaled, b.pro_priority_beacon, b.pro_custom_beacon
  from public.billing_settings b where b.id = 'global'
$$;

revoke all on function public.billing_public_info() from public;
revoke all on function public.billing_public_info() from anon;
grant execute on function public.billing_public_info() to authenticated, service_role;

create or replace function public.admin_set_subscription(_user_id uuid, _active boolean, _days integer default 30, _plan text default 'admin')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'not authorized'; end if;
  if _active then
    insert into public.subscriptions (user_id, status, plan, source, expires_at)
    values (_user_id, 'active', _plan, 'admin',
            case when _days is null or _days <= 0 then null else now() + make_interval(days => _days) end)
    on conflict (user_id) do update
      set status = 'active', plan = excluded.plan, source = 'admin',
          expires_at = excluded.expires_at, updated_at = now();
  else
    update public.subscriptions set status = 'cancelled', updated_at = now() where user_id = _user_id;
  end if;
end;
$$;

revoke all on function public.admin_set_subscription(uuid, boolean, integer, text) from public;
revoke all on function public.admin_set_subscription(uuid, boolean, integer, text) from anon;
grant execute on function public.admin_set_subscription(uuid, boolean, integer, text) to authenticated, service_role;

create or replace function public.admin_billing_stats()
returns table(active_subs bigint, expiring_30d bigint, paid_total bigint, revenue_minor bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query select
    (select count(*) from public.subscriptions s where s.status = 'active' and (s.expires_at is null or s.expires_at > now())),
    (select count(*) from public.subscriptions s where s.status = 'active' and s.expires_at is not null and s.expires_at between now() and now() + interval '30 days'),
    (select count(*) from public.payments p where p.status = 'success'),
    (select coalesce(sum(p.amount), 0) from public.payments p where p.status = 'success');
end;
$$;

revoke all on function public.admin_billing_stats() from public;
revoke all on function public.admin_billing_stats() from anon;
grant execute on function public.admin_billing_stats() to authenticated, service_role;

create or replace function public.apply_signal_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare hrs integer; lim integer; sent integer; free_lim integer; pro boolean; unlimited boolean;
begin
  select signal_expiry_hours, daily_signal_limit into hrs, lim
  from public.app_settings where id = 'global';
  hrs := coalesce(hrs, 6);
  lim := coalesce(lim, 100);

  select free_daily_signals, (pro_unlimited_signals and enabled)
    into free_lim, unlimited
  from public.billing_settings where id = 'global';

  NEW.expires_at := now() + (hrs || ' hours')::interval;

  pro := public.is_pro(NEW.from_user);

  if coalesce(unlimited, false) and pro then
    return NEW;
  end if;

  if not pro and coalesce(free_lim, 0) > 0 then
    lim := least(lim, free_lim);
  end if;

  if lim > 0 then
    select count(*) into sent from public.signals s
    where s.from_user = NEW.from_user and s.created_at > now() - interval '24 hours';
    if sent >= lim then
      raise exception 'daily signal limit reached';
    end if;
  end if;
  return NEW;
end;
$$;

revoke all on function public.apply_signal_rules() from public;
revoke all on function public.apply_signal_rules() from anon;
revoke all on function public.apply_signal_rules() from authenticated;