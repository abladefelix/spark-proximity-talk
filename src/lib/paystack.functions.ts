import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CheckoutPlan = "monthly" | "yearly";

export type CheckoutResult = {
  authorizationUrl: string;
  reference: string;
};

export type VerifyResult = {
  status: "success" | "pending" | "failed";
  plan: CheckoutPlan | null;
  expiresAt: string | null;
};

/** Starts a Paystack transaction for the signed-in member. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: CheckoutPlan; callbackUrl: string }) => {
    const plan = input.plan === "yearly" ? "yearly" : "monthly";
    const callbackUrl = String(input.callbackUrl ?? "").slice(0, 500);
    return { plan: plan as CheckoutPlan, callbackUrl };
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await (supabaseAdmin as any)
      .from("billing_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    if (!settings?.enabled) throw new Error("Payments are not enabled yet.");
    const secret = settings.paystack_secret_key as string | null;
    if (!secret) throw new Error("Payments are not configured yet.");

    const amount =
      data.plan === "yearly" ? Number(settings.yearly_amount) : Number(settings.monthly_amount);
    if (!amount || amount <= 0) throw new Error("This plan has no price set.");

    const { data: userRes } = await (supabaseAdmin as any).auth.admin.getUserById(context.userId);
    const email = userRes?.user?.email;
    if (!email) throw new Error("Your account has no email address.");

    const reference = `skan_${context.userId.slice(0, 8)}_${Date.now()}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount,
        currency: settings.currency ?? "GHS",
        reference,
        callback_url: data.callbackUrl || undefined,
        metadata: { user_id: context.userId, plan: data.plan },
      }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.status) {
      throw new Error(json?.message ?? "Could not start the payment.");
    }

    await (supabaseAdmin as any).from("payments").insert({
      user_id: context.userId,
      reference,
      plan: data.plan,
      amount,
      currency: settings.currency ?? "GHS",
      status: "pending",
    });

    return {
      authorizationUrl: json.data.authorization_url as string,
      reference,
    };
  });

/** Confirms a transaction with Paystack and activates Pro on success. */
export const verifyCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input.reference ?? "").slice(0, 120),
  }))
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activateFromTransaction } = await import("@/lib/paystack.server");

    const { data: settings } = await (supabaseAdmin as any)
      .from("billing_settings")
      .select("paystack_secret_key")
      .eq("id", "global")
      .maybeSingle();
    const secret = settings?.paystack_secret_key as string | null;
    if (!secret) throw new Error("Payments are not configured yet.");

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.status) return { status: "failed", plan: null, expiresAt: null };

    const tx = json.data;
    if (tx?.status !== "success") return { status: "pending", plan: null, expiresAt: null };
    if (tx?.metadata?.user_id && tx.metadata.user_id !== context.userId) {
      throw new Error("Forbidden");
    }
    return await activateFromTransaction(tx);
  });
