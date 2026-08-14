import { useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppSettings, useSaveAppSettings } from "@/hooks/useAppSettings";
import { backgroundCss, useChatBackgrounds, BUILTIN_BACKGROUNDS } from "@/lib/chatBackgrounds";

type Stored = { id: string; name: string; path: string };

function storedList(value: unknown): Stored[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Stored =>
      Boolean(v) && typeof v === "object" && typeof (v as Stored).path === "string",
  );
}

/** Admin upload + management of chat sheet backgrounds. */
export function ChatBackgroundsAdmin() {
  const { data: settings } = useAppSettings();
  const save = useSaveAppSettings();
  const all = useChatBackgrounds();
  const [busy, setBusy] = useState(false);

  const stored = storedList((settings as { chat_backgrounds?: unknown } | undefined)?.chat_backgrounds);

  async function onUpload(file: File) {
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const id = crypto.randomUUID();
      const path = `${id}.${ext}`;
      const { error } = await supabase.storage.from("chat-backgrounds").upload(path, file, {
        contentType: file.type,
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
                    onClick={() => remove(item)}
                    aria-label={`Remove ${bg.name}`}
                    className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white"
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
            accept="image/*"
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
