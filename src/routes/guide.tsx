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
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { GUIDE_SECTIONS, type GuideSection } from "@/lib/guide";
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

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "User guide — how SKANAROUND works" },
      {
        name: "description",
        content:
          "Learn the radar, beacon colours, signals, matching, chats, Pro perks and safety tips so you can use SKANAROUND with confidence.",
      },
      { property: "og:title", content: "User guide — how SKANAROUND works" },
      {
        property: "og:description",
        content: "Radar, beacons, signals, chats, Pro and safety explained step by step.",
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

  // Opened both in-app and from a browser, so scroll like a normal page.
  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    return () => document.body.removeAttribute("data-web-page");
  }, []);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.map((section) => {
      const titleHit =
        section.title.toLowerCase().includes(q) || section.summary.toLowerCase().includes(q);
      const items = section.items.filter(
        (item) =>
          item.term.toLowerCase().includes(q) || item.body.toLowerCase().includes(q),
      );
      if (titleHit) return section;
      return items.length ? { ...section, items } : null;
    }).filter((s): s is GuideSection => s !== null);
  }, [query]);

  const defaultOpen = query.trim() ? sections.map((s) => s.id) : [];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight">How {appName} works</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything on the radar explained — what the colours mean, how signals turn into chats,
          and what to do when something looks off.
        </p>
      </header>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the guide — beacon, compass, Pro…"
          className="pl-9"
          aria-label="Search the user guide"
        />
      </div>

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
        <Accordion
          key={query.trim() ? "filtered" : "all"}
          type="multiple"
          defaultValue={defaultOpen}
          className="mt-6"
        >
          {sections.map((section) => {
            const Icon = ICONS[section.icon];
            return (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-left">
                  <span className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{section.title}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {section.summary}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <dl className="space-y-4 pl-11">
                    {section.items.map((item) => (
                      <div key={item.term}>
                        <dt className="text-sm font-medium">{item.term}</dt>
                        <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.body}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <div className="mt-10 rounded-2xl border border-border p-4 text-sm">
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
    </main>
  );
}
