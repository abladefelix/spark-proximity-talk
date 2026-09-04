import { createClient } from "@supabase/supabase-js";

/** Resolves a username to its account email using admin access. */
export async function resolveEmail(username: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const clean = username.toLowerCase().replace(/\s+/g, "_");
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", clean)
    .maybeSingle();
  // A misconfigured backend (missing/incorrect service key) must not be
  // reported to the user as a wrong password.
  if (error) throw new Error("Username sign-in is unavailable right now. Use your email address.");
  if (!profile?.id) return null;
  const { data, error: adminError } = await admin.auth.admin.getUserById(profile.id);
  if (adminError) throw new Error("Username sign-in is unavailable right now. Use your email address.");
  return data?.user?.email ?? null;
}

/** Performs an email/password sign-in server-side and returns the session tokens. */
export async function passwordSignIn(email: string, password: string) {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(url, key, {
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
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message ?? "Invalid login credentials");
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
