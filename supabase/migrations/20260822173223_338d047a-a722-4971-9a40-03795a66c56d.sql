alter table public.billing_settings
  add column if not exists web_checkout_enabled boolean not null default false,
  add column if not exists paystack_public_key text,
  add column if not exists paystack_secret_key text,
  add column if not exists web_currency text not null default 'GHS',
  add column if not exists web_monthly_amount integer not null default 0,
  add column if not exists web_yearly_amount integer not null default 0;