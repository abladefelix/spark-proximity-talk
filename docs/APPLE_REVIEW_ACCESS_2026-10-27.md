# Apple review access remediation — October 27, 2026

Status update October 28: the owner confirmed the isolated demo opens on iOS, but requested normal account sample activity instead. The replacement is implemented and awaiting deployment and iOS verification; see [REVIEW_DEMO.md](REVIEW_DEMO.md) for current instructions. App Store Connect updates remain pending. The October 27 findings below are historical.
Submission: `03bdc8a2-8197-4beb-910e-4f110d9bbd37`.
Reviewed version: 1.1.7 (19), iPad Air 11-inch (M3).
Reason: Guideline 2.1(a), access to all features/account types and populated sample chats/questions.

## Findings

- The live admin session is now authenticated. App Store Connect was signed out at its last inspection.
- Existing review notes reference a provided review account but do not establish that it works or contains sample content.
- Local configuration contains public backend credentials only; it cannot administer production users.
- Device sessions can prevent concurrent use of the same account. Close other sessions and verify a fresh reviewer login. Do not disable this protection globally.
- Question broadcasts normally expire after 15 minutes and are geographically filtered. Static questions seeded at the owner's location will not reliably appear to Apple.
- Chats have vanishing-message settings (the migration default is 168 hours); actual production settings require inspection. Sample conversations must remain available throughout review.

## Live remediation steps

1. Sign into the existing admin account and inspect the actual review account. Check email confirmation, adult date of birth, profile completion, ban status, device-session behavior and subscription entitlement. Never grant reviewers an admin role or access to real users' private data.
2. Use dedicated test identities with fictional, clearly identified sample content. Verify a standard account and a Pro account if needed to exercise different feature sets. Store credentials only in a private vault and App Store Connect's review fields.
3. Populate test-only conversations with sample messages exchanged between those identities. Verify actual send/receive behavior and the Report/Block controls.
4. Resolve location and expiry for sample questions explicitly. A disclosed, isolated demonstration mode is an option if ordinary test accounts cannot reliably expose these features. Do not make fake nearby profiles visible to normal users or silently alter the reviewer's location.
5. Check the review account on a fresh iPad session: sign-in, onboarding, radar/location permissions, chat, questions, reporting/blocking, Pro access, paywall and Restore Purchases. Record any unresolved failures before resubmission.
6. In App Store Connect, update App Review Information with verified credentials, account-type differences and precise navigation. Explain any demonstration mode openly. Keep the app backend reachable throughout review.
7. Reply to Apple only after the account/content checks pass. Do not state that this is fixed based solely on repository changes.

## Reply template — use only after verification

Hello App Review Team,

We have updated App Review Information with tested credentials for [account types]. The review accounts contain fictional sample conversations and [verified way to access sample questions].

To review the features:
1. Sign in using the credentials in App Review Information.
2. Open Chats and select [actual sample conversation name] to view and send messages.
3. Open Local → Ask the area and [tested instructions for questions].
4. Use the menu on another sample user's content to test Report and Block, and create your own question to test deletion.
5. [Verified instructions for Pro features, paywall and Restore Purchases.]

[Describe any explicit demo mode and any location requirements accurately.]

Thank you.

Do not send placeholders or claim sample questions are globally accessible before testing that behavior.

## Backend verification on October 27

Public production assets `/assets/useQuery-DVhS-myQ.js` and `/assets/index-BgNZd_qX.js` point to `https://api.skanaround.bytenetdigital.com`. The checked-in `.env` still points to the historical hosted project; deployment overlays it with self-hosted configuration. Do not use that local `.env` to diagnose production account existence.

`sa2@skanaround.app` appears only as an example in `deploy/wsl/create-super-admin.sh`; it is not a verified production admin. The script warns that old hosted accounts do not automatically exist on the new backend. Invalid login alone cannot distinguish a missing account from a wrong password. Do not run that script speculatively: it can reset passwords and grant administrative access.

An authorized operator can identify current admin emails using this read-only query on the **current self-hosted database**, without reading password hashes or resetting credentials:

```sql
select u.email, u.email_confirmed_at, r.role
from auth.users u
join public.user_roles r on r.user_id = u.id
where r.role = 'admin'
order by u.created_at;
```

The connected hosted Supabase project listings did not identify a SkanAround project. They do not provide administrative access to this self-hosted backend. This earlier access blocker was resolved through the owner’s authenticated admin session and phone SSH session; see the deployment update below.

## Live review account findings and action

On October 27 the owner identified `ogyamwilson` as the account supplied to Apple. Admin shows an active, email-confirmed, verified ordinary user with successful sign-ins on the review date, but zero signals, matches and messages. These logs do not establish who signed in or prove every feature worked.

Granted complimentary Pro through the existing Admin → Billing → Grant membership control. Verified Members with Pro shows the account active until November 26, 2026. This is an admin-issued membership, not an administrative role or a paid transaction. No password, role, global retention or location settings were changed. Recheck/extend membership if review continues beyond that date.

The original Admin UI had no demo provisioning control. The deployed update now provides Admin → App → Review demo data, and enabling it for `ogyamwilson` returned a success confirmation. This exposes an isolated, explicitly simulated demonstration; it does not seed production conversations. See [REVIEW_DEMO.md](REVIEW_DEMO.md) for exact behavior, limitations and verification steps. Do not claim native end-to-end verification until completed.

## Deployment and recovery record

The owner’s phone SSH session confirmed user `ablade`, hostname `SKNRND`, Ubuntu 24.04.4 with Azure kernel, and production repository `/srv/skanaround` with remote `abladefelix/spark-proximity-talk`. Public server IP is `172.176.158.116`; `172.16.0.4` is its private interface address. The Azure subscription/account owner is still unverified. No hosting migration occurred.

The supplied deployment command backs up local changes under `$HOME/skanaround-before-demo.*`, fetches origin, creates `deploy/review-demo-20261027`, and invokes `deploy/wsl/deploy.sh codex/review-demo-access /srv/skanaround`. The owner reported completion; subsequent live browser inspection confirmed the new controls and successful enable action. Server command output and installed iOS behavior have not been independently verified. Production is using the feature update; PR #11 must be integrated before deploying main again.
