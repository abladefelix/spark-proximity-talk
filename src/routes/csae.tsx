import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/LegalDocument";
import { DEFAULT_CSAE } from "@/lib/legal";
import { useSettings } from "@/hooks/useAppSettings";

export const Route = createFileRoute("/csae")({
  head: () => ({
    meta: [
      { title: "Child Safety Standards — SKANAROUND" },
      {
        name: "description",
        content:
          "SKANAROUND's published standards against child sexual abuse and exploitation (CSAE): 18+ only, prohibited conduct, reporting, and NCMEC escalation.",
      },
      { property: "og:title", content: "Child Safety Standards — SKANAROUND" },
      {
        property: "og:description",
        content:
          "Zero tolerance for CSAE: how SKANAROUND prevents, reports and acts on child safety violations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CsaePage,
});

function CsaePage() {
  const settings = useSettings();
  const email = settings.support_email?.trim();
  return (
    <LegalDocument
      markdown={settings.csae_text?.trim() ? settings.csae_text : DEFAULT_CSAE}
      {...(email ? { supportEmail: email } : {})}
    />
  );
}
