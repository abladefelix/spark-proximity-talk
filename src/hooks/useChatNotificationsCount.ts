import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CHAT_READS_EVENT, getChatReads } from "@/lib/chat-reads";

/** Count of chats with an unread reply the user hasn't opened yet. */
export function useChatNotificationsCount() {
  const queryClient = useQueryClient();

  const { data: count = 0, isLoading } = useQuery({
    queryKey: ["chat-notifications-count"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<number> => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (!me) return 0;

      const { data: matches, error: matchesError } = await supabase
        .from("matches")
        .select("id, user_a, user_b")
        .or(`user_a.eq.${me},user_b.eq.${me}`);
      if (matchesError || !matches?.length) return 0;

      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("match_id, sender_id, created_at")
        .in(
          "match_id",
          matches.map((m) => m.id),
        )
        .order("created_at", { ascending: false });
      if (messagesError) return 0;

      const latestByMatch = new Map<string, { sender_id: string; created_at: string }>();
      for (const msg of messages ?? []) {
        if (!latestByMatch.has(msg.match_id)) {
          latestByMatch.set(msg.match_id, msg);
        }
      }

      const reads = getChatReads();
      return matches.filter((m) => {
        const last = latestByMatch.get(m.id);
        if (!last || last.sender_id === me) return false;
        const seenAt = reads[m.id];
        return !seenAt || new Date(seenAt).getTime() < new Date(last.created_at).getTime();
      }).length;
    },
  });

  useEffect(() => {
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["chat-notifications-count"] });
    const channel = supabase
      .channel("chat-notifications-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        invalidate,
      )
      .subscribe();
    window.addEventListener(CHAT_READS_EVENT, invalidate);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener(CHAT_READS_EVENT, invalidate);
    };
  }, [queryClient]);

  return { count, isLoading };
}

