# Apple Review Resubmission — Guideline 1.2 and 3.1.2

This checklist documents the changes made after the SKANAROUND 1.1.7 App Review rejection.

## Guideline 1.2 — User Generated Content

Implemented:

- 18+ age gate already required at signup.
- Explicit Terms + Privacy acceptance already required at signup.
- Local questions are no longer anonymous: the author's SKANAROUND username is displayed.
- Local questions have a direct Report question action.
- Local questions have a direct Block user action.
- Authors can immediately Delete my question.
- Client-side objectionable-content checks are applied before posting.
- Server-side objectionable-content checks are enforced in the database RPC.
- Reported local questions include a content snapshot and content type in the moderation queue.
- Staff can remove the reported local question directly from the Reports tab.
- Terms explicitly state zero tolerance and a 24-hour moderation target.
- Public support/community-safety page is available at /support.

## Guideline 3.1.2 — Subscriptions

App Store Connect metadata must contain a functional Terms of Use link.

Recommended App Store description ending:

Terms of Use (EULA):
https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Privacy Policy:
https://skanaround.bytenetdigital.com/privacy

The in-app Pro purchase card already provides pricing, billing period, auto-renewal wording, Restore Purchases, Terms, and Privacy Policy.

## Age rating

In App Store Connect:

1. App Information → Age Rating.
2. Keep User-Generated Content = Yes.
3. Keep Social Media = Yes.
4. Keep Messaging and Chat = Yes.
5. Unrestricted Web Access = No unless arbitrary web browsing is later added.
6. On Step 7 choose Override to Higher Age Rating and select 18+.

## Suggested App Review notes

Guideline 1.2 – User Generated Content

We have updated SKANAROUND's local user-generated content feature to strengthen moderation and accountability.

SKANAROUND is restricted to users aged 18 and over. Date of birth is required during registration and users younger than the minimum age cannot create an account.

Users must explicitly accept the Terms of Service and Privacy Policy before account creation. The Terms include a zero-tolerance policy for objectionable content and abusive behaviour.

The local question feature now provides:
- identifiable/pseudonymous authorship using the user's SKANAROUND username
- automated objectionable-content filtering before publication
- a Report action directly on user-generated questions
- a Block action directly on user-generated questions
- immediate deletion of a user's own question
- moderator removal tools for reported local questions
- reports reviewed as quickly as possible with a target of action within 24 hours
- support/contact information inside the app and at the public support page

Report and Block are also available inside chats and user profiles.

Reviewer navigation:
1. Sign in with the provided review account.
2. Open the Local tab.
3. View the Ask the area section.
4. Open the menu on a user-generated question to see Report and Block.
5. Post a question from the review account to see Delete my question.
6. Profile → Legal & support contains Terms, Privacy Policy, Child Safety Standards and Contact Support.

Guideline 3.1.2 – Subscriptions

The App Store description contains a functional Apple Terms of Use (EULA) link and Privacy Policy URL. The Pro purchase screen also displays subscription pricing, billing periods, auto-renewal information, Restore Purchases, Terms and Privacy Policy.
