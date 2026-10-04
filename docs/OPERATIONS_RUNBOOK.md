# SKANAROUND — Production Operations Runbook

Use this for deployment, production checks, database migrations and recovery.

## Production topology

- App: `https://skanaround.bytenetdigital.com`
- API/Supabase: `https://api.skanaround.bytenetdigital.com`
- App checkout: `/srv/skanaround`
- Supabase stack: `/srv/supabase`
- App service: `skanaround`
- Protected backend env: `/etc/skanaround-backend.env`
- Supabase stack env: `/srv/supabase/.env`

Production is self-hosted Supabase on the Azure VM. The old Lovable-hosted
Supabase project is historical and must not be treated as production.

## Normal deployment

```bash
cd /srv/skanaround
git fetch origin
git reset --hard origin/main
sudo chown -R ablade:ablade /srv/skanaround
bash deploy/wsl/deploy.sh main /srv/skanaround
```

The deploy script:

1. pulls the requested Git branch;
2. overlays production self-hosted Supabase values;
3. verifies the backend key against Auth health;
4. applies migrations with `sudo bash deploy/wsl/apply-migrations.sh`;
5. runs `bun install --frozen-lockfile`;
6. builds the app;
7. verifies the built bundle does not contain the old hosted Supabase URL;
8. restarts `skanaround`;
9. performs homepage and sign-in health checks.

Do not replace Bun with `npm ci` unless `package-lock.json` has been deliberately
brought back into sync.

## Database migrations

Migration source of truth:

`supabase/migrations/*.sql`

Rules:

- forward-only;
- never edit an already-applied migration;
- always create a new timestamped migration;
- apply using the repository migration script.

Manual production apply:

```bash
cd /srv/skanaround
sudo bash deploy/wsl/apply-migrations.sh /srv/skanaround /srv/supabase
```

## Health checks

Application:

```bash
curl -I https://skanaround.bytenetdigital.com
sudo systemctl status skanaround
sudo journalctl -u skanaround -n 100 --no-pager
```

Backend:

```bash
curl -I https://api.skanaround.bytenetdigital.com/auth/v1/health
cd /srv/supabase
sudo docker compose ps
```

Never paste service-role or database keys into terminal history when a protected
environment file can be used instead.

## Restart procedures

App only:

```bash
sudo systemctl restart skanaround
```

Self-hosted Supabase stack:

```bash
cd /srv/supabase
sudo docker compose up -d --force-recreate
```

Use a backend restart after key rotation or when the gateway is still serving
stale signing keys.

## Admin access recovery

Admin URL:

`https://skanaround.bytenetdigital.com/admin`

The browser admin flow has inline sign-in. Do not expose privileged admin RPCs
to anonymous users. `claim_first_admin()` is only for a genuinely empty admin
state.

If permissions regress, inspect the migration that grants authenticated
execution on the admin bootstrap functions rather than opening them to `anon`.

## GitHub Actions deployment

Workflow:

`.github/workflows/deploy-azure-ubuntu.yml`

Required repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

If CI fails during SSH setup, check these secrets first.

## Billing health

Admin:

`https://skanaround.bytenetdigital.com/admin`

Expected RevenueCat configuration:

- project: `SKANAROUND`
- entitlement: `skanaround_pro`
- offering: `default`
- monthly: `skanaround_pro_monthly`
- yearly: `skanaround_pro_yearly`

The native app fetches public billing configuration dynamically, so changing a
RevenueCat public SDK key in Admin does not normally require a new native build.

## Incident: app is loading the old backend

Symptoms may include missing users/data after a deployment.

Check:

```bash
sudo grep -E 'SUPABASE_URL|VITE_SUPABASE_URL' /etc/skanaround-backend.env
```

Production must point to `api.skanaround.bytenetdigital.com`, not
`pxgxxlcchyxrilibecsc.supabase.co`.

Then redeploy with `deploy/wsl/deploy.sh`.

## Incident: store products disappear

1. verify product IDs in App Store Connect/Play Console;
2. verify the same IDs in RevenueCat;
3. verify the products are attached to `default`;
4. verify entitlement `skanaround_pro`;
5. check Admin → Billing;
6. force-close/reopen the test build;
7. allow store propagation time before changing code.

## Safe-change procedure

For infrastructure, billing, authentication, schema or native release changes:

1. create a branch;
2. make the smallest change;
3. test locally/staging where possible;
4. create a PR;
5. merge only after validation;
6. deploy `main`;
7. run health checks;
8. document the change.
