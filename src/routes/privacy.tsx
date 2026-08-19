import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { DEFAULT_PRIVACY } from "@/lib/legal";
import { useSettings } from "@/hooks/useAppSettings";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SKANAROUND" },
      {
        name: "description",
        content:
          "What SKANAROUND collects, how location and photos are used, how long data is kept, and how to delete your account and data.",
      },
      { property: "og:title", content: "Privacy Policy — SKANAROUND" },
      {
        property: "og:description",
        content: "Location, photos, retention and deletion — how SKANAROUND handles your data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const settings = useSettings();
  const email = settings.support_email?.trim();
  return (
    <LegalDocument
      markdown={settings.privacy_text?.trim() ? settings.privacy_text : DEFAULT_PRIVACY}
      {...(email ? { supportEmail: email } : {})}
    />
  );
}
