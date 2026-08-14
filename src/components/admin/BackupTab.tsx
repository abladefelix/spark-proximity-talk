import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CloudUpload, HardDriveDownload, Loader2, Save } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBlob } from "@/lib/exporters";
import { getBackupSettings, runBackup, saveBackupSettings } from "@/lib/backup.functions";

type Draft = {
  destination: string;
  schedule: string;
  s3_endpoint: string;
  s3_region: string;
  s3_bucket: string;
  s3_prefix: string;
  s3_access_key_id: string;
  s3_secret_access_key: string;
  gdrive_folder_id: string;
  gdrive_client_id: string;
  gdrive_client_secret: string;
  gdrive_refresh_token: string;
};

const EMPTY: Draft = {
  destination: "download",
  schedule: "manual",
  s3_endpoint: "",
  s3_region: "auto",
  s3_bucket: "",
  s3_prefix: "shatta-backups",
  s3_access_key_id: "",
  s3_secret_access_key: "",
  gdrive_folder_id: "",
  gdrive_client_id: "",
  gdrive_client_secret: "",
  gdrive_refresh_token: "",
};

export function BackupTab() {
  const queryClient = useQueryClient();
  const loadSettings = useServerFn(getBackupSettings);
  const save = useServerFn(saveBackupSettings);
  const run = useServerFn(runBackup);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["backup-settings"],
    queryFn: () => loadSettings({ data: undefined as never }),
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["backup-runs"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("backup_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!settings) return;
    setDraft({
      ...EMPTY,
      ...settings,
      s3_secret_access_key: "",
      gdrive_client_secret: "",
      gdrive_refresh_token: "",
    } as Draft);
  }, [settings]);

  const set = (k: keyof Draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: draft });
      await queryClient.invalidateQueries({ queryKey: ["backup-settings"] });
      toast.success("Backup settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onRun() {
    setRunning(true);
    try {
      const res = await run({ data: { destination: draft.destination } });
      if (res.payload) {
        downloadBlob(res.objectKey ?? "shatta-backup.json", res.payload, "application/json");
      }
      await queryClient.invalidateQueries({ queryKey: ["backup-runs"] });
      await queryClient.invalidateQueries({ queryKey: ["backup-settings"] });
      toast.success(
        res.destination === "download" ? "Backup downloaded" : "Backup sent to your cloud",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Destination</Label>
          <Select value={draft.destination} onValueChange={set("destination")}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="download">Download only</SelectItem>
              <SelectItem value="s3">S3-compatible</SelectItem>
              <SelectItem value="gdrive">Google Drive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Schedule</Label>
          <Select value={draft.schedule} onValueChange={set("schedule")}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual only</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {draft.destination === "s3" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            S3-compatible (AWS S3, Cloudflare R2, Backblaze B2)
          </p>
          <Input
            className="h-9"
            placeholder="Endpoint — https://s3.amazonaws.com"
            value={draft.s3_endpoint}
            onChange={(e) => set("s3_endpoint")(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              className="h-9"
              placeholder="Bucket"
              value={draft.s3_bucket}
              onChange={(e) => set("s3_bucket")(e.target.value)}
            />
            <Input
              className="h-9"
              placeholder="Region"
              value={draft.s3_region}
              onChange={(e) => set("s3_region")(e.target.value)}
            />
          </div>
          <Input
            className="h-9"
            placeholder="Folder prefix"
            value={draft.s3_prefix}
            onChange={(e) => set("s3_prefix")(e.target.value)}
          />
          <Input
            className="h-9"
            placeholder="Access key ID"
            value={draft.s3_access_key_id}
            onChange={(e) => set("s3_access_key_id")(e.target.value)}
          />
          <Input
            className="h-9"
            type="password"
            placeholder={settings?.hasS3Secret ? "Secret key (saved — leave blank to keep)" : "Secret access key"}
            value={draft.s3_secret_access_key}
            onChange={(e) => set("s3_secret_access_key")(e.target.value)}
          />
        </div>
      )}

      {draft.destination === "gdrive" && (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Google Drive — paste an OAuth client and refresh token with Drive access
          </p>
          <Input
            className="h-9"
            placeholder="Client ID"
            value={draft.gdrive_client_id}
            onChange={(e) => set("gdrive_client_id")(e.target.value)}
          />
          <Input
            className="h-9"
            type="password"
            placeholder={settings?.hasDriveSecret ? "Client secret (saved)" : "Client secret"}
            value={draft.gdrive_client_secret}
            onChange={(e) => set("gdrive_client_secret")(e.target.value)}
          />
          <Input
            className="h-9"
            type="password"
            placeholder={settings?.hasDriveToken ? "Refresh token (saved)" : "Refresh token"}
            value={draft.gdrive_refresh_token}
            onChange={(e) => set("gdrive_refresh_token")(e.target.value)}
          />
          <Input
            className="h-9"
            placeholder="Folder ID (optional)"
            value={draft.gdrive_folder_id}
            onChange={(e) => set("gdrive_folder_id")(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
          Save settings
        </Button>
        <Button size="sm" className="flex-1" onClick={onRun} disabled={running}>
          {running ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : draft.destination === "download" ? (
            <HardDriveDownload className="mr-1 size-4" />
          ) : (
            <CloudUpload className="mr-1 size-4" />
          )}
          Back up now
        </Button>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">Recent backups</p>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {runs.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">No backups yet</li>
          )}
          {runs.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  r.status === "success" ? "bg-emerald-500" : "bg-destructive"
                }`}
              />
              <span className="truncate">{r.object_key ?? r.error ?? "—"}</span>
              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                {r.destination} · {new Date(r.created_at).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
