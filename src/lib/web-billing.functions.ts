import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Prices shown on the public website upgrade page. */
export const getWebCheckoutInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { loadWebSettings, webCheckoutInfo } = await import("@/lib/web-billing.server");
  return webCheckoutInfo(await loadWebSettings());
});

/** Creates a hosted checkout for the signed-in member. */
export const startWebCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan: string; callbackUrl: string }) => ({
    plan: input?.plan === "yearly" ? ("yearly" as const) : ("monthly" as const),
    callbackUrl: String(input?.callbackUrl ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { startCheckout } = await import("@/lib/web-billing.server");
    const email = (context.claims as any)?.email as string | undefined;
    if (!email) throw new Error("Your account has no email address on file.");
    return startCheckout({
      userId: context.userId,
      email,
      plan: data.plan,
      callbackUrl: data.callbackUrl,
    });
  });

/** Confirms a completed checkout right after the redirect back. */
export const confirmWebPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string }) => ({
    reference: String(input?.reference ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.reference) throw new Error("Missing payment reference.");
    const { verifyAndGrant } = await import("@/lib/web-billing.server");
    return verifyAndGrant(data.reference);
  });
