/**
 * Server-side entitlement handling for Apple / Google subscriptions sold
 * through RevenueCat. Both the webhook and the client-triggered refresh land
 * here, so the database is the single source of truth for Pro access.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type EntitlementState = {
  isActive: boolean;
  plan: string;
  expiresAt: string | null;
  productId: string | null;
  store: string | null;
};

export async function loadBillingSettings() {
  const { data } = await (supabaseAdmin as any)
    .from("billing_settings")
    .select("*")
    .eq("id", "global")
    .maybeSingle();
  return data ?? null;
}

function planFor(productId: string | null, settings: any): string {
  if (!productId) return "pro";
  if (settings?.rc_yearly_product_id && productId === settings.rc_yearly_product_id) {
    return "yearly";
  }
  if (settings?.rc_monthly_product_id && productId === settings.rc_monthly_product_id) {
    return "monthly";
  }
  return /year|annual/i.test(productId) ? "yearly" : "monthly";
}

/** Reads the member's entitlement straight from RevenueCat's REST API. */
export async function fetchEntitlement(
  userId: string,
  settings: any,
): Promise<EntitlementState> {
  const secret = settings?.rc_secret_api_key as string | null;
  const entitlementId = (settings?.rc_entitlement_id as string) || "pro";
  if (!secret) throw new Error("Store billing is not configured yet.");

  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  if (!res.ok) throw new Error("Could not reach the store right now.");
  const json: any = await res.json().catch(() => null);
  const ent = json?.subscriber?.entitlements?.[entitlementId];
  const expiresAt: string | null = ent?.expires_date ?? null;
  const productId: string | null = ent?.product_identifier ?? null;
  const isActive = Boolean(ent) && (!expiresAt || new Date(expiresAt) > new Date());
  const store = productId
    ? (json?.subscriber?.subscriptions?.[productId]?.store ?? null)
    : null;

  return { isActive, plan: planFor(productId, settings), expiresAt, productId, store };
}

/** Writes the entitlement into `subscriptions` for the app to gate on. */
export async function applyEntitlement(userId: string, state: EntitlementState) {
  await (supabaseAdmin as any).from("subscriptions").upsert(
    {
      user_id: userId,
      status: state.isActive ? "active" : "expired",
      plan: state.isActive ? state.plan : "free",
      source: state.store ?? "store",
      reference: state.productId,
      expires_at: state.expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (state.isActive) await queueVerification(userId);
  return state;
}

/** Paid members join the verification queue so an admin can badge them. */
async function queueVerification(userId: string) {
  const { data: profile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("verified")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.verified) return;

  const { data: existing } = await (supabaseAdmin as any)
    .from("verification_requests")
    .select("id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    await (supabaseAdmin as any).from("verification_requests").insert({
      user_id: userId,
      selfie_path: null,
      status: "pending",
      source: "pro",
    });
  } else if (existing.status !== "pending") {
    await (supabaseAdmin as any)
      .from("verification_requests")
      .update({ status: "pending", source: "pro", reviewed_at: null })
      .eq("id", existing.id);
  }
}

/** Records a store transaction for the admin revenue view. */
export async function recordStorePayment(event: any, settings: any) {
  const reference =
    event?.transaction_id ?? event?.original_transaction_id ?? event?.id ?? null;
  if (!reference) return;

  const amountMinor = Math.round(Number(event?.price_in_purchased_currency ?? 0) * 100);
  await (supabaseAdmin as any).from("payments").upsert(
    {
      user_id: event?.app_user_id ?? null,
      reference: String(reference),
      plan: planFor(event?.product_id ?? null, settings),
      amount: amountMinor,
      currency: event?.currency ?? settings?.currency ?? "USD",
      status: "success",
      raw: event,
    },
    { onConflict: "reference" },
  );
}
