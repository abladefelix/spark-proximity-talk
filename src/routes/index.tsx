import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Zap, MapPin, MessagesSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/shatta-hero.jpg";

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

const steps = [
  { icon: MapPin, title: "Go live", text: "Turn on your radar and see who's within a few metres." },
  { icon: Zap, title: "Signal", text: "Tap signal. Your name and photo drop on their screen." },
  { icon: MessagesSquare, title: "Link up", text: "They signal back, the chat opens. Simple." },
];

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/radar" });
    });
  }, [navigate]);

  return (
    <main className="mx-auto w-full max-w-lg px-6 pb-16 pt-14">
      <p className="text-sm font-semibold tracking-[0.28em] text-muted-foreground">SHATTA</p>

      <h1 className="mt-6 text-[2rem] font-semibold leading-[1.15]">
        The people around you are already interesting.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Same bar, same bus, same queue. SHATTA finds the strangers near you and lets one signal do
        the talking.
      </p>

      <div className="mt-8 flex gap-3">
        <Button asChild variant="heat" size="lg" className="flex-1">
          <Link to="/auth">Start signalling</Link>
        </Button>
      </div>

      <img
        src={heroImage}
        alt="Two strangers noticing each other across a warm, busy street at night"
        className="mt-12 aspect-[4/5] w-full rounded-2xl object-cover"
        loading="lazy"
      />

      <section className="mt-12 space-y-1">
        {steps.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4 border-t border-border py-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/70">
              <Icon className="size-4 text-primary" />
            </span>
            <div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="mt-12 text-center text-xs leading-relaxed text-muted-foreground">
        Your exact location is never shown to anyone — only rough distance, and only while you're
        visible.
      </p>
    </main>
  );
}
