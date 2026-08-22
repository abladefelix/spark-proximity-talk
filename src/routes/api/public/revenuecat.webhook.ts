import { createFileRoute } from "@tanstack/react-router";

/**
 * RevenueCat server notifications. Keeps Pro access in sync with Apple /
 * Google renewals, cancellations and refunds.
 */
export const Route = createFileRoute("/api/public/revenuecat/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();

        const {
          loadBillingSettings,
          fetchEntitlement,
          applyEntitlement,
          recordStorePayment,
        } = await import("@/lib/store-billing.server");

        const settings = await loadBillingSettings();
        const secret = settings?.rc_webhook_secret as string | null;
        if (!secret) return new Response("Not configured", { status: 503 });

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.replace(/^Bearer\s+/i, "");
        if (provided !== secret) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any = null;
        try {
          event = JSON.parse(body)?.event ?? null;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const userId: string | undefined = event?.app_user_id;
        if (!userId) return new Response("ok");

        const paidTypes = ["INITIAL_PURCHASE", "RENEWAL", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE"];
        if (paidTypes.includes(event?.type)) {
          await recordStorePayment(event, settings);
        }

        try {
          const state = await fetchEntitlement(userId, settings);
          await applyEntitlement(userId, state);
        } catch {
          // Entitlement lookup failed — RevenueCat will retry the event.
          return new Response("Retry later", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
