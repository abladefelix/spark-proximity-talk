import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
    // No backdrop-filter here: a full-screen blur layer forces the compositor to
    // repaint the whole chat on every scroll frame. A flat wash is just as soft
    // and keeps scrolling at 60fps.
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.22] dark:opacity-[0.16]" style={{ background: css }} />
      <div className="absolute inset-0 bg-background/70" />
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

/**
 * Keyboard-aware height. iOS shrinks visualViewport when the keyboard opens;
 * we mirror that height so the composer sits right above the keyboard and the
 * header stays pinned instead of scrolling away.
 */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setInset(overlap > 80 ? overlap : 0);
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}

export function ChatSheetProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const pushedRef = useRef(false);
  const keyboard = useKeyboardInset();

  const openChat = useCallback((id: string) => {
    setMatchId(id);
    if (!pushedRef.current) {
      window.history.pushState({ chat: id }, "");
      pushedRef.current = true;
    }
  }, []);

  const closeChat = useCallback(() => {
    setMatchId(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    }
  }, []);

  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);

  useEffect(() => {
    const onPop = () => {
      pushedRef.current = false;
      setMatchId(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Android hardware back closes the chat instead of leaving the app.
  useEffect(() => {
    if (!matchId) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => closeChat());
        if (cancelled) void handle.remove();
        else remove = () => void handle.remove();
      } catch {
        /* not running natively */
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [matchId, closeChat]);

  return (
    <ChatSheetContext.Provider value={value}>
      {children}

      {matchId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat"
          className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-background animate-in fade-in slide-in-from-right-2 duration-200"
          style={{ paddingBottom: keyboard }}
        >
          <ChatBackdrop />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatPanel key={matchId} matchId={matchId} />
          </div>
        </div>
      )}
    </ChatSheetContext.Provider>
  );
}
