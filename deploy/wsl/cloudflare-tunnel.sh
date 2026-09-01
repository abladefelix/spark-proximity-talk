#!/usr/bin/env bash
# SKANAROUND — publish the app through a Cloudflare Tunnel.
#
# Use this when the host has no public inbound ports (Windows 365 Cloud PC,
# home connection, NAT, corporate firewall). The tunnel dials OUT to
# Cloudflare, so nothing has to be opened on the firewall and Let's Encrypt
# is not involved — Cloudflare terminates TLS at its edge.
#
#   sudo bash deploy/wsl/cloudflare-tunnel.sh [tunnel-name] [app-domain] [api-domain]
#
# Defaults: skanaround  skanaround.bytenetdigital.com  api.skanaround.bytenetdigital.com
#
# Prerequisite: bytenetdigital.com must use Cloudflare nameservers
# (dash.cloudflare.com -> Add a site -> follow the nameserver instructions).

set -euo pipefail

TUNNEL_NAME="${1:-skanaround}"
APP_DOMAIN="${2:-skanaround.bytenetdigital.com}"
API_DOMAIN="${3:-api.skanaround.bytenetdigital.com}"

if [[ $EUID -ne 0 ]]; then echo "Run with sudo." >&2; exit 1; fi

REAL_USER="${SUDO_USER:-root}"
REAL_HOME="$(getent passwd "$REAL_USER" | cut -d: -f6)"

echo "==> Installing cloudflared"
if ! command -v cloudflared >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y curl ca-certificates
  arch="$(dpkg --print-architecture)"
  curl -fsSL -o /tmp/cloudflared.deb \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${arch}.deb"
  dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

echo "==> Cloudflare login"
# Opens a browser URL; pick the bytenetdigital.com zone and authorise.
if [[ ! -f "$REAL_HOME/.cloudflared/cert.pem" && ! -f /root/.cloudflared/cert.pem ]]; then
  cloudflared tunnel login
fi
if [[ -f "$REAL_HOME/.cloudflared/cert.pem" && ! -f /root/.cloudflared/cert.pem ]]; then
  install -d -m 700 /root/.cloudflared
  cp "$REAL_HOME/.cloudflared/cert.pem" /root/.cloudflared/cert.pem
fi

echo "==> Creating tunnel '$TUNNEL_NAME'"
if ! cloudflared tunnel list | awk '{print $2}' | grep -qx "$TUNNEL_NAME"; then
  cloudflared tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID="$(cloudflared tunnel list | awk -v n="$TUNNEL_NAME" '$2==n {print $1}' | head -n1)"
if [[ -z "$TUNNEL_ID" ]]; then echo "Could not resolve tunnel id." >&2; exit 1; fi
echo "    tunnel id: $TUNNEL_ID"

echo "==> Writing /etc/cloudflared/config.yml"
install -d /etc/cloudflared
cp "/root/.cloudflared/$TUNNEL_ID.json" "/etc/cloudflared/$TUNNEL_ID.json"
chmod 600 "/etc/cloudflared/$TUNNEL_ID.json"

cat > /etc/cloudflared/config.yml <<YML
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json
originRequest:
  connectTimeout: 30s
  noTLSVerify: true

ingress:
  - hostname: $APP_DOMAIN
    service: http://127.0.0.1:3000
  - hostname: $API_DOMAIN
    service: http://127.0.0.1:8000
  - service: http_status:404
YML

echo "==> Pointing DNS at the tunnel"
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$APP_DOMAIN" || true
cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$API_DOMAIN" || true

echo "==> Installing the service"
systemctl stop cloudflared 2>/dev/null || true
cloudflared service install 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now cloudflared
sleep 5
systemctl --no-pager --lines=15 status cloudflared || true

echo
echo "Done. https://$APP_DOMAIN should now serve the app (give DNS ~1 minute)."
echo "Caddy is no longer needed for public traffic:  sudo systemctl disable --now caddy"
