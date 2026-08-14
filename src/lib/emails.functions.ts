import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export type PendingEmail = {
  id: string;
  email: string;
  created_at: string;
  confirmed: boolean;
};

export const listPendingEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingEmail[]> => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    return ((data?.users ?? []) as any[])
      .map((u) => ({
        id: u.id as string,
        email: (u.email ?? "") as string,
        created_at: u.created_at as string,
        confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
      }))
      .filter((u) => u.email && !u.confirmed)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });

export const approveUserEmail = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId) throw new Error("userId required");
    return input;
  })
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertStaff(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).auth.admin.updateUserById(data.userId, {
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
