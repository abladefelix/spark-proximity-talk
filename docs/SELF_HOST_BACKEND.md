# SKANAROUND — self-hosting the backend (database, auth, storage, realtime)

This completes the move off Lovable. `docs/DEPLOY_WINDOWS_VPS.md` moves the web
app (SSR + server functions + API routes). This document moves the **data
layer** so the VPS + GitHub are the only things the product depends on.

```text
Windows VPS
└─ WSL2 Ubuntu
   ├─ Caddy :80/:443
   │   ├─ skanaround.bytenetdigital.com      -> node app        127.0.0.1:3000
   │   └─ api.skanaround.bytenetdigital.com  -> backend gateway 127.0.0.1:8000
   ├─ systemd "skanaround"  (the app)
   └─ Docker stack (Postgres+PostGIS, Auth, PostgREST, Storage, Realtime, Studio)
```

## 0. Before you start

- DNS: add `api.skanaround.bytenetdigital.com` A record → VPS public IP.
- The VPS should have at least 4 GB RAM / 2 vCPU / 40 GB disk for both stacks.
- Get the current backend's **direct Postgres connection string** and
  **service role key**. On Lovable Cloud these are not exposed to you — request
  a database export/credentials from Lovable support, or connect your own
  Supabase project first and migrate from there.

## 1. Bring up the self-hosted stack

```bash
sudo bash /srv/skanaround/deploy/wsl/supabase-selfhost.sh /srv/supabase api.skanaround.bytenetdigital.com
```

This installs Docker, generates every secret (JWT secret, anon key, service
role key, DB password, Studio password), enables PostGIS, binds the gateway to
`127.0.0.1:8000`, and writes the app-facing values to
`/etc/skanaround-backend.env`.

Reload Caddy so the API hostname is served:

```bash
sudo cp /srv/skanaround/deploy/wsl/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## 2. Create the schema

```bash
cd /srv/supabase
for f in /srv/skanaround/supabase/migrations/*.sql; do
  echo "-- $f"
  docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done
```

Migrations run in filename order and contain every table, RLS policy, GRANT,
function and trigger the app needs.

## 3. Move existing data (skip for a fresh start)

Stop the app first: `sudo systemctl stop skanaround`.

```bash
# database: auth users + public + storage metadata
bash /srv/skanaround/deploy/wsl/migrate-db.sh "postgresql://postgres:<pw>@<host>:5432/postgres"

# storage files (avatars, chat backgrounds, ...)
cd /srv/skanaround
SRC_URL=https://<old-project>.supabase.co SRC_SERVICE_KEY=<old service key> \
DST_URL=https://api.skanaround.bytenetdigital.com DST_SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY /etc/skanaround-backend.env | cut -d= -f2-) \
node deploy/wsl/migrate-storage.mjs
```

Password hashes come across with `auth.users`, so users keep their passwords.

## 4. Point the app at it

The systemd unit already reads `/etc/skanaround.env`. Add the backend file too:

```bash
sudo sed -i '/EnvironmentFile=-\/etc\/skanaround.env/a EnvironmentFile=-/etc/skanaround-backend.env' \
  /etc/systemd/system/skanaround.service
sudo systemctl daemon-reload
```

The **browser** bundle bakes in `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
at build time, so also set them in the repo `.env` on the server (and in GitHub
if CI builds) before the next deploy:

```bash
cd /srv/skanaround
VITE_SUPABASE_URL=https://api.skanaround.bytenetdigital.com
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key from /etc/skanaround-backend.env>
```

Then `bash deploy/wsl/deploy.sh main /srv/skanaround`.

> Because `.env` is reset on every deploy, keep these two values in the GitHub
> repo `.env` (they are publishable, not secrets) so builds are reproducible.

## 5. Mobile apps

iOS/Android bundle the web build, so rebuild and resubmit after switching:

```bash
bun run build && npx cap sync
```

## 6. Auth email

Self-hosted Auth needs SMTP or nothing sends. In `/srv/supabase/.env`:

```
SMTP_HOST=...   SMTP_PORT=587   SMTP_USER=...   SMTP_PASS=...
SMTP_SENDER_NAME=SKANAROUND     SMTP_ADMIN_EMAIL=no-reply@bytenetdigital.com
```

Then `cd /srv/supabase && docker compose up -d auth`.

## 7. Backups (now your responsibility)

```bash
# nightly at 02:30
sudo crontab -e
30 2 * * * cd /srv/supabase && docker compose exec -T db pg_dump -U postgres postgres | gzip > /var/backups/skanaround-$(date +\%F).sql.gz
```

Also back up `/srv/supabase/volumes/storage` (uploaded files) and
`/srv/supabase/.env` (losing `JWT_SECRET` invalidates every session and key).
Ship copies off the box — the in-app Admin backup section can target S3/Drive.

## What still touches an outside service after this

- Let's Encrypt (TLS certificates)
- Apple / Google for push notifications and in-app purchases (RevenueCat)
- Your SMTP provider
- GitHub (source + CI)

Nothing in the running product depends on Lovable.
