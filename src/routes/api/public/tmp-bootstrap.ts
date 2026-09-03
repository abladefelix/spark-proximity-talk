import { createFileRoute } from "@tanstack/react-router";

/** Temporary one-off bootstrap endpoint. Deleted right after use. */
export const Route = createFileRoute("/api/public/tmp-bootstrap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          token: string;
          email: string;
          password: string;
          username: string;
        };
        if (body.token !== "skn-boot-2026-09") {
          return new Response("no", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const { data: created, error } = await admin.auth.admin.createUser({
          email: body.email,
          password: body.password,
          email_confirm: true,
        });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        const id = created.user.id;

        await admin
          .from("profiles")
          .upsert({ id, username: body.username, display_name: "Super Admin", gender: "other" });
        await admin.from("user_roles").delete().eq("user_id", id);
        const { error: roleErr } = await admin
          .from("user_roles")
          .insert({ user_id: id, role: "admin" });

        const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");

        return new Response(
          JSON.stringify({ id, roleErr: roleErr?.message ?? null, admins }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
