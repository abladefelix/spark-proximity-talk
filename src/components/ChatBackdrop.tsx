import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { backgroundCss, useChatBackgrounds } from "@/lib/chatBackgrounds";

/** The member's chosen wallpaper, drawn behind the conversation. */
export function ChatBackdrop() {
  const backgrounds = useChatBackgrounds();
  const { data: chosen } = useQuery({
    queryKey: ["my-chat-background"],
    staleTime: 60_000,
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

  const css = backgroundCss(backgrounds.find((b) => b.id === chosen));
  if (!css) return null;

  return (
    // No backdrop-filter: a full-screen blur layer forces a repaint on every
    // scroll frame. A flat wash keeps scrolling smooth.
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-90 dark:opacity-70" style={{ background: css }} />
      <div className="absolute inset-0 bg-background/45 dark:bg-background/60" />
    </div>
  );
}
