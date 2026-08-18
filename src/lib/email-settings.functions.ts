import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailSettingsInput = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  enabled: boolean;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .limit(1);
  if (!data?.length) throw new Error("Forbidden");
}

export const getEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("email_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    const s = data ?? {};
    return {
      smtp_host: s.smtp_host ?? "",
      smtp_port: s.smtp_port ?? 587,
      smtp_secure: Boolean(s.smtp_secure),
      smtp_user: s.smtp_user ?? "",
      from_name: s.from_name ?? "",
      from_email: s.from_email ?? "",
      reply_to: s.reply_to ?? "",
      enabled: Boolean(s.enabled),
      hasPassword: Boolean(s.smtp_password),
      last_test_at: s.last_test_at ?? null,
      last_test_ok: s.last_test_ok ?? null,
      last_test_error: s.last_test_error ?? null,
    };
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .inputValidator((input: EmailSettingsInput) => {
    if (!input) throw new Error("Missing settings");
    const host = (input.smtp_host ?? "").trim();
    const port = Number(input.smtp_port);
    if (host.length > 255) throw new Error("Host is too long");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid port");
    const email = (input.from_email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Invalid sender address");
    const reply = (input.reply_to ?? "").trim();
    if (reply && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply)) throw new Error("Invalid reply-to");
    return { ...input, smtp_host: host, smtp_port: port, from_email: email, reply_to: reply };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      id: "global",
      provider: "smtp",
      smtp_host: data.smtp_host || null,
      smtp_port: data.smtp_port,
      smtp_secure: data.smtp_secure,
      smtp_user: data.smtp_user || null,
      from_name: data.from_name || null,
      from_email: data.from_email || null,
      reply_to: data.reply_to || null,
      enabled: data.enabled,
      updated_at: new Date().toISOString(),
    };
    // Empty password means "keep the stored one".
    if (data.smtp_password) patch["smtp_password"] = data.smtp_password;
    const { error } = await (supabaseAdmin as any)
      .from("email_settings")
      .upsert(patch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { to: string }) => {
    const to = (input?.to ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error("Enter a valid email address");
    return { to };
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await (supabaseAdmin as any)
      .from("email_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    if (!s?.smtp_host || !s?.from_email) throw new Error("Add a mail server and sender first");

    const { sendSmtpMail } = await import("@/lib/smtp.server");
    let ok = true;
    let message = "";
    try {
      await sendSmtpMail(
        {
          host: s.smtp_host,
          port: s.smtp_port ?? 587,
          secure: Boolean(s.smtp_secure),
          user: s.smtp_user,
          password: s.smtp_password,
        },
        {
          from: s.from_email,
          fromName: s.from_name,
          to: data.to,
          replyTo: s.reply_to,
          subject: "SKANAROUND test email",
          text: "Your SKANAROUND mail settings are working.",
          html: "<p>Your <strong>SKANAROUND</strong> mail settings are working.</p>",
        },
      );
    } catch (err) {
      ok = false;
      message = err instanceof Error ? err.message : "Send failed";
    }

    await (supabaseAdmin as any)
      .from("email_settings")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_ok: ok,
        last_test_error: ok ? null : message.slice(0, 500),
      })
      .eq("id", "global");

    if (!ok) throw new Error(message);
    return { ok: true };
  });
