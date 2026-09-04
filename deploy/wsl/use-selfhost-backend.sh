#!/usr/bin/env bash
# SKANAROUND — point the deployed app at the SELF-HOSTED backend.
#
#   sudo bash deploy/wsl/use-selfhost-backend.sh [api-domain]
#
# Reads the self-hosted keys from the Supabase stack (/srv/supabase/.env) or
# from /etc/skanaround-backend.env, rewrites /srv/skanaround/.env and
# /etc/skanaround.env with them, rebuilds the app (VITE_* values are baked
# into the browser bundle at build time) and restarts the service.

set -euo pipefail

APP_DIR="${APP_DIR:-/srv/skanaround}"
STACK_DIR="${STACK_DIR:-/srv/supabase}"
APP_ENV="$APP_DIR/.env"
SYS_ENV="/etc/skanaround.env"

[[ $EUID -eq 0 ]] || { echo "Run with sudo."; exit 1; }

read_kv() { grep -m1 "^$1=" "$2" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true; }

API_DOMAIN="${1:-}"
SUPA_URL=""; ANON=""; SRK=""

if [[ -f /etc/skanaround-backend.env ]]; then
  SUPA_URL="$(read_kv SUPABASE_URL /etc/skanaround-backend.env)"
  ANON="$(read_kv SUPABASE_PUBLISHABLE_KEY /etc/skanaround-backend.env)"
  SRK="$(read_kv SUPABASE_SERVICE_ROLE_KEY /etc/skanaround-backend.env)"
fi

if [[ -z "$ANON" || -z "$SRK" ]] && [[ -f "$STACK_DIR/.env" ]]; then
  ANON="$(read_kv ANON_KEY "$STACK_DIR/.env")"
  SRK="$(read_kv SERVICE_ROLE_KEY "$STACK_DIR/.env")"
  SUPA_URL="${SUPA_URL:-$(read_kv API_EXTERNAL_URL "$STACK_DIR/.env")}"
fi

[[ -n "$API_DOMAIN" ]] && SUPA_URL="https://${API_DOMAIN#https://}"

if [[ -z "$SUPA_URL" || -z "$ANON" || -z "$SRK" ]]; then
  echo "Could not find the self-hosted backend values."
  echo "Looked in /etc/skanaround-backend.env and $STACK_DIR/.env."
  echo "Re-run as: sudo bash deploy/wsl/use-selfhost-backend.sh api.yourdomain.com"
  exit 1
fi

case "$SUPA_URL" in
  *supabase.co*)
    echo "Refusing to continue: $SUPA_URL is the managed backend, not your self-hosted one."
    exit 1;;
esac

echo "==> Backend: $SUPA_URL"

set_env() { # file key value
  local f="$1" k="$2" v="$3"
  touch "$f"
  if grep -q "^$k=" "$f"; then
    # value may contain / and & — use a safe delimiter and escape
    python3 - "$f" "$k" "$v" <<'PY'
import sys, re
f, k, v = sys.argv[1:4]
lines = open(f).read().splitlines()
out = [f"{k}={v}" if re.match(rf"^{re.escape(k)}=", l) else l for l in lines]
open(f, "w").write("\n".join(out) + "\n")
PY
  else
    printf '%s=%s\n' "$k" "$v" >> "$f"
  fi
}

for f in "$APP_ENV" "$SYS_ENV"; do
  cp -a "$f" "$f.bak.$(date -u +%s)" 2>/dev/null || true
  set_env "$f" SUPABASE_URL "$SUPA_URL"
  set_env "$f" SUPABASE_PUBLISHABLE_KEY "$ANON"
  set_env "$f" SUPABASE_ANON_KEY "$ANON"
  set_env "$f" SUPABASE_SERVICE_ROLE_KEY "$SRK"
  set_env "$f" VITE_SUPABASE_URL "$SUPA_URL"
  set_env "$f" VITE_SUPABASE_PUBLISHABLE_KEY "$ANON"
  set_env "$f" VITE_SUPABASE_PROJECT_ID "selfhosted"
  set_env "$f" SUPABASE_PROJECT_ID "selfhosted"
  chmod 600 "$f"
done

echo "==> Rebuilding the app with the self-hosted values baked in"
cd "$APP_DIR"
npm run build

echo "==> Restarting"
systemctl restart skanaround

echo "==> Verifying"
APP_READY=false
for _ in $(seq 1 20); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    APP_READY=true
    break
  fi
  sleep 1
done
if [[ "$APP_READY" != true ]]; then
  echo "FAILED: the app did not become ready after restart."
  systemctl status skanaround --no-pager -l || true
  exit 1
fi
echo "app HTTP 200"

# Prove that the deployed server contains the username sign-in route. A stale
# build used to return an HTML 404 here while deployment still printed Done.
AUTH_HEADERS="$(mktemp)"
AUTH_BODY="$(mktemp)"
trap 'rm -f "$AUTH_HEADERS" "$AUTH_BODY"' EXIT
AUTH_STATUS="$(curl -sS -D "$AUTH_HEADERS" -o "$AUTH_BODY" -w '%{http_code}' \
  -X POST http://127.0.0.1:3000/api/public/username-sign-in \
  -H 'content-type: application/json' \
  --data '{"identifier":"__deployment_probe__","password":"not-a-real-password"}')"
if [[ "$AUTH_STATUS" != "401" ]] || ! grep -qi '^content-type: application/json' "$AUTH_HEADERS" \
  || ! grep -q 'Invalid login credentials' "$AUTH_BODY"; then
  echo "FAILED: username sign-in smoke test returned HTTP $AUTH_STATUS instead of JSON HTTP 401."
  echo "The deployed server is stale or the sign-in route is unavailable."
  exit 1
fi
echo "username sign-in HTTP 401 JSON (expected probe result)"

# The bare /rest/v1/ OpenAPI root is intentionally service-role-only in the
# current Envoy gateway. Test an ordinary Data API resource instead.
BACKEND_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  "$SUPA_URL/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON")"
if [[ "$BACKEND_STATUS" != "200" && "$BACKEND_STATUS" != "401" ]]; then
  echo "FAILED: backend returned unexpected HTTP $BACKEND_STATUS."
  exit 1
fi
echo "backend HTTP $BACKEND_STATUS"

echo "Done. App, self-hosted backend, and username sign-in all passed."
