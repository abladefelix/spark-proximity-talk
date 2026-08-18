import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Loader2, Music, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";
import { BUILTIN_TONES, playRadarTone, useRadarTones } from "@/lib/radarTones";

type Stored = { id: string; name: string; path: string };

/** Supported tone uploads and the hard limits shown to admins. */
export const TONE_FORMATS = ["MP3", "WAV", "OGG", "AAC", "M4A", "FLAC"];
export const TONE_MAX_SIZE_MB = 5;
export const TONE_MAX_SIZE_BYTES = TONE_MAX_SIZE_MB * 1024 * 1024;

const SUPPORTED_MIME_PREFIXES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
  "audio/x-flac",
];

function storedList(value: unknown): Stored[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Stored =>
      Boolean(v) && typeof v === "object" && typeof (v as Stored).path === "string",
  );
}

function isSupportedTone(file: File): boolean {
  if (file.type) return SUPPORTED_MIME_PREFIXES.some((p) => file.type.startsWith(p) || file.type === p);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["mp3", "wav", "ogg", "aac", "m4a", "flac"].includes(ext);
}

function formatLimitLabel(): string {
  return `${TONE_FORMATS.join(", ")} · max ${TONE_MAX_SIZE_MB}MB`;
}

/** Admin upload + management of radar alert tones. */
export function RadarTonesAdmin() {
  const { data: settings } = useAppSettings();
  const save = useSaveAppSettings();
  const all = useRadarTones();
  const [busy, setBusy] = useState(false);

  const stored = storedList((settings as { radar_tones?: unknown } | undefined)?.radar_tones);

  async function onUpload(file: File) {
    if (!isSupportedTone(file)) {
      toast.error(`Unsupported format. Accepted: ${TONE_FORMATS.join(", ")}`);
      return;
    }
    if (file.size > TONE_MAX_SIZE_BYTES) {
      toast.error(`Tone must be smaller than ${TONE_MAX_SIZE_MB}MB`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
      const id = crypto.randomUUID();
      const path = `${id}.${ext}`;
      const { error } = await supabase.storage.from("radar-tones").upload(path, file, {
        contentType: file.type || "audio/mpeg",
      });
      if (error) throw error;
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Tone";
      await save({ radar_tones: [...stored, { id, name, path }] as never });
      toast.success("Tone added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Stored) {
    setBusy(true);
    try {
      await supabase.storage.from("radar-tones").remove([item.path]);
      await save({ radar_tones: stored.filter((s) => s.id !== item.id) as never });
      toast.success("Tone removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">Radar tones</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Members pick one in their profile; it plays when new people appear on the radar.
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="text-[11px] leading-4 text-muted-foreground">
          <p className="font-medium text-foreground">Accepted formats</p>
          <p>{TONE_FORMATS.join(", ")}</p>
          <p className="mt-0.5">Max file size: {TONE_MAX_SIZE_MB}MB · Short clips work best (1–3 seconds).</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {all.map((tone) => {
          const isBuiltin = BUILTIN_TONES.some((b) => b.id === tone.id);
          const item = stored.find((s) => s.id === tone.id);
          return (
            <div
              key={tone.id}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <Music className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">{tone.name}</span>
              <span className="text-[10px] uppercase text-muted-foreground">
                {isBuiltin ? "Built-in" : "Upload"}
              </span>
              <button
                type="button"
                aria-label={`Preview ${tone.name}`}
                onClick={() => playRadarTone(tone)}
                className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
              >
                <Play className="size-3" />
              </button>
              {!isBuiltin && item ? (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${tone.name}`}
                  onClick={() => void remove(item)}
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-destructive"
                >
                  <Trash2 className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button asChild size="sm" variant="outline" className="mt-3" disabled={busy}>
        <label className="cursor-pointer">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Music className="size-3.5" />}
          Upload tone
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,audio/flac"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onUpload(file);
            }}
          />
        </label>
      </Button>
    </section>
  );
}
