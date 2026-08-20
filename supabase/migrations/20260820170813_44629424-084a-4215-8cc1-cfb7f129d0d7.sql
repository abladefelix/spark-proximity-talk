alter table public.verification_requests
  alter column selfie_path drop not null;
alter table public.verification_requests
  add column if not exists source text not null default 'selfie';