import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", ["admin", "moderator"])
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

export type AdminUserDetails = {
  id: string;
  email: string | null;
  phone: string | null;
  emailConfirmed: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  providers: string[];
  username: string;
  displayName: string | null;
  bio: string | null;
  gender: string | null;
  verified: boolean;
  banned: boolean;
  bannedReason: string | null;
  lastSeen: string | null;
  roles: string[];
  counts: {
    signalsSent: number;
    signalsReceived: number;
    matches: number;
    messages: number;
    reportsAgainst: number;
  };
  location: { lat: number; lng: number; updatedAt: string; visible: boolean } | null;
};

/** Full account view for staff: auth identity + profile + activity counters. */
export const getUserDetails = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<AdminUserDetails> => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: authRes, error: authErr } = await admin.auth.admin.getUserById(data.userId);
    if (authErr) throw new Error(authErr.message);
    const authUser = authRes?.user;

    const [profile, roles, sent, received, matchesA, matchesB, messages, reports, location] =
      await Promise.all([
        admin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
        admin.from("user_roles").select("role").eq("user_id", data.userId),
        admin.from("signals").select("id", { count: "exact", head: true }).eq("from_user", data.userId),
        admin.from("signals").select("id", { count: "exact", head: true }).eq("to_user", data.userId),
        admin.from("matches").select("id", { count: "exact", head: true }).eq("user_a", data.userId),
        admin.from("matches").select("id", { count: "exact", head: true }).eq("user_b", data.userId),
        admin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("sender_id", data.userId),
        admin.from("reports").select("id", { count: "exact", head: true }).eq("reported", data.userId),
        admin
          .from("locations")
          .select("lat, lng, updated_at, is_visible")
          .eq("user_id", data.userId)
          .maybeSingle(),
      ]);

    const p = profile?.data ?? {};
    const loc = location?.data;

    return {
      id: data.userId,
      email: authUser?.email ?? null,
      phone: authUser?.phone ?? null,
      emailConfirmed: Boolean(authUser?.email_confirmed_at ?? authUser?.confirmed_at),
      createdAt: authUser?.created_at ?? null,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      providers: (authUser?.app_metadata?.providers ?? []) as string[],
      username: p.username ?? "unknown",
      displayName: p.display_name ?? null,
      bio: p.bio ?? null,
      gender: p.gender ?? null,
      verified: Boolean(p.verified),
      banned: Boolean(p.banned),
      bannedReason: p.banned_reason ?? null,
      lastSeen: p.last_seen ?? null,
      roles: ((roles?.data ?? []) as { role: string }[]).map((r) => r.role),
      counts: {
        signalsSent: sent?.count ?? 0,
        signalsReceived: received?.count ?? 0,
        matches: (matchesA?.count ?? 0) + (matchesB?.count ?? 0),
        messages: messages?.count ?? 0,
        reportsAgainst: reports?.count ?? 0,
      },
      location: loc
        ? { lat: loc.lat, lng: loc.lng, updatedAt: loc.updated_at, visible: loc.is_visible }
        : null,
    };
  });
