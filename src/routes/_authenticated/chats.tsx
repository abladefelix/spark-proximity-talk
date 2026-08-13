import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PersonAvatar } from "@/components/PersonAvatar";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [
      { title: "Your links — SHATTA chats" },
      {
        name: "description",
        content: "Every mutual signal you've made on SHATTA, and the conversations that followed.",
      },
      { property: "og:title", content: "SHATTA chats" },
      { property: "og:description", content: "Your mutual matches and conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatsPage,
});

type Row = {
  matchId: string;
  other: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  preview: string | null;
  at: string;
};

function ChatsPage() {
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async (): Promise<Row[]> => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return [];
      const { data: matches, error } = await supabase
        .from("matches")
        .select("id, user_a, user_b, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!matches?.length) return [];

      const otherIds = matches.map((m) => (m.user_a === me ? m.user_b : m.user_a));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", otherIds);

      const { data: msgs } = await supabase
        .from("messages")
        .select("match_id, content, created_at")
        .in(
          "match_id",
          matches.map((m) => m.id),
        )
        .order("created_at", { ascending: false });

      return matches.map((m) => {
        const otherId = m.user_a === me ? m.user_b : m.user_a;
        const profile = profiles?.find((p) => p.id === otherId);
        const last = msgs?.find((x) => x.match_id === m.id);
        return {
          matchId: m.id,
          other: profile ?? {
            id: otherId,
            username: "someone",
            display_name: null,
            avatar_url: null,
          },
          preview: last?.content ?? null,
          at: last?.created_at ?? m.created_at,
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () =>
        queryClient.invalidateQueries({ queryKey: ["matches"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        queryClient.invalidateQueries({ queryKey: ["matches"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <main className="px-5 pt-8">
      <h1 className="text-2xl font-semibold">Your links</h1>
      <p className="mt-1 text-sm text-muted-foreground">Mutual signals only. No noise.</p>

      <section className="mt-6 space-y-3">
        {!isLoading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <p className="text-base font-semibold">No links yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Head to the radar and signal someone close by. When they signal back, the chat opens
              here.
            </p>
          </div>
        )}
        {rows.map((row) => (
          <Link
            key={row.matchId}
            to="/chat/$matchId"
            params={{ matchId: row.matchId }}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 transition-colors hover:bg-secondary/60"
          >
            <PersonAvatar
              path={row.other.avatar_url}
              name={row.other.display_name}
              username={row.other.username}
              className="size-14"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {row.other.display_name ?? row.other.username}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {row.preview ?? "You matched. Say something."}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
