import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SettingsInput = {
  destination: string;
  schedule: string;
  s3_endpoint?: string | null;
  s3_region?: string | null;
  s3_bucket?: string | null;
  s3_prefix?: string | null;
  s3_access_key_id?: string | null;
  s3_secret_access_key?: string | null;
  gdrive_folder_id?: string | null;
  gdrive_client_id?: string | null;
  gdrive_client_secret?: string | null;
  gdrive_refresh_token?: string | null;
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

export const getBackupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("backup_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    const s = data ?? {};
    return {
      destination: s.destination ?? "download",
      schedule: s.schedule ?? "manual",
      s3_endpoint: s.s3_endpoint ?? "",
      s3_region: s.s3_region ?? "auto",
      s3_bucket: s.s3_bucket ?? "",
      s3_prefix: s.s3_prefix ?? "skanaround-backups",
      s3_access_key_id: s.s3_access_key_id ?? "",
      gdrive_folder_id: s.gdrive_folder_id ?? "",
      gdrive_client_id: s.gdrive_client_id ?? "",
      hasS3Secret: Boolean(s.s3_secret_access_key),
      hasDriveSecret: Boolean(s.gdrive_client_secret),
      hasDriveToken: Boolean(s.gdrive_refresh_token),
      last_run_at: s.last_run_at ?? null,
    };
  });

export const saveBackupSettings = createServerFn({ method: "POST" })
  .inputValidator((input: SettingsInput) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { id: "global" };
    for (const [k, v] of Object.entries(data)) {
      // empty secret fields mean "keep existing"
      if (
        (k === "s3_secret_access_key" ||
          k === "gdrive_client_secret" ||
          k === "gdrive_refresh_token") &&
        !v
      ) {
        continue;
      }
      patch[k] = v ?? null;
    }
    const { error } = await (supabaseAdmin as any)
      .from("backup_settings")
      .upsert(patch, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TABLES = [
  "profiles",
  "user_roles",
  "signals",
  "matches",
  "messages",
  "reports",
  "blocks",
  "verification_requests",
  "reactivation_requests",
  "app_settings",
] as const;

export const runBackup = createServerFn({ method: "POST" })
  .inputValidator((input: { destination?: string }) => input ?? {})
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: settings } = await admin
      .from("backup_settings")
      .select("*")
      .eq("id", "global")
      .maybeSingle();
    const destination = data.destination || settings?.destination || "download";

    const snapshot: Record<string, unknown> = {
      generated_at: new Date().toISOString(),
      app: "SkanAround",
    };
    for (const table of TABLES) {
      const { data: rows, error } = await admin.from(table).select("*").limit(50000);
      if (error) throw new Error(`${table}: ${error.message}`);
      snapshot[table] = rows ?? [];
    }

    const body = JSON.stringify(snapshot, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `${(settings?.s3_prefix || "skanaround-backups").replace(/\/+$/, "")}/skanaround-backup-${stamp}.json`;
    const size = new TextEncoder().encode(body).length;

    let objectKey: string | null = null;
    try {
      if (destination === "s3") {
        const { s3PutObject } = await import("./s3.server");
        if (!settings?.s3_endpoint || !settings?.s3_bucket || !settings?.s3_access_key_id) {
          throw new Error("S3 settings are incomplete");
        }
        await s3PutObject(
          {
            endpoint: settings.s3_endpoint,
            region: settings.s3_region || "auto",
            bucket: settings.s3_bucket,
            accessKeyId: settings.s3_access_key_id,
            secretAccessKey: settings.s3_secret_access_key,
          },
          key,
          body,
        );
        objectKey = key;
      } else if (destination === "gdrive") {
        const { driveUpload } = await import("./gdrive.server");
        if (!settings?.gdrive_client_id || !settings?.gdrive_refresh_token) {
          throw new Error("Google Drive settings are incomplete");
        }
        const name = key.split("/").pop()!;
        await driveUpload(
          {
            clientId: settings.gdrive_client_id,
            clientSecret: settings.gdrive_client_secret,
            refreshToken: settings.gdrive_refresh_token,
            folderId: settings.gdrive_folder_id,
          },
          name,
          body,
        );
        objectKey = name;
      } else {
        objectKey = key.split("/").pop()!;
      }
    } catch (err) {
      await admin.from("backup_runs").insert({
        destination,
        status: "failed",
        size_bytes: size,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      throw err;
    }

    await admin.from("backup_runs").insert({
      destination,
      status: "success",
      object_key: objectKey,
      size_bytes: size,
    });
    await admin
      .from("backup_settings")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", "global");

    return {
      destination,
      objectKey,
      size,
      // only hand the payload back for manual downloads
      payload: destination === "download" ? body : null,
    };
  });
