#!/usr/bin/env bash
# SKANAROUND — one-time setup inside WSL (Ubuntu) on a Windows VPS.
#
#   wsl -d Ubuntu
#   sudo bash deploy/wsl/setup.sh <repo-url> [branch] [app-dir]
#
# Installs Node LTS, Git, Caddy, clones the repo, builds it and installs the
# app + Caddy as systemd services that start with WSL.

set -euo pipefail

REPO_URL="${1:-}"
BRANCH="${2:-main}"
APP_DIR="${3:-/srv/skanaround}"
RUN_USER="${SUDO_USER:-$USER}"

if [[ -z "$REPO_URL" ]]; then
  echo "usage: sudo bash deploy/wsl/setup.sh <repo-url> [branch] [app-dir]" >&2
  exit 1
fi

echo "==> Enabling systemd in WSL"
if ! grep -q '^systemd=true' /etc/wsl.conf 2>/dev/null; then
  printf '[boot]\nsystemd=true\n' >> /etc/wsl.conf
  echo "    systemd enabled — run 'wsl --shutdown' in Windows, reopen WSL, then re-run this script."
fi

echo "==> Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Source checkout at $APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$RUN_USER":"$RUN_USER" "$APP_DIR"
git config --global --add safe.directory "$APP_DIR"

echo "==> Install + build"
sudo -u "$RUN_USER" bash -lc "cd '$APP_DIR' && npm ci && npm run build"

echo "==> systemd units"
sed -e "s#__APP_DIR__#$APP_DIR#g" -e "s#__RUN_USER__#$RUN_USER#g" \
  "$APP_DIR/deploy/wsl/skanaround.service" > /etc/systemd/system/skanaround.service

install -d /etc/caddy
cp "$APP_DIR/deploy/wsl/Caddyfile" /etc/caddy/Caddyfile

# Server-only secrets live here, never in the repo (.env is overwritten on deploy).
if [[ ! -f /etc/skanaround.env ]]; then
  cat > /etc/skanaround.env <<'EOF'
# Server-only secrets — one KEY=value per line, no quotes needed.
# SUPABASE_SERVICE_ROLE_KEY=
EOF
  chmod 600 /etc/skanaround.env
fi

systemctl daemon-reload
systemctl enable --now skanaround
systemctl enable --now caddy
systemctl restart caddy

echo
echo "Done. App: http://127.0.0.1:3000  ·  Caddy is terminating TLS on 80/443."
echo "Next: run deploy/windows/wsl-portproxy.ps1 in an elevated Windows PowerShell"
echo "so the VPS forwards ports 80/443 into WSL."
