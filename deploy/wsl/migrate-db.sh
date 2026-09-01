#!/usr/bin/env bash
# SKANAROUND — copy the managed database into the self-hosted one.
#
#   bash deploy/wsl/migrate-db.sh "<SOURCE_POSTGRES_URL>" [stack-dir]
#
# SOURCE_POSTGRES_URL is the direct connection string of the current backend
# (postgresql://postgres:<password>@<host>:5432/postgres).
#
# Copies: auth users, public schema (tables/functions/triggers/policies),
# storage metadata. Storage FILES are copied separately by migrate-storage.mjs.
#
# Run this with the app stopped so nothing writes mid-copy.

set -euo pipefail

SRC="${1:?usage: migrate-db.sh <source-postgres-url> [stack-dir]}"
STACK_DIR="${2:-/srv/supabase}"
DUMP_DIR="${DUMP_DIR:-/var/backups/skanaround-migration}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$DUMP_DIR"

echo "==> Ensuring pg client tools (v15+)"
if ! command -v pg_dump >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y postgresql-client-common postgresql-client
fi

echo "==> Dumping roles + data from source"
pg_dumpall --roles-only --no-role-passwords -d "$SRC" > "$DUMP_DIR/roles-$STAMP.sql" || true

pg_dump -d "$SRC" \
  --schema=public --schema=auth --schema=storage \
  --no-owner --no-privileges --no-comments \
  --exclude-table-data='storage.s3_multipart_uploads*' \
  --format=plain --file "$DUMP_DIR/data-$STAMP.sql"

echo "==> Restoring into the self-hosted database"
cd "$STACK_DIR"
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "$DUMP_DIR/data-$STAMP.sql"

echo "==> Re-applying grants/policies from repo migrations (idempotent safety net)"
echo "    (skipped by default — run manually if the dump reported policy errors)"

echo "==> Sanity check"
docker compose exec -T db psql -U postgres -d postgres -c \
  "select (select count(*) from auth.users) as users, (select count(*) from public.profiles) as profiles;"

echo "Dumps kept in $DUMP_DIR (contain personal data — delete when done)."
