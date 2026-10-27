# Review demo data

## Deployment status

Implemented in source; deployment and enabling on production must be verified separately. No database migration is required. Do not tell Apple the demo is available until it has been tested in the installed iOS build.

## Enable and disable

1. Deploy this web update using the existing production deployment process.
2. Open Admin → App → Review demo data.
3. Enter the exact username `ogyamwilson` and select **Enable demo data**.
4. Sign into that account in the iOS app. The authenticated screens show **Open review demo**. The direct route is `/review-demo`.
5. To disable later, enter the same username and select **Disable demo data**. The open demo checks current server permission every 15 seconds while online. It is hidden after the next successful check; a failed access check also hides it. Browser timers may pause in the background.

Pro access is separate: the current account was granted complimentary membership until November 26, 2026. Demo enable/disable does not alter subscription status, passwords, roles or real content.

## Content and isolation

The demo contains two fictional people, two pre-populated conversations and two questions. Users can send simulated messages, receive explicitly automated replies, signal sample people, block sample people, vote, post/delete their own questions and record simulated reports. It needs no GPS, nearby user or expiry refresh.

Interaction state is in memory only and resets on reload. It does not populate real messages, matches, reports or location tables, send notifications, or contact real users. Disabling hides the entire demo; there is no production data to delete. This is a supplementary demonstration, not proof that real chat delivery, purchases, push notifications or moderation delivery have been tested.

## Access control

Only an existing admin may set `review_demo_enabled` in the target user's protected Auth `app_metadata`. User-editable metadata cannot enable it. The server reads the current Auth user on every access check rather than relying on a cached JWT flag. The route is permitted through the browser download wall but still requires an authenticated, enabled account before it renders the interactive demo. Each account has separate query-cache keys.

The Supabase admin API merges the supplied app metadata keys. No credentials, demo state or personal content is stored in this flag. No schema/RLS changes are needed.

## Required live verification

- Enable for the review account, confirm the banner and seeded data in iOS 1.1.7 (19).
- Send a demo message, block a demo peer, vote, add/delete a question and try a sample report.
- Reload: original sample data returns.
- Disable from Admin while the demo is open: verify it closes on its next check, then re-enable for review.
- Verify an ordinary account has no demo entry and cannot enable it.
- Verify real sign-in, Pro access, purchase restoration and real reporting separately.

## Apple review notes (only after live verification)

Sign in with the credentials in App Review Information. Select **Open review demo** from the banner on the signed-in app screens. It provides clearly labelled fictional people, sample conversations and questions independent of geographic location. Demo replies and reports are simulated, and sample interactions reset when the page reloads. Use **Return to the app** to inspect the normal app and subscription features. The review account has complimentary Pro access until November 26, 2026.

Do not claim that a simulated report exercises the production moderation queue or that the demo guarantees App Review acceptance.

## Validation

Run `bun test tests/review-demo.test.ts tests/review-demo-access.test.ts`, `bun run build` and `tsc --noEmit`. Automated authorization tests stub external Auth/database services; a live enable/disable check is still required after deployment.
