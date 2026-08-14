import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import { useSettings } from "@/hooks/useAppSettings";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to SkanAround — Chat with people around you" },
      {
        name: "description",
        content:
          "Create your SkanAround account or sign in to see who is nearby, send a signal and start chatting.",
      },
      { property: "og:title", content: "Sign in to SkanAround" },
      {
        property: "og:description",
        content: "Join SkanAround and meet the people sharing your spot right now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  // A restored email session can land here when the native shell resumes.
  useEffect(() => {
    let active = true;
    const check = () => {
      supabase.auth.getSession().then(({ data }) => {
        if (active && data.session) navigate({ to: "/radar" });
      });
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/radar" });
    });
    window.addEventListener("focus", check);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", check);
    };
  }, [navigate]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for the reset link");
        return;
      }
      if (mode === "signup") {
        if (!settings.signups_enabled) {
          toast.error("New sign-ups are closed right now");
          return;
        }
        const clean = username.trim().toLowerCase().replace(/\s+/g, "_");
        if (clean.length < 3) {
          toast.error("Pick a username with at least 3 characters");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/radar`,
            data: { username: clean, display_name: username.trim() },
          },
        });
        if (error) throw error;
        // Send them to the sign-in form instead of assuming a session exists.
        await supabase.auth.signOut();
        setPassword("");
        setUsername("");
        setMode("signin");
        toast.success("Account created. Sign in to continue.");
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/radar" });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-md flex-col justify-center overflow-y-auto overscroll-none px-6 py-12">
      <Link
        to="/"
        className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground"
      >
        <Brand className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground" />
      </Link>
      <h1 className="mt-6 text-3xl leading-tight">
        {mode === "signup" ? "Join the block" : mode === "reset" ? "Reset password" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {mode === "reset"
          ? "Enter your email and we'll send you a link to set a new password."
          : settings.tagline}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {mode === "signup" && (
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="kofi_vibes"
              required
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {mode !== "reset" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        )}
        <Button type="submit" variant="heat" size="lg" className="w-full" disabled={busy}>
          {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </Button>
        {mode === "signin" && (
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode("reset")}
          >
            Forgot your password?
          </button>
        )}
      </form>

      {(settings.signups_enabled || mode === "signup") && (
        <button
          type="button"
          className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      )}
    </main>
  );
}
