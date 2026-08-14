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
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[88dvh] max-h-[760px] min-h-[520px] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border bg-background shadow-2xl outline-none">
            <DrawerPrimitive.Title className="sr-only">Chat</DrawerPrimitive.Title>
            <DrawerPrimitive.Description className="sr-only">
              Swipe down to close and pick someone else.
            </DrawerPrimitive.Description>
            <div className="mx-auto my-2 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
            {matchId && (
              <ChatPanel matchId={matchId} className="flex min-h-0 flex-1 flex-col bg-background" />
            )}
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </ChatSheetContext.Provider>
  );
}
