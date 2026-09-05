import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";

export const Route = createFileRoute("/verified")({
  head: () => ({
    meta: [
      { title: "Account activated — SKANAROUND" },
      {
        name: "description",
        content: "Your SKANAROUND email is confirmed. Open the app and sign in to start scanning.",
      },
      { property: "og:title", content: "Account activated — SKANAROUND" },
      {
        property: "og:description",
        content: "Your SKANAROUND email is confirmed. Open the app and sign in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifiedPage,
});

function VerifiedPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Supabase puts an error in the URL hash when the link is expired/used.
    const hash = window.location.hash.replace(/^#/, "");
    if (/error|expired/i.test(hash)) setFailed(true);
    // Never keep a browser session around — the app is where you sign in.
    supabase.auth.signOut().catch(() => {});
  }, []);

  return (
    <main data-scrollable className="flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-background px-6 pb-[max(3rem,var(--safe-bottom))] pt-[max(3rem,var(--safe-top))]">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card/60 p-8 text-center shadow-sm backdrop-blur">
        <div className="flex justify-center">
          <BrandMark size={56} />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.32em] text-muted-foreground">
          SKANAROUND
        </p>

        {failed ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold text-foreground">Link expired</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This activation link is no longer valid. Open the app and sign up again, or use
              &ldquo;Forgot your password?&rdquo; to get a fresh link.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mt-6 flex size-14 items-center justify-center rounded-full bg-primary/15">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7 text-primary"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-semibold text-foreground">Account activated</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your email is confirmed. Head back to the SKANAROUND app and sign in to start seeing
              who&rsquo;s around you.
            </p>
            <p className="mt-6 rounded-2xl bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              You can close this tab now.
            </p>
          </>
        )}

        <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground/70">
          SKANAROUND &middot; Proximity chat, done right.
        </p>
      </div>
    </main>
  );
}
