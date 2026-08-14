import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
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
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-t-[2.5rem]">
      <div className="absolute inset-0 opacity-50 blur-[1px] saturate-90 dark:opacity-40" style={{ background: css }} />
      <div className="absolute inset-0 bg-card/35 backdrop-blur-xl dark:bg-card/40" />
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

/** Clears any body locks vaul/radix may leave behind after a sheet closes. */
function releaseBodyLocks() {
  const body = document.body;
  const html = document.documentElement;
  const appScroll = document.getElementById("app-scroll");

  [body, html, appScroll].forEach((el) => {
    if (!el) return;
    el.style.removeProperty("pointer-events");
    el.style.removeProperty("overflow");
    el.style.removeProperty("position");
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("right");
    el.style.removeProperty("bottom");
    el.style.removeProperty("height");
    el.style.removeProperty("width");
    el.style.removeProperty("touch-action");
    el.removeAttribute("data-scroll-locked");
  });

  // Make sure the fixed root stays fixed.
  html.style.position = "fixed";
  html.style.inset = "0";
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
  html.style.touchAction = "none";
  body.style.position = "fixed";
  body.style.inset = "0";
  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "none";
  body.style.touchAction = "none";
  if (appScroll) {
    appScroll.style.position = "fixed";
    appScroll.style.inset = "0";
    appScroll.style.overflow = "hidden";
    appScroll.style.overscrollBehavior = "none";
    appScroll.style.touchAction = "none";
  }
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
        closeThreshold={0.08}
        scrollLockTimeout={0}
        repositionInputs={false}
        noBodyStyles
        preventScrollRestoration={false}
        disablePreventScroll
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px] transition-colors duration-300" />
          <DrawerPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[min(92dvh,800px)] w-full max-w-lg touch-pan-y flex-col overflow-hidden rounded-t-[2.5rem] border border-border/40 bg-card/40 shadow-sheet outline-none backdrop-blur-3xl dark:bg-card/30 dark:shadow-sheet-dark">
            <ChatBackdrop />
            <div className="relative z-10 flex h-full flex-col overflow-hidden">
              <DrawerPrimitive.Title className="sr-only">Chat</DrawerPrimitive.Title>
              <DrawerPrimitive.Description className="sr-only">
                Swipe down anywhere to close and pick someone else.
              </DrawerPrimitive.Description>

              {/* Full-width drag handle: draggable and clearly indicates the gesture. */}
              <DrawerPrimitive.Handle
                className="flex h-10 w-full shrink-0 touch-none cursor-grab items-center justify-center active:cursor-grabbing"
                aria-label="Swipe down to close chat"
              >
                <span className="h-1.5 w-14 rounded-full bg-muted-foreground/40 transition-colors hover:bg-muted-foreground/60" />
              </DrawerPrimitive.Handle>

              {matchId && (
                <ChatPanel
                  key={matchId}
                  matchId={matchId}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
                />
              )}
            </div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </ChatSheetContext.Provider>
  );
}
