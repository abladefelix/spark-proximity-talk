create table if not exists public.device_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_label text not null default 'Unknown device',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  primary key (user_id, device_id)
);

grant select, delete on public.device_sessions to authenticated;
grant all on public.device_sessions to service_role;

alter table public.device_sessions enable row level security;

create policy "own device sessions readable" on public.device_sessions
  for select to authenticated using (user_id = auth.uid());

create policy "own device sessions removable" on public.device_sessions
  for delete to authenticated using (user_id = auth.uid());

create index if not exists device_sessions_user_idx on public.device_sessions(user_id);