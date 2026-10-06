import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, ShieldCheck, FileText, Trash2, BookOpen } from "lucide-react";

import { useSettings } from "@/hooks/useAppSettings";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "SKANAROUND Support" },
      {
        name: "description",
        content:
          "Get help with SKANAROUND, contact support, review community safety information, and access account and legal resources.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const settings = useSettings();
  const email = settings.support_email?.trim();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-10">
      <p className="text-xs font-semibold tracking-[0.28em] text-muted-foreground">SKANAROUND</p>
      <h1 className="mt-3 text-3xl font-semibold">Support & Community Safety</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Need help or want to report inappropriate activity? Use the options below. Safety reports
        are reviewed as quickly as possible and we aim to act on confirmed violations within
        24 hours.
      </p>

      <div className="mt-8 grid gap-3">
        {email ? (
          <a
            href={`mailto:${email}`}
            className="rounded-2xl border border-border p-4 hover:bg-accent"
          >
            <div className="flex items-center gap-2 font-semibold">
              <LifeBuoy className="size-4 text-primary" /> Contact support
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
          </a>
        ) : null}

        <Link to="/guide" className="rounded-2xl border border-border p-4 hover:bg-accent">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="size-4 text-primary" /> User guide
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Learn how radar, signals, chat, Pro features and safety controls work.
          </p>
        </Link>

        <Link to="/terms" className="rounded-2xl border border-border p-4 hover:bg-accent">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-primary" /> Community rules & Terms
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the 18+ requirement, zero-tolerance policy, reporting and moderation rules.
          </p>
        </Link>

        <Link to="/privacy" className="rounded-2xl border border-border p-4 hover:bg-accent">
          <div className="flex items-center gap-2 font-semibold">
            <FileText className="size-4 text-primary" /> Privacy Policy
          </div>
        </Link>

        <Link
          to="/delete-account"
          className="rounded-2xl border border-border p-4 hover:bg-accent"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Trash2 className="size-4 text-primary" /> Account & data deletion
          </div>
        </Link>
      </div>
    </main>
  );
}
