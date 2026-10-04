# SKANAROUND — Future Maintenance & Handoff

This document is for the next engineer or a future return to the project.

## First 15 minutes

1. Read [../PROJECT_MAP.md](../PROJECT_MAP.md).
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md).
3. Read [ACCOUNTS_INFRASTRUCTURE.md](./ACCOUNTS_INFRASTRUCTURE.md).
4. Read [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
5. Check open pull requests before changing production.
6. Confirm which backend is production.

## Critical facts

- Production backend is self-hosted Supabase on Azure.
- The historical Lovable/Supabase project is not production.
- Native apps load the live website, so many web fixes deploy without a store
  resubmission.
- Native capabilities, package IDs, entitlements, permissions, version codes and
  plugin changes still require a new store binary.
- Mobile subscriptions are Apple/Google billing through RevenueCat.
- Web-only external billing must not be surfaced inside the native purchase flow.
- Database migrations are forward-only.
- Production secrets never belong in Git.

## Change discipline

Use branch → test → PR → merge → deploy.

Do not make direct production schema changes that are absent from a migration.
Do not merge a release version bump only on the local machine; Git must reflect
the artifact submitted to stores.

## When adding a new feature

Update:

1. the code;
2. DB migration if needed;
3. user/admin guide if applicable;
4. architecture if a new subsystem was introduced;
5. [../PROJECT_MAP.md](../PROJECT_MAP.md) if navigation changed;
6. store privacy/data-safety declarations if new data is collected.

## When adding a new external service

Record in [ACCOUNTS_INFRASTRUCTURE.md](./ACCOUNTS_INFRASTRUCTURE.md):

- service name;
- login URL;
- project/resource identifier;
- where its secret is stored (password manager/GitHub Secret/VM env);
- callback/webhook URLs;
- owner/recovery process.

Never add the actual secret value.

## Version-release discipline

Android:
- always increment `versionCode`.

iOS:
- keep app version aligned with the binary;
- increment build number for every binary upload.

After submission, merge the version bump so `main` equals what was shipped.

## Store/privacy maintenance

Whenever permissions or collected data change, revisit:

- Apple App Privacy;
- Google Play Data Safety;
- Privacy Policy;
- Terms if user-facing behaviour changed.

## Quarterly maintenance

- verify backups/restores;
- rotate sensitive keys where appropriate;
- audit admin accounts;
- audit GitHub/Azure access;
- test legal/support URLs;
- confirm store subscriptions can purchase and restore;
- update dependencies on a branch;
- review CI/CD secrets and failed workflows.

## If production is down

1. check Azure VM availability;
2. check `systemctl status skanaround`;
3. check Supabase Docker containers;
4. inspect app logs;
5. inspect backend health;
6. roll back only through a known Git commit/branch;
7. preserve DB before destructive recovery.

See [OPERATIONS_RUNBOOK.md](./OPERATIONS_RUNBOOK.md).
