import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  BadgeCheck,
  Compass,
  Crown,
  HelpCircle,
  MessagesSquare,
  Radar,
  Radio,
  Search,
  ShieldCheck,
  Signal,
  UserRound,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { GUIDE_SECTIONS, type GuideSection } from "@/lib/guide";
import { cn } from "@/lib/utils";
import { GuideLegend } from "@/components/guide/GuideLegend";
import radarShot from "@/assets/guide/radar_people.png.asset.json";
import beaconShot from "@/assets/guide/profile_dialog.png.asset.json";
import chatShot from "@/assets/guide/chat.png.asset.json";
import chatsShot from "@/assets/guide/chats.png.asset.json";
import profileShot from "@/assets/guide/profile.png.asset.json";
import { useSettings } from "@/hooks/useAppSettings";

const ICONS: Record<GuideSection["icon"], typeof Radar> = {
  radar: Radar,
  beacon: Radio,
  compass: Compass,
  signal: Signal,
  chat: MessagesSquare,
  profile: UserRound,
  verified: BadgeCheck,
  pro: Crown,
  safety: ShieldCheck,
  bell: Bell,
  help: HelpCircle,
};

const SHOTS: Record<NonNullable<GuideSection["shot"]>, { src: string; alt: string }> = {
  radar: { src: radarShot.url, alt: "The radar screen with nearby people shown as beacons" },
  beacon: { src: beaconShot.url, alt: "A beacon tapped open, showing the person's profile card" },
  chat: { src: chatShot.url, alt: "A one-to-one match chat with messages and the input bar" },
  chats: { src: chatsShot.url, alt: "The list of your active match chats" },
  profile: { src: profileShot.url, alt: "Your own profile screen with photo, name and bio" },
};

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "User guide — how SKANAROUND works" },
      {
        name: "description",
        content:
          "Learn the radar, beacon colours, male and female avatar symbols, signals, matching, chats, Pro perks and safety tips so you can use SKANAROUND with confidence.",
      },
      { property: "og:title", content: "User guide — how SKANAROUND works" },
      {
        property: "og:description",
        content: "Radar, beacons, avatar symbols, signals, chats, Pro and safety explained step by step.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuidePage,
});

function GuidePage() {
  const settings = useSettings();
  const appName = settings.app_name?.trim() || "SKANAROUND";
  const supportEmail = settings.support_email?.trim();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Opened both in-app and from a browser, so scroll like a normal page.
  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    return () => document.body.removeAttribute("data-web-page");
  }, []);

  const sections = useMemo(() => {
    let base = GUIDE_SECTIONS;
    if (selectedId) base = base.filter((section) => section.id === selectedId);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base
      .map((section) => {
        const titleHit =
          section.title.toLowerCase().includes(q) || section.summary.toLowerCase().includes(q);
        const items = section.items.filter(
          (item) => item.term.toLowerCase().includes(q) || item.body.toLowerCase().includes(q),
        );
        if (titleHit) return section;
        return items.length ? { ...section, items } : null;
      })
      .filter((s): s is GuideSection => s !== null);
  }, [query, selectedId]);

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <span className="hidden truncate text-sm font-semibold sm:inline">{appName} guide</span>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or filter…"
              className="h-9 truncate pl-9 pr-8"
              aria-label="Search the user guide"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                selectedId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              All
            </button>
            {GUIDE_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  selectedId === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 pt-8">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {appName} documentation
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">How {appName} works</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every screen, symbol and colour in the app, explained end to end — including the male
            and female avatar symbols, beacon rings, badges and buttons, drawn here exactly as they
            appear on your radar.
          </p>
        </header>


      {sections.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Nothing matches “{query.trim()}”.{" "}
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              Ask support
            </a>
          ) : (
            "Try another word."
          )}
        </p>
      ) : (
        <div className="mt-8 gap-10 lg:flex lg:items-start">
          {/* Docs-style sidebar navigation */}
          <nav
            aria-label="Guide contents"
            className="mb-8 shrink-0 lg:sticky lg:top-20 lg:mb-0 lg:w-60"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On this page
            </p>
            <ul className="space-y-0.5 border-l border-border">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ml-px block border-l border-transparent py-1.5 pl-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <main className="min-w-0 flex-1 space-y-14">
            {sections.map((section) => {
              const Icon = ICONS[section.icon];
              return (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>
                    </div>
                  </div>

                  {section.legend ? (
                    <div className="mt-5">
                      <GuideLegend />
                    </div>
                  ) : null}

                  {section.shot ? (
                    <figure className="mt-5">
                      <img
                        src={SHOTS[section.shot].src}
                        alt={SHOTS[section.shot].alt}
                        loading="lazy"
                        className="w-full max-w-[260px] rounded-2xl border border-border shadow-sm"
                      />
                      {section.shotCaption ? (
                        <figcaption className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                          {section.shotCaption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}

                  <dl className="mt-5 space-y-4 border-l border-border pl-4">
                    {section.items.map((item) => (
                      <div key={item.term}>
                        <dt className="text-sm font-medium">{item.term}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.body}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </main>
        </div>
      )}

      <div className="mt-14 rounded-2xl border border-border p-4 text-sm">
        <p className="font-semibold">Still need a hand?</p>
        <p className="mt-1 text-muted-foreground">
          Read the{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">
            Privacy Policy
          </Link>
          {supportEmail ? (
            <>
              , or email{" "}
              <a
                href={`mailto:${supportEmail}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {supportEmail}
              </a>
            </>
          ) : null}
          .
        </p>
        </div>
      </div>
    </div>
  );
}
