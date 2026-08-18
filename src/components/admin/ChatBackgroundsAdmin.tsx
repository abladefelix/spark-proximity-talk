import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";
import { backgroundCss, useChatBackgrounds, BUILTIN_BACKGROUNDS } from "@/lib/chatBackgrounds";

type Stored = { id: string; name: string; path: string };

/** Supported chat background uploads and hard limits shown to admins. */
export const BG_FORMATS = ["JPG", "JPEG", "PNG", "WEBP"];
export const BG_MAX_SIZE_MB = 5;
export const BG_MAX_SIZE_BYTES = BG_MAX_SIZE_MB * 1024 * 1024;

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function storedList(value: unknown): Stored[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Stored =>
      Boolean(v) && typeof v === "object" && typeof (v as Stored).path === "string",
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
      await supabase.storage.from("chat-backgrounds").remove([item.path]);
      await save({ chat_backgrounds: stored.filter((s) => s.id !== item.id) as never });
      toast.success("Background removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

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
          <p className="mt-0.5">Max file size: {BG_MAX_SIZE_MB}MB · Built-in presets cannot be deleted.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {all
          .filter((b) => b.id !== "none")
          .map((bg) => {
            const css = backgroundCss(bg);
            const isBuiltin = BUILTIN_BACKGROUNDS.some((b) => b.id === bg.id);
            const item = stored.find((s) => s.id === bg.id);
            return (
              <div
                key={bg.id}
                className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border"
                style={css ? { background: css } : undefined}
              >
                {!isBuiltin && item ? (
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

      <Button asChild size="sm" variant="outline" className="mt-3" disabled={busy}>
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
    </section>
  );
}
