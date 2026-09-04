/**
 * Store-required legal copy. Admins can override either document from the
 * admin console (`app_settings.terms_text` / `privacy_text`); these are the
 * defaults shipped with the app so the URLs are never empty when reviewers
 * open them.
 */

export const DEFAULT_TERMS = `# Terms of Service & End User Licence Agreement

_Last updated: 4 September 2026_

By creating an account you agree to these terms. If you do not agree, do not use SKANAROUND.

## 1. Who can use SKANAROUND
You must be at least 18 years old. Accounts belonging to anyone under 18 are removed on discovery.

## 2. Licence
We grant you a personal, non-transferable, revocable licence to use SKANAROUND on devices you own or control, for personal, non-commercial use, subject to these terms and the app store rules that apply to your device.

## 3. Zero tolerance for objectionable content and abusive behaviour
There is no tolerance for objectionable content or abusive users. You must not post, send or share:

- harassment, threats, hate speech or bullying;
- sexual content involving minors, or any sexually explicit imagery sent without consent;
- nudity, violence or gore;
- impersonation, scams, spam or solicitation;
- content that is illegal where you or the recipient are located.

Accounts that breach this section are suspended or permanently banned, and content is removed.

## 4. Reporting and moderation
Every profile and chat has a Report and a Block action. Reports reach our moderation queue immediately. We aim to review every report and remove offending content and ejectors of abusive users **within 24 hours**. Blocking is instant and hides both people from each other on the radar and in chat.

## 5. Your content
You keep ownership of the photos and messages you post. You grant us the licence needed to store and display them to the people you chat with. You are responsible for what you send.

## 6. Location
SKANAROUND shows approximate distance to other members near you. Your exact coordinates are never shown to another member. You can go invisible at any time from the radar screen, and you can revoke location permission in your device settings.

## 7. Meeting people
SKANAROUND is a discovery app. We do not run background checks. Meet in public places, tell someone where you are going, and use your judgement. You interact with other members at your own risk.

## 8. Account termination
You can delete your account at any time from Profile → Delete account. Deletion is immediate and permanent. We may suspend or terminate accounts that breach these terms.

## 9. Disclaimer and liability
SKANAROUND is provided "as is", without warranties of any kind. To the fullest extent permitted by law we are not liable for indirect or consequential loss arising from your use of the app.

## 10. Pro membership and auto-renewing subscriptions
Pro is an optional paid membership sold only as an in-app purchase through the Apple App Store or Google Play. The price and billing period are shown in the app before you confirm, and payment is charged to your App Store or Google Play account at confirmation.

Pro currently includes:

- unlimited signals each day;
- the full scan range the operator allows;
- unlimited messages in a chat;
- seeing the name and photo of everyone who signals you;
- a priority beacon that stands out on nearby radars;
- a custom beacon look;
- longer chat history before conversations are purged;
- invisible mode, letting you scan without showing your own beacon.

The operator may add, change or withdraw individual Pro features; the list shown in the app at the time of purchase is the current one. Free accounts keep working with daily signal, range and message limits.

Subscriptions renew automatically for the same period unless you cancel at least 24 hours before the current period ends. Your account is charged for renewal within 24 hours before the period ends. You can manage or cancel your subscription in your App Store or Google Play account settings; deleting the app does not cancel it. Refunds are handled by Apple or Google under their own policies. Unused time in a current period is not refunded when you cancel.

## 11. Apple and Google
These terms are between you and us, not with Apple or Google. Apple and Google are not responsible for the app or for support, and they are third-party beneficiaries with the right to enforce these terms against you.

## 12. Activity records
We keep an internal record of account and safety events — sign-ups, profile changes, sign-ins, signals, matches, blocks, reports, moderation decisions, suspensions, appeals and membership changes — so we can investigate abuse and settle disputes. The content of your private messages is not part of that record.

## 13. Changes
We may update these terms. Continued use after an update means you accept the new version.
`;

export const DEFAULT_PRIVACY = `# Privacy Policy

_Last updated: 4 September 2026_

This policy explains what SKANAROUND collects, why, and how to get rid of it.

## What we collect
- **Account data:** email address, username, display name, date of birth, and optional bio and gender.
- **Photos:** your profile picture, optional verification selfie, and any images you send in chat.
- **Location:** your device's coordinates while the radar screen is open, used to work out who is nearby. Other members only ever see an approximate distance — never your coordinates or address.
- **Usage data:** signals sent, matches, messages, blocks and reports, and the time you were last active.
- **Membership data:** your subscription status and payment references when you buy Pro. Card details never reach us — Apple, Google or the payment processor handle them.
- **Device data:** a push notification token if you enable notifications, and the devices signed into your account.
- **Activity records:** a log of account and safety events (sign-up, profile edits, sign-ins, signals, matches, blocks, reports, moderation decisions, suspensions, appeals, membership and payment status). Message text is never stored in this log — only that a message was sent.

## Why we collect it
To show you people nearby, to deliver messages, to keep the community safe (moderation, reports, bans), to run Pro memberships, and to notify you about signals and replies. We do not sell your data and we do not use it for advertising, and the app shows no ads.

## Who can see what
- Other members see your username, display name, bio, photo, verified badge and approximate distance.
- Messages are visible to you and the person you are chatting with.
- Moderators can review reported profiles, reported content, verification selfies and the activity records described above.

## How long we keep it
- Location: only your most recent position is stored, and it is deleted when it goes stale or when you delete your account.
- Signals: expire automatically (default 6 hours).
- Chats: purged automatically after the retention period set by the operator.
- Chat history is longer for Pro members when the operator enables that feature.
- Activity records: kept while they are useful for safety and disputes, and cleared by the operator on a schedule (older entries are purged).
- Everything else: until you delete your account.

## Deleting your data
Open **Profile → Delete account**. This immediately and permanently removes your profile, photos, messages, matches, signals, blocks, reports and login. It cannot be undone.

## Permissions
Location, camera, photo library and notifications are all optional and requested only when you use the feature that needs them. You can revoke any of them in your device settings; the app keeps working with reduced functionality.

## Children
SKANAROUND is for adults aged 18 and over. We do not knowingly collect data from children.

## Security
Data is stored on managed infrastructure with encryption in transit, and access rules that limit each member to their own records.

## Your rights
You can access, correct or delete your data from inside the app: edit your profile, change your email, or use Profile → Delete account. Where local law gives you further rights (such as objection or portability), contact us at the support email and we will respond.

## Contact
Questions or data requests: use the support email shown on your profile screen.
`;

/**
 * Child safety standards, published publicly so app stores can link to them
 * (Google Play CSAE policy / Apple child safety requirements).
 */
export const DEFAULT_CSAE = `# Child Safety Standards

_Last updated: 2 September 2026_

SKANAROUND has zero tolerance for child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM). This page is our published standard against CSAE.

## 1. Adults only
SKANAROUND is an 18+ service. Sign-up requires a date of birth and anyone under 18 is refused. Accounts later found to belong to a minor are terminated and their data removed.

## 2. Prohibited conduct
The following are strictly forbidden and result in immediate, permanent removal:

- child sexual abuse material (CSAM) of any kind, real, drawn or AI-generated;
- sexualisation of a minor in text, images, usernames or profile content;
- grooming, solicitation, or attempting to arrange contact with a minor;
- sextortion, trafficking, or sharing links to CSAE material;
- impersonating a minor, or seeking minors on the service.

## 3. Reporting
Any user can report a profile or a chat from the report action in the profile dialog and in the chat safety menu. Child-safety reports are prioritised above all other reports.

Reports can also be sent directly to our child safety point of contact at the support email published on the profile screen, with "CSAE" in the subject line.

## 4. What we do with a report
- Child-safety reports are triaged as soon as they arrive and reviewed within 24 hours.
- Offending content is removed and the account is permanently banned and blocked from re-registration.
- Confirmed CSAM is reported to the National Center for Missing & Exploited Children (NCMEC) and, where required, to local law enforcement.
- Related evidence is preserved as required by law.

## 5. Prevention
- 18+ age gate at sign-up; gender and date of birth cannot be silently changed.
- No public browsing: another member is only visible when nearby, and chat only opens after both people accept.
- Block and report are available everywhere a person appears.
- Exact coordinates are never shared with other members.

## 6. Compliance
We comply with applicable child protection laws in the jurisdictions where the app is distributed, including US 18 U.S.C. §2258A reporting obligations, and with the Google Play CSAE policy and the Apple App Store child safety requirements.

## 7. Contact
Child safety point of contact: the support email shown on your profile screen and in the app store listing. Mark the message "CSAE" for priority handling.
`;


/** Minimal markdown → sections renderer input (headings, list items, text). */
export type LegalBlock =
  | { kind: "h1" | "h2" | "p" | "em"; text: string }
  | { kind: "ul"; items: string[] };

export function parseLegal(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push({ kind: "ul", items: list });
      list = [];
    }
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (line.startsWith("## ")) blocks.push({ kind: "h2", text: line.slice(3) });
    else if (line.startsWith("# ")) blocks.push({ kind: "h1", text: line.slice(2) });
    else if (line.startsWith("_") && line.endsWith("_"))
      blocks.push({ kind: "em", text: line.slice(1, -1) });
    else blocks.push({ kind: "p", text: line });
  }
  flush();
  return blocks;
}

/** Strips the bold/emphasis markers we use sparingly in the copy. */
export function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1");
}
