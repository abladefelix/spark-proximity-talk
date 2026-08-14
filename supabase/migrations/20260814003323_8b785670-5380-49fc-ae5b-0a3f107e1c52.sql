
CREATE TABLE public.backup_settings (
  id text PRIMARY KEY DEFAULT 'global',
  destination text NOT NULL DEFAULT 'download',
  schedule text NOT NULL DEFAULT 'manual',
  s3_endpoint text,
  s3_region text DEFAULT 'auto',
  s3_bucket text,
  s3_prefix text DEFAULT 'shatta-backups',
  s3_access_key_id text,
  s3_secret_access_key text,
  gdrive_folder_id text,
  gdrive_client_id text,
  gdrive_client_secret text,
  gdrive_refresh_token text,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- credentials: server-only. no anon/authenticated grants on purpose.
GRANT ALL ON public.backup_settings TO service_role;
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.backup_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

CREATE TRIGGER backup_settings_touch BEFORE UPDATE ON public.backup_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  object_key text,
  size_bytes bigint,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY backup_runs_select_staff ON public.backup_runs
FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_activity_report(_days integer DEFAULT 30)
RETURNS TABLE(day date, signups bigint, signals bigint, matches bigint, messages bigint, active_people bigint, reports bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'not authorized'; end if;
  return query
  with days as (
    select generate_series(
      (current_date - (greatest(least(_days, 365), 1) - 1))::date,
      current_date,
      interval '1 day'
    )::date as d
  )
  select d.d,
    (select count(*) from public.profiles p where p.created_at::date = d.d),
    (select count(*) from public.signals s where s.created_at::date = d.d),
    (select count(*) from public.matches m where m.created_at::date = d.d),
    (select count(*) from public.messages ms where ms.created_at::date = d.d),
    (select count(*) from public.profiles p where p.last_seen::date = d.d),
    (select count(*) from public.reports r where r.created_at::date = d.d)
  from days d
  order by d.d;
end;
$$;
