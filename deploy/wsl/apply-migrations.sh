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
# Tolerant variant: keeps executing after errors so we can fill in the gaps of
# a partially-applied migration (each failing statement is inspected after).
psql_fill() { docker compose exec -T db psql -U postgres -d postgres "$@"; }

echo "==> Ensuring migration ledger"
psql_run -q -c "create table if not exists public.repo_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);"

# Servers installed before repo_migrations already contain the mature core
# schema. Replaying the early history against that schema is unsafe: old
# CREATE OR REPLACE FUNCTION statements can have return signatures that were
# deliberately replaced by later migrations. Mark only the legacy history as
# the baseline, then run the idempotent reconciliation migration and everything
# after it normally. A genuinely empty database still runs every migration.
BASELINE_BEFORE="20260904042446_a1d0fb0d-5fef-47c6-b1be-80a00052653f.sql"
ledger_count="$(psql_run -tAc "select count(*) from public.repo_migrations")"
core_count="$(psql_run -tAc "
  select count(*)
  from (values ('profiles'), ('locations'), ('app_settings'), ('user_roles')) required(name)
  where to_regclass('public.' || required.name) is not null;
")"

if [[ "$ledger_count" == "0" && "$core_count" == "4" ]]; then
  echo "    existing core database detected — recording legacy migration baseline"
  baselined=0
  for file in "$MIG_DIR"/*.sql; do
    name="$(basename "$file")"
    [[ "$name" < "$BASELINE_BEFORE" ]] || continue
    psql_run -q -c "insert into public.repo_migrations (name) values ('$name') on conflict do nothing;"
    baselined=$((baselined + 1))
  done
  echo "    $baselined legacy migrations recorded; reconciliation will run next"
fi

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
  # Run each migration in a single transaction so a failure can never leave
  # the schema half-applied.
  if ! out="$(psql_run -q --single-transaction < "$file" 2>&1)"; then
    # Databases installed before this ledger existed may already contain part
    # of a migration. Re-run it statement-by-statement: statements whose
    # objects already exist are skipped, everything else is created, and any
    # remaining genuine error still aborts the deploy.
    echo "    $name: partly present from the pre-ledger install — filling in the gaps"
    out2="$(psql_fill -q < "$file" 2>&1)" || true
    bad="$(grep -i 'ERROR' <<<"$out2" | grep -viE 'already exists|duplicate key' || true)"
    if [[ -n "$bad" ]]; then
      echo "$out2" >&2
      echo "Migration $name failed — stopping before the app is rebuilt." >&2
      exit 1
    fi
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
    values
      ('admin_activity_log'), ('admin_activity_log_summary'),
      ('admin_activity_report'), ('admin_billing_stats'), ('admin_exists'),
      ('admin_purge_stale_locations'), ('admin_review_reactivation'),
      ('admin_set_ban'), ('admin_set_subscription'), ('admin_stats'),
      ('admin_wipe_user_activity'), ('answer_broadcast'),
      ('billing_public_info'), ('chat_retention'), ('claim_first_admin'),
      ('claim_zone_perk'), ('drop_help_beacon'), ('my_profile_private'),
      ('my_zone'), ('nearby_broadcasts'), ('nearby_help_beacons'),
      ('nearby_people'), ('post_broadcast'), ('purge_expired_signals'),
      ('purge_old_chats'), ('set_chat_vanish'), ('set_my_intent'),
      ('set_my_mood'), ('signal_broadcast_author'), ('staff_profiles')
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
