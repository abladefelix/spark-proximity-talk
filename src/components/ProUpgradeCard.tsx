import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Loader2, Check, RefreshCw, ExternalLink, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProFeatures, useProPackages } from "@/hooks/useProFeatures";
import {
  useBillingInfo,
  useMySubscription,
  MY_SUB_KEY,
} from "@/hooks/useBilling";
import { refreshEntitlement } from "@/lib/store-billing.functions";
import {
  initStore,
  setStoreOptions,
  isNativeStore,
  listPackages,
  purchase,
  restore,
  storeName,
  isUserCancelled,
  getStoreDiagnostics,
  recordStoreError,
  clearStoreDiagnostics,
  type StorePackage,
  type StoreDiagnostics,
} from "@/lib/revenuecat";

function featureList(
  catalog: { key: string; label: string; pro_only: boolean }[],
  keys: string[] | null,
) {
  const paid = catalog.filter((f) => f.pro_only);
  const chosen = keys ? paid.filter((f) => keys.includes(f.key)) : paid;
  return ["Verification review by our team after payment", ...chosen.map((f) => f.label)];
}

/**
 * Membership card. Subscriptions are sold only through Apple In-App Purchase
 * and Google Play Billing — never an external payment page — so the app meets
 * App Store guideline 3.1.1 and Google Play's Payments policy.
 */
export function ProUpgradeCard() {
  const {
    data: billing,
    isError: billingFailed,
    isFetching: billingLoading,
    refetch: refetchBilling,
  } = useBillingInfo();

  const { data: sub } = useMySubscription();
  const { data: catalog = [] } = useProFeatures();
  const { data: packageCatalog = [] } = useProPackages();
  const queryClient = useQueryClient();
  const sync = useServerFn(refreshEntitlement);

  const [packages, setPackages] = useState<StorePackage[]>([]);
  const [ready, setReady] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const [diag, setDiag] = useState<StoreDiagnostics | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const native = isNativeStore();

  useEffect(() => {
    if (!native || !billing?.enabled) return;
    let cancelled = false;
    setReady(false);
    setStoreError(null);
    setActionError(null);
    clearStoreDiagnostics();
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Sign in again to see the plans.");
        setStoreOptions({
          iosApiKey: billing.ios_api_key,
          androidApiKey: billing.android_api_key,
          userId: uid,
        });
        const ok = await initStore({
          iosApiKey: billing.ios_api_key,
          androidApiKey: billing.android_api_key,
          userId: uid,
        });
        if (cancelled) return;
        if (!ok) throw new Error("Store keys are missing. Please contact support.");
        const list = await listPackages(
          [billing.monthly_product_id, billing.yearly_product_id].filter(
            (id): id is string => Boolean(id),
          ),
        );
        if (cancelled) return;
        setPackages(list);
        setDiag(getStoreDiagnostics());
        setReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not reach the store.";
        const key =
          (typeof navigator !== "undefined" && billing?.android_api_key) ||
          billing?.ios_api_key ||
          null;
        recordStoreError(msg, Boolean(key), key ? key.slice(0, 5) : null);
        setDiag(getStoreDiagnostics());
        setStoreError(msg);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    native,
    billing?.enabled,
    billing?.ios_api_key,
    billing?.android_api_key,
    billing?.monthly_product_id,
    billing?.yearly_product_id,
    attempt,
  ]);

  const afterStoreChange = useCallback(
    async (managed: string | null) => {
      setManagementUrl(managed);
      try {
        await sync({});
      } catch {
        // Webhook will catch up if the direct sync fails.
      }
      await queryClient.invalidateQueries({ queryKey: MY_SUB_KEY });
    },
    [queryClient, sync],
  );

  if (!billing?.enabled) return null;

  const isPro = Boolean(sub?.isPro);
  const primary = packageCatalog[0] ?? null;
  const features = featureList(catalog, primary ? primary.features : null);
  const entitlement = billing.entitlement_id || "pro";

  // Shown when the store list could not be loaded, so members always see what
  // they can buy. Prices come from admin settings; the store confirms at checkout.
  const money = (amount: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: billing.currency || "USD",
        maximumFractionDigits: 2,
      }).format(amount / 100);
    } catch {
      return `${billing.currency || "USD"} ${(amount / 100).toFixed(2)}`;
    }
  };
  const fallbackPlans = [
    billing.monthly_product_id && billing.monthly_amount > 0
      ? { productId: billing.monthly_product_id, label: `${money(billing.monthly_amount)} / month` }
      : null,
    billing.yearly_product_id && billing.yearly_amount > 0
      ? { productId: billing.yearly_product_id, label: `${money(billing.yearly_amount)} / year` }
      : null,
  ].filter((p): p is { productId: string; label: string } => p !== null);

  async function buy(pkg: StorePackage) {
    if (busy) return;
    setBusy(pkg.identifier);
    setActionError(null);
    try {
      const ent = await purchase(pkg, entitlement);
      await afterStoreChange(ent.managementUrl);
      toast.success("You're Pro now. Enjoy!");
    } catch (e) {
      if (isUserCancelled(e)) toast.message("Purchase cancelled");
      else {
        const message = e instanceof Error ? e.message : "The purchase didn't go through.";
        setActionError(message);
        toast.error(message);
      }
    } finally {
      setBusy(null);
    }
  }

  async function restorePurchases() {
    if (busy) return;
    setBusy("restore");
    setActionError(null);
    try {
      const ent = await restore(entitlement);
      await afterStoreChange(ent.managementUrl);
      toast[ent.isActive ? "success" : "message"](
        ent.isActive ? "Your membership is back." : "No previous purchase found.",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not restore purchases.";
      setActionError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-w-0 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Crown className="size-4 text-primary" />
        {billing.pro_label}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {isPro
          ? `You're on ${sub?.plan === "yearly" ? "the yearly plan" : "Pro"}${
              sub?.expiresAt
                ? ` — renews ${new Date(sub.expiresAt).toLocaleDateString()}`
                : ""
            }.`
          : billing.pro_pitch}
      </p>

      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs">
            <Check className="size-3.5 shrink-0 text-primary" /> {f}
          </li>
        ))}
      </ul>

      {!native ? (
        <p className="mt-4 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          Membership is managed in the SKANAROUND mobile app.
        </p>
      ) : isPro ? (
        <div className="mt-4 space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              window.open(
                managementUrl ??
                  (storeName() === "App Store"
                    ? "https://apps.apple.com/account/subscriptions"
                    : "https://play.google.com/store/account/subscriptions"),
                "_blank",
              )
            }
          >
            <ExternalLink className="mr-2 size-4" />
            Manage subscription in {storeName()}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Cancel or change your plan any time in your {storeName()} account.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {!ready ? (
            <p className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              Loading plans from {storeName()}…
            </p>
          ) : packages.length === 0 ? (
            <div className="space-y-2">
              <p className="flex items-start gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">
                {storeError ??
                  diag?.error ??
                  "No plans are available right now. Please check back soon."}
                </span>
              </p>

              {fallbackPlans.length > 0 ? (
                <p className="break-words text-center text-[11px] leading-relaxed text-muted-foreground">
                  Expected plans: {fallbackPlans.map((plan) => plan.label).join(" · ")}. Checkout becomes available when {storeName()} returns these plans.
                </p>
              ) : null}

              <Button
                variant="outline"
                className="w-full"
                disabled={busy !== null}
                onClick={() => {
                  setStoreError(null);
                  setActionError(null);
                  clearStoreDiagnostics();
                  setAttempt((n) => n + 1);
                }}
              >
                <RefreshCw className="mr-2 size-4" />
                Try again
              </Button>
              {diag?.requestedProductIds.length ? (
                <p className="break-all text-center text-[10px] text-muted-foreground">
                  Support detail: {diag.platform} · {diag.requestedProductIds.join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            packages.map((pkg, i) => (
              <Button
                key={pkg.identifier}
                variant={i === 0 ? "default" : "outline"}
                className="w-full"
                disabled={busy !== null}
                onClick={() => buy(pkg)}
              >
                {busy === pkg.identifier ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                {pkg.priceString}
                {pkg.period === "yearly"
                  ? " / year"
                  : pkg.period === "monthly"
                    ? " / month"
                    : ""}
              </Button>
            ))
          )}

          {actionError ? (
            <p className="break-words rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
              {actionError}
            </p>
          ) : null}

          <Button
            variant="ghost"
            className="w-full"
            disabled={busy !== null}
            onClick={restorePurchases}
          >
            {busy === "restore" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Restore purchases
          </Button>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Payment is charged to your {storeName()} account. Subscriptions renew
            automatically unless cancelled at least 24 hours before the period ends.
            Manage or cancel in your {storeName()} account settings.{" "}
            <Link to="/terms" className="underline">
              Terms
            </Link>{" "}
            ·{" "}
            <Link to="/privacy" className="underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
