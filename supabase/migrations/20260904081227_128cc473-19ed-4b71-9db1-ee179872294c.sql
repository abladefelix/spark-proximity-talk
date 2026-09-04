-- Activity log: an organised, admin-only record of what happens in the app.

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  category text NOT NULL,
  action text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  actor_id uuid,
  actor_label text,
  target_id uuid,
  target_label text,
  summary text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT ALL ON public.activity_log TO service_role;
GRANT SELECT ON public.activity_log TO authenticated;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff read activity log" ON public.activity_log;
CREATE POLICY "staff read activity log" ON public.activity_log
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_category_idx ON public.activity_log (category, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_actor_idx ON public.activity_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_target_idx ON public.activity_log (target_id, created_at DESC);

-- Helper: human label for a person.
CREATE OR REPLACE FUNCTION private.person_label(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(nullif(p.display_name, ''), p.username, left(_id::text, 8))
  FROM public.profiles p WHERE p.id = _id
$$;

CREATE OR REPLACE FUNCTION private.write_log(
  _category text, _action text, _severity text,
  _actor uuid, _target uuid, _summary text, _meta jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_log (category, action, severity, actor_id, actor_label, target_id, target_label, summary, meta)
  VALUES (_category, _action, coalesce(_severity, 'info'),
          _actor, CASE WHEN _actor IS NULL THEN NULL ELSE private.person_label(_actor) END,
          _target, CASE WHEN _target IS NULL THEN NULL ELSE private.person_label(_target) END,
          coalesce(_summary, ''), coalesce(_meta, '{}'::jsonb));
EXCEPTION WHEN OTHERS THEN
  -- Logging must never break the action being logged.
  RETURN;
END;
$$;

-- People ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_profile_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('people', 'signup', 'info', NEW.id, NEW.id,
    'New member joined', jsonb_build_object('username', NEW.username, 'gender', NEW.gender));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF NEW.banned IS DISTINCT FROM OLD.banned THEN
    PERFORM private.write_log('moderation', CASE WHEN NEW.banned THEN 'suspended' ELSE 'reinstated' END,
      CASE WHEN NEW.banned THEN 'warning' ELSE 'info' END, me, NEW.id,
      CASE WHEN NEW.banned THEN 'Member suspended' ELSE 'Member reinstated' END,
      jsonb_build_object('reason', NEW.banned_reason));
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    PERFORM private.write_log('moderation', CASE WHEN NEW.verified THEN 'verified' ELSE 'unverified' END,
      'info', me, NEW.id,
      CASE WHEN NEW.verified THEN 'Member verified' ELSE 'Verification removed' END, '{}'::jsonb);
  END IF;
  IF NEW.username IS DISTINCT FROM OLD.username
     OR NEW.display_name IS DISTINCT FROM OLD.display_name
     OR NEW.bio IS DISTINCT FROM OLD.bio
     OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     OR NEW.gender IS DISTINCT FROM OLD.gender THEN
    PERFORM private.write_log('people', 'profile_updated', 'info', me, NEW.id, 'Profile details changed',
      jsonb_build_object(
        'username', CASE WHEN NEW.username IS DISTINCT FROM OLD.username THEN OLD.username || ' -> ' || NEW.username END,
        'display_name', CASE WHEN NEW.display_name IS DISTINCT FROM OLD.display_name THEN NEW.display_name END,
        'gender', CASE WHEN NEW.gender IS DISTINCT FROM OLD.gender THEN NEW.gender END,
        'avatar_changed', NEW.avatar_url IS DISTINCT FROM OLD.avatar_url,
        'bio_changed', NEW.bio IS DISTINCT FROM OLD.bio));
  END IF;
  RETURN NEW;
END; $$;

-- Activity -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('signals', 'signal_sent', 'info', NEW.from_user, NEW.to_user,
    'Signal sent', jsonb_build_object('intent', NEW.intent, 'note', NEW.intent_note));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_match() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('chats', 'match_created', 'info', NEW.user_a, NEW.user_b,
    'Two people matched and can chat', jsonb_build_object('match_id', NEW.id));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE other uuid;
BEGIN
  SELECT CASE WHEN m.user_a = NEW.sender_id THEN m.user_b ELSE m.user_a END
    INTO other FROM public.matches m WHERE m.id = NEW.match_id;
  PERFORM private.write_log('chats', 'message_sent', 'info', NEW.sender_id, other,
    'Message sent',
    jsonb_build_object('match_id', NEW.match_id, 'kind', NEW.kind, 'length', length(coalesce(NEW.content, ''))));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_block() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('moderation', 'blocked', 'warning', NEW.blocker, NEW.blocked,
    'One member blocked another', '{}'::jsonb);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('moderation', 'reported', 'warning', NEW.reporter, NEW.reported,
    'Member reported', jsonb_build_object('reason', NEW.reason));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_verification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.write_log('verification', 'verification_requested', 'info', NEW.user_id, NEW.user_id,
      'Verification requested', jsonb_build_object('source', NEW.source));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM private.write_log('verification', 'verification_' || NEW.status, 'info', auth.uid(), NEW.user_id,
      'Verification ' || NEW.status, '{}'::jsonb);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_reactivation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.write_log('moderation', 'appeal_submitted', 'info', NEW.user_id, NEW.user_id,
      'Suspension appeal submitted', jsonb_build_object('message', left(NEW.message, 300)));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM private.write_log('moderation', 'appeal_' || NEW.status, 'info', auth.uid(), NEW.user_id,
      'Appeal ' || NEW.status, '{}'::jsonb);
  END IF;
  RETURN NEW;
END; $$;

-- Money ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    PERFORM private.write_log('billing', 'subscription_' || NEW.status, 'info', auth.uid(), NEW.user_id,
      'Subscription ' || NEW.status,
      jsonb_build_object('plan', NEW.plan, 'source', NEW.source, 'expires_at', NEW.expires_at));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM private.write_log('billing', 'payment_' || NEW.status,
    CASE WHEN NEW.status = 'success' THEN 'info' ELSE 'warning' END,
    NEW.user_id, NEW.user_id, 'Payment ' || NEW.status,
    jsonb_build_object('reference', NEW.reference, 'plan', NEW.plan,
                       'amount', NEW.amount, 'currency', NEW.currency));
  RETURN NEW;
END; $$;

-- Admin ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM private.write_log('admin', 'role_granted', 'warning', auth.uid(), NEW.user_id,
      'Role granted: ' || NEW.role::text, '{}'::jsonb);
    RETURN NEW;
  END IF;
  PERFORM private.write_log('admin', 'role_revoked', 'warning', auth.uid(), OLD.user_id,
    'Role removed: ' || OLD.role::text, '{}'::jsonb);
  RETURN OLD;
END; $$;

CREATE OR REPLACE FUNCTION public.log_settings_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[];
BEGIN
  SELECT coalesce(array_agg(key), '{}') INTO changed
  FROM jsonb_each(to_jsonb(NEW)) n
  WHERE n.value IS DISTINCT FROM (to_jsonb(OLD) -> n.key) AND n.key <> 'updated_at';
  IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;
  PERFORM private.write_log('admin', 'settings_changed', 'info', auth.uid(), NULL,
    TG_TABLE_NAME || ' updated', jsonb_build_object('table', TG_TABLE_NAME, 'fields', to_jsonb(changed)));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.log_device_session() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.device_id IS NOT DISTINCT FROM OLD.device_id THEN RETURN NEW; END IF;
  PERFORM private.write_log('access', 'signed_in', 'info', NEW.user_id, NEW.user_id,
    'Signed in on a device', jsonb_build_object('device', NEW.device_label));
  RETURN NEW;
END; $$;

-- Triggers -------------------------------------------------------------
DROP TRIGGER IF EXISTS profiles_log_insert ON public.profiles;
CREATE TRIGGER profiles_log_insert AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_insert();
DROP TRIGGER IF EXISTS profiles_log_update ON public.profiles;
CREATE TRIGGER profiles_log_update AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_update();
DROP TRIGGER IF EXISTS signals_log ON public.signals;
CREATE TRIGGER signals_log AFTER INSERT ON public.signals FOR EACH ROW EXECUTE FUNCTION public.log_signal();
DROP TRIGGER IF EXISTS matches_log ON public.matches;
CREATE TRIGGER matches_log AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.log_match();
DROP TRIGGER IF EXISTS messages_log ON public.messages;
CREATE TRIGGER messages_log AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_message();
DROP TRIGGER IF EXISTS blocks_log ON public.blocks;
CREATE TRIGGER blocks_log AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.log_block();
DROP TRIGGER IF EXISTS reports_log ON public.reports;
CREATE TRIGGER reports_log AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.log_report();
DROP TRIGGER IF EXISTS verification_requests_log ON public.verification_requests;
CREATE TRIGGER verification_requests_log AFTER INSERT OR UPDATE ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.log_verification();
DROP TRIGGER IF EXISTS reactivation_requests_log ON public.reactivation_requests;
CREATE TRIGGER reactivation_requests_log AFTER INSERT OR UPDATE ON public.reactivation_requests FOR EACH ROW EXECUTE FUNCTION public.log_reactivation();
DROP TRIGGER IF EXISTS subscriptions_log ON public.subscriptions;
CREATE TRIGGER subscriptions_log AFTER INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.log_subscription();
DROP TRIGGER IF EXISTS payments_log ON public.payments;
CREATE TRIGGER payments_log AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_payment();
DROP TRIGGER IF EXISTS user_roles_log ON public.user_roles;
CREATE TRIGGER user_roles_log AFTER INSERT OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_role_change();
DROP TRIGGER IF EXISTS app_settings_log ON public.app_settings;
CREATE TRIGGER app_settings_log AFTER UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();
DROP TRIGGER IF EXISTS billing_settings_log ON public.billing_settings;
CREATE TRIGGER billing_settings_log AFTER UPDATE ON public.billing_settings FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();
DROP TRIGGER IF EXISTS device_sessions_log ON public.device_sessions;
CREATE TRIGGER device_sessions_log AFTER INSERT OR UPDATE ON public.device_sessions FOR EACH ROW EXECUTE FUNCTION public.log_device_session();

-- Reading the log ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_activity_log(
  _category text DEFAULT NULL,
  _search text DEFAULT NULL,
  _user uuid DEFAULT NULL,
  _days integer DEFAULT 30,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, category text, action text, severity text,
  actor_id uuid, actor_label text, target_id uuid, target_label text,
  summary text, meta jsonb, total_count bigint
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  _since := now() - make_interval(days => greatest(least(coalesce(_days, 30), 365), 1));
  RETURN QUERY
  WITH filtered AS (
    SELECT l.* FROM public.activity_log l
    WHERE l.created_at >= _since
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

CREATE OR REPLACE FUNCTION public.admin_activity_log_summary(_days integer DEFAULT 30)
RETURNS TABLE(category text, events bigint, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT l.category, count(*), max(l.created_at)
  FROM public.activity_log l
  WHERE l.created_at >= now() - make_interval(days => greatest(least(coalesce(_days, 30), 365), 1))
  GROUP BY l.category
  ORDER BY count(*) DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_purge_activity_log(_days integer DEFAULT 180)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.activity_log WHERE created_at < now() - make_interval(days => greatest(coalesce(_days, 180), 1));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.admin_activity_log(text, text, uuid, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_activity_log_summary(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_purge_activity_log(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_activity_log(text, text, uuid, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity_log_summary(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_activity_log(integer) TO authenticated;