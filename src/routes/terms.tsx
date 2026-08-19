import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { DEFAULT_TERMS } from "@/lib/legal";
import { useSettings } from "@/hooks/useAppSettings";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SKANAROUND" },
      {
        name: "description",
        content:
          "The rules for using SKANAROUND: eligibility, the licence, zero tolerance for abusive content, reporting, and account deletion.",
      },
      { property: "og:title", content: "Terms of Service — SKANAROUND" },
      {
        property: "og:description",
        content: "Eligibility, community rules, moderation and account deletion on SKANAROUND.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const settings = useSettings();
  const email = settings.support_email?.trim();
  return (
    <LegalDocument
      markdown={settings.terms_text?.trim() ? settings.terms_text : DEFAULT_TERMS}
      {...(email ? { supportEmail: email } : {})}
    />
  );
}
