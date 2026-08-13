import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/PersonAvatar";

export const Route = createFileRoute("/_authenticated/chat/$matchId")({
  head: () => ({
    meta: [
      { title: "Chat — SHATTA" },
      { name: "description", content: "Your private SHATTA conversation after a mutual signal." },
      { property: "og:title", content: "SHATTA chat" },
      { property: "og:description", content: "A conversation that started with a signal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

type Message = { id: string; sender_id: string; content: string; created_at: string };

function ChatPage() {
  const { matchId } = Route.useParams();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const { data: other } = useQuery({
    queryKey: ["match-other", matchId, me],
    enabled: Boolean(me),
    queryFn: async () => {
      const { data: match } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .eq("id", matchId)
        .maybeSingle();
      if (!match) return null;
      const otherId = match.user_a === me ? match.user_b : match.user_a;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("id", otherId)
        .maybeSingle();
      return profile;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", matchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        () => queryClient.invalidateQueries({ queryKey: ["messages", matchId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content || !me) return;
    setText("");
    const { error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: me, content });
    if (error) {
      toast.error("Message didn't send");
      setText(content);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <Link to="/chats" className="text-muted-foreground">
          <ChevronLeft className="size-6" />
        </Link>
        <PersonAvatar
          path={other?.avatar_url}
          name={other?.display_name}
          username={other?.username ?? "?"}
          className="size-10 rounded-xl"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">
            {other?.display_name ?? other?.username ?? "Chat"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {other ? `@${other.username}` : ""}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 py-5">
        {messages.length === 0 && (
          <p className="mx-auto max-w-xs rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground">
            You both signalled. Break the ice.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <p
                className={
                  mine
                    ? "max-w-[78%] rounded-3xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                    : "max-w-[78%] rounded-3xl rounded-bl-md bg-card px-4 py-2.5 text-sm text-card-foreground"
                }
              >
                {m.content}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="sticky bottom-20 mx-4 mb-2 flex items-center gap-2 rounded-full border border-border bg-card p-2 shadow-card"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          className="border-0 bg-transparent focus-visible:ring-0"
          maxLength={2000}
        />
        <Button type="submit" variant="heat" size="icon" className="rounded-full">
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
