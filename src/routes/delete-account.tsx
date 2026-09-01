import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { useSettings } from "@/hooks/useAppSettings";

/**
 * Publicly reachable data-deletion page. Google Play requires a web URL that
 * explains how an account and its data are deleted, usable without installing
 * the app; Apple accepts the same page as the deletion policy link.
 */
export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your SKANAROUND account & data" },
      {
        name: "description",
        content:
          "How to permanently delete your SKANAROUND account, what data is erased, what is kept, and how to request deletion by email.",
      },
      { property: "og:title", content: "Delete your SKANAROUND account & data" },
      {
        property: "og:description",
        content:
          "Delete your SKANAROUND account in the app, or request deletion by email. Profile, photos, messages and location data are erased.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeleteAccountPage,
});

function body(email: string) {
  return `# Delete your account and data

_App: SKANAROUND (app.skanaround.mobile)_

## Delete from inside the app
1. Open SKANAROUND and sign in.
2. Go to **Profile**.
3. Scroll to the bottom and tap **Delete account**.
4. Type the confirmation and confirm.

Deletion is immediate and irreversible. You are signed out straight away.

## Request deletion by email
If you can no longer sign in, email **${email}** from the address on the account
with the subject "Delete my account". We verify ownership and delete the account
within 30 days, usually within 72 hours.

## What is deleted
- Your profile: username, display name, gender, date of birth, avatar and photos
- All chat messages, matches and signals you sent or received
- Your last known location and radar presence
- Notification tokens, device sessions and app preferences
- Blocks and reports you created

## What is kept, and for how long
- Moderation records of reports made **about** you, and ban records, are kept for
  up to 12 months so banned users cannot immediately return. These are stored
  without your profile details.
- Anonymous, aggregated usage counts that cannot identify you.
- Records we must keep by law, such as payment receipts held by Apple or Google.

## Subscriptions
Deleting the account does not cancel a store subscription. Cancel it in your
Apple App Store or Google Play account settings before deleting.

## Contact
Questions about deletion: **${email}**
`;
}

function DeleteAccountPage() {
  const settings = useSettings();
  const email = settings.support_email?.trim() || "support@skanaround.app";
  return <LegalDocument markdown={body(email)} supportEmail={email} />;
}
