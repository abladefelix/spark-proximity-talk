alter table public.messages
  drop constraint if exists messages_kind_check;

alter table public.messages
  add constraint messages_kind_check check (kind in ('text', 'pin', 'image'));

create policy "chat_media_read_members"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-media'
  and public.is_match_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

create policy "chat_media_insert_members"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and public.is_match_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

create policy "chat_media_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'chat-media'
  and owner_id = auth.uid()::text
  and public.is_match_member(((storage.foldername(name))[1])::uuid, auth.uid())
);