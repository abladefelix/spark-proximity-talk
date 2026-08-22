alter table public.billing_settings
  drop column if exists paystack_public_key,
  drop column if exists paystack_secret_key,
  drop column if exists monthly_plan_code,
  drop column if exists yearly_plan_code,
  add column if not exists rc_ios_api_key text,
  add column if not exists rc_android_api_key text,
  add column if not exists rc_entitlement_id text not null default 'pro',
  add column if not exists rc_monthly_product_id text,
  add column if not exists rc_yearly_product_id text,
  add column if not exists rc_webhook_secret text;

update public.billing_settings set provider = 'revenuecat' where id = 'global';
alter table public.billing_settings alter column provider set default 'revenuecat';

drop function if exists public.billing_public_info();

create or replace function public.billing_public_info()
returns table(
  enabled boolean,
  provider text,
  ios_api_key text,
  android_api_key text,
  entitlement_id text,
  monthly_product_id text,
  yearly_product_id text,
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
  select b.enabled, b.provider, b.rc_ios_api_key, b.rc_android_api_key,
         b.rc_entitlement_id, b.rc_monthly_product_id, b.rc_yearly_product_id,
         b.currency, b.monthly_amount, b.yearly_amount, b.pro_label, b.pro_pitch,
         b.free_daily_signals, b.free_max_radius_m, b.free_messages_per_match,
         b.pro_unlimited_signals, b.pro_extended_radius, b.pro_unlimited_messages,
         b.pro_see_who_signaled, b.pro_priority_beacon, b.pro_custom_beacon
  from public.billing_settings b where b.id = 'global'
$$;

revoke all on function public.billing_public_info() from public;
revoke all on function public.billing_public_info() from anon;
grant execute on function public.billing_public_info() to authenticated, service_role;