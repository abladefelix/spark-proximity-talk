import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatPanel } from "@/components/ChatPanel";
import { supabase } from "@/integrations/supabase/client";
import { backgroundCss, useChatBackgrounds } from "@/lib/chatBackgrounds";

/** Washed-out wallpaper behind the chat, chosen by the member in their profile. */
function ChatBackdrop() {
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
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-60 saturate-90 dark:opacity-50" style={{ background: css }} />
      <div className="absolute inset-0 bg-background/70 backdrop-blur-2xl dark:bg-background/70" />
    </div>
  );
}

type ChatSheetContextValue = {
  openChat: (matchId: string) => void;
  closeChat: () => void;
};

const ChatSheetContext = createContext<ChatSheetContextValue | null>(null);

export function useChatSheet() {
  const ctx = useContext(ChatSheetContext);
  if (!ctx) throw new Error("useChatSheet must be used inside ChatSheetProvider");
  return ctx;
}

export function ChatSheetProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const pushedRef = useRef(false);

  const openChat = useCallback((id: string) => setMatchId(id), []);
  const closeChat = useCallback(() => {
    setMatchId(null);
    // Drop the history entry we added so the next back press behaves normally.
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
  }, []);
  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);

  // Hardware/browser back closes the chat instead of leaving the app.
  useEffect(() => {
    if (!matchId) return;
    const onPop = () => {
      pushedRef.current = false;
      setMatchId(null);
    };
    window.history.pushState({ chat: matchId }, "");
    pushedRef.current = true;
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [matchId]);

  return (
    <ChatSheetContext.Provider value={value}>
      {children}

      {matchId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background animate-in fade-in slide-in-from-right-4 duration-200"
        >
          <ChatBackdrop />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatPanel
              key={matchId}
              matchId={matchId}
              className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
            />
          </div>
        </div>
      )}
    </ChatSheetContext.Provider>
  );
}

