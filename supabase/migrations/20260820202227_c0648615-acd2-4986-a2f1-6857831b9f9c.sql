CREATE OR REPLACE FUNCTION public.billing_public_info()
RETURNS TABLE(
  enabled boolean,
  provider text,
  public_key text,
  currency text,
  monthly_amount integer,
  yearly_amount integer,
  pro_label text,
  pro_pitch text,
  free_daily_signals integer,
  free_max_radius_m integer,
  free_messages_per_match integer,
  pro_unlimited_signals boolean,
  pro_extended_radius boolean,
  pro_unlimited_messages boolean,
  pro_see_who_signaled boolean,
  pro_priority_beacon boolean,
  pro_custom_beacon boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT b.enabled, b.provider, b.paystack_public_key, b.currency,
         b.monthly_amount, b.yearly_amount, b.pro_label, b.pro_pitch,
         b.free_daily_signals, b.free_max_radius_m, b.free_messages_per_match,
         b.pro_unlimited_signals, b.pro_extended_radius, b.pro_unlimited_messages,
         b.pro_see_who_signaled, b.pro_priority_beacon, b.pro_custom_beacon
  FROM public.billing_settings b
  WHERE b.id = 'global'
$function$;

GRANT SELECT (
  id, enabled, provider, paystack_public_key, currency,
  monthly_amount, yearly_amount, pro_label, pro_pitch,
  free_daily_signals, free_max_radius_m, free_messages_per_match,
  pro_unlimited_signals, pro_extended_radius, pro_unlimited_messages,
  pro_see_who_signaled, pro_priority_beacon, pro_custom_beacon
) ON public.billing_settings TO anon, authenticated;

DROP POLICY IF EXISTS billing_settings_public_safe_select ON public.billing_settings;
CREATE POLICY billing_settings_public_safe_select
ON public.billing_settings
FOR SELECT
TO anon, authenticated
USING (id = 'global');

REVOKE ALL ON FUNCTION public.billing_public_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_public_info() TO anon, authenticated, service_role;