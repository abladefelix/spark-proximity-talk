# SKANAROUND Documentation

Start with the repository [PROJECT_MAP.md](../PROJECT_MAP.md). It is the
sitemap-style structural index for code, infrastructure, routes and operations.

## Operations and handoff

| Doc | Contents |
| --- | --- |
| [../PROJECT_MAP.md](../PROJECT_MAP.md) | Structural map: where everything is and where to start by task |
| [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md) | Production deploys, health checks, migrations, incidents |
| [ACCOUNTS_INFRASTRUCTURE.md](./ACCOUNTS_INFRASTRUCTURE.md) | Login entry points, Azure/database/store resource references; no secrets |
| [RELEASE_RUNBOOK.md](./RELEASE_RUNBOOK.md) | Repeatable iOS, Android, RevenueCat and store release process |
| [FUTURE_MAINTENANCE.md](./FUTURE_MAINTENANCE.md) | Handoff rules and future-maintainer checklist |

## Product and engineering

| Doc | Contents |
| --- | --- |
| [USER_GUIDE.md](./USER_GUIDE.md) | Using the app: sign up, profile, radar, signals, chat, Pro |
| [ADMIN.md](./ADMIN.md) | Admin console: every tab, setting and moderation action |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Stack, routes, data flow, security model |
| [DATABASE.md](./DATABASE.md) | Migration rules, tables, functions, storage buckets |
| [SETUP.md](./SETUP.md) | Local setup, migrations, first admin, mail/billing config |
| [SELF_HOST_BACKEND.md](./SELF_HOST_BACKEND.md) | Self-hosted Supabase setup and migration |
| [DEPLOY_AZURE_UBUNTU.md](./DEPLOY_AZURE_UBUNTU.md) | Azure Ubuntu deployment |
| [MOBILE.md](./MOBILE.md) | Native builds, permissions and native project details |
| [PLAY_STORE.md](./PLAY_STORE.md) | Google Play-specific submission guide |
| [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) | APNs + FCM setup and secrets |
| [WEB_BILLING.md](./WEB_BILLING.md) | Website-only Paystack checkout |
| [GITHUB_SYNC.md](./GITHUB_SYNC.md) | Connecting the repo and working locally |
| [LAUNCH.md](./LAUNCH.md) | Local iOS + Android run commands |

## Documentation rule

When a new surface, service or deployment path ships:

1. update its detailed document;
2. add/update its entry here;
3. update [PROJECT_MAP.md](../PROJECT_MAP.md) if architecture/navigation changed;
4. never commit passwords, private keys or server-only secret values.
