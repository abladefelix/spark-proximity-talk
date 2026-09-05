import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Count of chats with an unread reply: the latest message is from the other person. */
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

      const latestByMatch = new Map<string, { sender_id: string }>();
      for (const msg of messages ?? []) {
        if (!latestByMatch.has(msg.match_id)) {
          latestByMatch.set(msg.match_id, msg);
        }
      }

      return matches.filter((m) => latestByMatch.get(m.id)?.sender_id !== me).length;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("chat-notifications-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => queryClient.invalidateQueries({ queryKey: ["chat-notifications-count"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { count, isLoading };
}
