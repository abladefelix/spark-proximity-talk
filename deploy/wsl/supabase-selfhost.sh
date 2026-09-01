#!/usr/bin/env bash
# SKANAROUND — self-hosted backend (Postgres + Auth + Storage + Realtime + PostgREST)
# running in Docker inside WSL2 on the same Windows VPS as the app.
#
#   sudo bash deploy/wsl/supabase-selfhost.sh [stack-dir] [api-domain]
#
# Defaults: /srv/supabase  api.skanaround.bytenetdigital.com
#
# Produces:
#   <stack-dir>/.env           full stack config (KEEP SAFE, mode 600)
#   /etc/skanaround-backend.env  the values the app needs (URL + keys)

set -euo pipefail

STACK_DIR="${1:-/srv/supabase}"
API_DOMAIN="${2:-api.skanaround.bytenetdigital.com}"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi

echo "==> Installing Docker Engine + compose plugin"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg jq openssl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker || service docker start

echo "==> Fetching the Supabase docker stack into $STACK_DIR"
if [[ ! -d "$STACK_DIR/.git" ]]; then
  rm -rf "$STACK_DIR"
  git clone --depth 1 --filter=blob:none --sparse https://github.com/supabase/supabase.git "$STACK_DIR.src"
  git -C "$STACK_DIR.src" sparse-checkout set docker
  mkdir -p "$STACK_DIR"
  cp -r "$STACK_DIR.src/docker/." "$STACK_DIR/"
  cp -r "$STACK_DIR.src/.git" "$STACK_DIR/.git"
  rm -rf "$STACK_DIR.src"
fi

cd "$STACK_DIR"

if [[ ! -f .env ]]; then
  cp .env.example .env

  echo "==> Generating secrets"
  JWT_SECRET="$(openssl rand -hex 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 24)"
  DASHBOARD_PASSWORD="$(openssl rand -hex 16)"
  SECRET_KEY_BASE="$(openssl rand -hex 32)"
  VAULT_ENC_KEY="$(openssl rand -hex 16)"

  # HS256 JWTs for the anon / service_role API keys, signed with JWT_SECRET.
  mk_key() {
    node -e '
      const c = require("crypto");
      const [secret, role] = process.argv.slice(1);
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const iat = Math.floor(Date.now()/1000);
      const body = b64({alg:"HS256",typ:"JWT"}) + "." + b64({role, iss:"supabase", iat, exp: iat + 60*60*24*365*10});
      const sig = c.createHmac("sha256", secret).update(body).digest("base64url");
      process.stdout.write(body + "." + sig);
    ' "$JWT_SECRET" "$1"
  }
  ANON_KEY="$(mk_key anon)"
  SERVICE_ROLE_KEY="$(mk_key service_role)"

  set_env() { # set_env KEY VALUE
    if grep -q "^$1=" .env; then
      python3 - "$1" "$2" <<'PY'
import sys, pathlib
k, v = sys.argv[1], sys.argv[2]
p = pathlib.Path(".env")
out = []
for line in p.read_text().splitlines():
    out.append(f"{k}={v}" if line.startswith(k + "=") else line)
p.write_text("\n".join(out) + "\n")
PY
    else
      echo "$1=$2" >> .env
    fi
  }

  set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
  set_env JWT_SECRET "$JWT_SECRET"
  set_env ANON_KEY "$ANON_KEY"
  set_env SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
  set_env DASHBOARD_USERNAME "admin"
  set_env DASHBOARD_PASSWORD "$DASHBOARD_PASSWORD"
  set_env SECRET_KEY_BASE "$SECRET_KEY_BASE"
  set_env VAULT_ENC_KEY "$VAULT_ENC_KEY"
  set_env SITE_URL "https://skanaround.bytenetdigital.com"
  set_env API_EXTERNAL_URL "https://$API_DOMAIN"
  set_env SUPABASE_PUBLIC_URL "https://$API_DOMAIN"
  set_env ADDITIONAL_REDIRECT_URLS "https://skanaround.bytenetdigital.com/**,app.skanaround://**"
  set_env DISABLE_SIGNUP "false"
  set_env ENABLE_EMAIL_AUTOCONFIRM "false"
  set_env KONG_HTTP_PORT "8000"
  set_env KONG_HTTPS_PORT "8443"
  chmod 600 .env
fi

# Bind the gateway to localhost only; Caddy terminates TLS in front of it.
mkdir -p "$STACK_DIR"
cat > docker-compose.override.yml <<'YML'
services:
  kong:
    ports: !override
      - "127.0.0.1:8000:8000/tcp"
  db:
    ports: !override
      - "127.0.0.1:5432:5432"
YML

echo "==> Starting the stack"
docker compose pull
docker compose up -d

echo "==> Waiting for the API gateway"
for i in $(seq 1 60); do
  curl -sf -o /dev/null "http://127.0.0.1:8000/rest/v1/" -H "apikey: $(grep '^ANON_KEY=' .env | cut -d= -f2-)" && break
  sleep 3
done

echo "==> Enabling PostGIS (used by proximity search)"
docker compose exec -T db psql -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;" || true

# Values the app server needs.
ANON="$(grep '^ANON_KEY=' .env | cut -d= -f2-)"
SRK="$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)"
cat > /etc/skanaround-backend.env <<EOF
SUPABASE_URL=https://$API_DOMAIN
SUPABASE_PUBLISHABLE_KEY=$ANON
SUPABASE_SERVICE_ROLE_KEY=$SRK
VITE_SUPABASE_URL=https://$API_DOMAIN
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON
EOF
chmod 600 /etc/skanaround-backend.env

echo
echo "Done. Backend gateway: http://127.0.0.1:8000 (proxy $API_DOMAIN to it)."
echo "App env written to /etc/skanaround-backend.env"
echo "Studio (admin UI) is on 127.0.0.1:8000 behind basic auth — keep it off the public internet."
