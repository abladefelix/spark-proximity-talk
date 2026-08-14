import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MapPin, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";

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

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  kind: "text" | "pin";
  lat: number | null;
  lng: number | null;
};

function lastSeenLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 5) return " · active now";
  if (mins < 60) return ` · active ${mins}m ago`;
  if (mins < 1440) return ` · active ${Math.round(mins / 60)}h ago`;
  return "";
}

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
        .select("id, username, display_name, avatar_url, bio, verified, last_seen")
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
        .select("id, sender_id, content, created_at, kind, lat, lng")
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

  const [pinning, setPinning] = useState(false);

  function sharePin() {
    if (!me) return;
    if (!("geolocation" in navigator)) {
      toast.error("This device can't share location");
      return;
    }
    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.from("messages").insert({
          match_id: matchId,
          sender_id: me,
          kind: "pin",
          content: "Meet me here",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setPinning(false);
        if (error) {
          toast.error("Couldn't drop the pin");
          return;
        }
        queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
      },
      () => {
        setPinning(false);
        toast.error("Location permission is off");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const firstAt = messages[0]?.created_at;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-background px-4 pb-5 pt-3">
        <Link to="/chats" className="text-muted-foreground">
          <ChevronLeft className="size-6" />
        </Link>
        <PersonAvatar
          path={other?.avatar_url}
          name={other?.display_name}
          username={other?.username ?? "?"}
          className="size-11 rounded-2xl"
        />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-lg font-semibold leading-tight">
            {other?.display_name ?? other?.username ?? "Chat"}
            {other?.verified && <VerifiedBadge />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {other ? `@${other.username}${lastSeenLabel(other.last_seen)}` : ""}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 rounded-t-[2rem] bg-card px-4 pb-6 pt-8">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center -space-x-3">
            <PersonAvatar
              path={other?.avatar_url}
              name={other?.display_name}
              username={other?.username ?? "?"}
              className="size-14 rounded-2xl ring-2 ring-card"
            />
          </div>
          <p className="mt-3 text-base font-semibold leading-snug">
            You both signalled.
            <span className="block">You were metres apart.</span>
          </p>
          {firstAt && (
            <p className="mt-4 text-right text-xs text-muted-foreground">
              {new Date(firstAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>

        {messages.map((m) => {
          const mine = m.sender_id === me;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              {m.kind === "pin" && m.lat != null && m.lng != null ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    mine
                      ? "flex max-w-[78%] items-center gap-2 rounded-3xl bg-secondary px-5 py-3 text-sm text-secondary-foreground"
                      : "flex max-w-[78%] items-center gap-2 rounded-3xl bg-primary/15 px-5 py-3 text-sm text-foreground"
                  }
                >
                  <MapPin className="size-4 text-primary" />
                  <span>
                    Meet-up pin
                    <span className="block text-xs text-muted-foreground">Tap to open map</span>
                  </span>
                </a>
              ) : (
                <p
                  className={
                    mine
                      ? "max-w-[78%] rounded-3xl bg-secondary px-5 py-3 text-[15px] leading-snug text-secondary-foreground"
                      : "max-w-[78%] rounded-3xl bg-primary/15 px-5 py-3 text-[15px] leading-snug text-foreground"
                  }
                >
                  {m.content}
                </p>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>


      <form
        onSubmit={send}
        className="sticky bottom-20 mx-4 mb-2 flex items-center gap-2 rounded-full border border-border bg-card p-2"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full text-muted-foreground"
          aria-label="Share a meet-up pin"
          disabled={pinning}
          onClick={sharePin}
        >
          <MapPin className="size-4" />
        </Button>
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
