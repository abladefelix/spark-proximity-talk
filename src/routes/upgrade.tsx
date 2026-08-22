import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/username-auth.functions";
import {
  confirmWebPayment,
  getWebCheckoutInfo,
  startWebCheckout,
} from "@/lib/web-billing.functions";

/**
 * Website-only membership page. The mobile apps sell Pro through Apple and
 * Google exclusively and must never link here, so this route is deliberately
 * not reachable from any in-app navigation.
 */
export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade to skanAround Pro" },
      {
        name: "description",
        content:
          "Upgrade your skanAround account to Pro and pay with mobile money or a local card.",
      },
      { property: "og:title", content: "Upgrade to skanAround Pro" },
      {
        property: "og:description",
        content: "Pay for skanAround Pro with mobile money or a local card.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UpgradePage,
});

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(
      minor / 100,
    );
  } catch {
    return `${currency} ${(minor / 100).toFixed(2)}`;
  }
}

function UpgradePage() {
  const [session, setSession] = useState<unknown>(null);
  const [ready, setReady] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.setAttribute("data-web-page", "");
    return () => document.body.removeAttribute("data-web-page");
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { data: info } = useQuery({
    queryKey: ["web-checkout-info"],
    queryFn: () => getWebCheckoutInfo(),
  });

  // Paystack sends the member back with ?reference=...
  useEffect(() => {
    if (!session) return;
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference) return;
    confirmWebPayment({ data: { reference } })
      .then((res) => {
        if (res.granted) {
          setDone(true);
          toast.success("Pro is active. Open the app and you're set.");
        } else {
          toast.error("That payment did not go through.");
        }
        window.history.replaceState(null, "", window.location.pathname);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not confirm payment"));
  }, [session]);

  const signIn = useMutation({
    mutationFn: async () => {
      const tokens = await signInWithIdentifier({
        data: { identifier: identifier.trim(), password },
      });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw error;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sign in"),
  });

  const checkout = useMutation({
    mutationFn: async (plan: "monthly" | "yearly") => {
      const res = await startWebCheckout({
        data: { plan, callbackUrl: `${window.location.origin}/upgrade` },
      });
      if (!res?.url) throw new Error("Could not start the payment.");
      window.location.href = res.url;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start payment"),
  });

  if (Capacitor.isNativePlatform()) return null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 py-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Brand size="lg" />
        <h1 className="text-xl font-semibold">Go Pro</h1>
        <p className="text-sm text-muted-foreground">
          Pay with mobile money or a local card. Your membership unlocks the moment the
          payment clears — just open the app again.
        </p>
      </header>

      {!ready ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : !session ? (
        <form
          className="space-y-3 rounded-2xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            signIn.mutate();
          }}
        >
          <p className="text-sm font-medium">Sign in to your account</p>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-id" className="text-xs text-muted-foreground">
              Username or email
            </Label>
            <Input
              id="upgrade-id"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upgrade-pass" className="text-xs text-muted-foreground">
              Password
            </Label>
            <Input
              id="upgrade-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={signIn.isPending}>
            {signIn.isPending ? <Loader2 className="size-4 animate-spin" /> : "Continue"}
          </Button>
        </form>
      ) : done ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border p-6 text-center">
          <Check className="size-6 text-primary" />
          <p className="text-sm font-medium">You're Pro</p>
          <p className="text-xs text-muted-foreground">
            Open skanAround on your phone to use your new features.
          </p>
        </div>
      ) : !info?.enabled ? (
        <p className="rounded-2xl border border-border p-6 text-center text-sm text-muted-foreground">
          Website payments are closed at the moment. Please try again later.
        </p>
      ) : (
        <div className="space-y-3">
          {(
            [
              ["monthly", "Monthly", info.monthly],
              ["yearly", "Yearly", info.yearly],
            ] as const
          )
            .filter(([, , amount]) => amount > 0)
            .map(([plan, label, amount]) => (
              <button
                key={plan}
                type="button"
                disabled={checkout.isPending}
                onClick={() => checkout.mutate(plan)}
                className="flex w-full items-center justify-between rounded-2xl border border-border px-4 py-4 text-left transition-colors hover:border-primary disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Crown className="size-4 text-primary" />
                  {label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {money(amount, info.currency)}
                </span>
              </button>
            ))}
          <p className="text-center text-[11px] text-muted-foreground">
            Payments are handled by Paystack. You can cancel any time by letting the
            membership lapse.
          </p>
        </div>
      )}
    </main>
  );
}
