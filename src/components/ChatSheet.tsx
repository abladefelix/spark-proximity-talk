import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
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

/** Clears any body locks vaul/radix may leave behind after a sheet closes. */
function releaseBodyLocks() {
  const body = document.body;
  body.style.removeProperty("pointer-events");
  body.style.removeProperty("overflow");
  body.style.removeProperty("position");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("right");
  body.style.removeProperty("height");
  body.style.removeProperty("touch-action");
  body.removeAttribute("data-scroll-locked");
}

export function ChatSheetProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);

  const openChat = useCallback((id: string) => setMatchId(id), []);
  const closeChat = useCallback(() => setMatchId(null), []);
  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);

  // When the sheet closes, make sure the page underneath is interactive again.
  useEffect(() => {
    if (matchId) return;
    releaseBodyLocks();
    const t = window.setTimeout(releaseBodyLocks, 400);
    return () => window.clearTimeout(t);
  }, [matchId]);

  useEffect(() => releaseBodyLocks, []);

  return (
    <ChatSheetContext.Provider value={value}>
      {children}

      <DrawerPrimitive.Root
        open={Boolean(matchId)}
        onOpenChange={(o) => !o && closeChat()}
        dismissible
        direction="bottom"
        closeThreshold={0.15}
        scrollLockTimeout={100}
        repositionInputs={false}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-colors duration-300" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[min(88dvh,760px)] w-full max-w-lg touch-pan-y flex-col overflow-hidden rounded-t-[2.5rem] border border-border/40 bg-card/80 shadow-sheet backdrop-blur-2xl outline-none dark:bg-card/75 dark:shadow-sheet-dark">
            <DrawerPrimitive.Title className="sr-only">Chat</DrawerPrimitive.Title>
            <DrawerPrimitive.Description className="sr-only">
              Swipe down anywhere to close and pick someone else.
            </DrawerPrimitive.Description>
            <DrawerPrimitive.Handle
              className="flex h-10 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
              aria-label="Swipe down to close chat"
            >
              <span className="h-1.5 w-14 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/50" />
            </DrawerPrimitive.Handle>
            {matchId && (
              <ChatPanel
                key={matchId}
                matchId={matchId}
                className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
              />
            )}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </ChatSheetContext.Provider>
  );
}

