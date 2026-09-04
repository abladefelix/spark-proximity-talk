import { supabase } from "@/integrations/supabase/client";
import type { PasswordSignInResult } from "./username-auth.functions";

/**
 * Signs in with an email address or a username.
 *
 * Email addresses go straight to the auth API from the browser, so sign-in keeps
 * working even when the server function cannot be reached ("Load failed").
 * Usernames still need the server to resolve the account email.
 */
export async function signInWithIdentifierClient(
  identifier: string,
  password: string,
): Promise<void> {
  const id = identifier.trim();
  if (!id || !password) throw new Error("Enter your username or email and password");

  if (id.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    if (error) throw new Error(error.message);
    return;
  }

  let response: Response;
  try {
    response = await fetch("/api/public/username-sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: id, password }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/load failed|failed to fetch|network/i.test(message)) {
      throw new Error("Could not reach the server. Sign in with your email address instead.");
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      response.status === 401
        ? "Sign-in request was rejected. Restart the app service and try again."
        : "The sign-in service returned an invalid response.",
    );
  }
  const result = (await response.json()) as PasswordSignInResult & { error?: string };
  if (!response.ok || !result.access_token || !result.refresh_token) {
    throw new Error(result.error ?? "Invalid login credentials");
  }

  const { error } = await supabase.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
  if (error) throw new Error(error.message);
}
