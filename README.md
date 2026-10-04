# SKANAROUND

Proximity chat. People nearby appear as beacons on a live radar; a mutual signal
unlocks a private chat. Built as a mobile-first app (iOS + Android via Capacitor)
with a web admin console.

> Returning to the project? Start with **[PROJECT_MAP.md](./PROJECT_MAP.md)** for
> a sitemap-style map of code, routes, infrastructure, accounts and release docs.

## Quick start

Requires Node.js 20+ and Bun.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install
bun run dev
```

Scripts: `bun run dev`, `bun run build`, `bun run preview`, `bun run lint`,
`bun run format`.

## Production backend

Production uses a **self-hosted Supabase stack on the Azure VM** (Postgres,
Auth, Storage and Realtime). The original Lovable-hosted Supabase project is
kept for history/migration reference and is not production.

Production references are injected at deploy time from protected server
environment files. Never expose the service-role key to browser code or commit
production secret values.

See:

- [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md)
- [docs/ACCOUNTS_INFRASTRUCTURE.md](./docs/ACCOUNTS_INFRASTRUCTURE.md)
- [docs/SELF_HOST_BACKEND.md](./docs/SELF_HOST_BACKEND.md)

## Documentation

The complete index is [docs/README.md](./docs/README.md).

Highest-value entry points:

| Doc | Contents |
| --- | --- |
| [PROJECT_MAP.md](./PROJECT_MAP.md) | Structural repository/system map |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack, data flow and security model |
| [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md) | Production operations |
| [docs/ACCOUNTS_INFRASTRUCTURE.md](./docs/ACCOUNTS_INFRASTRUCTURE.md) | Resource/login references without secrets |
| [docs/RELEASE_RUNBOOK.md](./docs/RELEASE_RUNBOOK.md) | iOS/Android/store releases |
| [docs/FUTURE_MAINTENANCE.md](./docs/FUTURE_MAINTENANCE.md) | Handoff and future maintenance |

## Tech

TanStack Start (React 19) + Vite, Tailwind v4, TanStack Query, Capacitor 8,
self-hosted Supabase on Azure, RevenueCat for native subscriptions, and SMTP for
email.
