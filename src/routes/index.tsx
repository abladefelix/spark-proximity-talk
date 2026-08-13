import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SHATTA — Chat with the people right around you" },
      {
        name: "description",
        content:
          "SHATTA shows you who is close by right now. Send a signal, and if they signal back your chat unlocks. No usernames to hunt for.",
      },
      { property: "og:title", content: "SHATTA — Chat with the people right around you" },
      {
        property: "og:description",
        content: "Proximity chat. Signal someone nearby, match, and link up.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const demoBeacons = [
  { label: "A", left: "68%", top: "34%" },
  { label: "K", left: "32%", top: "58%" },
  { label: "M", left: "58%", top: "72%" },
  { label: "J", left: "24%", top: "30%" },
];


function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/radar" });
    });
  }, [navigate]);

  return (
    <main className="mx-auto w-full max-w-lg px-6 pb-16 pt-10">
      <p className="text-center text-sm font-semibold tracking-[0.28em] text-muted-foreground">
        SHATTA
      </p>

      <section
        aria-label="Radar preview showing people nearby as beacons"
        className="relative mx-auto mt-8 aspect-square w-full max-w-sm overflow-hidden rounded-full border border-border bg-secondary/20"
      >
        <div className="radar-grid absolute inset-0" />
        <div className="absolute inset-[16%] rounded-full border border-border/70" />
        <div className="absolute inset-[33%] rounded-full border border-border/50" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/40" />
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/40" />
        <div className="radar-sweep absolute inset-0 rounded-full" />
        <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        <span className="pulse-ring absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />

        {demoBeacons.map((b) => (
          <span
            key={b.label}
            style={{ left: b.left, top: b.top }}
            className="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold"
          >
            {b.label}
          </span>
        ))}
      </section>

      <h1 className="mt-10 text-center text-[1.75rem] font-semibold leading-[1.2]">
        The people around you are already interesting.
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-muted-foreground">
        Everyone nearby shows up as a beacon. Tap one to signal — if they signal back, the chat
        opens.
      </p>

      <Button asChild variant="heat" size="lg" className="mt-8 w-full">
        <Link to="/auth">Start signalling</Link>
      </Button>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        Your exact location is never shown — only rough distance, and only while you're visible.
      </p>
    </main>
  );
}

