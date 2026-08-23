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
  avatarUrl: string | null;
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
      avatarUrl: p.avatar_url ?? null,
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

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Admins only");
}

export type AdminUserPatch = {
  userId: string;
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  gender?: string | null;
  avatarUrl?: string | null;
  verified?: boolean;
  banned?: boolean;
  bannedReason?: string | null;
  dateOfBirth?: string | null;
  email?: string;
  phone?: string | null;
  password?: string;
  emailConfirmed?: boolean;
  role?: "admin" | "moderator" | "user";
};

/** Admin-only: update any part of a member's profile or auth identity. */
export const adminUpdateUser = createServerFn({ method: "POST" })
  .inputValidator((input: AdminUserPatch) => {
    if (!input?.userId) throw new Error("userId required");
    if (input.username !== undefined && !/^[a-z0-9_]{3,20}$/i.test(input.username)) {
      throw new Error("Username must be 3-20 letters, numbers or underscores");
    }
    if (input.password !== undefined && input.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (input.email !== undefined && !/^\S+@\S+\.\S+$/.test(input.email)) {
      throw new Error("Enter a valid email");
    }
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    // Auth identity changes
    const authPatch: Record<string, unknown> = {};
    if (data.email !== undefined) authPatch["email"] = data.email;
    if (data.phone !== undefined) authPatch["phone"] = data.phone || undefined;
    if (data.password !== undefined) authPatch["password"] = data.password;
    if (data.emailConfirmed) authPatch["email_confirm"] = true;
    if (Object.keys(authPatch).length) {
      const { error } = await admin.auth.admin.updateUserById(data.userId, authPatch);
      if (error) throw new Error(error.message);
    }

    // Profile changes
    const patch: Record<string, unknown> = {};
    if (data.username !== undefined) {
      const clean = data.username.toLowerCase().replace(/\s+/g, "_");
      const { data: taken } = await admin
        .from("profiles")
        .select("id")
        .ilike("username", clean)
        .neq("id", data.userId)
        .maybeSingle();
      if (taken) throw new Error("That username is taken");
      patch["username"] = clean;
    }
    if (data.displayName !== undefined) patch["display_name"] = data.displayName || null;
    if (data.bio !== undefined) patch["bio"] = data.bio || null;
    if (data.gender !== undefined) patch["gender"] = data.gender || null;
    if (data.avatarUrl !== undefined) patch["avatar_url"] = data.avatarUrl || null;
    if (data.verified !== undefined) patch["verified"] = data.verified;
    if (data.dateOfBirth !== undefined) patch["date_of_birth"] = data.dateOfBirth || null;
    if (Object.keys(patch).length) {
      const { error } = await admin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.banned !== undefined) {
      const { error } = await context.supabase.rpc("admin_set_ban", {
        _user_id: data.userId,
        _banned: data.banned,
        _reason: data.bannedReason ?? null,
      });
      if (error) throw new Error(error.message);
    }

    if (data.role !== undefined) {
      if (data.userId === context.userId && data.role !== "admin") {
        throw new Error("You cannot remove your own admin role");
      }
      await admin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await admin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

/** Admin-only: permanently delete a member's account. */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account here");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin-only: send a password-reset email to the member. */
export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; redirectTo?: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: authRes } = await admin.auth.admin.getUserById(data.userId);
    const email = authRes?.user?.email;
    if (!email) throw new Error("This account has no email address");
    const { data: link, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: data.redirectTo ? { redirectTo: data.redirectTo } : undefined,
    });
    if (error) throw new Error(error.message);
    return { ok: true, email, link: (link?.properties?.action_link as string) ?? null };
  });
