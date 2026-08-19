import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanent, self-service account deletion.
 *
 * Apple 5.1.1(v) and Google Play's data-deletion policy both require an
 * in-app path that removes the account and its data — not just a support
 * email. The caller can only ever delete themselves: the id comes from the
 * verified bearer token, never from the request body.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove uploaded media first — storage objects outlive row deletes.
    for (const bucket of ["avatars", "verifications"]) {
      const { data: files } = await supabaseAdmin.storage.from(bucket).list(userId);
      if (files?.length) {
        await supabaseAdmin.storage
          .from(bucket)
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    }

    // Chat media lives under <matchId>/<userId>/..., so collect the user's
    // matches and clear their folder inside each one.
    const { data: myMatches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`);
    for (const match of myMatches ?? []) {
      const prefix = `${match.id}/${userId}`;
      const { data: files } = await supabaseAdmin.storage.from("chat-media").list(prefix);
      if (files?.length) {
        await supabaseAdmin.storage
          .from("chat-media")
          .remove(files.map((f) => `${prefix}/${f.name}`));
      }
    }

    // Messages in shared threads, then the threads themselves.
    const matchIds = (myMatches ?? []).map((m) => m.id);
    if (matchIds.length) {
      await supabaseAdmin.from("messages").delete().in("match_id", matchIds);
      await supabaseAdmin.from("matches").delete().in("id", matchIds);
    }

    await supabaseAdmin.from("notification_reads").delete().eq("user_id", userId);
    await supabaseAdmin.from("notifications").delete().eq("user_id", userId);
    await supabaseAdmin.from("push_tokens").delete().eq("user_id", userId);
    await supabaseAdmin.from("verification_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("reactivation_requests").delete().eq("user_id", userId);
    await supabaseAdmin.from("locations").delete().eq("user_id", userId);
    await supabaseAdmin.from("blocks").delete().or(`blocker.eq.${userId},blocked.eq.${userId}`);
    await supabaseAdmin.from("reports").delete().or(`reporter.eq.${userId},reported.eq.${userId}`);
    await supabaseAdmin.from("signals").delete().or(`from_user.eq.${userId},to_user.eq.${userId}`);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true } as const;
  });
