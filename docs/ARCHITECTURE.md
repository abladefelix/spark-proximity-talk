# SHATTA — Architecture

Proximity-based discovery and chat. People near each other appear as beacons on a
radar; a mutual signal unlocks a chat.

## Stack

- **Web**: TanStack Start (React 19) + Vite 7, Tailwind v4 tokens in `src/styles.css`
- **Backend**: Lovable Cloud (Postgres, Auth, Storage, Realtime)
- **Native**: Capacitor shell for iOS + Android (`docs/MOBILE.md`)

## Data model (`public`)

| Table | Purpose |
| --- | --- |
| `profiles` | username, bio, avatar, verified, banned, last_seen |
| `locations` | latest coordinates per user (never exposed raw to clients) |
| `signals` | one-way interest, expires after 6h |
| `matches` | created on mutual signal; gates chat access |
| `messages` | chat messages, incl. location pins |
| `user_roles` | `admin` / `moderator` (separate table, never on profiles) |
| `reports`, `blocks` | safety layer |
| `reactivation_requests` | ban appeals reviewed in admin |
| `app_settings` | app name, logo, accent hue |
| `push_tokens` | device tokens per user + platform |

`nearby_people` is a `SECURITY DEFINER` RPC doing Haversine distance (500 m) and
returning bearing/distance only — raw coordinates never leave the server. Banned
and blocked users are filtered out.

## Key screens

- `/` and `/_authenticated/radar` — the radar scope with auto-zoom, collision
  spreading, and cyber-glass beacons.
- Beacon tap → profile dialog → signal.
- `ChatSheet` (vaul bottom sheet) — swipe-down chat over the radar.
  `chat/$matchId` remains for deep links and push taps.
- `/admin` — stats, exports, moderation, bans/appeals, email confirmation,
  branding, accent colour, backups.

## Security

- RLS on every table plus explicit GRANTs; chat rows require match membership.
- `SECURITY DEFINER` helpers are not executable by `anon`; internal helpers
  (`has_role`, `is_staff`, `is_match_member`) are revoked from `authenticated`.
- Admin-only server functions verify roles through `user_roles` directly.
