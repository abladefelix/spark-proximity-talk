CREATE TABLE public.pro_features (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  pro_only boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pro_features TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_features TO authenticated;
GRANT ALL ON public.pro_features TO service_role;
ALTER TABLE public.pro_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_features_read" ON public.pro_features FOR SELECT USING (true);
CREATE POLICY "pro_features_admin" ON public.pro_features FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER pro_features_touch BEFORE UPDATE ON public.pro_features
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.pro_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  entitlement_id text NOT NULL DEFAULT 'pro',
  monthly_product_id text,
  yearly_product_id text,
  currency text NOT NULL DEFAULT 'USD',
  monthly_amount integer NOT NULL DEFAULT 0,
  yearly_amount integer NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pro_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_packages TO authenticated;
GRANT ALL ON public.pro_packages TO service_role;
ALTER TABLE public.pro_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pro_packages_read" ON public.pro_packages FOR SELECT USING (true);
CREATE POLICY "pro_packages_admin" ON public.pro_packages FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER pro_packages_touch BEFORE UPDATE ON public.pro_packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.pro_features (key, label, description, pro_only, sort_order)
SELECT * FROM (VALUES
  ('unlimited_signals', 'Unlimited signals', 'Signal as many people a day as you like.', COALESCE((SELECT pro_unlimited_signals FROM public.billing_settings WHERE id='global'), true), 10),
  ('extended_radius', 'Full scan range', 'Scan out to the maximum range the admin allows.', COALESCE((SELECT pro_extended_radius FROM public.billing_settings WHERE id='global'), true), 20),
  ('unlimited_messages', 'Unlimited messages', 'No cap on messages in a chat.', COALESCE((SELECT pro_unlimited_messages FROM public.billing_settings WHERE id='global'), true), 30),
  ('see_who_signaled', 'See everyone who signalled you', 'Reveal the name and photo of people who signal you.', COALESCE((SELECT pro_see_who_signaled FROM public.billing_settings WHERE id='global'), true), 40),
  ('priority_beacon', 'Priority beacon', 'Stand out on nearby radars.', COALESCE((SELECT pro_priority_beacon FROM public.billing_settings WHERE id='global'), true), 50),
  ('custom_beacon', 'Custom beacon look', 'Pick a personalised beacon style.', COALESCE((SELECT pro_custom_beacon FROM public.billing_settings WHERE id='global'), true), 60),
  ('invisible_mode', 'Go invisible', 'Scan without showing your own beacon.', true, 70)
) AS v(key, label, description, pro_only, sort_order);

INSERT INTO public.pro_packages (name, description, entitlement_id, monthly_product_id, yearly_product_id, currency, monthly_amount, yearly_amount, features, active, sort_order)
SELECT
  COALESCE(b.pro_label, 'SKANAROUND Pro'),
  COALESCE(b.pro_pitch, ''),
  COALESCE(b.rc_entitlement_id, 'pro'),
  b.rc_monthly_product_id,
  b.rc_yearly_product_id,
  COALESCE(b.currency, 'USD'),
  COALESCE(b.monthly_amount, 0),
  COALESCE(b.yearly_amount, 0),
  ARRAY(SELECT key FROM public.pro_features WHERE pro_only),
  true,
  10
FROM public.billing_settings b WHERE b.id = 'global';