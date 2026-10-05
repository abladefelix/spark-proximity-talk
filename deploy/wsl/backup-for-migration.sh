#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

APP_DIR="/srv/skanaround"
STACK_DIR="/srv/supabase"
OUT_DIR="${1:-/var/backups/skanaround-migration}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$OUT_DIR/work-$STAMP"
PAYLOAD="$WORK/SKANAROUND_BACKUP_$STAMP"
ARCHIVE="$OUT_DIR/SKANAROUND_BACKUP_$STAMP.tar.gz"

mkdir -p "$PAYLOAD/database" "$PAYLOAD/storage" "$PAYLOAD/meta"
chmod 700 "$WORK" "$PAYLOAD"

cleanup() {
  rm -rf "$WORK"
}
trap cleanup EXIT

[[ -d "$APP_DIR/.git" ]] || { echo "Missing $APP_DIR" >&2; exit 1; }
[[ -f "$STACK_DIR/docker-compose.yml" ]] || { echo "Missing $STACK_DIR/docker-compose.yml" >&2; exit 1; }

cd "$STACK_DIR"
docker compose ps >/dev/null

echo "==> Recording metadata"
{
  echo "created_utc=$STAMP"
  echo "hostname=$(hostname)"
  echo "app_commit=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true)"
  echo "app_branch=$(git -C "$APP_DIR" branch --show-current 2>/dev/null || true)"
  echo "supabase_commit=$(git -C "$STACK_DIR" rev-parse HEAD 2>/dev/null || true)"
} > "$PAYLOAD/meta/backup-info.txt"

echo "==> Dumping PostgreSQL"
docker compose exec -T db pg_dump   -U postgres   -d postgres   --clean   --if-exists   --no-owner   --no-privileges   --format=custom   > "$PAYLOAD/database/postgres.dump"

echo "==> Backing up Supabase storage"
if [[ -d "$STACK_DIR/volumes/storage" ]]; then
  tar -C "$STACK_DIR/volumes" -czf "$PAYLOAD/storage/storage-files.tar.gz" storage
else
  echo "WARNING: $STACK_DIR/volumes/storage not found" > "$PAYLOAD/storage/README.txt"
fi

echo "==> Creating archive"
mkdir -p "$OUT_DIR"
tar -C "$WORK" -czf "$ARCHIVE" "$(basename "$PAYLOAD")"
chmod 600 "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
chmod 600 "$ARCHIVE.sha256"

echo
echo "BACKUP COMPLETE"
echo "Archive:  $ARCHIVE"
echo "Checksum: $ARCHIVE.sha256"
echo
echo "IMPORTANT: This archive does not contain protected environment files."
echo "Copy these separately using a secure channel:"
echo "  /srv/supabase/.env"
echo "  /etc/skanaround-backend.env"
echo "  /etc/skanaround.env (if present)"
echo "  /etc/caddy/Caddyfile"
echo "  /etc/systemd/system/skanaround.service"
