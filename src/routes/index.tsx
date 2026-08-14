import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Brand } from "@/components/Brand";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkanAround — Chat with the people right around you" },
      {
        name: "description",
        content:
          "SkanAround shows you who is close by right now. Send a signal, and if they signal back your chat unlocks. No usernames to hunt for.",
      },
      { property: "og:title", content: "SkanAround — Chat with the people right around you" },
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





function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/radar" });
    });
  }, [navigate]);

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-6 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <Brand />
        <ThemeToggle />
      </div>


      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-8">
        <section
          aria-label="Radar showing people nearby as beacons"
          className="relative aspect-square w-full max-w-sm overflow-hidden rounded-full border border-border bg-secondary/20"
        >
          <div className="radar-grid absolute inset-0" />
          <div className="absolute inset-[16%] rounded-full border border-border/70" />
          <div className="absolute inset-[33%] rounded-full border border-border/50" />
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/40" />
          <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-border/40" />
          <div className="radar-sweep absolute inset-0 rounded-full" />
          <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
          <span className="pulse-ring absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />
        </section>


        <h1 className="sr-only">SkanAround — chat with the people right around you</h1>

        <Button asChild variant="heat" size="lg" className="w-full">
          <Link to="/auth">Start signalling</Link>
        </Button>
      </div>
    </main>
  );
}


