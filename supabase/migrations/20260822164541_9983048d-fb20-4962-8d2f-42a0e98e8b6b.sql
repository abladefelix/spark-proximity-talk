alter table public.billing_settings
  add column if not exists rc_secret_api_key text;