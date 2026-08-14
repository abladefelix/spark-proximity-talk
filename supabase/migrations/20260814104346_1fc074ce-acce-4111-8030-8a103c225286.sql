ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS chat_ttl_days integer NOT NULL DEFAULT 30;

CREATE OR REPLACE FUNCTION public.purge_old_chats()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _days integer;
  _deleted integer := 0;
BEGIN
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
$$;

REVOKE ALL ON FUNCTION public.purge_old_chats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_old_chats() TO authenticated, service_role;