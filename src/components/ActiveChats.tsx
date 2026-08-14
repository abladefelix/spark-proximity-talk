import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { useChatSheet } from "@/components/ChatSheet";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/PersonAvatar";

type Row = {
  matchId: string;
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: "male" | "female" | "other" | null;
  preview: string | null;
};

export function ActiveChats() {
  const queryClient = useQueryClient();
  const { openChat } = useChatSheet();

  const { data: rows = [] } = useQuery({
    queryKey: ["active-chats"],
    refetchInterval: 15000,
    queryFn: async (): Promise<Row[]> => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return [];
      const { data: matches } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
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
          .select("match_id, content, created_at")
          .in(
            "match_id",
            matches.map((m) => m.id),
          )
          .order("created_at", { ascending: false }),
      ]);

      return matches.map((m) => {
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
          preview: last?.content ?? null,
        };
      });
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

  if (rows.length === 0) return null;

  const collapsible = rows.length > 2;
  const shown = collapsible && !open ? [] : rows;

  return (
    <div className="mt-4 rounded-2xl border border-primary/30 bg-card/60">
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        >
          <div className="flex -space-x-3">
            {rows.slice(0, 4).map((row) => (
              <PersonAvatar
                key={row.matchId}
                path={row.avatar_url}
                name={row.display_name}
                username={row.username}
                gender={row.gender}
                className="size-8 shrink-0 ring-2 ring-card"
              />
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{rows.length} chats unlocked</p>
            <p className="truncate text-xs text-muted-foreground">
              {open ? "Tap to collapse" : "Tap to see everyone"}
            </p>
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}

      <div
        className={
          collapsible && open
            ? "max-h-64 space-y-1 overflow-y-auto border-t border-border/60 p-1.5"
            : "space-y-1 p-1.5"
        }
      >
        {shown.map((row) => (
          <button
            key={row.matchId}
            type="button"
            onClick={() => openChat(row.matchId)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-secondary/60"
          >
            <PersonAvatar
              path={row.avatar_url}
              name={row.display_name}
              username={row.username}
              gender={row.gender}
              className="size-9 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.display_name ?? row.username}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.preview ?? "Chat unlocked — say hello"}
              </p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
              <MessageCircle className="size-3.5" />
              Open
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
