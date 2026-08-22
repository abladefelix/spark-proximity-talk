/**
 * Store-required legal copy. Admins can override either document from the
 * admin console (`app_settings.terms_text` / `privacy_text`); these are the
 * defaults shipped with the app so the URLs are never empty when reviewers
 * open them.
 */

export const DEFAULT_TERMS = `# Terms of Service & End User Licence Agreement

_Last updated: 18 August 2026_

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

Subscriptions renew automatically for the same period unless you cancel at least 24 hours before the current period ends. Your account is charged for renewal within 24 hours before the period ends. You can manage or cancel your subscription in your App Store or Google Play account settings; deleting the app does not cancel it. Refunds are handled by Apple or Google under their own policies. Unused time in a current period is not refunded when you cancel.

## 11. Apple and Google
These terms are between you and us, not with Apple or Google. Apple and Google are not responsible for the app or for support, and they are third-party beneficiaries with the right to enforce these terms against you.

## 12. Changes
We may update these terms. Continued use after an update means you accept the new version.
`;

export const DEFAULT_PRIVACY = `# Privacy Policy

_Last updated: 18 August 2026_

This policy explains what SKANAROUND collects, why, and how to get rid of it.

## What we collect
- **Account data:** email address, username, display name, date of birth, and optional bio and gender.
- **Photos:** your profile picture, optional verification selfie, and any images you send in chat.
- **Location:** your device's coordinates while the radar screen is open, used to work out who is nearby. Other members only ever see an approximate distance — never your coordinates or address.
- **Usage data:** signals sent, matches, messages, blocks and reports, and the time you were last active.
- **Device data:** a push notification token if you enable notifications.

## Why we collect it
To show you people nearby, to deliver messages, to keep the community safe (moderation, reports, bans), and to notify you about signals and replies. We do not sell your data and we do not use it for advertising.

## Who can see what
- Other members see your username, display name, bio, photo, verified badge and approximate distance.
- Messages are visible to you and the person you are chatting with.
- Moderators can review reported profiles, reported content and verification selfies.

## How long we keep it
- Location: only your most recent position is stored, and it is deleted when it goes stale or when you delete your account.
- Signals: expire automatically (default 6 hours).
- Chats: purged automatically after the retention period set by the operator.
- Everything else: until you delete your account.

## Deleting your data
Open **Profile → Delete account**. This immediately and permanently removes your profile, photos, messages, matches, signals, blocks, reports and login. It cannot be undone.

## Permissions
Location, camera, photo library and notifications are all optional and requested only when you use the feature that needs them. You can revoke any of them in your device settings; the app keeps working with reduced functionality.

## Children
SKANAROUND is for adults aged 18 and over. We do not knowingly collect data from children.

## Security
Data is stored on managed infrastructure with encryption in transit, and access rules that limit each member to their own records.

## Contact
Questions or data requests: use the support email shown on your profile screen.
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
