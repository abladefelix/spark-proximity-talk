# App Store & Play Store readiness

SKANAROUND already has blocking, reporting, moderation and bans. What's missing are the hard
requirements reviewers check on a location-based, user-generated-content social app. Both stores
reject on these specific points.

## 1. In-app account deletion (hard requirement — Apple 5.1.1(v), Google Data Deletion)
- New "Delete my account" section at the bottom of Profile, with a typed confirmation dialog.
- A server function verifies the caller, wipes their profile, messages, matches, signals, blocks,
  reports, uploaded avatars/verification photos, then deletes the auth user.
- Deletion is immediate and irreversible; the user is signed out and returned to the auth screen.

## 2. Terms of Service, Privacy Policy and EULA
- Public routes `/terms` and `/privacy`, written for a proximity chat app: what location data is
  collected, how long it's kept, photo/message storage, deletion rights, contact address.
- Links in Profile and on the sign-up screen.
- Apple requires an EULA for UGC apps; Terms will include Apple's zero-tolerance clause.

## 3. Age gate (17+ rating)
- Date-of-birth field at sign-up with an 18+ minimum; stored on the profile.
- Under-age sign-ups are refused with a clear message.

## 4. Objectionable-content controls (Apple 1.2 — all four are required together)
- Terms with a zero-tolerance clause for abusive content (covered above).
- Report content: keep the existing profile report, add a report action inside the chat.
- Block abusive users: already present; surfaced in chat too.
- Admin response mechanism: the existing Admin moderation queue satisfies this; add a visible
  24-hour response commitment in Terms.

## 5. Location & permission clarity
- A pre-permission explainer before the OS location prompt on first radar visit, saying why
  location is needed and that exact position is never shown to others.
- Profile toggle to go invisible / stop sharing location without deleting the account.

## 6. Support contact
- Support email surfaced in Profile and in the store-required legal pages, configurable from Admin.

## Technical notes
- New route files `src/routes/terms.tsx`, `src/routes/privacy.tsx` (public, browser-friendly).
- New `src/lib/account.functions.ts` with a `deleteMyAccount` server function using the admin
  client only after verifying the caller's own id.
- Migration: add `date_of_birth` to profiles plus `support_email` / `legal_contact` to app settings.
- Native: no Capacitor config changes needed; the store forms are filled from these pages.

Out of scope for this pass: store listing copy, screenshots, and privacy nutrition labels — those
are filled in App Store Connect / Play Console, not code.
