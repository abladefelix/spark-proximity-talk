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

echo "==> Applying self-hosted backend values to .env"
# The repo .env is version-controlled and holds the MANAGED (Lovable) backend
# values, so `git reset --hard` above puts them back on every deploy. The
# browser bundle bakes VITE_* in at build time, so without this overlay the
# freshly deployed app talks to the old managed database.
BACKEND_ENV="/etc/skanaround-backend.env"
[[ -f "$BACKEND_ENV" ]] || BACKEND_ENV="/etc/skanaround.env"

read_kv() { grep -m1 "^$1=" "$2" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true; }

SUPA_URL="$(read_kv SUPABASE_URL "$BACKEND_ENV")"
[[ -n "$SUPA_URL" ]] || SUPA_URL="$(read_kv VITE_SUPABASE_URL "$BACKEND_ENV")"
ANON="$(read_kv SUPABASE_PUBLISHABLE_KEY "$BACKEND_ENV")"
[[ -n "$ANON" ]] || ANON="$(read_kv SUPABASE_ANON_KEY "$BACKEND_ENV")"
[[ -n "$ANON" ]] || ANON="$(read_kv VITE_SUPABASE_PUBLISHABLE_KEY "$BACKEND_ENV")"
[[ -n "$ANON" ]] || ANON="$(read_kv VITE_SUPABASE_ANON_KEY "$BACKEND_ENV")"

if [[ -z "$SUPA_URL" || -z "$ANON" ]]; then
  echo "Could not read SUPABASE_URL / key from $BACKEND_ENV." >&2
  echo "Run: sudo bash deploy/wsl/use-selfhost-backend.sh api.skanaround.bytenetdigital.com" >&2
  exit 1
fi

case "$SUPA_URL" in
  *supabase.co*)
    echo "Refusing to build: $BACKEND_ENV still points at the managed backend ($SUPA_URL)." >&2
    echo "Run: sudo bash deploy/wsl/use-selfhost-backend.sh api.skanaround.bytenetdigital.com" >&2
    exit 1;;
esac

set_env() { # key value
  local k="$1" v="$2"
  if grep -q "^$k=" .env 2>/dev/null; then
    python3 - .env "$k" "$v" <<'PY'
import sys, re
f, k, v = sys.argv[1:4]
lines = open(f).read().splitlines()
open(f, "w").write("\n".join(f"{k}={v}" if re.match(rf"^{re.escape(k)}=", l) else l for l in lines) + "\n")
PY
  else
    printf '%s=%s\n' "$k" "$v" >> .env
  fi
}

touch .env
set_env SUPABASE_URL "$SUPA_URL"
set_env VITE_SUPABASE_URL "$SUPA_URL"
set_env SUPABASE_PUBLISHABLE_KEY "$ANON"
set_env SUPABASE_ANON_KEY "$ANON"
set_env VITE_SUPABASE_PUBLISHABLE_KEY "$ANON"
set_env VITE_SUPABASE_PROJECT_ID "selfhosted"
set_env SUPABASE_PROJECT_ID "selfhosted"
echo "    backend -> $SUPA_URL"

echo "==> Installing dependencies"
npm ci --no-audit --no-fund

echo "==> Building"
npm run build

echo "==> Verifying the built bundle targets the self-hosted backend"
if grep -rl "pxgxxlcchyxrilibecsc.supabase.co" dist .output 2>/dev/null | head -5 | grep -q .; then
  echo "Build still contains the managed backend URL — aborting before restart." >&2
  exit 1
fi
echo "    bundle clean"

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
