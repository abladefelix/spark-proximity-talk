#!/usr/bin/env bash
# Run on the existing Ubuntu host as the normal deploy user.
set -euo pipefail
umask 077
APP_DIR=/srv/skanaround
BRANCH=codex/review-demo-access
cd "$APP_DIR"
BACKUP_DIR="$HOME/skanaround-backups/$(date -u +%Y%m%dT%H%M%SZ)-review-safety"
mkdir -p "$BACKUP_DIR"
git rev-parse HEAD > "$BACKUP_DIR/previous-commit.txt"
git diff > "$BACKUP_DIR/working-tree.patch"
git diff --cached > "$BACKUP_DIR/staged.patch"
git ls-files --modified --others --exclude-standard -z > "$BACKUP_DIR/local-files.list"
tar --null -T "$BACKUP_DIR/local-files.list" -czf "$BACKUP_DIR/local-files.tgz"
# Keep a database recovery point locally on the server, never in GitHub.
(cd /srv/supabase && sudo docker compose exec -T db pg_dump -U postgres -d postgres -Fc) > "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/database.dump"
for envfile in .env .env.local; do
  if [[ -f "$envfile" ]]; then cp "$envfile" "$BACKUP_DIR/$(basename "$envfile")"; fi
done
printf 'Recovery files saved at %s\n' "$BACKUP_DIR"
git fetch origin "$BRANCH"
git show "origin/$BRANCH:deploy/wsl/deploy.sh" > "$BACKUP_DIR/deploy.sh"
bash "$BACKUP_DIR/deploy.sh" "$BRANCH" "$APP_DIR"
printf '\nReview safety deployment finished. Verify the iOS acceptance screen and manual check-in before resubmitting.\n'
