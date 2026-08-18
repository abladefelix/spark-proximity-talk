CREATE TABLE public.email_settings (
  id text PRIMARY KEY DEFAULT 'global',
  provider text NOT NULL DEFAULT 'smtp',
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_user text,
  smtp_password text,
  from_name text,
  from_email text,
  reply_to text,
  enabled boolean NOT NULL DEFAULT false,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email settings"
ON public.email_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;