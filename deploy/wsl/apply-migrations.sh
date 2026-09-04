#!/usr/bin/env bash
# SKANAROUND — apply repo database migrations to the self-hosted backend.
#
#   bash deploy/wsl/apply-migrations.sh [app-dir] [stack-dir]
#
# Every .sql file in supabase/migrations is applied once, in filename order,
# and recorded in public.repo_migrations so re-running is safe. After applying,
# the API layer's schema cache is reloaded so new functions are callable
# immediately (otherwise the app reports "Could not find the function ... in
# the schema cache").

set -euo pipefail

APP_DIR="${1:-/srv/skanaround}"
STACK_DIR="${2:-/srv/supabase}"
MIG_DIR="$APP_DIR/supabase/migrations"

[[ -d "$MIG_DIR" ]] || { echo "No migrations directory at $MIG_DIR" >&2; exit 1; }
[[ -d "$STACK_DIR" ]] || { echo "No backend stack at $STACK_DIR" >&2; exit 1; }

cd "$STACK_DIR"

psql_run() { docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

echo "==> Ensuring migration ledger"
psql_run -q -c "create table if not exists public.repo_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);"

applied=0
skipped=0
for file in "$MIG_DIR"/*.sql; do
  name="$(basename "$file")"
  exists="$(psql_run -tAc "select 1 from public.repo_migrations where name = '$name'" || true)"
  if [[ "$exists" == "1" ]]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "    applying $name"
  if ! psql_run -q < "$file"; then
    echo "Migration $name failed — stopping before the app is rebuilt." >&2
    exit 1
  fi
  psql_run -q -c "insert into public.repo_migrations (name) values ('$name') on conflict do nothing;"
  applied=$((applied + 1))
done

echo "    $applied applied, $skipped already present"

echo "==> Reloading the API schema cache"
psql_run -q -c "notify pgrst, 'reload schema';" || true
docker compose restart rest >/dev/null 2>&1 || true
sleep 3

echo "==> Verifying the functions the app calls"
MISSING="$(psql_run -tAc "
  with needed(name) as (
    values ('set_my_intent'),('set_my_mood'),('drop_help_beacon'),
           ('nearby_help_beacons'),('post_broadcast'),('nearby_people')
  )
  select string_agg(n.name, ', ')
  from needed n
  where not exists (
    select 1 from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = n.name
  );" || true)"

if [[ -n "${MISSING// /}" ]]; then
  echo "These database functions are still missing: $MISSING" >&2
  echo "The app will show errors until they exist. Check the migration output above." >&2
  exit 1
fi

echo "OK — database is up to date"
