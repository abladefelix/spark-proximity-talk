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
npm ci --no-audit --no-fund

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart skanaround

echo "==> Health checks"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3000/; then
    break
  fi
  sleep 2
done

if ! curl -sf -o /dev/null http://127.0.0.1:3000/; then
  echo "Homepage health check failed — recent logs:" >&2
  sudo journalctl -u skanaround -n 50 --no-pager >&2
  exit 1
fi

AUTH_HEADERS="$(mktemp)"
AUTH_BODY="$(mktemp)"
trap 'rm -f "$AUTH_HEADERS" "$AUTH_BODY"' EXIT
AUTH_STATUS="$(curl -sS -D "$AUTH_HEADERS" -o "$AUTH_BODY" -w '%{http_code}' \
  -X POST http://127.0.0.1:3000/api/public/username-sign-in \
  -H 'content-type: application/json' \
  --data '{"identifier":"__deployment_probe__","password":"not-a-real-password"}')"
if [[ "$AUTH_STATUS" != "401" ]] || ! grep -qi '^content-type: application/json' "$AUTH_HEADERS" \
  || ! grep -q 'Invalid login credentials' "$AUTH_BODY"; then
  echo "Username sign-in check failed: HTTP $AUTH_STATUS (expected JSON HTTP 401)." >&2
  echo "The service is stale or the sign-in route was not included in the build." >&2
  sudo journalctl -u skanaround -n 50 --no-pager >&2
  exit 1
fi

echo "OK — homepage and username sign-in endpoint passed"
