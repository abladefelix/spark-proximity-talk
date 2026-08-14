import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, LoaderCircle, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";
import { sendPushNotification } from "@/lib/push-notifications.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";


type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  kind: "text" | "pin" | "image";
  lat: number | null;
  lng: number | null;
  mediaUrl?: string;
};

function lastSeenLabel(iso: string | null | undefined) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 5) return " · active now";
  if (mins < 60) return ` · active ${mins}m ago`;
  if (mins < 1440) return ` · active ${Math.round(mins / 60)}h ago`;
  return "";
}

export function ChatPanel({
  matchId,
  leading,
  className,
}: {
  matchId: string;
  /** Optional element rendered before the avatar in the header (back arrow, grabber, etc.). */
  leading?: React.ReactNode;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const sendPush = useServerFn(sendPushNotification);
  const settings = useSettings();
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);


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
      const rows = (data ?? []) as Message[];
      const imagePaths = rows.filter((message) => message.kind === "image").map((message) => message.content);
      if (!imagePaths.length) return rows;
      const { data: signed } = await supabase.storage.from("chat-media").createSignedUrls(imagePaths, 3600);
      const urls = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
      return rows.map((message) =>
        message.kind === "image" ? { ...message, mediaUrl: urls.get(message.content) } : message,
      );
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
    const messageList = messagesRef.current;
    if (!messageList) return;
    messageList.scrollTo({ top: messageList.scrollHeight, behavior: "smooth" });
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
    if (other?.id) {
      sendPush({
        data: {
          kind: "message",
          recipientId: other.id,
          title: other.display_name ?? other.username ?? "New message",
          body: content,
          relatedId: matchId,

        },
      }).catch(() => {
        /* push failure is non-fatal */
      });
    }
  }


  async function uploadPicture(file: File) {
    if (!me) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Pictures must be under 10 MB");
      return;
    }

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${matchId}/${me}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("chat-media").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setUploading(false);
      toast.error("Picture didn't upload");
      return;
    }
    const { error: messageError } = await supabase.from("messages").insert({
      match_id: matchId,
      sender_id: me,
      kind: "image",
      content: path,
    });
    setUploading(false);
    if (messageError) {
      await supabase.storage.from("chat-media").remove([path]);
      toast.error("Picture didn't send");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
  }

  const firstAt = messages[0]?.created_at;

  return (
    <div className={className ?? "flex min-h-screen min-w-0 flex-col bg-background"}>
      <header className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-2">
        {leading}
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

      <div ref={messagesRef} data-vaul-no-drag className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-t-[2rem] bg-card px-4 pb-5 pt-6">
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
              {m.kind === "image" ? (
                m.mediaUrl ? (
                  <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="block max-w-[78%] overflow-hidden rounded-2xl bg-secondary">
                    <img src={m.mediaUrl} alt="Shared in chat" className="max-h-80 w-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <div className="flex h-40 w-56 max-w-[78%] items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                    Picture unavailable
                  </div>
                )
              ) : m.kind === "pin" && m.lat != null && m.lng != null ? (
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
        className="z-10 mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] mt-2 shrink-0 rounded-[26px] border border-border/60 bg-card p-2 shadow-card"
      >
        <div className="flex items-end gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadPicture(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full text-muted-foreground"
            aria-label="Upload a picture"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus />}
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={settings.chat_prompt_text}
            className="min-h-[44px] max-h-[160px] flex-1 resize-none border-0 bg-transparent py-3.5 text-[15px] leading-snug placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={1}
            maxLength={settings.max_message_len}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
          />
          <Button
            type="submit"
            variant="heat"
            size="icon"
            disabled={!text.trim()}
            className="size-10 shrink-0 rounded-full"
          >
            <Send className="size-[18px]" />
          </Button>
        </div>
      </form>
    </div>
  );
}
