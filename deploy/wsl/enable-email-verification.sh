#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SKANAROUND — turn email verification back ON for the self-hosted backend.
#
# Auto-confirm was switched on temporarily so signups worked without SMTP.
# That means anyone can spam accounts with fake addresses. This script wires
# real SMTP into GoTrue, disables auto-confirm, and tightens signup rate limits.
#
# Run on the VM:
#   sudo bash deploy/wsl/enable-email-verification.sh
#
# It will prompt for SMTP details. Any provider works, e.g.:
#   Azure Communication Services  smtp.azurecomm.net           :587
#   Brevo (free 300/day)          smtp-relay.brevo.com         :587
#   Zoho Mail                     smtp.zoho.com                :587
#   Gmail (app password)          smtp.gmail.com               :587
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE=${ENV_FILE:-/srv/supabase/.env}
COMPOSE_DIR=$(dirname "$ENV_FILE")
SITE_URL=${SITE_URL:-https://skanaround.bytenetdigital.com}

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Cannot find $ENV_FILE — set ENV_FILE=/path/to/.env and retry." >&2
  exit 1
fi

ask() { # ask VAR "Prompt" "default"
  local __var=$1 __prompt=$2 __default=${3:-} __in=""
  if [[ -n "$__default" ]]; then
    read -r -p "$__prompt [$__default]: " __in
    __in=${__in:-$__default}
  else
    while [[ -z "$__in" ]]; do read -r -p "$__prompt: " __in; done
  fi
  printf -v "$__var" '%s' "$__in"
}

echo "== SMTP details =="
ask SMTP_HOST   "SMTP host"            "smtp-relay.brevo.com"
ask SMTP_PORT   "SMTP port"            "587"
ask SMTP_USER   "SMTP username"
read -r -s -p "SMTP password / API key: " SMTP_PASS; echo
ask SMTP_SENDER "From address"         "no-reply@bytenetdigital.com"
ask SMTP_NAME   "From name"            "SKANAROUND"

set_env() { # set_env KEY VALUE — replace in place or append
  local key=$1 val=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    # Use a sentinel delimiter so passwords with / and & survive.
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines()
out = [f"{key}={val}" if l.startswith(f"{key}=") else l for l in lines]
open(path, "w").write("\n".join(out) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

# --- SMTP ------------------------------------------------------------------
set_env SMTP_HOST        "$SMTP_HOST"
set_env SMTP_PORT        "$SMTP_PORT"
set_env SMTP_USER        "$SMTP_USER"
set_env SMTP_PASS        "$SMTP_PASS"
set_env SMTP_SENDER_NAME "$SMTP_NAME"
set_env SMTP_ADMIN_EMAIL "$SMTP_SENDER"
# GoTrue reads the GOTRUE_* names directly; set both so either compose file works.
set_env GOTRUE_SMTP_HOST        "$SMTP_HOST"
set_env GOTRUE_SMTP_PORT        "$SMTP_PORT"
set_env GOTRUE_SMTP_USER        "$SMTP_USER"
set_env GOTRUE_SMTP_PASS        "$SMTP_PASS"
set_env GOTRUE_SMTP_SENDER_NAME "$SMTP_NAME"
set_env GOTRUE_SMTP_ADMIN_EMAIL "$SMTP_SENDER"
set_env GOTRUE_SMTP_MAX_FREQUENCY "60s"

# --- Verification required --------------------------------------------------
set_env ENABLE_EMAIL_AUTOCONFIRM        "false"
set_env GOTRUE_MAILER_AUTOCONFIRM       "false"
set_env ENABLE_EMAIL_SIGNUP             "true"
set_env GOTRUE_MAILER_SECURE_EMAIL_CHANGE_ENABLED "true"
set_env GOTRUE_MAILER_URLPATHS_CONFIRMATION "/auth/v1/verify"
set_env GOTRUE_MAILER_URLPATHS_RECOVERY     "/auth/v1/verify"
set_env SITE_URL                        "$SITE_URL"
set_env GOTRUE_SITE_URL                 "$SITE_URL"
set_env ADDITIONAL_REDIRECT_URLS        "${SITE_URL}/radar,${SITE_URL}/reset-password,skanaround://auth"
set_env GOTRUE_URI_ALLOW_LIST           "${SITE_URL}/**,skanaround://**"

# --- Anti-spam rate limits --------------------------------------------------
set_env GOTRUE_RATE_LIMIT_EMAIL_SENT   "30"   # auth emails per hour, per instance
set_env GOTRUE_RATE_LIMIT_VERIFY       "30"   # verify attempts / 5 min per IP
set_env GOTRUE_RATE_LIMIT_TOKEN_REFRESH "150"
set_env GOTRUE_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED "true"
set_env GOTRUE_PASSWORD_MIN_LENGTH     "8"

chmod 600 "$ENV_FILE"

echo
echo "== Restarting auth =="
cd "$COMPOSE_DIR"
docker compose up -d --force-recreate auth
sleep 4
docker compose logs --tail=40 auth

cat <<EOF

Done. Email verification is required again.

Verify it works:
  1. Sign up with a real address on ${SITE_URL}
  2. You should get a "Confirm your signup" mail from ${SMTP_SENDER}
  3. Signing in before confirming returns "Email not confirmed"

If mail does not arrive, check the auth container log above for smtp errors,
and confirm SPF/DKIM for the sending domain at your provider.
EOF
