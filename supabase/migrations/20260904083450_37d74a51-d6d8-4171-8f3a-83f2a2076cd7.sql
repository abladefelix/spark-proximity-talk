DROP FUNCTION IF EXISTS public.admin_activity_log(text, text, uuid, integer, integer, integer);
DROP FUNCTION IF EXISTS public.admin_activity_log_summary(integer);

CREATE OR REPLACE FUNCTION public.admin_activity_log(
  _category text DEFAULT NULL,
  _search text DEFAULT NULL,
  _user uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, category text, action text, severity text,
  actor_id uuid, actor_label text, target_id uuid, target_label text,
  summary text, meta jsonb, total_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz; _until timestamptz;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  _since := coalesce(_from, now() - interval '30 days');
  _until := least(coalesce(_to, now()), now());
  IF _until - _since > interval '366 days' THEN
    _since := _until - interval '366 days';
  END IF;
  RETURN QUERY
  WITH filtered AS (
    SELECT l.* FROM public.activity_log l
    WHERE l.created_at >= _since
      AND l.created_at <= _until
      AND (_category IS NULL OR _category = '' OR _category = 'all' OR l.category = _category)
      AND (_user IS NULL OR l.actor_id = _user OR l.target_id = _user)
      AND (
        _search IS NULL OR _search = '' OR
        l.summary ILIKE '%' || _search || '%' OR
        l.action ILIKE '%' || _search || '%' OR
        coalesce(l.actor_label, '') ILIKE '%' || _search || '%' OR
        coalesce(l.target_label, '') ILIKE '%' || _search || '%' OR
        l.meta::text ILIKE '%' || _search || '%'
      )
  ), counted AS (SELECT count(*) AS n FROM filtered)
  SELECT f.id, f.created_at, f.category, f.action, f.severity, f.actor_id, f.actor_label,
         f.target_id, f.target_label, f.summary, f.meta, c.n
  FROM filtered f CROSS JOIN counted c
  ORDER BY f.created_at DESC
  LIMIT greatest(least(coalesce(_limit, 50), 500), 1)
  OFFSET greatest(coalesce(_offset, 0), 0);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_activity_log_summary(
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
) RETURNS TABLE(category text, events bigint, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz; _until timestamptz;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  _since := coalesce(_from, now() - interval '30 days');
  _until := least(coalesce(_to, now()), now());
  IF _until - _since > interval '366 days' THEN
    _since := _until - interval '366 days';
  END IF;
  RETURN QUERY
  SELECT l.category, count(*), max(l.created_at)
  FROM public.activity_log l
  WHERE l.created_at >= _since AND l.created_at <= _until
  GROUP BY l.category
  ORDER BY count(*) DESC;
END; $$;

REVOKE ALL ON FUNCTION public.admin_activity_log(text, text, uuid, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activity_log(text, text, uuid, timestamptz, timestamptz, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_activity_log_summary(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activity_log_summary(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_activity_log(text, text, uuid, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_log_summary(timestamptz, timestamptz) TO authenticated;