import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EntitlementResult = {
  isActive: boolean;
  plan: string;
  expiresAt: string | null;
};

/**
 * Confirms the signed-in member's subscription with RevenueCat and updates
 * their Pro access. Called right after a purchase or restore so access is
 * granted without waiting for the webhook.
 */
export const refreshEntitlement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementResult> => {
    const { loadBillingSettings, fetchEntitlement, applyEntitlement } = await import(
      "@/lib/store-billing.server"
    );
    const settings = await loadBillingSettings();
    if (!settings?.enabled) throw new Error("Memberships are not available yet.");

    const state = await fetchEntitlement(context.userId, settings);
    await applyEntitlement(context.userId, state);
    return { isActive: state.isActive, plan: state.plan, expiresAt: state.expiresAt };
  });
