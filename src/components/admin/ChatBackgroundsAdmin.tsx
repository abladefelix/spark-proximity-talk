import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";
import { backgroundCss, useChatBackgrounds, NONE_BACKGROUND } from "@/lib/chatBackgrounds";

type Stored = { id: string; name: string; path?: string | undefined; css?: string | undefined };

/** Supported chat background uploads and hard limits shown to admins. */
export const BG_FORMATS = ["JPG", "JPEG", "PNG", "WEBP"];
export const BG_MAX_SIZE_MB = 5;
export const BG_MAX_SIZE_BYTES = BG_MAX_SIZE_MB * 1024 * 1024;

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const DEFAULT_BACKGROUNDS: Stored[] = [
  { id: "dusk", name: "Dusk", css: "linear-gradient(160deg, oklch(0.62 0.17 32), oklch(0.42 0.16 300))" },
  { id: "signal", name: "Signal", css: "radial-gradient(120% 90% at 20% 0%, oklch(0.75 0.15 55), transparent 60%), linear-gradient(200deg, oklch(0.55 0.13 220), oklch(0.30 0.09 265))" },
  { id: "mint", name: "Mint", css: "linear-gradient(150deg, oklch(0.85 0.12 165), oklch(0.62 0.11 205))" },
  { id: "ember", name: "Ember", css: "radial-gradient(100% 80% at 80% 10%, oklch(0.72 0.19 25), transparent 65%), linear-gradient(180deg, oklch(0.35 0.08 20), oklch(0.20 0.04 300))" },
  { id: "grid", name: "Night grid", css: "repeating-linear-gradient(0deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), linear-gradient(160deg, oklch(0.28 0.05 265), oklch(0.18 0.03 280))" },
];

function storedList(value: unknown): Stored[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Stored =>
      Boolean(v) &&
      typeof v === "object" &&
      typeof (v as Stored).id === "string" &&
      typeof (v as Stored).name === "string" &&
      (typeof (v as Stored).path === "string" || typeof (v as Stored).css === "string"),
  );
}

function isSupportedBackground(file: File): boolean {
  if (file.type) return SUPPORTED_MIME_TYPES.includes(file.type);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function bgLimitLabel(): string {
  return `${BG_FORMATS.join(", ")} · max ${BG_MAX_SIZE_MB}MB`;
}

/** Admin upload + management of chat sheet backgrounds. */
export function ChatBackgroundsAdmin() {
  const { data: settings } = useAppSettings();
  const save = useSaveAppSettings();
  const all = useChatBackgrounds();
  const [busy, setBusy] = useState(false);

  const stored = storedList((settings as { chat_backgrounds?: unknown } | undefined)?.chat_backgrounds);

  async function onUpload(file: File) {
    if (!isSupportedBackground(file)) {
      toast.error(`Unsupported format. Accepted: ${BG_FORMATS.join(", ")}`);
      return;
    }
    if (file.size > BG_MAX_SIZE_BYTES) {
      toast.error(`Background must be smaller than ${BG_MAX_SIZE_MB}MB`);
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const id = crypto.randomUUID();
      const path = `${id}.${ext}`;
      const { error } = await supabase.storage.from("chat-backgrounds").upload(path, file, {
        contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Background";
      await save({ chat_backgrounds: [...stored, { id, name, path }] as never });
      toast.success("Background added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Stored) {
    setBusy(true);
    try {
      if (item.path) {
        await supabase.storage.from("chat-backgrounds").remove([item.path]);
      }
      await save({ chat_backgrounds: stored.filter((s) => s.id !== item.id) as never });
      toast.success("Background removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefaults() {
    setBusy(true);
    try {
      const existing = new Map(stored.map((s) => [s.id, s]));
      const restored = [...DEFAULT_BACKGROUNDS];
      for (const item of restored) {
        if (!existing.has(item.id)) {
          existing.set(item.id, item);
        }
      }
      await save({ chat_backgrounds: Array.from(existing.values()) as never });
      toast.success("Default backgrounds restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  }

  const missingDefaults = DEFAULT_BACKGROUNDS.some((d) => !stored.some((s) => s.id === d.id));

  return (
    <section className="rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">Chat backgrounds</h3>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Members pick one in their profile. Backgrounds show washed out behind messages.
      </p>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="text-[11px] leading-4 text-muted-foreground">
          <p className="font-medium text-foreground">Accepted formats</p>
          <p>{BG_FORMATS.join(", ")}</p>
          <p className="mt-0.5">Max file size: {BG_MAX_SIZE_MB}MB · Built-in presets can now be removed or restored.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {all
          .filter((b) => b.id !== NONE_BACKGROUND.id)
          .map((bg) => {
            const css = backgroundCss(bg);
            const item = stored.find((s) => s.id === bg.id) ?? { id: bg.id, name: bg.name, css: bg.css, path: bg.path };
            const isNone = bg.id === NONE_BACKGROUND.id;
            return (
              <div
                key={bg.id}
                className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border"
                style={css ? { background: css } : undefined}
              >
                {!isNone ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(item)}
                    aria-label={`Remove ${bg.name}`}
                    className="absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-full bg-destructive text-white shadow-sm"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-1 text-[10px] text-white">
                  {bg.name}
                </span>
              </div>
            );
          })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" disabled={busy}>
          <label className="cursor-pointer">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            Upload background
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(file);
              }}
            />
          </label>
        </Button>
        {missingDefaults ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void restoreDefaults()}>
            <RotateCcw className="mr-1 size-3.5" /> Restore defaults
          </Button>
        ) : null}
      </div>
    </section>
  );
}
