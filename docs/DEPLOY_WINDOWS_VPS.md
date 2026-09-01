# SKANAROUND — Deploy to a Windows VPS via WSL (GitHub-driven)

Target: `https://skanaround.bytenetdigital.com`. The app runs on **Linux inside
WSL2** on the Windows VPS, behind Caddy, updated automatically from GitHub. No
Lovable hosting involved.

> This document covers the web app (SSR, server functions, `/api` routes). To
> also move the database, auth, storage and realtime onto the same VPS — making
> the product fully independent — follow `docs/SELF_HOST_BACKEND.md` afterwards.


## What the build produces

`bun run build` outputs a standalone Node server:

```text
.output/server/index.mjs   Node HTTP server (SSR + server functions + /api routes)
.output/public/            static client assets (also the Capacitor web dir)
```

Start it with `node .output/server/index.mjs`, listening on `HOST`/`PORT`.

## Layout

```text
Internet :80/:443
   -> Windows netsh portproxy      (deploy/windows/wsl-portproxy.ps1)
      -> Caddy in WSL :80/:443     (deploy/wsl/Caddyfile, TLS via Let's Encrypt)
         -> node .output/server/index.mjs on 127.0.0.1:3000
            (systemd unit "skanaround", deploy/wsl/skanaround.service)
```

## 1. Prerequisites

- Windows Server 2022 / Windows 10+ with virtualization enabled, administrator access
- Ports 80 and 443 open to the internet
- DNS: `skanaround.bytenetdigital.com` A record → the VPS public IP

## 2. Install WSL2 + Ubuntu

Elevated PowerShell:

```powershell
wsl --install -d Ubuntu-24.04
# reboot if prompted, then set up the Linux user when Ubuntu first launches
wsl --set-default-version 2
wsl --set-default Ubuntu-24.04
```

## 3. One-time setup inside WSL

```powershell
wsl -d Ubuntu-24.04
```

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/<your-org>/<your-repo>.git /tmp/skanaround-bootstrap
sudo bash /tmp/skanaround-bootstrap/deploy/wsl/setup.sh \
  https://github.com/<your-org>/<your-repo>.git main /srv/skanaround
```

The script installs Node LTS, Git and Caddy, clones to `/srv/skanaround`, builds,
and installs two systemd services (`skanaround`, `caddy`) that start with WSL.

If it reports that systemd was just enabled, run `wsl --shutdown` in Windows,
reopen WSL and run the same command again.

**Secrets** — the repo `.env` is overwritten on every deploy, so server-only
secrets live in `/etc/skanaround.env` (mode 600):

```bash
sudo nano /etc/skanaround.env      # SUPABASE_SERVICE_ROLE_KEY=...
sudo systemctl restart skanaround
```

`VITE_*` values are compiled into the browser bundle and must be present before
`bun run build` (they already are, via the committed `.env`).

## 4. Expose WSL to the internet

WSL gets a fresh internal IP on every boot, so Windows must re-point its port
proxy. Elevated PowerShell:

```powershell
cd C:\apps\skanaround   # or wherever you keep a Windows-side checkout
Set-ExecutionPolicy Bypass -Scope Process -Force
.\deploy\windows\wsl-portproxy.ps1 -Register
```

`-Register` also creates a scheduled task that re-runs it at every Windows boot.

Keep WSL running without an open console:

```powershell
# make sure the distro starts at boot
schtasks /Create /TN "Start WSL" /TR "wsl.exe -d Ubuntu-24.04 -- /bin/true" /SC ONSTART /RU SYSTEM /F
```

Verify: `curl -I https://skanaround.bytenetdigital.com` from any machine.

## 5. Automatic deploys from GitHub

Install a self-hosted runner on the **Windows** side:

1. GitHub repo → **Settings → Actions → Runners → New self-hosted runner → Windows**.
2. Follow the shown commands; when asked for labels enter `skanaround`.
3. Install it as a service: `.\svc.ps1 install` then `.\svc.ps1 start`.

`.github/workflows/deploy-windows-vps.yml` then runs on every push to `main`: it
shells into WSL, runs `deploy/wsl/deploy.sh` (fetch → `bun install` → `bun run build`
→ `systemctl restart` → health check) and refreshes the port proxy.

Manual deploy at any time, from WSL:

```bash
bash /srv/skanaround/deploy/wsl/deploy.sh main /srv/skanaround
```

## 6. Operations

| Task | Command (inside WSL) |
| --- | --- |
| Status | `systemctl status skanaround` |
| Logs | `journalctl -u skanaround -f` |
| Restart | `sudo systemctl restart skanaround` |
| Caddy logs | `journalctl -u caddy -f` |
| Rollback | `cd /srv/skanaround && git checkout <sha> && bun install && bun run build && sudo systemctl restart skanaround` |

Windows side: `netsh interface portproxy show all` lists the active forwards;
`wsl --shutdown` restarts the whole distro (re-run the port proxy script after).

## 7. Windows-native fallback (no WSL)

If WSL2 is unavailable on the VPS, the original PowerShell path still works:
`deploy/windows/setup.ps1` + `deploy/windows/deploy.ps1` run the same Node build
under PM2, with `deploy/windows/Caddyfile` or IIS (`deploy/windows/web.config`,
URL Rewrite + ARR + win-acme) in front. Point the GitHub workflow step at
`deploy\windows\deploy.ps1` instead of the WSL step.

## 8. After the domain change

- Supabase → Auth → URL configuration: set Site URL to
  `https://skanaround.bytenetdigital.com` and add it (plus
  `https://skanaround.bytenetdigital.com/**`) to the redirect allow-list, otherwise
  password reset and OAuth links break.
- Paystack dashboard: point the webhook at
  `https://skanaround.bytenetdigital.com/api/public/paystack/webhook`.
- RevenueCat: point its webhook at
  `https://skanaround.bytenetdigital.com/api/public/revenuecat/webhook`.
- Native apps: `capacitor.config.ts`, `MainActivity.java` and `SceneDelegate.swift`
  already reference the new domain; run `bun run build && npx cap sync` and ship a
  new build.
