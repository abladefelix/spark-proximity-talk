import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageCircle, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useChatSheet } from "@/components/ChatSheet";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useChatRetention, DEFAULT_CHAT_TTL_DAYS } from "@/hooks/useChatTtl";

type Row = {
  matchId: string;
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: "male" | "female" | "other" | null;
  preview: string | null;
  lastAt: number;
};

export function ActiveChats() {
  const queryClient = useQueryClient();
  const { openChat } = useChatSheet();
  const [expanded, setExpanded] = useState(false);
  const { data: retention } = useChatRetention();

  const { data: allRows = [] } = useQuery({
    queryKey: ["active-chats"],
    refetchInterval: 15000,
    queryFn: async (): Promise<Row[]> => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return [];
      const { data: matches } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
        // Staff accounts can read every match, so scope this to my own conversations.
        .or(`user_a.eq.${me},user_b.eq.${me}`)
        .order("created_at", { ascending: false });
      if (!matches?.length) return [];

      const otherIds = matches.map((m) => (m.user_a === me ? m.user_b : m.user_a));
      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url, gender")
          .in("id", otherIds),
        supabase
          .from("messages")
          .select("match_id, content, created_at, kind")
          .in(
            "match_id",
            matches.map((m) => m.id),
          )
          .order("created_at", { ascending: false }),
      ]);

      return matches
        .map((m) => {
          const otherId = m.user_a === me ? m.user_b : m.user_a;
          const p = profiles?.find((x) => x.id === otherId);
          const last = msgs?.find((x) => x.match_id === m.id);
          return {
            matchId: m.id,
            id: otherId,
            username: p?.username ?? "someone",
            display_name: p?.display_name ?? null,
            avatar_url: p?.avatar_url ?? null,
            gender: (p?.gender ?? null) as Row["gender"],
            preview: last ? (last.kind === "image" ? "📷 Photo" : last.kind === "pin" ? "📍 Meet-up pin" : last.content) : null,
            lastAt: new Date(last?.created_at ?? m.created_at).getTime(),
          };
        })
        .sort((a, b) => b.lastAt - a.lastAt);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("radar-active-chats")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () =>
        queryClient.invalidateQueries({ queryKey: ["active-chats"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["active-chats"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const days = retention?.effectiveDays ?? DEFAULT_CHAT_TTL_DAYS;
  const cutoff = days > 0 ? Date.now() - days * 86400000 : 0;
  const rows = allRows.filter((r) => r.lastAt >= cutoff);

  const latest = rows[0];
  if (!latest) return null;

  const behind = Math.min(rows.length - 1, 2);

  async function removeChat(matchId: string) {
    const { error } = await supabase.from("matches").delete().eq("id", matchId);
    if (error) {
      toast.error("Could not remove chat");
      return;
    }
    toast.success("Chat removed");
    queryClient.invalidateQueries({ queryKey: ["active-chats"] });
  }

  async function clearAll() {
    const ids = rows.map((r) => r.matchId);
    if (!ids.length) return;
    const { error } = await supabase.from("matches").delete().in("id", ids);
    if (error) {
      toast.error("Could not clear chats");
      return;
    }
    setExpanded(false);
    toast.success("All chats cleared");
    queryClient.invalidateQueries({ queryKey: ["active-chats"] });
  }

  return (
    <div className="relative z-10 mt-4">
      {/* Stacked deck: peeking cards behind the top card */}
      <div className={`relative isolate ${!expanded && behind === 2 ? "pb-4" : !expanded && behind === 1 ? "pb-2" : ""}`}>
        {!expanded &&
          Array.from({ length: behind }).map((_, i) => {
            const depth = i + 1; // 1 = closest behind
            return (
              <div
                key={`peek-${i}`}
                aria-hidden
                className="pointer-events-none absolute inset-x-2 top-0 h-[60px] rounded-2xl border border-border bg-card shadow-sm"
                style={{
                  transform: `translateY(${depth * 8}px) scale(${1 - depth * 0.025})`,
                  opacity: 1 - depth * 0.22,
                  zIndex: 1,
                }}
              />
            );
          })}

        <div className="relative z-[2] overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-md">
          <div className="flex items-center">
          <button
            type="button"
            onClick={() => (rows.length > 1 ? setExpanded((v) => !v) : openChat(latest.matchId))}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
          >
            <PersonAvatar
              path={latest.avatar_url}
              name={latest.display_name}
              username={latest.username}
              gender={latest.gender}
              className="size-9 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {latest.display_name ?? latest.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {latest.preview ?? "Chat unlocked — say hello"}
              </p>
            </div>
            {rows.length > 1 ? (
              <>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {rows.length}
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </>
            ) : (
              <MessageCircle className="size-4 shrink-0 text-primary" />
            )}
          </button>
          <button
            type="button"
            aria-label="Remove chat"
            onClick={() => removeChat(latest.matchId)}
            className="mr-2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          </div>

          {expanded && (
            <div className="max-h-64 space-y-1 overflow-y-auto border-t border-border/60 p-1.5">
              {rows.map((row) => (
                <div
                  key={row.matchId}
                  className="flex w-full items-center gap-1 rounded-xl transition-colors hover:bg-secondary/60"
                >
                <button
                  type="button"
                  onClick={() => openChat(row.matchId)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left"
                >
                  <PersonAvatar
                    path={row.avatar_url}
                    name={row.display_name}
                    username={row.username}
                    gender={row.gender}
                    className="size-9 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.display_name ?? row.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.preview ?? "Chat unlocked — say hello"}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                    <MessageCircle className="size-3.5" />
                    Open
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove chat with ${row.display_name ?? row.username}`}
                  onClick={() => removeChat(row.matchId)}
                  className="mr-1.5 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
                </div>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
                Clear all chats
              </button>
              {/* Set expectations: these links do not stick around forever. */}
              <p className="px-2 pb-1 pt-0.5 text-center text-[10px] leading-snug text-muted-foreground">
                Chats vanish after {days} {days === 1 ? "day" : "days"}
                {retention && !retention.isPro && retention.proDays > retention.freeDays
                  ? ` — Pro keeps them ${retention.proDays} days.`
                  : "."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



