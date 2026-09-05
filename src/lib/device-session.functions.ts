import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignInOutcome =
  | { status: "ok"; access_token: string; refresh_token: string }
  | { status: "other_device"; device_label: string; last_seen: string };

/**
 * Single-device sign-in. Credentials are checked first; if the account is
 * already claimed by another device the caller gets no tokens back, only the
 * information needed to decide whether to revoke it or reset the password.
 */
export const signInSingleDevice = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; password: string; deviceId: string; deviceLabel: string }) => {
    const identifier = (input?.identifier ?? "").trim();
    const password = input?.password ?? "";
    const deviceId = (input?.deviceId ?? "").trim();
    if (!identifier || !password) throw new Error("Enter your username or email and password");
    if (!deviceId) throw new Error("Could not identify this device");
    return {
      identifier,
      password,
      deviceId,
      deviceLabel: (input?.deviceLabel ?? "").trim().slice(0, 80) || "Unknown device",
    };
  })
  .handler(async ({ data }): Promise<SignInOutcome> => {
    const { resolveEmail } = await import("./username-auth.server");
    const { otherDevice, claimDevice, verifyPassword } = await import("./device-session.server");
    const email = data.identifier.includes("@")
      ? data.identifier
      : await resolveEmail(data.identifier);
    if (!email) throw new Error("Invalid login credentials");

    const { userId, tokens } = await verifyPassword(email, data.password);
    const existing = await otherDevice(userId, data.deviceId);
    if (existing) {
      return { status: "other_device", device_label: existing.device_label, last_seen: existing.last_seen };
    }
    await claimDevice(userId, data.deviceId, data.deviceLabel);
    return { status: "ok", ...tokens };
  });

/**
 * Claims this device for an already-signed-in session. Used by the email
 * sign-in path, where the browser authenticates directly with the auth
 * service — so sign-in keeps working even if the server's own backend
 * credentials are misconfigured.
 */
export const claimThisDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deviceId: string; deviceLabel: string; force?: boolean }) => {
    const deviceId = (input?.deviceId ?? "").trim();
    if (!deviceId) throw new Error("Could not identify this device");
    return {
      deviceId,
      deviceLabel: (input?.deviceLabel ?? "").trim().slice(0, 80) || "Unknown device",
      force: Boolean(input?.force),
    };
  })
  .handler(async ({ data, context }): Promise<SignInOutcome | { status: "ok" }> => {
    const { otherDevice, claimDevice, revokeOtherDeviceRows } = await import("./device-session.server");
    if (data.force) {
      await revokeOtherDeviceRows(context.userId, data.deviceId);
      await claimDevice(context.userId, data.deviceId, data.deviceLabel);
      return { status: "ok" };
    }
    const existing = await otherDevice(context.userId, data.deviceId);
    if (existing) {
      return { status: "other_device", device_label: existing.device_label, last_seen: existing.last_seen };
    }
    await claimDevice(context.userId, data.deviceId, data.deviceLabel);
    return { status: "ok" };
  });

/** Signs the other device out (password re-checked) and signs this one in. */
export const revokeOtherDeviceAndSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; password: string; deviceId: string; deviceLabel: string }) => {
    const identifier = (input?.identifier ?? "").trim();
    const password = input?.password ?? "";
    const deviceId = (input?.deviceId ?? "").trim();
    if (!identifier || !password || !deviceId) throw new Error("Invalid request");
    return {
      identifier,
      password,
      deviceId,
      deviceLabel: (input?.deviceLabel ?? "").trim().slice(0, 80) || "Unknown device",
    };
  })
  .handler(async ({ data }) => {
    const { resolveEmail } = await import("./username-auth.server");
    const { verifyPassword, revokeOtherDevices, claimDevice } = await import("./device-session.server");
    const email = data.identifier.includes("@")
      ? data.identifier
      : await resolveEmail(data.identifier);
    if (!email) throw new Error("Invalid login credentials");

    const { userId } = await verifyPassword(email, data.password);
    await revokeOtherDevices(userId, data.deviceId);
    // The global sign-out above invalidated the tokens we just minted.
    const fresh = await verifyPassword(email, data.password);
    await claimDevice(userId, data.deviceId, data.deviceLabel);
    return { status: "ok" as const, ...fresh.tokens };
  });

/** "This isn't me" — emails a password reset link for the given identifier. */
export const requestPasswordResetFor = createServerFn({ method: "POST" })
  .inputValidator((input: { identifier: string; redirectTo: string }) => {
    const identifier = (input?.identifier ?? "").trim();
    if (!identifier) throw new Error("Enter your username or email");
    return { identifier, redirectTo: input?.redirectTo ?? "" };
  })
  .handler(async ({ data }) => {
    const { resolveEmail } = await import("./username-auth.server");
    const { sendPasswordReset } = await import("./device-session.server");
    const email = data.identifier.includes("@")
      ? data.identifier
      : await resolveEmail(data.identifier);
    // Always report success so this cannot be used to probe for accounts.
    if (email) await sendPasswordReset(email, data.redirectTo);
    return { ok: true } as const;
  });

/** Heartbeat: false means another device took over this account. */
export const checkDeviceSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deviceId: string }) => ({ deviceId: (input?.deviceId ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.deviceId) return { active: true } as const;
    const { deviceStillActive } = await import("./device-session.server");
    return { active: await deviceStillActive(context.userId, data.deviceId) } as const;
  });

/** Releases this device's claim on sign-out. */
export const releaseMyDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deviceId: string }) => ({ deviceId: (input?.deviceId ?? "").trim() }))
  .handler(async ({ data, context }) => {
    if (!data.deviceId) return { ok: true } as const;
    const { releaseDevice } = await import("./device-session.server");
    await releaseDevice(context.userId, data.deviceId);
    return { ok: true } as const;
  });
