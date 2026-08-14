import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useChatBackgrounds, backgroundCss } from "@/lib/chatBackgrounds";

/** Lets a member pick the wallpaper shown behind their chats. */
export function ChatBackgroundSetting() {
  const backgrounds = useChatBackgrounds();
  const queryClient = useQueryClient();

  const { data: current } = useQuery({
    queryKey: ["my-chat-background"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return "none";
      const { data } = await supabase
        .from("profiles")
        .select("chat_background")
        .eq("id", auth.user.id)
        .maybeSingle();
      return data?.chat_background ?? "none";
    },
  });

  async function choose(id: string) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ chat_background: id })
      .eq("id", auth.user.id);
    if (error) {
      toast.error("Could not save background");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-chat-background"] });
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <ImageIcon className="size-4 text-primary" /> Chat background
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Shown softly behind your messages so text stays easy to read.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {backgrounds.map((bg) => {
          const selected = (current ?? "none") === bg.id;
          const css = backgroundCss(bg);
          return (
            <button
              key={bg.id}
              type="button"
              onClick={() => choose(bg.id)}
              aria-pressed={selected}
              className={`relative aspect-[3/4] overflow-hidden rounded-xl border transition ${
                selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
              }`}
              style={css ? { background: css } : undefined}
            >
              {!css && (
                <span className="absolute inset-0 grid place-items-center bg-muted text-[10px] text-muted-foreground">
                  None
                </span>
              )}
              {selected && (
                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1.5 py-1 text-[10px] font-medium text-white">
                {bg.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
