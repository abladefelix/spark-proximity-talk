# Review account sample activity

## Status — October 28, 2026

The owner confirmed the previous separate demo opens on iOS, then requested ordinary account activity instead. The new implementation removes the app-wide demo banner and replaces the Admin control with persistent sample provisioning. **This replacement still needs production deployment, population and an installed-iOS check.** PR: https://github.com/abladefelix/spark-proximity-talk/pull/11, branch `codex/review-demo-access`.

## Populate and remove

1. Deploy the branch with `bash deploy/wsl/deploy.sh codex/review-demo-access /srv/skanaround` after backing up local modifications. This version includes migration `20261028015428_populate_review_account.sql`; the deployment script applies it.
2. Sign in via `/auth?admin=1` using username or email, then navigate to `/admin`. The direct Admin login form accepts email only.
3. Admin → App → Review account activity → `ogyamwilson` → **Populate / refresh samples**.
4. Verify the success message reports four chats and four questions. In iOS, open normal **Chats** and **Local → Ask the area**. There is no separate demo banner or navigation required.
5. **Remove sample activity** deletes the sample matches (including new messages sent in those conversations), signals, questions and their votes. Confirmation is required in the UI. Real-member conversations are preserved. Re-population restores the predefined samples, not deleted reviewer messages. Dedicated non-login sample profiles remain for reuse; moderation reports/audit records are retained.

## What is created

- Four explicitly fictional peer profiles: Alex, Sam, Jordan and Taylor (Sample).
- Four real match records, eight directional signals and 24 saved text messages.
- Four sample questions (one owned by the review account) and 12 initial votes from sample peers.
- No fake payments, verification events, emergency requests, real-person interactions or location records.

Messages, votes, blocking and reporting use the application's normal database paths. New messages persist across reloads. The sample identities cannot sign in and do not send automated replies. This is pre-populated test content, not a simulation screen or a claim of organic user activity.

The sample questions are visible only to their review owner, regardless of GPS; other users cannot access them by guessing an ID. They display “Sample question” in place of a fabricated distance and expire 30 days after population/refresh. Blocks remain respected. Ordinary questions retain their location and expiry rules.

Samples use normal chat-history retention; their match vanishing timer is set to zero, but global history cleanup can still remove old messages. Refresh before resubmission if review is delayed. Refresh restores missing predefined messages and updates their timestamps, extends question/signal expiry, and preserves reviewer-written messages and existing votes. It does not remove blocks. Pro membership is separate (previously granted through November 26, 2026).

## Access and recovery

Only administrators can invoke the provisioning server function. The SQL RPC is restricted to service_role. Each reserved sample username is checked against protected Auth metadata before reuse; an existing unmarked account causes an error and is never taken over. Sample Auth accounts use random discarded passwords, a sign-in ban, and reserved `.invalid` email addresses; no credentials are sent or committed. Partial Auth creation is safe to retry. The content transaction rolls back on failure; the separate simulator flag is disabled only after it succeeds.

No production credentials or ordinary user settings are changed. The new schema is additive. For an application rollback, remove sample activity first, then deploy the previous application commit while retaining the migration. Do not drop the column or restore the old question RPC while private samples exist: doing so would remove their isolation guard. Integrate PR #11 before a future main deployment.

## Validation

- `bun test tests/review-activity.test.ts tests/review-demo-access.test.ts tests/review-demo.test.ts`
- `tsc --noEmit` and `bun run build`
- `tests/database/review-activity.mjs` runs against a disposable PGlite PostgreSQL instance. Supply `PGLITE_MODULE` pointing to an installed `@electric-sql/pglite` module. It exercises population/refresh/removal/re-enabling, isolation, unauthorized RPC calls and writes, reports, votes, question-to-chat navigation, blocking, and real-content preservation. PostGIS is stubbed in this test; live geospatial behavior and production triggers still require verification.

Before replying to Apple, verify normal Chats and Local in installed iOS 1.1.7 (19): open each conversation, send/reload a message, vote, report/block one sample peer, and delete the owned sample question. Check that another ordinary account sees none of the sample questions. Refresh and unblock test peers if needed afterwards. Purchases, restoration and actual push delivery require separate checks.

## Apple reply draft — only after production/iOS verification

Hello App Review Team,

We have populated the review account with fictional sample conversations and questions within the normal app screens. Please sign in using the credentials in App Review Information. Open Chats to view the sample conversations and send messages, and open Local → Ask the area to view and answer the sample questions. One sample question belongs to the review account so deletion can be tested. Reporting and blocking use the normal app controls.

Sample profiles are labelled, and the pre-populated questions are scoped to this account so they remain available regardless of your location. The sample peers are not live users and do not automatically reply. The account also has complimentary Pro access through November 26, 2026.

Thank you.

Verify the stored password and membership dates before using this text. Do not claim all app features have passed testing or that Apple approval is guaranteed.
