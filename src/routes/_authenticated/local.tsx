import { createFileRoute } from "@tanstack/react-router";

import { Brand } from "@/components/Brand";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { IntentChip } from "@/components/IntentSheet";
import { QuestionBroadcasts } from "@/components/QuestionBroadcasts";
import { ZonePerk } from "@/components/ZonePerk";
import { BatSignalButton, HelpBeaconList } from "@/components/BatSignal";

export const Route = createFileRoute("/_authenticated/local")({
  head: () => ({
    meta: [
      { title: "Local — SKANAROUND" },
      {
        name: "description",
        content:
          "Ask the people around you a question, send a Bat-Signal when you need help, and claim perks at the venue you're standing in.",
      },
      { property: "og:title", content: "Local on SKANAROUND" },
      {
        property: "og:description",
        content: "Anonymous local questions, urgent help signals and venue perks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalPage,
});

function LocalPage() {
  return (
    <main className="mx-auto w-full max-w-lg px-[var(--app-gutter)] pb-6 pt-3">
      <div className="flex items-center justify-between">
        <Brand />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      <h1 className="sr-only">Local</h1>

      <div className="mt-4 space-y-4">
        <IntentChip />
        <ZonePerk />
        <BatSignalButton />
        <HelpBeaconList />
        <QuestionBroadcasts />
      </div>
    </main>
  );
}
