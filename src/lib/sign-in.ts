import { supabase } from "@/integrations/supabase/client";
import type { PasswordSignInResult } from "./username-auth.functions";

type ServerSignIn = (args: {
  data: { identifier: string; password: string };
}) => Promise<PasswordSignInResult>;

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
  serverSignIn: ServerSignIn,
): Promise<void> {
  const id = identifier.trim();
  if (!id || !password) throw new Error("Enter your username or email and password");

  if (id.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({ email: id, password });
    if (error) throw new Error(error.message);
    return;
  }

  let tokens: PasswordSignInResult;
  try {
    tokens = await serverSignIn({ data: { identifier: id, password } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/load failed|failed to fetch|network/i.test(message)) {
      throw new Error("Could not reach the server. Sign in with your email address instead.");
    }
    throw new Error(message);
  }

  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) throw new Error(error.message);
}
