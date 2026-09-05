import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifierClient } from "@/lib/sign-in";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/Brand";
import { AdminPage } from "./admin";

/**
 * Private staff entrance. Unlike /admin this page carries its own sign-in
 * form, so staff can reach the console in a browser while the public web app
 * stays behind the download wall.
 */
export const Route = createFileRoute("/console-9f42x7")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Staff console — SKANAROUND" },
      { name: "description", content: "Private staff sign-in for the SKANAROUND control panel." },
      { property: "og:title", content: "Staff console — SKANAROUND" },
      { property: "og:description", content: "Private staff sign-in for SKANAROUND." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConsoleRoute,
});

function ConsoleRoute() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => {
      document.body.removeAttribute("data-web-page");
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!signedIn) return <ConsoleSignIn />;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex justify-end px-4 pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await supabase.auth.signOut();
            toast.success("Signed out");
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
      <AdminPage />
    </div>
  );
}


function ConsoleSignIn() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signInWithIdentifierClient(identifier, password);
      toast.success("Signed in");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid login credentials");
    } finally {
      setBusy(false);
    }
  }


  return (
    <main data-scrollable className="flex min-h-dvh w-full items-center justify-center overflow-y-auto bg-background px-6 pb-[max(3rem,var(--safe-bottom))] pt-[max(3rem,var(--safe-top))]">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 text-center">
        <div className="flex justify-center">
          <BrandMark size={56} />
        </div>
        <h1 className="flex items-center justify-center gap-2 text-lg font-semibold text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Staff console
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign in with your admin username or email.
        </p>
        <Input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Username or email"
          autoComplete="username"
          autoCapitalize="none"
        />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
        />
        <Button type="submit" variant="heat" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
