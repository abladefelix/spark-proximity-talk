#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SKANAROUND — rotate the self-hosted Supabase JWT secret and API keys.
#
# On self-hosted Supabase the anon key and service_role key are just JWTs
# signed with JWT_SECRET. Rotating means: new JWT_SECRET, re-sign both keys,
# restart the stack, then rebuild the app with the new anon key.
#
#   sudo bash deploy/wsl/rotate-jwt-keys.sh
#
# Effects:
#   - every existing user session is invalidated (everyone signs in again)
#   - the app MUST be rebuilt, the old anon key stops working immediately
# ---------------------------------------------------------------------------
set -euo pipefail

SUPA_DIR=${SUPA_DIR:-/srv/supabase}
APP_DIR=${APP_DIR:-/srv/skanaround}
SUPA_ENV="$SUPA_DIR/.env"
APP_ENV="$APP_DIR/.env"

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0" >&2; exit 1; }
[[ -f "$SUPA_ENV" ]] || { echo "Cannot find $SUPA_ENV" >&2; exit 1; }

echo "This invalidates all sessions and requires an app rebuild."
read -r -p "Continue? [y/N]: " ok
[[ ${ok,,} == y ]] || { echo "Aborted."; exit 0; }

cp "$SUPA_ENV" "${SUPA_ENV}.bak.$(date +%s)"
[[ -f "$APP_ENV" ]] && cp "$APP_ENV" "${APP_ENV}.bak.$(date +%s)"

# --- Mint a new secret and sign both role JWTs (10-year expiry) ------------
read -r NEW_SECRET NEW_ANON NEW_SERVICE < <(python3 - <<'PY'
import base64, hashlib, hmac, json, secrets, time

secret = secrets.token_urlsafe(48)

def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

def sign(role: str) -> str:
    iat = int(time.time())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(json.dumps(
        {"role": role, "iss": "supabase", "iat": iat, "exp": iat + 10 * 365 * 24 * 3600},
        separators=(",", ":"),
    ).encode())
    body = f"{header}.{payload}"
    sig = b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"

print(secret, sign("anon"), sign("service_role"))
PY
)

set_env() { # set_env FILE KEY VALUE
  local file=$1 key=$2 val=$3
  if grep -q "^${key}=" "$file"; then
    python3 - "$file" "$key" "$val" <<'PY'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines()
open(path, "w").write("\n".join(f"{key}={val}" if l.startswith(f"{key}=") else l for l in lines) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

# --- Backend ---------------------------------------------------------------
set_env "$SUPA_ENV" JWT_SECRET        "$NEW_SECRET"
set_env "$SUPA_ENV" GOTRUE_JWT_SECRET "$NEW_SECRET"
set_env "$SUPA_ENV" ANON_KEY          "$NEW_ANON"
set_env "$SUPA_ENV" SERVICE_ROLE_KEY  "$NEW_SERVICE"
chmod 600 "$SUPA_ENV"

# --- App -------------------------------------------------------------------
if [[ -f "$APP_ENV" ]]; then
  set_env "$APP_ENV" VITE_SUPABASE_PUBLISHABLE_KEY "$NEW_ANON"
  set_env "$APP_ENV" SUPABASE_PUBLISHABLE_KEY      "$NEW_ANON"
  set_env "$APP_ENV" SUPABASE_SERVICE_ROLE_KEY     "$NEW_SERVICE"
  chmod 600 "$APP_ENV"
fi

echo
echo "== Restarting backend =="
cd "$SUPA_DIR"
docker compose up -d --force-recreate
sleep 6
docker compose ps

cat <<EOF

Keys rotated. The old service-role key is dead.

Now rebuild and restart the app (the anon key is compiled into the bundle):

  cd $APP_DIR
  bun install --frozen-lockfile
  bun run build
  sudo systemctl restart skanaround

Everyone (including you) must sign in again.
The new keys are in $SUPA_ENV — never paste them into chat or commit them.
EOF
