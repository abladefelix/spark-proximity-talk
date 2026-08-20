# SKANAROUND — Admin console

Route: `/admin`. **The admin console is a web surface** — open it in a desktop
browser, not in the mobile app.

Access requires an `admin` or `moderator` row in `user_roles`. Every privileged
action is re-checked server-side via `private.is_staff()` / `private.has_role()`;
client-side role state is never trusted. If no admin exists yet, the first
signed-in user can claim the role (`claim_first_admin()`).

Moderators get moderation tabs; admins additionally get billing, mail, backups
and role management.

## Tabs

### Overview / Insights
Counts for people, online now, verified, signals, matches, messages, reports and
blocks (`admin_stats`), plus daily activity charts (`admin_activity_report`).
Stat cards are clickable and open a drill-down list.

### People
Paginated member list with search. Per user you can:

- open a details dialog (profile, activity, subscription),
- grant or revoke `moderator` / `admin`,
- ban or unban with a reason (bans hide the user, drop their signals and block
  radar visibility),
- grant or revoke Pro manually (`admin_set_subscription`),
- wipe the user's activity (`admin_wipe_user_activity`).

### Reports
Paginated user reports with the reported account and reason; act directly on the
account from the row.

### Appeals
`reactivation_requests` filed by banned users. Approving unbans the account;
rejecting keeps the ban.

### Verification
Paginated selfie verification requests from the private `verifications` bucket.
Approving sets `profiles.verified`, which changes the user's beacon colour and
shows the badge.

### Emails
Paginated list of unconfirmed accounts so an admin can confirm them manually.

### Notifications
Send a broadcast to all users, or search for one member and send a targeted
notification. Delivered in-app via the bell and as push where tokens exist.

### App (branding & rules)
- App name, logo upload (private `branding` bucket), accent hue applied app-wide.
- Presence timeout (minutes) — how long someone counts as online.
- Signal expiry hours and daily signal limit.
- Maximum scan radius users may select.
- Chat retention (`chat_ttl_days`).
- Chat backgrounds: upload and delete the wallpapers users choose from.
- Radar tones: upload and delete alert sounds (mp3/m4a/wav/ogg, max 5 MB).

### Mail
SMTP host, port, TLS, username, password, from name/address, reply-to and a test
send. Used for password resets, admin mail and Pro payment receipts.

### Billing
- Enable/disable payments (when disabled the Go Pro tab is hidden app-wide).
- Paystack public and secret keys, currency.
- Monthly and yearly amounts (in minor units). With no amount set, no pay button
  is shown.
- Pro label and pitch copy.
- Free-tier caps: daily signals, max radius, messages per match.
- Pro switches: unlimited signals, extended radius, unlimited messages, see who
  signalled, priority beacon, custom beacon.
- Revenue summary via `admin_billing_stats`.

Payments are Paystack only. There are no ads anywhere in the product.

### Backups
S3 or Google Drive credentials plus on-demand snapshots of app data.

### Exports
CSV, JSON and PDF exports of activity and moderation data.

### Maintenance
`admin_maintenance_overview` shows what can be cleaned up; one-click purges for
expired signals, stale locations, empty matches, old notifications, old reports
and expired chats.

## Bans

Banning sets `profiles.banned = true`, hides the user's location, deletes their
signals, blocks them from `nearby_people` and shows them `SuspendedGate`. They
may file one appeal, which lands in **Appeals**.
