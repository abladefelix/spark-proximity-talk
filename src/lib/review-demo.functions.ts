import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Read the current Auth record, never a stale JWT or user-editable metadata.
export const getReviewDemoAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !data.user) throw new Error("Could not verify demo access");
    return {
      userId: context.userId,
      enabled: data.user.app_metadata?.["review_demo_enabled"] === true,
    };
  });

export const setReviewDemoAccess = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; enabled: boolean }) => {
    if (
      !input ||
      !/^[a-z0-9_]{3,20}$/i.test(input.username) ||
      typeof input.enabled !== "boolean"
    ) {
      throw new Error("Enter an exact username and choose Enable or Disable");
    }
    return { username: input.username.toLowerCase(), enabled: input.enabled };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (roleError || !roles?.length) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("username", data.username)
      .maybeSingle();
    if (error || !profile) throw new Error("Account not found");
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      app_metadata: { review_demo_enabled: data.enabled },
    });
    if (updateError) throw new Error("Could not update demo access");
    return { username: profile.username, enabled: data.enabled };
  });
