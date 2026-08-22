/**
 * Website-only membership checkout (Paystack).
 *
 * This never runs inside the iOS or Android build — the apps sell Pro through
 * Apple In-App Purchase and Google Play Billing only. The web flow exists so
 * members in markets like Ghana can pay with mobile money or a local card on
 * skanaround's own website, which the store rules allow as long as the apps
 * neither link to nor mention it.
 */
import { createHmac } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type WebPlan = "monthly" | "yearly";

export type WebCheckoutInfo = {
  enabled: boolean;
  currency: string;
  monthly: number;
  yearly: number;
};

export async function loadWebSettings() {
  const { data } = await (supabaseAdmin as any)
    .from("billing_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  return data ?? null;
}

export function webCheckoutInfo(settings: any): WebCheckoutInfo {
  return {
    enabled: Boolean(settings?.web_checkout_enabled && settings?.paystack_secret_key),
    currency: (settings?.web_currency as string) || "GHS",
    monthly: Number(settings?.web_monthly_amount ?? 0),
    yearly: Number(settings?.web_yearly_amount ?? 0),
  };
}

function amountFor(plan: WebPlan, settings: any) {
  const info = webCheckoutInfo(settings);
  return plan === "yearly" ? info.yearly : info.monthly;
}

async function paystack(path: string, secret: string, init?: RequestInit) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || "The payment service is not responding.");
  }
  return json?.data ?? null;
}

/** Starts a hosted checkout and returns the URL to send the member to. */
export async function startCheckout(opts: {
  userId: string;
  email: string;
  plan: WebPlan;
  callbackUrl: string;
}) {
  const settings = await loadWebSettings();
  const info = webCheckoutInfo(settings);
  if (!info.enabled) throw new Error("Website checkout is not available right now.");

  const amount = amountFor(opts.plan, settings);
  if (!amount) throw new Error("This plan has no price set yet.");

  const data = await paystack("/transaction/initialize", settings.paystack_secret_key, {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      amount,
      currency: info.currency,
      callback_url: opts.callbackUrl,
      metadata: { user_id: opts.userId, plan: opts.plan },
    }),
  });

  return { url: data?.authorization_url as string, reference: data?.reference as string };
}

/** Confirms a reference with Paystack and unlocks Pro when it succeeded. */
export async function verifyAndGrant(reference: string) {
  const settings = await loadWebSettings();
  if (!settings?.paystack_secret_key) throw new Error("Website checkout is not configured.");

  const data = await paystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    settings.paystack_secret_key,
  );
  if (data?.status !== "success") return { granted: false as const };

  return grantFromTransaction(data, settings);
}

/** Shared by the verify call and the webhook. */
export async function grantFromTransaction(tx: any, settings: any) {
  const userId: string | null = tx?.metadata?.user_id ?? null;
  const plan: WebPlan = tx?.metadata?.plan === "yearly" ? "yearly" : "monthly";
  const reference: string | null = tx?.reference ?? null;
  if (!userId || !reference) return { granted: false as const };

  const { data: existing } = await (supabaseAdmin as any)
    .from("payments")
    .select("reference")
    .eq("reference", reference)
    .maybeSingle();

  await (supabaseAdmin as any).from("payments").upsert(
    {
      user_id: userId,
      reference,
      plan,
      amount: Number(tx?.amount ?? 0),
      currency: tx?.currency ?? settings?.web_currency ?? "GHS",
      status: "success",
      raw: tx,
    },
    { onConflict: "reference" },
  );

  // Already applied — don't extend the membership twice on a webhook retry.
  if (existing) return { granted: true as const, plan };

  const { data: sub } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("expires_at, status")
    .eq("user_id", userId)
    .maybeSingle();

  const current =
    sub?.status === "active" && sub?.expires_at && new Date(sub.expires_at) > new Date()
      ? new Date(sub.expires_at)
      : new Date();
  const expires = new Date(current);
  expires.setDate(expires.getDate() + (plan === "yearly" ? 365 : 30));

  await (supabaseAdmin as any).from("subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      plan,
      source: "web",
      reference,
      expires_at: expires.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return { granted: true as const, plan };
}

/** Paystack signs every webhook with an HMAC of the raw body. */
export function verifyWebhookSignature(body: string, signature: string, secret: string) {
  const expected = createHmac("sha512", secret).update(body).digest("hex");
  return expected.length === signature.length && expected === signature;
}
