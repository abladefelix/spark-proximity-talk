import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Plan = "monthly" | "yearly";

/**
 * Records a successful Paystack transaction and extends the member's Pro
 * access. Shared by the verify server function and the webhook route.
 */
export async function activateFromTransaction(tx: any): Promise<{
  status: "success";
  plan: Plan | null;
  expiresAt: string | null;
}> {
  const userId: string | undefined = tx?.metadata?.user_id;
  const plan: Plan = tx?.metadata?.plan === "yearly" ? "yearly" : "monthly";
  const reference: string = tx?.reference;

  await (supabaseAdmin as any)
    .from("payments")
    .upsert(
      {
        user_id: userId ?? null,
        reference,
        plan,
        amount: Number(tx?.amount ?? 0),
        currency: tx?.currency ?? "GHS",
        status: "success",
        raw: tx,
      },
      { onConflict: "reference" },
    );

  if (!userId) return { status: "success", plan, expiresAt: null };

  const { data: current } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("expires_at, status")
    .eq("user_id", userId)
    .maybeSingle();

  const base =
    current?.status === "active" && current?.expires_at && new Date(current.expires_at) > new Date()
      ? new Date(current.expires_at)
      : new Date();
  const expires = new Date(base);
  if (plan === "yearly") expires.setFullYear(expires.getFullYear() + 1);
  else expires.setMonth(expires.getMonth() + 1);

  await (supabaseAdmin as any).from("subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      plan,
      source: "paystack",
      reference,
      expires_at: expires.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return { status: "success", plan, expiresAt: expires.toISOString() };
}
