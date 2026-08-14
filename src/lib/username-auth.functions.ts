import { createServerFn } from "@tanstack/react-start";

export type PasswordSignInResult = { access_token: string; refresh_token: string };

/**
 * Signs in with either an email address or a username. The username -> email
 * lookup happens server-side with admin access and never returns the address,
 * so it cannot be used to harvest emails.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; password: string }) => {
    const identifier = (input?.identifier ?? "").trim();
    const password = input?.password ?? "";
    if (!identifier || !password) throw new Error("Enter your username or email and password");
    return { identifier, password };
  })
  .handler(async ({ data }): Promise<PasswordSignInResult> => {
    const { resolveEmail, passwordSignIn } = await import("./username-auth.server");
    const email = data.identifier.includes("@")
      ? data.identifier
      : await resolveEmail(data.identifier);
    if (!email) throw new Error("Invalid login credentials");
    return passwordSignIn(email, data.password);
  });
