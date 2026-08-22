DROP POLICY IF EXISTS billing_settings_public_safe_select ON public.billing_settings;
REVOKE SELECT ON public.billing_settings FROM anon;