# SKANAROUND — Deploy to a Windows VPS (GitHub-driven)

Target: `https://skanaround.bytenetdigital.com`, served by a Node process on the
VPS, updated automatically from GitHub. No Lovable hosting involved.

> The database, auth, storage and realtime still run on Supabase (the project the
> app already uses). Self-hosting the web app does not move that; if you also want
> to move it, that is a separate Supabase self-host/migration exercise.

## What the build produces

`npm run build` outputs a standalone Node server:

```text
.output/server/index.mjs   Node HTTP server (SSR + server functions + /api routes)
.output/public/            static client assets (also the Capacitor web dir)
```

Start it with `node .output/server/index.mjs`, listening on `HOST`/`PORT`.
(Inside Lovable the same command builds a Cloudflare bundle instead — the preset
switch is automatic, so both keep working.)

## 1. Prerequisites on the VPS

- Windows Server 2019+ (or Windows 10/11), administrator access
- Ports 80 and 443 open in the firewall
- DNS: `skanaround.bytenetdigital.com` A record → the VPS public IP

## 2. One-time setup

Open PowerShell as Administrator and run:

```powershell
git clone https://github.com/<your-org>/<your-repo>.git C:\apps\skanaround
cd C:\apps\skanaround
Set-ExecutionPolicy Bypass -Scope Process -Force
.\deploy\windows\setup.ps1 -AppDir C:\apps\skanaround -RepoUrl https://github.com/<your-org>/<your-repo>.git
```

This installs Node LTS + Git, installs dependencies, installs PM2 as a Windows
startup service, builds and starts the app on `http://127.0.0.1:3000`.

`.env` in the repo holds only publishable values and is overwritten on every
deploy, so **server-only secrets go in machine environment variables**:

```powershell
[System.Environment]::SetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY","<key>","Machine")
# reopen PowerShell, then
pm2 restart skanaround --update-env
```

`VITE_*` values are compiled into the browser bundle, so they must be present
before `npm run build` (they already are, via the committed `.env`).

## 3. HTTPS + the domain

Pick one:

**A. Caddy (easiest, automatic Let's Encrypt certificates)**

```powershell
winget install CaddyServer.Caddy
caddy run --config C:\apps\skanaround\deploy\windows\Caddyfile
```

Run it as a service with NSSM so it survives reboots:

```powershell
nssm install caddy "C:\Program Files\Caddy\caddy.exe" run --config C:\apps\skanaround\deploy\windows\Caddyfile
nssm start caddy
```

**B. IIS (if the VPS already runs IIS)**

1. Install **URL Rewrite 2.1** and **Application Request Routing**, then enable
   *Server Proxy Settings → Enable proxy*.
2. Create a site bound to `skanaround.bytenetdigital.com` with an empty physical
   root, e.g. `C:\inetpub\skanaround`.
3. Copy `deploy\windows\web.config` into that root.
4. Issue the certificate with [win-acme](https://www.win-acme.com/) (`wacs.exe`)
   and bind it to port 443.

## 4. Automatic deploys from GitHub

Install a self-hosted runner on the VPS:

1. GitHub repo → **Settings → Actions → Runners → New self-hosted runner → Windows**.
2. Follow the shown commands, and when asked for labels enter `skanaround`.
3. Install it as a service: `.\svc.ps1 install` then `.\svc.ps1 start`
   (or `./config.cmd --runasservice`).

`.github/workflows/deploy-windows-vps.yml` then runs on every push to `main`:
it pulls, `npm ci`, `npm run build`, reloads PM2 and health-checks the app.

Manual deploy at any time:

```powershell
C:\apps\skanaround\deploy\windows\deploy.ps1
```

## 5. Operations

| Task | Command |
| --- | --- |
| Status | `pm2 status` |
| Logs | `pm2 logs skanaround` |
| Restart | `pm2 restart skanaround --update-env` |
| Persist across reboot | `pm2 save` (already done by setup) |
| Rollback | `git checkout <sha>` then `npm ci && npm run build && pm2 restart skanaround` |

## 6. After the domain change

- Supabase → Auth → URL configuration: set Site URL to
  `https://skanaround.bytenetdigital.com` and add it (plus
  `https://skanaround.bytenetdigital.com/**`) to the redirect allow-list, otherwise
  password reset and OAuth links break.
- Paystack dashboard: point the webhook at
  `https://skanaround.bytenetdigital.com/api/public/paystack/webhook`.
- RevenueCat: point its webhook at
  `https://skanaround.bytenetdigital.com/api/public/revenuecat/webhook`.
- Native apps: `capacitor.config.ts`, `MainActivity.java` and `SceneDelegate.swift`
  already reference the new domain; run `npm run build && npx cap sync` and ship a
  new build.
