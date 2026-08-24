create or replace function private.can_view_avatar(_owner text, _viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _viewer is not null
     and _owner ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (
       _owner::uuid = _viewer
       or private.is_staff(_viewer)
       or exists (
         select 1 from public.matches m
         where (m.user_a = _viewer and m.user_b = _owner::uuid)
            or (m.user_b = _viewer and m.user_a = _owner::uuid)
       )
       or exists (
         select 1 from public.signals s
         where (s.from_user = _viewer and s.to_user = _owner::uuid)
            or (s.to_user = _viewer and s.from_user = _owner::uuid)
       )
       or exists (
         select 1
         from public.locations l
         join public.profiles p on p.id = l.user_id
         where l.user_id = _owner::uuid
           and l.is_visible
           and l.updated_at > now() - interval '30 minutes'
           and coalesce(p.banned, false) = false
       )
     )
$$;

revoke all on function private.can_view_avatar(text, uuid) from public, anon;
grant execute on function private.can_view_avatar(text, uuid) to authenticated;

create or replace function private.is_active_member(_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = _viewer and coalesce(p.banned, false) = false
  )
$$;

revoke all on function private.is_active_member(uuid) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and private.can_view_avatar((storage.foldername(name))[1], auth.uid())
);

drop policy if exists "Members can view chat backgrounds" on storage.objects;
create policy "Members can view chat backgrounds" on storage.objects
for select to authenticated
using (bucket_id = 'chat-backgrounds' and private.is_active_member(auth.uid()));

drop policy if exists "Members can view radar tones" on storage.objects;
create policy "Members can view radar tones" on storage.objects
for select to authenticated
using (bucket_id = 'radar-tones' and private.is_active_member(auth.uid()));

drop policy if exists "rr_delete_own" on public.reactivation_requests;
create policy "rr_delete_own" on public.reactivation_requests
for delete to authenticated
using (user_id = auth.uid());