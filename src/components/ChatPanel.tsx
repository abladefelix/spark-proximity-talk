import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ImagePlus, LoaderCircle, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";
import { useChatSheet } from "@/components/ChatSheet";
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
  if (mins < 5) return "active now";
  if (mins < 60) return `active ${mins}m ago`;
  if (mins < 1440) return `active ${Math.round(mins / 60)}h ago`;
  return "active recently";
}

export function ChatPanel({
  matchId,
  className,
}: {
  matchId: string;
  /** Optional element rendered before the avatar in the header (back arrow, grabber, etc.). */
  leading?: React.ReactNode;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const { closeChat } = useChatSheet();
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
        .select("id, username, display_name, avatar_url, bio, verified, last_seen, gender")
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

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
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

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const timeLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <div className={className ?? "flex h-full min-h-0 flex-col bg-transparent"}>
      <header
        className="flex shrink-0 items-center gap-1 border-b border-border/40 bg-background/85 px-1.5 pb-2 backdrop-blur-2xl"
        style={{ paddingTop: "calc(var(--safe-top) + 0.25rem)" }}
      >
        <button
          type="button"
          onClick={closeChat}
          className="-mr-0.5 flex size-11 shrink-0 items-center justify-center rounded-full text-foreground transition-transform active:scale-90 active:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft className="size-7" strokeWidth={2.25} />
        </button>

        <PersonAvatar
          path={other?.avatar_url}
          name={other?.display_name}
          username={other?.username ?? "?"}
          gender={other?.gender as import("@/components/PersonAvatar").Gender}
          className="size-10 rounded-full"
        />
        <div className="min-w-0 flex-1 pl-0.5">
          <p className="flex items-center gap-1 truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">
            {other?.display_name ?? other?.username ?? "Chat"}
            {other?.verified && <VerifiedBadge className="size-3.5" />}
          </p>
          <p className="truncate text-[12px] leading-tight text-muted-foreground">
            {other ? lastSeenLabel(other.last_seen) : ""}
          </p>
        </div>
      </header>

      <div
        ref={messagesRef}
        data-scrollable
        data-selectable
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-transparent px-3 pb-3 pt-4"
      >
        <div className="mt-auto" />
        <div className="mb-4 flex flex-col items-center px-6 text-center">
          <PersonAvatar
            path={other?.avatar_url}
            name={other?.display_name}
            username={other?.username ?? "?"}
            gender={other?.gender as import("@/components/PersonAvatar").Gender}
            className="size-20 rounded-full ring-1 ring-border/50"
          />
          <p className="mt-3 text-[15px] font-semibold leading-tight">
            {other?.display_name ?? other?.username ?? ""}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            You both signalled nearby. Messages here stay between the two of you.
          </p>
        </div>

        {messages.map((m, index) => {
          const mine = m.sender_id === me;
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const newDay =
            !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const grouped =
            !newDay && prev?.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
          const lastOfGroup =
            !next ||
            next.sender_id !== m.sender_id ||
            new Date(next.created_at).getTime() - new Date(m.created_at).getTime() >= 5 * 60000;

          const corner = mine
            ? `rounded-[20px] ${lastOfGroup ? "rounded-br-[6px]" : ""}`
            : `rounded-[20px] ${lastOfGroup ? "rounded-bl-[6px]" : ""}`;
          const skin = mine
            ? "bg-primary text-primary-foreground"
            : "border border-border/40 bg-card/85 text-foreground backdrop-blur-xl";

          return (
            <div key={m.id} className="shrink-0">
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-secondary/80 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}

              <div
                className={`flex items-end gap-1.5 ${grouped ? "mt-0.5" : "mt-3"} ${mine ? "justify-end" : "justify-start"}`}
              >
                {!mine && (
                  <div className="size-7 shrink-0">
                    {lastOfGroup && (
                      <PersonAvatar
                        path={other?.avatar_url}
                        name={other?.display_name}
                        username={other?.username ?? "?"}
                        gender={other?.gender as import("@/components/PersonAvatar").Gender}
                        className="size-7 rounded-full"
                      />
                    )}
                  </div>
                )}

                <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  {m.kind === "image" ? (
                    m.mediaUrl ? (
                      <a
                        href={m.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`relative block overflow-hidden ${corner} bg-secondary`}
                      >
                        <img
                          src={m.mediaUrl}
                          alt="Shared in chat"
                          className="max-h-72 w-full object-cover"
                          loading="lazy"
                        />
                        <span className="absolute bottom-1.5 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
                          {timeLabel(m.created_at)}
                        </span>
                      </a>
                    ) : (
                      <div className={`flex h-36 w-52 items-center justify-center ${corner} bg-secondary text-xs text-muted-foreground`}>
                        Picture unavailable
                      </div>
                    )
                  ) : m.kind === "pin" && m.lat != null && m.lng != null ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center gap-2 px-3.5 py-2.5 text-[15px] ${corner} ${skin}`}
                    >
                      <MapPin className="size-4" />
                      <span>Meet-up pin</span>
                      <span className={`text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        {timeLabel(m.created_at)}
                      </span>
                    </a>
                  ) : (
                    <div className={`px-3.5 py-2 ${corner} ${skin}`}>
                      <p className="whitespace-pre-wrap break-words text-[15.5px] leading-[1.35]">
                        {m.content}
                        <span className="pointer-events-none ml-2 inline-block w-9 select-none align-baseline" />
                      </p>
                      <span
                        className={`-mt-3 block text-right text-[10.5px] leading-none ${
                          mine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                      >
                        {timeLabel(m.created_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        data-vaul-no-drag
        className="z-10 flex shrink-0 items-end gap-2 border-t border-border/30 bg-card/50 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl"
      >
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
          {uploading ? <LoaderCircle className="animate-spin" /> : <ImagePlus className="size-[22px]" />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={settings.chat_prompt_text}
          className="min-h-[40px] max-h-[132px] min-w-0 flex-1 resize-none rounded-[20px] border border-border/50 bg-background/70 px-4 py-2 text-[15.5px] leading-snug shadow-none backdrop-blur-xl placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
          rows={1}
          maxLength={settings.max_message_len}
          onFocus={() => {
            window.setTimeout(() => {
              messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
            }, 250);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="submit"
          variant="heat"
          size="icon"
          disabled={!text.trim()}
          className="size-10 shrink-0 rounded-full transition-transform active:scale-95 disabled:opacity-40"
        >
          <Send className="size-[18px]" />
        </Button>
      </form>
    </div>
  );
}

