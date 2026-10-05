# Azure account migration backup and restore

Use this before cancelling the current Azure subscription.

## Objective

Move SKANAROUND from the current Azure account to a VM in another Azure account
without losing users, database records, authentication state, uploaded files or
production configuration.

## What is already outside Azure

- source code and migrations: GitHub
- App Store listing/subscriptions: App Store Connect
- Play Store listing/subscriptions: Google Play Console
- RevenueCat configuration: RevenueCat

## What must be backed up from the VM

1. PostgreSQL database
2. Supabase storage files
3. Supabase protected environment
4. SKANAROUND backend environment
5. server/service configuration

The repository backup script captures the database and storage into a portable archive.
Protected environment files must be copied separately over a secure channel and must
never be committed to this public repository.

## Create the data backup

On the old VM:

```bash
cd /srv/skanaround
git fetch origin
git reset --hard origin/main
sudo bash deploy/wsl/backup-for-migration.sh
```

Expected output location:

```text
/var/backups/skanaround-migration/
  SKANAROUND_BACKUP_<timestamp>.tar.gz
  SKANAROUND_BACKUP_<timestamp>.tar.gz.sha256
```

## Copy protected configuration separately

Copy these files securely to your local machine/password-protected storage:

```text
/srv/supabase/.env
/etc/skanaround-backend.env
/etc/skanaround.env        (if present)
/etc/caddy/Caddyfile
/etc/systemd/system/skanaround.service
```

Do not upload these files to GitHub.

## Copy everything off the old Azure VM

Use Termius SFTP or SCP.

Example:

```bash
scp ablade@<OLD_VM_IP>:/var/backups/skanaround-migration/SKANAROUND_BACKUP_*.tar.gz .
scp ablade@<OLD_VM_IP>:/var/backups/skanaround-migration/SKANAROUND_BACKUP_*.sha256 .
```

Also download the protected configuration files separately.

Keep at least two copies outside Azure.

## Verify the archive

```bash
sha256sum -c SKANAROUND_BACKUP_<timestamp>.tar.gz.sha256
```

On macOS, `shasum -a 256` can be used to compare the checksum.

## Restore to the new Azure account

1. Create a new Ubuntu VM.
2. Clone the repository to `/srv/skanaround`.
3. Bootstrap the self-hosted Supabase stack if needed.
4. Restore the protected environment/config files to their original paths.
5. Copy the backup archive to the new VM.
6. Run:

```bash
sudo bash /srv/skanaround/deploy/wsl/restore-from-migration-backup.sh /path/to/SKANAROUND_BACKUP_<timestamp>.tar.gz
```

Then start the full Supabase stack and deploy the app.

## Validate before DNS cutover

Confirm:

- admin login
- normal user sign-in
- existing users/data
- avatars and storage files
- radar/location
- chat history
- RevenueCat products
- purchase and restore
- email
- push notifications

Only after validation should the DNS records for
`skanaround.bytenetdigital.com` and `api.skanaround.bytenetdigital.com`
be pointed to the new VM.

## Do not cancel the old subscription yet

Cancel only after:

- backup archive downloaded
- checksum verified
- protected configuration downloaded
- new VM restored
- DNS cutover completed
- full application validation passed
