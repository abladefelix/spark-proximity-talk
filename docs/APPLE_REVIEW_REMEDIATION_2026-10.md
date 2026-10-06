# Apple App Review remediation — October 2026

This documents the remediation for the SKANAROUND 1.1.7 rejection under:

- Guideline 1.2 — User Generated Content
- Guideline 3.1.2 — Subscriptions

## App Store metadata

Use the following App Store description text:

SKANAROUND helps you discover people nearby, send a signal and start a conversation when the interest is mutual. Control your visibility, manage your profile and connect with people around you in real time.

SKANAROUND Pro is an optional auto-renewing subscription that unlocks additional features including unlimited signals, extended scan range, unlimited messages, priority visibility and other Pro features shown in the app.

Available subscription options:
- SKANAROUND Pro Monthly
- SKANAROUND Pro Yearly

Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew unless auto-renewal is turned off at least 24 hours before the end of the current subscription period. You can manage or cancel your subscription in your App Store account settings.

Terms of Use (EULA):
https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Privacy Policy:
https://skanaround.bytenetdigital.com/privacy

## Age rating

The app is for adults only. App Store Connect should be set to an 18+ override after accurately completing the content questionnaire.

## UGC changes

The local question feature now:
- shows the posting user's SKANAROUND username;
- keeps answers private, rather than presenting the post itself as anonymous;
- filters clearly objectionable text client-side and server-side;
- exposes Report directly on each question;
- exposes Block directly on each question;
- lets authors immediately delete their own question;
- records content-specific report metadata for moderation;
- lets staff remove reported local questions from the admin report queue;
- states the Community Rules before posting;
- maintains the 24-hour moderation commitment.

The existing app already provides:
- mandatory Terms/Privacy acceptance at signup;
- an 18+ date-of-birth gate;
- report/block actions in chat and profiles;
- zero-tolerance language in the Terms;
- in-app support contact information;
- subscription restore, price/period, renewal information, Terms and Privacy links.

## App Review Notes

Suggested notes:

Guideline 1.2 — User Generated Content

We have updated SKANAROUND's local user-generated content feature to strengthen moderation and accountability.

The app is restricted to users aged 18 and over. Date of birth is required during registration and users younger than the minimum age cannot create an account.

Users must explicitly accept the Terms of Service and Privacy Policy before account creation. The Terms include a zero-tolerance policy for objectionable content and abusive behaviour.

The local question feature now provides:
- pseudonymous authorship using the user's SKANAROUND username
- automated objectionable-content filtering before publication
- a Report action directly on user-generated questions
- a Block action directly on user-generated questions
- immediate deletion of a user's own question
- moderation tools for reported content
- reports reviewed within 24 hours
- support/contact information inside the app

Report and Block are also available inside chats and user profiles.

Reviewer navigation:
1. Sign in with the supplied review account.
2. Open the Local tab.
3. View the Ask the area section.
4. Open the menu on another user's question to see Report and Block.
5. Post a question from the review account to see Delete my question.
6. Profile > Legal & support contains Terms, Privacy Policy, Child Safety Standards and Contact Support.

Guideline 3.1.2 — Subscriptions

The App Store description contains a functional Apple Terms of Use (EULA) link and Privacy Policy link. The Pro purchase screen displays subscription pricing, billing periods, auto-renewal information, Restore Purchases, Terms of Use and Privacy Policy.

## Reply to App Review

Hello App Review Team,

Thank you for the review and guidance.

We have addressed the Guideline 1.2 and Guideline 3.1.2 issues.

For Guideline 1.2, SKANAROUND is restricted to users aged 18 and over, and users must explicitly accept our Terms of Service before creating an account. Our Terms contain a zero-tolerance policy for objectionable content and abusive behaviour.

We strengthened the user-generated content safeguards by providing objectionable-content filtering, reporting and blocking directly from user-generated content, immediate deletion of a user's own post, moderator review and removal tools, and in-app support/contact information. Reports are reviewed within 24 hours.

For Guideline 3.1.2, we added the functional Apple Terms of Use (EULA) link and Privacy Policy URL to the App Store description. The subscription purchase screen also displays pricing, billing periods, auto-renewal information, Restore Purchases, Terms and Privacy Policy.

Detailed reviewer navigation instructions are included in App Review Notes.

Thank you.
