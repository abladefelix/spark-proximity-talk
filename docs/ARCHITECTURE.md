# SKANAROUND — Architecture

Proximity discovery and chat. People near each other appear as beacons on a
compass-accurate radar; a mutual signal unlocks a private chat. The product is
mobile-first (Capacitor iOS/Android); the browser is a dev surface plus the home
of the admin console.

## Stack

- **App**: TanStack Start (React 19) + Vite, TanStack Query, Tailwind v4 tokens
  in `src/styles.css` (light + dark via OKLCH tokens)
- **Backend**: Lovable Cloud (Postgres, Auth, Storage, Realtime)
- **Server logic**: `createServerFn` modules in `src/lib/*.functions.ts` with
  server-only helpers in `*.server.ts`
- **Native**: Capacitor 8 shell (geolocation, push, biometrics, app state)
- **Payments**: Paystack · **Email**: SMTP configured in Admin

## Routes

| Route | Purpose |
| --- | --- |
| `/` | landing / redirect into the app |
| `/auth` | sign in (username or email), sign up, forgot password |
| `/reset-password` | password recovery |
| `/_authenticated/radar` | the radar scope — home screen |
| `/_authenticated/chats` | stacked deck of active chats |
| `/_authenticated/chat/$matchId` | a conversation (deep links, push taps) |
| `/_authenticated/profile` | profile, range, visibility, theme, tone, background, verification, delete account |
| `/admin` | web admin console |
| `/terms`, `/privacy` | legal pages required by the stores |
| `/api/public/*` | webhooks and external callbacks (signature-verified) |

`_authenticated/route.tsx` gates the subtree and redirects signed-out users to
`/auth`.

## Data flow

1. The device publishes its coordinates to `locations` while the app is in the
   foreground (Capacitor geolocation with a `navigator.geolocation` fallback).
2. The radar polls `nearby_people(radius_m)`, which returns distance, true
   bearing, presence and signal state — never raw coordinates.
3. Beacons are placed by real bearing and linear distance, rotated when compass
   heading-up mode is on, and de-crowded tangentially so direction stays true.
4. Tapping a beacon opens the profile card; `signals` insert triggers apply
   expiry and free/Pro limits, and a reciprocal signal creates a `match`.
5. Chat reads/writes go through RLS scoped by `private.is_match_member`.

## Security model

- RLS on every table plus explicit GRANTs; chat rows require match membership.
- Role and permission helpers live in the `private` schema, executable only by
  `authenticated`, so clients cannot call them and policies cannot recurse.
- Roles are stored in `user_roles`; staff RPCs re-check `private.is_staff()`.
- Sensitive `profiles` columns (date of birth, ban metadata) are not readable
  table-wide; owners use `my_profile_private()`, staff use `staff_profiles()`.
- All storage buckets are private with policy-scoped access.
- The service-role client is only imported inside server handlers after the
  caller has been verified.
