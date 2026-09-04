import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const credentialsSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

/** Public credential exchange used only when an account name must first be resolved. */
export const Route = createFileRoute("/api/public/username-sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let input: unknown;
        try {
          input = await request.json();
        } catch {
          return json({ error: "Invalid request" }, 400);
        }

        const parsed = credentialsSchema.safeParse(input);
        if (!parsed.success) {
          return json({ error: "Enter your username and password" }, 400);
        }

        try {
          const { resolveEmail, passwordSignIn } = await import("@/lib/username-auth.server");
          const email = await resolveEmail(parsed.data.identifier);
          if (!email) return json({ error: "Invalid login credentials" }, 401);
          const session = await passwordSignIn(email, parsed.data.password);
          return json(session);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not sign in";
          const isCredentialsError = /invalid login credentials|invalid credentials/i.test(message);
          return json(
            { error: isCredentialsError ? "Invalid login credentials" : message },
            isCredentialsError ? 401 : 503,
          );
        }
      },
    },
  },
});