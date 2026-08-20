import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await (supabaseAdmin as any)
          .from("billing_settings")
          .select("paystack_secret_key")
          .eq("id", "global")
          .maybeSingle();
        const secret = settings?.paystack_secret_key as string | null;
        if (!secret) return new Response("Not configured", { status: 503 });

        const expected = createHmac("sha512", secret).update(body).digest("hex");
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body);
        if (event?.event === "charge.success") {
          const { activateFromTransaction } = await import("@/lib/paystack.server");
          await activateFromTransaction(event.data);
        }
        return new Response("ok");
      },
    },
  },
});
