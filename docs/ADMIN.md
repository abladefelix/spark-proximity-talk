# Admin & Moderation

Route: `/admin`. Access requires an `admin` or `moderator` row in `user_roles`
(checked server-side; client-side role state is never trusted).

## Tabs

- **Overview** — user, signal, match and message counts plus daily activity charts.
- **Users** — grant/revoke roles, ban and unban, view verification state.
- **Reports** — review user reports, act on the reported account.
- **Appeals** — `reactivation_requests` from banned users; approve to unban.
- **Verification** — review selfie verification requests, grant the skanAround
  Signal Lock badge.
- **Emails** — manually confirm unconfirmed accounts.
- **Branding** — app name, logo upload (private `branding` bucket), accent hue
  applied app-wide via `app_settings`.
- **Backups** — configure S3 or Google Drive credentials and take snapshots.
- **Exports** — CSV, JSON and PDF exports of activity data.

## Bans

Banning sets `profiles.banned = true`. Banned users hit `SuspendedGate`, are
excluded from `nearby_people`, and can file one appeal, which appears in the
Appeals tab.
