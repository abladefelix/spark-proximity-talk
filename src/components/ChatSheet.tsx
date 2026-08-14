import { createContext, useCallback, useContext, useMemo, useState } from "react";
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

export function ChatSheetProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);

  const openChat = useCallback((id: string) => setMatchId(id), []);
  const closeChat = useCallback(() => setMatchId(null), []);
  const value = useMemo(() => ({ openChat, closeChat }), [openChat, closeChat]);

  return (
    <ChatSheetContext.Provider value={value}>
      {children}

      <DrawerPrimitive.Root
        open={Boolean(matchId)}
        onOpenChange={(o) => !o && closeChat()}
        dismissible
        direction="bottom"
        handleOnly
        closeThreshold={0.25}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[min(88dvh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border bg-background shadow-2xl outline-none">
            <DrawerPrimitive.Title className="sr-only">Chat</DrawerPrimitive.Title>
            <DrawerPrimitive.Description className="sr-only">
              Swipe down to close and pick someone else.
            </DrawerPrimitive.Description>
            <DrawerPrimitive.Handle
              className="flex h-10 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
              aria-label="Swipe down to close chat"
            >
              <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
            </DrawerPrimitive.Handle>
            {matchId && (
              <ChatPanel matchId={matchId} className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background" />
            )}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </ChatSheetContext.Provider>
  );
}
