import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset your SkanAround password" },
      {
        name: "description",
        content: "Choose a new password for your SkanAround account and get back on the radar.",
      },
      { property: "og:title", content: "Reset your SkanAround password" },
      {
        property: "og:description",
        content: "Set a new password and return to signalling people nearby.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate({ to: "/radar" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <Link to="/" className="flex items-center gap-2">
        <Brand className="flex items-center gap-2 text-sm font-semibold tracking-[0.28em] text-muted-foreground" />
      </Link>
      <h1 className="mt-6 text-3xl leading-tight">New password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {ready
          ? "Choose a new password for your account."
          : "Open this page from the reset link in your email."}
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <Button type="submit" variant="heat" size="lg" className="w-full" disabled={busy || !ready}>
          Update password
        </Button>
      </form>

      <Link
        to="/auth"
        className="mt-8 text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </main>
  );
}
