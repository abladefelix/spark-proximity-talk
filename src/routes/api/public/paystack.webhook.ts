import { createFileRoute } from "@tanstack/react-router";

/**
 * Paystack server notifications for the website-only checkout. Unlocks Pro as
 * soon as a payment clears, even if the member closed the browser tab.
 */
export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();

        const { loadWebSettings, verifyWebhookSignature, grantFromTransaction } = await import(
          "@/lib/web-billing.server"
        );

        const settings = await loadWebSettings();
        const secret = settings?.paystack_secret_key as string | null;
        if (!secret) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-paystack-signature") ?? "";
        if (!signature || !verifyWebhookSignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any = null;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        if (event?.event === "charge.success" && event?.data?.status === "success") {
          try {
            await grantFromTransaction(event.data, settings);
          } catch {
            return new Response("Retry later", { status: 500 });
          }
        }

        return new Response("ok");
      },
    },
  },
});
