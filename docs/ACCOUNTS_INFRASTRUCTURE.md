# SKANAROUND — Accounts & Infrastructure Reference

This document records **where to log in and which project/resource to open**.
It deliberately excludes passwords, private keys and secret values because this
repository is public. Keep the exact login emails, passwords, MFA recovery codes,
SSH keys and API secrets in the team's password manager.

## Service map

| Service | Login / entry point | Project/resource to open | Non-secret identifier |
| --- | --- | --- | --- |
| GitHub | https://github.com/login | `abladefelix/spark-proximity-talk` | account `abladefelix` |
| Azure Portal | https://portal.azure.com | production subscription / VM | subscription label: `VM GROUP TECHNOLOGIES` |
| Production VM | SSH | Azure Ubuntu host | Linux deploy user: `ablade` |
| SKANAROUND Admin | https://skanaround.bytenetdigital.com/admin | production admin console | admin users are stored in production Auth/roles |
| RevenueCat | https://app.revenuecat.com | project `SKANAROUND` | entitlement `skanaround_pro` |
| App Store Connect | https://appstoreconnect.apple.com | SKANAROUND iOS app | bundle ID `app.skanaround.mobile` |
| Google Play Console | https://play.google.com/console | SKANAROUND | package `com.skanaround` |
| Lovable (historical) | https://lovable.dev | Nearby Connect | project ID below |
| Supabase hosted (historical) | https://supabase.com/dashboard | old Lovable backend | ref below |

## Azure / production host

- Azure subscription label previously used: **VM GROUP TECHNOLOGIES**
- Linux deploy user: `ablade`
- Application directory: `/srv/skanaround`
- Supabase stack directory: `/srv/supabase`
- Application environment: `/etc/skanaround-backend.env`
- Supabase stack environment: `/srv/supabase/.env`
- Application service: `skanaround`
- Web: https://skanaround.bytenetdigital.com
- API/Supabase gateway: https://api.skanaround.bytenetdigital.com

### GitHub Actions deployment variables

`.github/workflows/deploy-azure-ubuntu.yml` expects repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

These values belong in GitHub Actions secrets/password management, not in Git.

## Production database

Production is a **self-hosted Supabase/PostgreSQL stack on Azure**.

Use:

- stack: `/srv/supabase`
- stack secrets: `/srv/supabase/.env`
- app backend overlay: `/etc/skanaround-backend.env`
- public gateway: `https://api.skanaround.bytenetdigital.com`
- production project marker used by the app: `selfhosted`

The environment files contain values such as:

- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- PostgreSQL credentials
- public/backend URLs

Never copy those secret values into documentation or issues.

## Historical Lovable / hosted Supabase

These are retained for provenance and migration history. They are **not current
production**.

- Lovable project: **Nearby Connect**
- Workspace ID: `BgRrDULCVYjwO4OhrShk`
- Lovable Project ID: `b0859620-d8d1-49a0-93f5-f6acf2710f99`
- Old Supabase project ref: `pxgxxlcchyxrilibecsc`
- Old Supabase URL: `https://pxgxxlcchyxrilibecsc.supabase.co`

## Store/account identifiers

### Apple
- Bundle ID: `app.skanaround.mobile`
- RevenueCat Apple products:
  - `skanaround_pro_monthly`
  - `skanaround_pro_yearly`
- Subscription group: `SKANAROUND Pro`

Keep in password manager:
- Apple ID used for App Store Connect
- MFA/recovery data
- App Store Connect `.p8` key
- Key ID
- Issuer ID
- App Review test credentials

### Google Play
- Package: `com.skanaround`
- Android upload keystore: `~/skanaround-upload.jks`
- Alias: `skanaround`
- Upload SHA-1:
  `F2:BC:5A:F9:9E:81:66:6F:51:51:7E:72:06:0C:17:5B:60:9B:EC:D8`

Keep in password manager:
- Google account used for Play Console
- MFA/recovery data
- keystore password
- key password

### RevenueCat
- Project: `SKANAROUND`
- Entitlement: `skanaround_pro`
- Offering: `default`
- Products:
  - `skanaround_pro_monthly`
  - `skanaround_pro_yearly`
- Public SDK key prefixes:
  - Apple: `appl_`
  - Google: `goog_`

Keep in password manager:
- RevenueCat account login
- secret API key
- webhook secret

## Password-manager checklist

Create a vault/folder called **SKANAROUND** containing at minimum:

1. Azure Portal account + MFA recovery
2. Azure VM hostname/IP
3. Azure VM SSH private key
4. GitHub account recovery data
5. GitHub Actions deploy SSH key
6. Apple Developer/App Store Connect login + MFA recovery
7. Apple App Store Connect private `.p8` key, Key ID and Issuer ID
8. Google Play Console login + recovery data
9. Android keystore + passwords
10. RevenueCat login + secret API key + webhook secret
11. Production PostgreSQL credentials
12. Supabase service-role key
13. Production admin login(s)
14. App Review test login
15. SMTP/Firebase/provider credentials

## Recovery sequence

If all local context is lost:

1. open GitHub repository;
2. read [../PROJECT_MAP.md](../PROJECT_MAP.md);
3. log into Azure and locate the production VM;
4. SSH as the deploy user;
5. inspect `/srv/skanaround` and `/srv/supabase`;
6. read production references from the protected env files;
7. use the password manager for secrets;
8. verify RevenueCat/App Store/Play product IDs before changing billing.
