# SKANAROUND — Database

Postgres managed by Lovable Cloud. Schema changes are made only through
migrations in `supabase/migrations/*.sql`, applied in timestamp order.

## Migration rules

- Forward-only: never edit an applied migration, always add a new file.
- Every new `public` table needs explicit grants — RLS alone is not enough:

```sql
create table public.thing (...);
grant select, insert, update, delete on public.thing to authenticated;
grant all on public.thing to service_role;
-- grant select on public.thing to anon;   -- only if a policy allows anon reads
alter table public.thing enable row level security;
create policy "owner reads" on public.thing
  for select to authenticated using (user_id = auth.uid());
```

- Role checks live in the `private` schema (`private.is_staff`,
  `private.has_role`, `private.is_pro`, `private.is_match_member`) and are
  executable only by `authenticated`, so policies never recurse and clients
  cannot call them directly.
- Roles are stored in `public.user_roles`, never on `profiles`.

## Tables (`public`)

| Table | Purpose |
| --- | --- |
| `profiles` | username, display name, bio, avatar, gender, verified, banned, last_seen; DOB and moderation columns are column-restricted |
| `locations` | latest coordinates + visibility per user; raw coordinates never leave the server |
| `signals` | one-way interest, auto-expiring |
| `matches` | created on mutual signal; gates chat access |
| `messages` | chat text, media and location pins |
| `blocks`, `reports` | safety layer |
| `reactivation_requests` | ban appeals |
| `user_roles` | `admin` / `moderator` |
| `app_settings` | branding, presence timeout, signal expiry, limits, max radius, chat TTL |
| `billing_settings` | Paystack keys, prices, free caps, Pro feature switches |
| `subscriptions`, `payments` | Pro state and transaction history |
| `email_settings` | SMTP configuration |
| `backup_settings` | S3 / Google Drive credentials |
| `notifications`, `notification_reads` | admin broadcasts and targeted messages |
| `push_tokens` | device tokens per user + platform |

## Key functions

| Function | Purpose |
| --- | --- |
| `nearby_people(radius_m)` | Haversine distance + true compass bearing for visible, non-blocked, non-banned users; never returns coordinates |
| `handle_signal()` | trigger creating a match on mutual signal |
| `apply_signal_rules()` | trigger applying expiry and free/Pro daily signal limits |
| `handle_new_user()` | creates a profile row on sign-up |
| `touch_last_seen()`, `touch_updated_at()` | presence and timestamps |
| `my_profile_private()` | owner-only access to DOB and ban fields |
| `billing_public_info()` | safe subset of billing settings for the client |
| `claim_first_admin()` | one-time first-admin bootstrap |
| `admin_stats`, `admin_activity_report`, `admin_billing_stats`, `staff_profiles` | staff dashboards |
| `admin_set_ban`, `admin_set_subscription`, `admin_review_reactivation`, `admin_wipe_user_activity` | staff actions |
| `admin_maintenance_overview`, `admin_purge_*`, `purge_expired_signals`, `purge_old_chats` | maintenance |

All staff functions are `SECURITY DEFINER` and start with an `is_staff` check.

## Storage buckets

All private, access controlled by storage policies:

| Bucket | Contents |
| --- | --- |
| `avatars` | profile photos |
| `branding` | app logo |
| `chat-media` | photos sent in chat (match members only) |
| `chat-backgrounds` | admin-uploaded chat wallpapers |
| `radar-tones` | admin-uploaded alert sounds |
| `verifications` | selfie verification submissions (staff only) |
