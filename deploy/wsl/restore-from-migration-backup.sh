#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo." >&2
  exit 1
fi

ARCHIVE="${1:-}"
[[ -n "$ARCHIVE" && -f "$ARCHIVE" ]] || {
  echo "Usage: sudo bash $0 /path/to/SKANAROUND_BACKUP_....tar.gz" >&2
  exit 1
}

APP_DIR="/srv/skanaround"
STACK_DIR="/srv/supabase"
ROOT="/var/tmp/skanaround-restore-$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$ROOT/extracted"

if [[ -f "$ARCHIVE.sha256" ]]; then
  (cd "$(dirname "$ARCHIVE")" && sha256sum -c "$(basename "$ARCHIVE.sha256")")
fi

tar -C "$ROOT/extracted" -xzf "$ARCHIVE"
BACKUP_DIR="$(find "$ROOT/extracted" -mindepth 1 -maxdepth 1 -type d -name 'SKANAROUND_BACKUP_*' | head -1)"

[[ -n "$BACKUP_DIR" ]] || { echo "Backup payload not found." >&2; exit 1; }
[[ -d "$APP_DIR/.git" ]] || { echo "$APP_DIR must contain the cloned repo." >&2; exit 1; }
[[ -f "$STACK_DIR/.env" ]] || { echo "Restore /srv/supabase/.env before running this script." >&2; exit 1; }

cd "$STACK_DIR"
docker compose up -d db

for i in $(seq 1 60); do
  docker compose exec -T db pg_isready -U postgres -d postgres >/dev/null 2>&1 && break
  sleep 2
done

echo "==> Restoring PostgreSQL"
cat "$BACKUP_DIR/database/postgres.dump" | docker compose exec -T db pg_restore   -U postgres   -d postgres   --clean   --if-exists   --no-owner   --no-privileges

echo "==> Restoring storage"
if [[ -f "$BACKUP_DIR/storage/storage-files.tar.gz" ]]; then
  rm -rf "$STACK_DIR/volumes/storage"
  mkdir -p "$STACK_DIR/volumes"
  tar -C "$STACK_DIR/volumes" -xzf "$BACKUP_DIR/storage/storage-files.tar.gz"
fi

echo
echo "DATA RESTORE COMPLETE"
echo "Now restore protected config files, start the full stack, deploy the app, and validate before DNS cutover."
