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

## Location services recovery

When system Location Services are off, Capacitor's permission check throws before it can request app permission. Radar now recognizes disabled/denied/restricted location errors and shows an Enable location dialog, platform-specific instructions, and an iOS Open Settings link (`app-settings:`). The existing Capacitor iOS navigation delegate forwards external schemes to `UIApplication.open`; no new native plugin is introduced. This opens app settings, not the global Location Services panel. Users with the global switch off must navigate to Settings → Privacy & Security → Location Services. On return, a fresh manual Check in is required; there is no automatic check-in. Verify the Settings link and successful retry on the submitted iPhone build after deployment. Five focused error-classification tests cover system-off, permission denial, legacy messages, browser/Android behavior, and unrelated failures.

## Configurable duration follow-up

You → Check-in duration now offers 15 minutes (default), 30 minutes, 1 hour and 2 hours, free for all members. The preference is stored on the profile and validated in PostgreSQL. A preference change does not extend an existing check-in; the server reads it only on the next explicit Check in. Radar shows the actual server expiry time. Checkout/background behavior and the prohibition on automatic renewal remain unchanged. The former heartbeat-age cutoff was removed from nearby discovery because the finite consent lease is now authoritative; otherwise a longer check-in would disappear early.

Deploy migration `20261111190027_configurable_checkin_duration.sql` before the frontend. The normal deploy wrapper does this. Verify saving each duration, checking in, checking out and reopening the app. Existing 15-minute leases are unchanged. Because the earlier Apple reply described a fixed 15-minute expiry, clarify after deployment: “Check-ins default to 15 minutes. Members can explicitly choose 30 minutes, 1 hour or 2 hours in their profile for future manual check-ins. There is no automatic check-in or renewal.”

## Deployment guard correction

The first configurable-duration deployment stopped with “nearby_people still has stale matching rules” after migrations. The deploy validator still required the retired heartbeat grace-period clause. It now requires the active manual lease, snapshot coordinates and accuracy bounds, and rejects the old cutoff. `tests/deploy/check-nearby-guard.py` tests the actual SQL against current, legacy and incomplete definitions. Re-run the normal deploy wrapper after fetching this correction; the migration ledger skips already applied migrations, then the application build and restart can finish. Do not restore the old cutoff or bypass validation.
