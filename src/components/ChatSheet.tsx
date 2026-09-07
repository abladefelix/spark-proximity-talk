import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";


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

  return (
    <ChatSheetContext.Provider value={value}>
      {children}

      {matchId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat"
          className="fixed inset-0 z-[70] flex h-[100dvh] w-screen flex-col overflow-hidden overscroll-none bg-background animate-in fade-in slide-in-from-right-2 duration-200"
          style={{ paddingBottom: keyboard, ["--chat-safe-top" as string]: "var(--safe-top)" } as React.CSSProperties}

        >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
            <ChatPanel key={matchId} matchId={matchId} />
          </div>

        </div>
      )}
    </ChatSheetContext.Provider>
  );
}
