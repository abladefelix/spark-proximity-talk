#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SKANAROUND — create (or reset) a super admin on the SELF-HOSTED backend.
#
# Accounts created in Lovable Cloud do NOT exist on your Azure VM backend.
# Run this on the VM to create the account there:
#
#   sudo bash deploy/wsl/create-super-admin.sh
#   sudo ADMIN_EMAIL=sa2@skanaround.app ADMIN_PASSWORD='Skn!Admin2026#Radar' \
#        ADMIN_USERNAME=superadmin bash deploy/wsl/create-super-admin.sh
#
# It will:
#   1. create the auth user (email pre-confirmed) or reset its password
#   2. make sure a profile row exists with the username
#   3. grant the 'admin' role in public.user_roles
#
# Sign in afterwards at https://skanaround.bytenetdigital.com/console-9f42x7
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE=${ENV_FILE:-/srv/supabase/.env}
STACK_DIR=${STACK_DIR:-$(dirname "$ENV_FILE")}
API_URL=${API_URL:-http://localhost:8000}

ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}
ADMIN_USERNAME=${ADMIN_USERNAME:-}

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Cannot find $ENV_FILE — set ENV_FILE=/path/to/.env and retry." >&2
  exit 1
fi

command -v jq >/dev/null 2>&1 || { apt-get update && apt-get install -y jq; }
command -v curl >/dev/null 2>&1 || { apt-get update && apt-get install -y curl; }

# Read single keys without sourcing (the .env contains unquoted values).
env_get() {
  local v
  v=$(grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" | tail -n1 | sed -E "s/^[[:space:]]*(export[[:space:]]+)?$1=//")
  v=${v%$'\r'}
  v=${v#\"}; v=${v%\"}; v=${v#\'}; v=${v%\'}
  printf '%s' "$v"
}

SERVICE_KEY=$(env_get SERVICE_ROLE_KEY)
[[ -n "$SERVICE_KEY" ]] || SERVICE_KEY=$(env_get SUPABASE_SERVICE_ROLE_KEY)
if [[ -z "$SERVICE_KEY" ]]; then
  echo "SERVICE_ROLE_KEY not found in $ENV_FILE" >&2
  exit 1
fi

[[ -n "$ADMIN_EMAIL" ]]    || read -r -p "Admin email: " ADMIN_EMAIL
[[ -n "$ADMIN_USERNAME" ]] || read -r -p "Admin username [superadmin]: " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-superadmin}
if [[ -z "$ADMIN_PASSWORD" ]]; then
  read -r -s -p "New admin password (use a new, unique password): " ADMIN_PASSWORD; echo
  read -r -s -p "Confirm new admin password: " ADMIN_PASSWORD_CONFIRM; echo
  [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD_CONFIRM" ]] || {
    echo "Passwords do not match." >&2
    exit 1
  }
fi
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || { echo "Password must be at least 8 characters." >&2; exit 1; }

# Find the running Postgres container of the Supabase stack.
DB_CONTAINER=${DB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -E 'supabase[-_]db|(^|[-_])db([-_]|$)' | head -n1)}
if [[ -z "$DB_CONTAINER" ]]; then
  echo "Could not find the database container. Set DB_CONTAINER=<name> and retry (docker ps)." >&2
  exit 1
fi

psql_run() {
  docker exec -i "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres -qtA -c "$1"
}

echo "==> Looking up existing user"
USER_ID=$(psql_run "select id from auth.users where lower(email) = lower('${ADMIN_EMAIL//\'/\'\'}') limit 1" | tr -d '[:space:]')

if [[ -z "$USER_ID" ]]; then
  echo "==> Creating auth user"
  RESP=$(curl -sS -X POST "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" --arg u "$ADMIN_USERNAME" \
          '{email:$e, password:$p, email_confirm:true, user_metadata:{username:$u, display_name:$u, date_of_birth:"1990-01-01", gender:"other"}}')")
  USER_ID=$(echo "$RESP" | jq -r '.id // empty')
  if [[ -z "$USER_ID" ]]; then
    echo "Failed to create user: $RESP" >&2
    exit 1
  fi
else
  echo "==> User exists ($USER_ID) — resetting password"
  RESP=$(curl -sS -X PUT "$API_URL/auth/v1/admin/users/$USER_ID" \
    -H "apikey: $SERVICE_KEY" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -nc --arg p "$ADMIN_PASSWORD" '{password:$p, email_confirm:true}')")
  echo "$RESP" | jq -e '.id' >/dev/null || { echo "Failed to update user: $RESP" >&2; exit 1; }
fi

echo "==> Ensuring profile + admin role"
psql_run "
  insert into public.profiles (id, username, display_name, date_of_birth, gender)
  values ('$USER_ID', '${ADMIN_USERNAME//\'/\'\'}', '${ADMIN_USERNAME//\'/\'\'}', '1990-01-01', 'other')
  on conflict (id) do update set username = excluded.username;
  insert into public.user_roles (user_id, role)
  values ('$USER_ID', 'admin')
  on conflict (user_id, role) do nothing;
" >/dev/null

echo "==> Verifying the new credentials against this backend"
LOGIN_RESP=$(curl -sS -X POST "$API_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -nc --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" \
        '{email:$e, password:$p}')")
if ! echo "$LOGIN_RESP" | jq -e '.access_token and .user.id' >/dev/null 2>&1; then
  LOGIN_ERROR=$(echo "$LOGIN_RESP" | jq -r '.msg // .message // .error_description // .error // "unknown authentication error"')
  echo "The account was updated, but sign-in verification failed: $LOGIN_ERROR" >&2
  echo "Run this script again and choose a new password that you have never used elsewhere." >&2
  exit 1
fi

echo
echo "Super admin ready on this backend:"
echo "  URL      : https://skanaround.bytenetdigital.com/console-9f42x7"
echo "  Email    : $ADMIN_EMAIL"
echo "  Username : $ADMIN_USERNAME"
echo "  Role     : admin"
echo "Change the password after your first sign-in."
