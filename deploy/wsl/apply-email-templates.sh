#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# SKANAROUND — point self-hosted GoTrue at the branded HTML email templates.
#
# The templates are served by the app itself from /email/*.html, so a normal
# `bun run build && systemctl restart skanaround` deploys new copy instantly.
#
# Run on the VM (after deploying the app):
#   sudo bash deploy/wsl/apply-email-templates.sh
# ---------------------------------------------------------------------------
set -euo pipefail

ENV_FILE=${ENV_FILE:-/srv/supabase/.env}
COMPOSE_DIR=$(dirname "$ENV_FILE")
SITE_URL=${SITE_URL:-https://skanaround.bytenetdigital.com}

[[ $EUID -eq 0 ]] || { echo "Run with sudo: sudo bash $0" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Cannot find $ENV_FILE" >&2; exit 1; }

set_env() {
  local key=$1 val=$2
  if grep -q "^${key}=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import sys
path, key, val = sys.argv[1], sys.argv[2], sys.argv[3]
lines = open(path).read().splitlines()
open(path, "w").write("\n".join(f"{key}={val}" if l.startswith(f"{key}=") else l for l in lines) + "\n")
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}

cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

set_env GOTRUE_MAILER_TEMPLATES_CONFIRMATION   "${SITE_URL}/email/confirm.html"
set_env GOTRUE_MAILER_TEMPLATES_RECOVERY       "${SITE_URL}/email/recovery.html"
set_env GOTRUE_MAILER_TEMPLATES_MAGIC_LINK     "${SITE_URL}/email/magic-link.html"
set_env GOTRUE_MAILER_TEMPLATES_INVITE         "${SITE_URL}/email/invite.html"
set_env GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE   "${SITE_URL}/email/email-change.html"

set_env GOTRUE_MAILER_SUBJECTS_CONFIRMATION    "Verify your SKANAROUND account"
set_env GOTRUE_MAILER_SUBJECTS_RECOVERY        "Reset your SKANAROUND password"
set_env GOTRUE_MAILER_SUBJECTS_MAGIC_LINK      "Your SKANAROUND sign-in link"
set_env GOTRUE_MAILER_SUBJECTS_INVITE          "You have been invited to SKANAROUND"
set_env GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE    "Confirm your new SKANAROUND email"

# Link-only verification: no 6-digit OTP fallback in the mail.
set_env GOTRUE_MAILER_OTP_LENGTH               "6"
set_env GOTRUE_MAILER_OTP_EXP                  "86400"

chmod 600 "$ENV_FILE"

# --- Make sure docker compose actually passes these vars into the auth container.
# The stock supabase compose file only maps a fixed list of GOTRUE_* vars, so
# values added to .env are otherwise silently ignored.
COMPOSE_FILE=""
for f in "$COMPOSE_DIR/docker-compose.yml" "$COMPOSE_DIR/docker-compose.yaml"; do
  [[ -f "$f" ]] && COMPOSE_FILE="$f" && break
done

if [[ -n "$COMPOSE_FILE" ]]; then
  cp "$COMPOSE_FILE" "${COMPOSE_FILE}.bak.$(date +%s)"
  python3 - "$COMPOSE_FILE" <<'PY'
import re, sys

path = sys.argv[1]
lines = open(path).read().splitlines()

keys = [
    "GOTRUE_MAILER_TEMPLATES_CONFIRMATION",
    "GOTRUE_MAILER_TEMPLATES_RECOVERY",
    "GOTRUE_MAILER_TEMPLATES_MAGIC_LINK",
    "GOTRUE_MAILER_TEMPLATES_INVITE",
    "GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE",
    "GOTRUE_MAILER_SUBJECTS_CONFIRMATION",
    "GOTRUE_MAILER_SUBJECTS_RECOVERY",
    "GOTRUE_MAILER_SUBJECTS_MAGIC_LINK",
    "GOTRUE_MAILER_SUBJECTS_INVITE",
    "GOTRUE_MAILER_SUBJECTS_EMAIL_CHANGE",
]

# locate `auth:` service block, then its `environment:` list
auth_i = next((i for i, l in enumerate(lines)
               if re.match(r"^\s{2}auth:\s*$", l)), None)
if auth_i is None:
    print("  !! could not find the auth service in the compose file; skipping")
    sys.exit(0)

end = len(lines)
for i in range(auth_i + 1, len(lines)):
    if re.match(r"^\s{2}\S", lines[i]):
        end = i
        break

env_i = next((i for i in range(auth_i + 1, end)
              if re.match(r"^\s+environment:\s*$", lines[i])), None)
if env_i is None:
    print("  !! auth service has no environment block; skipping")
    sys.exit(0)

indent = " " * (len(lines[env_i]) - len(lines[env_i].lstrip()) + 2)
block = "\n".join(lines[env_i:end])
missing = [k for k in keys if f"{k}:" not in block]
if not missing:
    print("  compose already passes the mailer template vars through")
    sys.exit(0)

insert = [f'{indent}{k}: ${{{k}}}' for k in missing]
lines[env_i + 1:env_i + 1] = insert
open(path, "w").write("\n".join(lines) + "\n")
print(f"  added {len(missing)} mailer var(s) to the auth service")
PY
else
  echo "  !! no docker-compose file found next to $ENV_FILE"
fi

echo "== Checking templates are reachable =="
for f in confirm recovery magic-link invite email-change; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${SITE_URL}/email/${f}.html")
  echo "  ${f}.html -> ${code}"
  [[ "$code" == "200" ]] || echo "    !! GoTrue cannot fetch this — deploy the app build first."
done

cd "$COMPOSE_DIR"
docker compose up -d --force-recreate auth
sleep 4
docker compose logs --tail=30 auth

echo
echo "Done. Sign up with a fresh address to see the branded email."
