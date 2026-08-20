DO $do$
DECLARE r record; def text;
BEGIN
  FOR r IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('public','private')
      AND p.prosrc ~ 'public\.(is_staff|has_role|is_match_member|is_pro)\s*\('
  LOOP
    def := pg_get_functiondef(r.oid);
    def := regexp_replace(def, 'public\.(is_staff|has_role|is_match_member|is_pro)\s*\(', 'private.\1(', 'g');
    EXECUTE def;
  END LOOP;
END
$do$;