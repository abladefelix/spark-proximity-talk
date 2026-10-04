# SKANAROUND Project Map

> Start here when returning to the project after time away. This file acts like a
> sitemap for the repository: choose the task you need, then follow the linked
> code or documentation.

## Quick navigation by task

| I need to… | Start here | Then inspect |
| --- | --- | --- |
| Understand the whole system | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | `src/routes/`, `src/lib/`, `supabase/migrations/` |
| Find a feature/screen | [Application map](#application-map) | `src/routes/`, `src/components/` |
| Work on the database | [docs/DATABASE.md](./docs/DATABASE.md) | `supabase/migrations/`, `drizzle/` |
| Deploy production | [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md) | `deploy/wsl/`, `.github/workflows/` |
| Recover accounts/infrastructure | [docs/ACCOUNTS_INFRASTRUCTURE.md](./docs/ACCOUNTS_INFRASTRUCTURE.md) | password manager + Azure/GitHub dashboards |
| Build iOS/Android | [docs/MOBILE.md](./docs/MOBILE.md) | `ios/`, `android/`, `capacitor.config.ts` |
| Publish a new app version | [docs/RELEASE_RUNBOOK.md](./docs/RELEASE_RUNBOOK.md) | App Store Connect / Play Console / RevenueCat |
| Configure subscriptions | [docs/RELEASE_RUNBOOK.md](./docs/RELEASE_RUNBOOK.md#subscriptions-and-revenuecat) | `src/lib/revenuecat.ts`, `src/hooks/useBilling.ts` |
| Operate the admin console | [docs/ADMIN.md](./docs/ADMIN.md) | `src/routes/admin.tsx`, `src/components/admin/` |
| Configure push | [docs/PUSH_NOTIFICATIONS.md](./docs/PUSH_NOTIFICATIONS.md) | FCM/APNs + native projects |
| Hand the project to another engineer | [docs/FUTURE_MAINTENANCE.md](./docs/FUTURE_MAINTENANCE.md) | this map + operations docs |

## System map

```text
Users (iOS / Android)
        │
        │ Capacitor WebView loads live production app
        ▼
https://skanaround.bytenetdigital.com
        │
        ├── TanStack Start / React UI
        │   ├── src/routes
        │   ├── src/components
        │   └── src/hooks
        │
        ├── server functions
        │   └── src/lib/*.functions.ts / *.server.ts
        │
        ▼
https://api.skanaround.bytenetdigital.com
        │
        ▼
Self-hosted Supabase on Azure VM
        ├── Auth
        ├── PostgreSQL
        ├── Storage
        └── Realtime
             │
             └── schema changes: supabase/migrations/*.sql

External services
├── RevenueCat → Apple IAP / Google Play Billing
├── Firebase / APNs → push notifications
├── SMTP → transactional email
├── GitHub → source + CI deployment
└── Azure VM → production host
```

## Repository structure

```text
.
├── PROJECT_MAP.md                 ← you are here
├── README.md                      ← project overview / quick start
├── docs/                          ← human operating documentation
│   ├── README.md                  ← documentation index
│   ├── ARCHITECTURE.md            ← runtime/system design
│   ├── DATABASE.md                ← schema/migrations/RLS
│   ├── ADMIN.md                   ← admin console
│   ├── OPERATIONS_RUNBOOK.md      ← deploy/recovery/production operations
│   ├── ACCOUNTS_INFRASTRUCTURE.md ← account + resource references, no secrets
│   ├── RELEASE_RUNBOOK.md         ← iOS/Android/store/subscription releases
│   ├── FUTURE_MAINTENANCE.md      ← rules for future maintainers
│   ├── MOBILE.md                  ← native build details
│   ├── PLAY_STORE.md              ← Play Console-specific guide
│   ├── PUSH_NOTIFICATIONS.md       ← APNs/FCM
│   └── ...
├── src/
│   ├── routes/                    ← pages/routes
│   ├── components/                ← reusable UI
│   ├── hooks/                     ← client behaviour/state hooks
│   ├── lib/                       ← server functions + domain logic
│   ├── integrations/              ← external clients/integrations
│   └── styles.css                 ← product design tokens
├── supabase/
│   ├── migrations/                ← authoritative forward-only DB changes
│   └── config.toml                ← historical hosted project ref
├── drizzle/                       ← secondary schema/migration tooling
├── deploy/
│   ├── wsl/                       ← current Azure Ubuntu production scripts
│   └── windows/                   ← legacy Windows deployment material
├── android/                       ← Android Studio project
├── ios/                           ← Xcode project
├── public/                        ← static assets, guide images, offline page
├── .github/workflows/             ← CI/CD workflows
└── capacitor.config.ts            ← native shell + live web URL
```

## Application map

### Public/browser routes

| Route | Purpose |
| --- | --- |
| `/` | native app entry / browser download wall |
| `/auth` | app authentication; `?admin=1` allows browser admin sign-in |
| `/admin` | browser admin console |
| `/privacy` | public privacy policy |
| `/terms` | public terms |
| `/delete-account` | public account-deletion information |
| `/guide` | in-app user guide; check WebGate allowlist before using as public support URL |
| `/business` | venue/business-zone page |
| `/api/public/*` | externally callable callbacks/webhooks |

### Signed-in app routes

| Route | Purpose |
| --- | --- |
| `/_authenticated/radar` | proximity radar |
| `/_authenticated/local` | intent, Bat-Signal, local questions |
| `/_authenticated/chats` | active mutual chats |
| `/_authenticated/chat/$matchId` | direct chat |
| `/_authenticated/profile` | profile, app settings, legal links, account deletion |

## Domain-code map

| Domain | Primary code |
| --- | --- |
| Radar/location | `src/routes/_authenticated/radar.tsx`, `src/lib/publish-location.ts`, DB `nearby_people` |
| Local/Bat-Signal | `src/routes/_authenticated/local.tsx`, `src/components/BatSignal.tsx`, `src/components/QuestionBroadcasts.tsx` |
| Chat | `src/components/ChatPanel.tsx`, `src/routes/_authenticated/chat.$matchId.tsx` |
| Pro subscriptions | `src/components/ProUpgradeCard.tsx`, `src/lib/revenuecat.ts`, `src/hooks/useBilling.ts` |
| Store sync/webhooks | `src/lib/store-billing*.ts`, public API routes |
| Admin | `src/routes/admin.tsx`, `src/components/admin/` |
| Auth | `src/routes/auth.tsx`, `src/lib/username-auth*.ts` |
| Push | `src/hooks/usePushNotifications.ts`, `src/lib/fcm.server.ts` |
| Email | `src/lib/smtp.server.ts`, `src/lib/emails.functions.ts` |
| Web gating | `src/components/WebGate.tsx` |
| Legal | `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/delete-account.tsx` |

## Production map

```text
Azure subscription
└── Ubuntu VM
    ├── /srv/skanaround              application checkout
    ├── /srv/supabase                self-hosted Supabase stack
    ├── /etc/skanaround-backend.env  application backend references
    ├── systemd: skanaround           app service
    └── reverse proxy / DNS
        ├── skanaround.bytenetdigital.com
        └── api.skanaround.bytenetdigital.com
```

See [docs/ACCOUNTS_INFRASTRUCTURE.md](./docs/ACCOUNTS_INFRASTRUCTURE.md) for
resource identifiers and [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md)
for commands.

## Store/release map

```text
Source code
  │
  ├── iOS → Xcode Archive → App Store Connect
  │                         └── RevenueCat ← Apple subscriptions
  │
  └── Android → signed AAB → Google Play Console
                            └── RevenueCat ← Google Play subscriptions
```

Current release line: `1.1.7`. Store build/version codes must always be
incremented for a new binary. See [docs/RELEASE_RUNBOOK.md](./docs/RELEASE_RUNBOOK.md).

## Sources of truth

- **Production runtime/backend:** self-hosted Supabase on Azure.
- **Database evolution:** `supabase/migrations/*.sql`.
- **Native shell IDs/URL:** native projects + `capacitor.config.ts`.
- **Production secrets:** VM environment files / password manager, never Git.
- **Store product IDs:** App Store Connect, Play Console and RevenueCat must match.
- **Historical Lovable project:** reference/history only; do not switch production
  back to it without an explicit migration plan.

## Documentation maintenance rule

Whenever a new feature, service, store product, environment, domain or deployment
path is introduced:

1. update the relevant detailed doc;
2. add or update its link in `docs/README.md`;
3. update this map if navigation or architecture changed;
4. never commit passwords, private keys or server-only secret values.
