import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export const registerPushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ token: z.string().min(1), platform: z.string().default("ios") }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_tokens").upsert(
      { user_id: context.userId, token: data.token, platform: data.platform },
      { onConflict: "user_id, token" }
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const sendPayloadSchema = z.object({
  kind: z.enum(["signal", "match", "message"]),
  recipientId: z.string().uuid(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(240),
  relatedId: z.string().uuid().optional(),
});

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendPayloadSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let relationId: string | null = null;
    let valid = false;

    if (data.kind === "signal") {
      const { data: signal } = await context.supabase
        .from("signals")
        .select("id, from_user, to_user")
        .eq("from_user", userId)
        .eq("to_user", data.recipientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      valid = Boolean(signal);
      relationId = signal?.id ?? null;
    } else if (data.kind === "match") {
      const matchId = data.relatedId;
      if (!matchId) return { sent: false, reason: "missing-match-id" };
      const { data: match } = await context.supabase
        .from("matches")
        .select("id, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();
      const isMember = Boolean(match && (match.user_a === userId || match.user_b === userId));
      const other = match?.user_a === userId ? match.user_b : match?.user_a;
      valid = isMember && other === data.recipientId;
      relationId = match?.id ?? null;
    } else if (data.kind === "message") {
      const matchId = data.relatedId;
      if (!matchId) return { sent: false, reason: "missing-match-id" };
      const { data: message } = await context.supabase
        .from("messages")
        .select("id, match_id, sender_id")
        .eq("match_id", matchId)
        .eq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: match } = await context.supabase
        .from("matches")
        .select("id, user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();
      const other = match?.user_a === userId ? match.user_b : match?.user_a;
      valid = Boolean(message) && other === data.recipientId;
      relationId = match?.id ?? null;
    }

    if (!valid) return { sent: false, reason: "not-authorized" };

    const { sendApnsNotification, shouldDeleteApnsToken } = await import("./push-notifications.server");

    const { data: tokens } = await supabaseAdmin

      .from("push_tokens")
      .select("token")
      .eq("user_id", data.recipientId);

    if (!tokens?.length) return { sent: false, reason: "no-tokens" };

    const results = await Promise.all(
      tokens.map(async ({ token }) => {
        const res = await sendApnsNotification({
          token,
          title: data.title,
          body: data.body,
          data:
            data.kind === "signal"
              ? { kind: "signal" }
              : { kind: data.kind, relatedId: relationId ?? "" },
        });
        if (!res.sent && shouldDeleteApnsToken(res.reason)) {
          await supabaseAdmin.from("push_tokens").delete().eq("token", token);
        }
        return res;
      })
    );

    const anySent = results.some((r) => r.sent);
    const reasons = results.map((r) => r.reason).filter(Boolean);
    return { sent: anySent, reason: anySent ? undefined : reasons.join(", ") };
  });

