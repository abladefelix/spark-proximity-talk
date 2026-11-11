# Apple review safety update — 11 November 2026

Submission: `03bdc8a2-8197-4beb-910e-4f110d9bbd37`, version 1.1.7 (19).

## Status

Implementation and local checks completed in commit `b763535`. The owner reported deployment completed without errors on 11 November. Browser checks confirmed the new public safety contact and 24-hour wording, the updated Admin report guidance, and a successful refresh of four sample chats and four questions for `ogyamwilson`. The normal web member experience is disabled by app settings, so iPhone/iPad verification remains pending. Do not submit a review reply claiming device verification until it passes.

App Store Connect App Information was inspected on 11 November: 18+ in 173 countries/regions, 19+ in Korea, and the legacy 17+ classification on operating systems earlier than version 26. No questionnaire answers were fabricated to obtain a rating.

## Changes

- All signed-in users must explicitly agree to versioned 18+ Terms/EULA and zero-tolerance community rules. Acceptance is saved server-side; direct posting requires acceptance. Signup and the database enforce a minimum of 18 even if settings specify less.
- Text filtering applies to direct writes of questions, messages, help requests, signal notes and profile text. This is a text filter, not an automatic image classifier. Human moderation remains necessary for image reports and filter evasion.
- Questions have **Remove from my feed**, report (also immediately hides the question), block and own-question delete actions. Existing profile/chat report and block actions remain available.
- Admin → Reports has a **Confirm violation: remove content & ban** action. Only staff can invoke it; it removes the offender's questions, help posts and messages, clears their bio/avatar, revokes radar visibility and bans the account. Reports are retained with an action timestamp.
- Safety & contact displays `niiabladefelix@gmail.com`. Felix must monitor this inbox and Admin reports daily, including weekends, and act on confirmed objectionable content/abusive users within 24 hours. Code cannot substitute for this operational responsibility.
- Radar defaults to hidden. **Check in** performs a one-shot position lookup and publishes a snapshot for at most 15 minutes. There is no automatic check-in, watch or renewal. **Stop sharing** and private scanning are free. Leaving Radar/backgrounding requests checkout; server expiry applies if connectivity is lost. Old clients cannot enable visibility with ordinary location writes.
- Terms, privacy disclosures and in-app help describe the updated behavior.

## Deploy to the existing server

Production remains on Azure Ubuntu host SKNRND, public IP `172.176.158.116`, SSH user `ablade`. The repository is `/srv/skanaround`; the self-hosted Supabase stack is `/srv/supabase`. Do not migrate services as part of this release.

Run from the existing phone SSH session:

```bash
cd /srv/skanaround && git fetch origin codex/review-demo-access && git show origin/codex/review-demo-access:deploy/wsl/deploy-review-safety.sh > /tmp/skanaround-review-deploy.sh && bash /tmp/skanaround-review-deploy.sh
```

The wrapper creates private recovery files under `~/skanaround-backups/`, including the current commit, working changes, environment files and a database dump. It then runs the normal deployment with the protected self-hosted backend configuration, migration ledger, build, restart and health checks. Stop on any failure; do not repeatedly deploy past an error. Never paste backups, environment values or private keys into chat or GitHub.

The migration turns off existing radar visibility. Every user must explicitly check in again. Do not roll back by restoring the old automatic-sharing code; preserve the new privacy guard. If a release fails, diagnose before database restoration, which would discard later writes.

## Required live verification

1. On iPhone and iPad, sign in with review username `ogyamwilson` using the password already stored in App Review Information. Verify the rules gate, links and explicit agreement.
2. Verify existing sample chats/questions. Refresh the scoped sample activity in Admin if expired; do not create sample activity for real users.
3. With two authorized test accounts, confirm hidden by default, manual Check in, Stop sharing, background/return, leaving Radar and expiry. Returning must not re-publish location. Denied GPS must leave chats and sample questions usable.
4. On disposable test content, exercise question hide, report, block, own delete and text rejection. Confirm the report reaches Admin. Staff enforcement must be tested only on a disposable account, never the reviewer or a real user.
5. Confirm Safety & contact, Terms/EULA and Privacy load on device and the email link is usable.
6. Review the existing submitted binary. Its Capacitor configuration loads the live site, so these web/database changes may be delivered without replacing the binary; verify build 19 actually displays them before deciding whether a new build is needed.
7. After verification, update App Review Information with exact navigation paths and reply to Apple. Credentials belong in the secure review form, not this public document. Do not submit a reply claiming untested functionality.

## Local checks

TypeScript and production build; existing 16 unit tests; PGlite database integration covering manual visibility, nonrenewal, expiry, revoke, access controls, EULA, filtering, immediate report hiding, moderation and age enforcement. The database harness uses minimal fixtures and PostGIS stubs; it does not replace a full live-stack/device check.

## Radar layout follow-up

After the first deployment, the owner confirmed that the rules gate, manual check-in and sample activity work in the iOS app. A subsequent iPhone screenshot showed the enlarged privacy notice crowding the fixed-height card region above Radar, clipping the chat preview. The follow-up replaces the long notice with a compact status and expandable privacy explanation, removes the duplicate pre-scan hint, and puts cards and the square radar in the app shell's single scroll area. Bottom navigation remains fixed. This layout follow-up needs deployment and a fresh iPhone visual check.
