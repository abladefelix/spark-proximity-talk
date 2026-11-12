import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setReviewActivity = createServerFn({ method: "POST" })
  .inputValidator((input: { username: string; enabled: boolean }) => {
    if (
      !input ||
      input.username?.trim().toLowerCase() !== "ogyamwilson" ||
      typeof input.enabled !== "boolean"
    ) {
      throw new Error("This sample activity is scoped to ogyamwilson");
    }
    return { username: "ogyamwilson", enabled: input.enabled };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: roles, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (error || !roles?.length) throw new Error("Admins only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .single();
    if (lookupError || !profile) throw new Error("Review account not found");
    const { populateReviewActivity } = await import("@/lib/review-activity.server");
    return populateReviewActivity(supabaseAdmin, profile.id, data.enabled);
  });
