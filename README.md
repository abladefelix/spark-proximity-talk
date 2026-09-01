# SKANAROUND

Proximity chat. People nearby appear as beacons on a live radar; a mutual signal
unlocks a private chat. Built as a mobile-first app (iOS + Android via Capacitor)
with a web admin console.

## Quick start

Requires Node.js 20+ and Bun.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev            # http://localhost:8080
```

Scripts: `bun run dev`, `bun run build`, `bun run preview`, `bun run lint`,
`bun run format`.

## Backend

The backend (Postgres, Auth, Storage, Realtime) is managed by Lovable Cloud.
Client env vars live in `.env` and are generated automatically:

| Variable | Where it is used |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | privileged server-only work |

Never expose the service-role key to browser code.

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | How to use the app: sign up, radar, signals, chat, Pro |
| [docs/ADMIN.md](./docs/ADMIN.md) | Admin console: every tab, setting and moderation action |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack, data model, routes, security model |
| [docs/DATABASE.md](./docs/DATABASE.md) | Migrations, tables, RPCs, storage buckets |
| [docs/DEPLOY_WINDOWS_VPS.md](./docs/DEPLOY_WINDOWS_VPS.md) | Self-hosting on a Windows VPS at skanaround.bytenetdigital.com |
| [docs/SETUP.md](./docs/SETUP.md) | Local setup, first admin, billing/mail configuration |
| [docs/LAUNCH.md](./docs/LAUNCH.md) | Line-by-line iOS + Android run commands |
| [docs/MOBILE.md](./docs/MOBILE.md) | Native builds, permissions, store checklist |
| [docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) | APNs + FCM setup |
| [docs/GITHUB_SYNC.md](./docs/GITHUB_SYNC.md) | Repo sync and working locally |

## Tech

TanStack Start (React 19) + Vite, Tailwind v4 tokens in `src/styles.css`,
TanStack Query, Capacitor 8 native shell, Paystack for payments, SMTP for email.
