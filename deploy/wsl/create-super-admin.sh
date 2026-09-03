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

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

SERVICE_KEY=${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}
if [[ -z "$SERVICE_KEY" ]]; then
  echo "SERVICE_ROLE_KEY not found in $ENV_FILE" >&2
  exit 1
fi

[[ -n "$ADMIN_EMAIL" ]]    || read -r -p "Admin email: " ADMIN_EMAIL
[[ -n "$ADMIN_USERNAME" ]] || read -r -p "Admin username [superadmin]: " ADMIN_USERNAME
ADMIN_USERNAME=${ADMIN_USERNAME:-superadmin}
if [[ -z "$ADMIN_PASSWORD" ]]; then
  read -r -s -p "Admin password: " ADMIN_PASSWORD; echo
fi
[[ ${#ADMIN_PASSWORD} -ge 8 ]] || { echo "Password must be at least 8 characters." >&2; exit 1; }

psql_run() {
  docker compose --project-directory "$STACK_DIR" exec -T db \
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
          '{email:$e, password:$p, email_confirm:true, user_metadata:{username:$u, display_name:$u}}')")
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

echo
echo "Super admin ready on this backend:"
echo "  URL      : https://skanaround.bytenetdigital.com/console-9f42x7"
echo "  Email    : $ADMIN_EMAIL"
echo "  Username : $ADMIN_USERNAME"
echo "  Role     : admin"
echo "Change the password after your first sign-in."
