import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Loader2, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useBillingInfo,
  useMySubscription,
  formatAmount,
  MY_SUB_KEY,
  type BillingInfo,
} from "@/hooks/useBilling";
import { startCheckout, verifyCheckout } from "@/lib/paystack.functions";

function proFeatures(b: BillingInfo) {
  const items: string[] = ["Verification review by our team after payment"];
  if (b.pro_unlimited_signals) items.push("Unlimited signals every day");
  if (b.pro_extended_radius) items.push("Scan the full radar range");
  if (b.pro_unlimited_messages) items.push("Unlimited messages in every chat");
  if (b.pro_see_who_signaled) items.push("See everyone who signalled you");
  if (b.pro_priority_beacon) items.push("Priority beacon on nearby radars");
  if (b.pro_custom_beacon) items.push("Custom beacon look");
  return items;
}

/** Membership card shown in the profile: current plan or upgrade options. */
export function ProUpgradeCard() {
  const { data: billing } = useBillingInfo();
  const { data: sub } = useMySubscription();
  const queryClient = useQueryClient();
  const start = useServerFn(startCheckout);
  const verify = useServerFn(verifyCheckout);
  const [busy, setBusy] = useState<string | null>(null);
  const cancelled = useRef(false);

  // Coming back from Paystack: confirm the reference in the URL.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;
    (async () => {
      try {
        const res = await verify({ data: { reference } });
        if (res.status === "success") {
          toast.success("You're Pro now. Enjoy!");
          await queryClient.invalidateQueries({ queryKey: MY_SUB_KEY });
        } else {
          toast.message("Payment not confirmed yet.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not confirm the payment.");
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        window.history.replaceState({}, "", url.toString());
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!billing?.enabled) return null;

  const isPro = Boolean(sub?.isPro);
  const features = proFeatures(billing);

  async function buy(plan: "monthly" | "yearly") {
    setBusy(plan);
    cancelled.current = false;
    try {
      const res = await start({
        data: { plan, callbackUrl: `${window.location.origin}/profile` },
      });
      if (cancelled.current) return;
      window.location.href = res.authorizationUrl;
    } catch (e) {
      if (cancelled.current) return;
      toast.error(e instanceof Error ? e.message : "Could not start the payment.");
      setBusy(null);
    }
  }

  function cancelPayment() {
    cancelled.current = true;
    setBusy(null);
    toast.message("Payment cancelled");
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Crown className="size-4 text-primary" />
        {billing.pro_label}
      </p>

      {isPro ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            You're on {sub?.plan === "yearly" ? "the yearly plan" : "Pro"}
            {sub?.expiresAt
              ? ` — renews ${new Date(sub.expiresAt).toLocaleDateString()}`
              : ""}
            .
          </p>
          <ul className="mt-3 space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs">
                <Check className="size-3.5 shrink-0 text-primary" /> {f}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{billing.pro_pitch}</p>
          <ul className="mt-3 space-y-1.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs">
                <Check className="size-3.5 shrink-0 text-primary" /> {f}
              </li>
            ))}
          </ul>
          {billing.monthly_amount <= 0 && billing.yearly_amount <= 0 ? (
            <p className="mt-4 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              Pricing isn't set up yet. Please check back soon.
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {billing.monthly_amount > 0 ? (
              <Button
                className="flex-1"
                disabled={busy !== null}
                onClick={() => buy("monthly")}
              >
                {busy === "monthly" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {formatAmount(billing.monthly_amount, billing.currency)} / month
              </Button>
            ) : null}
            {billing.yearly_amount > 0 ? (
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy !== null}
                onClick={() => buy("yearly")}
              >
                {busy === "yearly" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {formatAmount(billing.yearly_amount, billing.currency)} / year
              </Button>
            ) : null}
          </div>
          {busy ? (
            <Button variant="ghost" className="mt-2 w-full" onClick={cancelPayment}>
              Cancel payment
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
