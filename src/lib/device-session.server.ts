import { createClient } from "@supabase/supabase-js";

export type OtherDevice = { device_label: string; last_seen: string };

/** Publishable-key client used for password-based auth calls from the server. */
function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Any device registered for this account other than the one signing in. */
export async function otherDevice(userId: string, deviceId: string): Promise<OtherDevice | null> {
  const db = await admin();
  const { data } = await db
    .from("device_sessions")
    .select("device_label, last_seen")
    .eq("user_id", userId)
    .neq("device_id", deviceId)
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OtherDevice | null) ?? null;
}

/** Marks this device as the single active session for the account. */
export async function claimDevice(userId: string, deviceId: string, label: string) {
  const db = await admin();
  await db
    .from("device_sessions")
    .upsert(
      { user_id: userId, device_id: deviceId, device_label: label, last_seen: new Date().toISOString() },
      { onConflict: "user_id,device_id" },
    );
}

/** Drops every other device record and invalidates their refresh tokens. */
export async function revokeOtherDevices(userId: string, deviceId: string) {
  const db = await admin();
  await db.from("device_sessions").delete().eq("user_id", userId).neq("device_id", deviceId);
  // Kills refresh tokens everywhere; the signing-in device gets fresh ones below.
  try {
    await db.auth.admin.signOut(userId, "global");
  } catch {
    /* best effort — the device-record check still logs the other device out */
  }
}

export async function releaseDevice(userId: string, deviceId: string) {
  const db = await admin();
  await db.from("device_sessions").delete().eq("user_id", userId).eq("device_id", deviceId);
}

/** True when this device still owns the account's active session. */
export async function deviceStillActive(userId: string, deviceId: string) {
  const db = await admin();
  const { data } = await db
    .from("device_sessions")
    .select("device_id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();
  if (!data) return false;
  await db
    .from("device_sessions")
    .update({ last_seen: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("device_id", deviceId);
  return true;
}

/** Verifies credentials and returns the user id plus fresh session tokens. */
export async function verifyPassword(email: string, password: string) {
  const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(error?.message ?? "Invalid login credentials");
  }
  return {
    userId: data.user.id,
    tokens: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

export async function sendPasswordReset(email: string, redirectTo: string) {
  await publicClient().auth.resetPasswordForEmail(email, { redirectTo });
}
