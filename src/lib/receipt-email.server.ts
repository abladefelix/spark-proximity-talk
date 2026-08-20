import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ReceiptInput = {
  userId: string;
  email?: string | null;
  name?: string | null;
  reference: string;
  plan: "monthly" | "yearly";
  /** Minor units, e.g. pesewas / kobo. */
  amount: number;
  currency: string;
  paidAt: string;
  expiresAt: string | null;
};

function money(amountMinor: number, currency: string): string {
  const value = (Number(amountMinor) || 0) / 100;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function receiptHtml(o: {
  appName: string;
  logoUrl: string | null;
  proLabel: string;
  name: string;
  reference: string;
  planLabel: string;
  amount: string;
  paidAt: string;
  renews: string | null;
  supportEmail: string | null;
}): string {
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:10px 0;font:400 13px/20px Helvetica,Arial,sans-serif;color:#71717a;">${esc(label)}</td>
      <td align="right" style="padding:10px 0;font:600 13px/20px Helvetica,Arial,sans-serif;color:#18181b;">${esc(value)}</td>
    </tr>`;

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
  <div style="display:none;max-height:0;overflow:hidden;">Your ${esc(o.proLabel)} receipt</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border:1px solid #e4e4e7;border-radius:18px;overflow:hidden;">
        <tr><td style="padding:28px 28px 20px;border-bottom:1px solid #f4f4f5;">
          ${
            o.logoUrl
              ? `<img src="${esc(o.logoUrl)}" alt="${esc(o.appName)}" width="44" height="44" style="display:block;border-radius:12px;" />`
              : ""
          }
          <p style="margin:${o.logoUrl ? "14px" : "0"} 0 0;font:700 19px/26px Helvetica,Arial,sans-serif;color:#18181b;letter-spacing:-0.3px;">${esc(o.appName)}</p>
          <p style="margin:4px 0 0;font:400 13px/20px Helvetica,Arial,sans-serif;color:#71717a;">Payment receipt</p>
        </td></tr>

        <tr><td style="padding:26px 28px 8px;">
          <p style="margin:0 0 6px;font:400 14px/22px Helvetica,Arial,sans-serif;color:#3f3f46;">Hi ${esc(o.name)},</p>
          <p style="margin:0;font:400 14px/22px Helvetica,Arial,sans-serif;color:#3f3f46;">
            Thanks for going ${esc(o.proLabel)}. Your payment went through — here are the details.
          </p>
          <div style="margin:22px 0 0;padding:18px 20px;background:#fafafa;border-radius:14px;">
            <p style="margin:0;font:400 12px/18px Helvetica,Arial,sans-serif;color:#71717a;text-transform:uppercase;letter-spacing:1px;">Amount paid</p>
            <p style="margin:4px 0 0;font:700 28px/34px Helvetica,Arial,sans-serif;color:#18181b;">${esc(o.amount)}</p>
          </div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            ${row("Plan", o.planLabel)}
            ${row("Reference", o.reference)}
            ${row("Date", o.paidAt)}
            ${o.renews ? row("Access until", o.renews) : ""}
          </table>
        </td></tr>

        <tr><td style="padding:18px 28px 28px;border-top:1px solid #f4f4f5;">
          <p style="margin:0;font:400 12px/19px Helvetica,Arial,sans-serif;color:#a1a1aa;">
            Keep this receipt for your records.${
              o.supportEmail
                ? ` Questions? Reach us at <a href="mailto:${esc(o.supportEmail)}" style="color:#71717a;">${esc(o.supportEmail)}</a>.`
                : ""
            }
          </p>
          <p style="margin:8px 0 0;font:400 12px/19px Helvetica,Arial,sans-serif;color:#a1a1aa;">— The ${esc(o.appName)} team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Emails a branded receipt after a successful payment. Never throws — a mail
 * problem must not fail the payment activation.
 */
export async function sendPaymentReceipt(input: ReceiptInput): Promise<void> {
  try {
    const admin = supabaseAdmin as any;

    const [{ data: mail }, { data: app }, { data: billing }] = await Promise.all([
      admin.from("email_settings").select("*").eq("id", "global").maybeSingle(),
      admin
        .from("app_settings")
        .select("app_name, logo_url, support_email")
        .eq("id", "global")
        .maybeSingle(),
      admin.from("billing_settings").select("pro_label").eq("id", "global").maybeSingle(),
    ]);

    if (!mail?.enabled || !mail?.smtp_host || !mail?.from_email) return;

    let to = input.email ?? null;
    let name = input.name ?? null;
    if (!to) {
      const { data: userRes } = await admin.auth.admin.getUserById(input.userId);
      to = userRes?.user?.email ?? null;
      name = name ?? (userRes?.user?.user_metadata?.display_name as string | undefined) ?? null;
    }
    if (!to) return;

    let logoUrl: string | null = null;
    if (app?.logo_url) {
      logoUrl = /^https?:\/\//.test(app.logo_url)
        ? app.logo_url
        : ((
            await admin.storage.from("branding").createSignedUrl(app.logo_url, 60 * 60 * 24 * 30)
          )?.data?.signedUrl ?? null);
    }

    const appName = app?.app_name || "SKANAROUND";
    const proLabel = billing?.pro_label || "Pro";
    const amount = money(input.amount, input.currency);
    const planLabel = input.plan === "yearly" ? "Yearly membership" : "Monthly membership";
    const paidAt = new Date(input.paidAt).toUTCString();
    const renews = input.expiresAt ? new Date(input.expiresAt).toUTCString() : null;

    const html = receiptHtml({
      appName,
      logoUrl,
      proLabel,
      name: name || "there",
      reference: input.reference,
      planLabel,
      amount,
      paidAt,
      renews,
      supportEmail: app?.support_email ?? null,
    });

    const text = [
      `${appName} — payment receipt`,
      ``,
      `Amount paid: ${amount}`,
      `Plan: ${planLabel}`,
      `Reference: ${input.reference}`,
      `Date: ${paidAt}`,
      renews ? `Access until: ${renews}` : "",
      ``,
      `Thanks for going ${proLabel}.`,
    ]
      .filter(Boolean)
      .join("\n");

    const { sendSmtpMail } = await import("@/lib/smtp.server");
    await sendSmtpMail(
      {
        host: mail.smtp_host,
        port: mail.smtp_port ?? 587,
        secure: Boolean(mail.smtp_secure),
        user: mail.smtp_user,
        password: mail.smtp_password,
      },
      {
        from: mail.from_email,
        fromName: mail.from_name ?? appName,
        to,
        replyTo: mail.reply_to,
        subject: `Your ${appName} receipt — ${amount}`,
        text,
        html,
      },
    );
  } catch (err) {
    console.error("[receipt] send failed", err);
  }
}
