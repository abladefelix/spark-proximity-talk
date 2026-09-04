import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bug, History, Sparkles, Wrench } from "lucide-react";

import { CHANGELOG, type ChangeKind } from "@/lib/changelog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/changelog")({
  head: () => ({
    meta: [
      { title: "Changelog — what's new in SKANAROUND" },
      {
        name: "description",
        content:
          "Every notable SKANAROUND update in one place: new features, improvements and fixes for the proximity radar, signals, chats, Pro and the admin console.",
      },
      { property: "og:title", content: "Changelog — what's new in SKANAROUND" },
      {
        property: "og:description",
        content:
          "Every notable SKANAROUND update in one place: new features, improvements and fixes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChangelogPage,
});

const KIND_META: Record<ChangeKind, { label: string; icon: typeof Sparkles; classes: string }> = {
  new: {
    label: "New",
    icon: Sparkles,
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  improved: {
    label: "Improved",
    icon: Wrench,
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  fixed: {
    label: "Fixed",
    icon: Bug,
    classes: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
};

function ChangelogPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <header className="mt-6 flex items-start gap-3">
        <span className="mt-0.5 rounded-xl border border-border/60 bg-card p-2.5 text-primary shadow-sm">
          <History className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Changelog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What's new, improved and fixed in SKANAROUND — newest first.
          </p>
        </div>
      </header>

      <div className="mt-8 space-y-8">
        {CHANGELOG.map((entry) => (
          <section
            key={entry.date + entry.title}
            className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{entry.title}</h2>
              <time className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {entry.date}
              </time>
            </div>
            <ul className="mt-4 space-y-3">
              {entry.changes.map((change, i) => {
                const meta = KIND_META[change.kind];
                const Icon = meta.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        meta.classes,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="text-foreground/90">{change.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        Looking for a specific page? See the <Link to="/treeview" className="underline underline-offset-2 hover:text-foreground">site map</Link>.
      </p>
    </div>
  );
}
