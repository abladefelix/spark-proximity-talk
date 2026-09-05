import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Brand, BrandMark } from "@/components/Brand";
import { withTimeoutFallback } from "@/lib/net";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SKANAROUND — Chat with the people right around you" },
      {
        name: "description",
        content:
          "SKANAROUND shows you who is close by right now. Send a signal, and if they signal back your chat unlocks. No usernames to hunt for.",
      },
      { property: "og:title", content: "SKANAROUND — Chat with the people right around you" },
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
  // Inside the installed app there is no "marketing" moment: go straight to the
  // radar when signed in, or to sign-in when not, behind a branded splash.
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [stuck, setStuck] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    // getSession() can hang forever on a stalled token refresh (weak signal at
    // launch). Bound it, and if it stalls, show a retry/continue escape hatch.
    const timer = window.setTimeout(() => {
      if (!cancelled) setStuck(true);
    }, 6000);
    withTimeoutFallback(supabase.auth.getSession(), null, 5000, "Session check")
      .then((result) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        if (result?.data.session) navigate({ to: "/radar" });
        else if (!result) setStuck(true);
        else navigate({ to: "/auth" });
      })
      .catch(() => {
        if (!cancelled) {
          window.clearTimeout(timer);
          setStuck(true);
        }
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [navigate, isNative, attempt]);

  useEffect(() => {
    // Web landing keeps its old behaviour: hop signed-in visitors to the radar.
    if (isNative) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/radar" });
    });
  }, [navigate, isNative]);

  const retry = useCallback(() => {
    setStuck(false);
    setAttempt((n) => n + 1);
  }, []);

  if (isNative) {
    return (
      <main className="flex h-full w-full flex-col items-center justify-center gap-4 px-6">
        <BrandMark size={72} />
        <p className="text-xs font-semibold tracking-[0.32em] text-muted-foreground">SKANAROUND</p>
        {stuck ? (
          <div className="mt-4 flex w-full max-w-xs flex-col items-center gap-3">
            <p className="text-center text-sm text-muted-foreground">
              It's taking longer than usual to check your sign-in.
            </p>
            <Button variant="heat" className="w-full" onClick={retry}>
              Try again
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Go to sign in</Link>
            </Button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-lg flex-col overflow-hidden px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
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


        <h1 className="sr-only">SKANAROUND — chat with the people right around you</h1>

        <Button asChild variant="heat" size="lg" className="w-full">
          <Link to="/auth">Start signalling</Link>
        </Button>
      </div>
    </main>
  );
}


