#!/usr/bin/env bash
# SKANAROUND — pull, build, restart inside WSL.
#   bash deploy/wsl/deploy.sh [branch] [app-dir]

set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="${2:-/srv/skanaround}"

cd "$APP_DIR"

echo "==> Fetching $BRANCH"
git fetch --all --prune
git reset --hard "origin/$BRANCH"

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart skanaround

echo "==> Health check"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3000/; then
    echo "OK — app responding on 127.0.0.1:3000"
    exit 0
  fi
  sleep 2
done

echo "Health check failed — recent logs:" >&2
sudo journalctl -u skanaround -n 50 --no-pager >&2
exit 1
