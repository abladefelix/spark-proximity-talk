
revoke execute on function public.apply_signal_rules() from authenticated, anon;
revoke execute on function public.purge_old_chats() from anon;

create or replace function public.purge_old_chats()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  _days integer;
  _deleted integer := 0;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT chat_ttl_days INTO _days FROM public.app_settings WHERE id = 'global';
  IF _days IS NULL OR _days <= 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.messages
  WHERE created_at < now() - (_days || ' days')::interval;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  DELETE FROM public.matches m
  WHERE m.created_at < now() - (_days || ' days')::interval
    AND NOT EXISTS (SELECT 1 FROM public.messages x WHERE x.match_id = m.id);

  RETURN _deleted;
END;
$function$;

revoke all on function public.purge_old_chats() from public, anon;
grant execute on function public.purge_old_chats() to authenticated, service_role;

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
