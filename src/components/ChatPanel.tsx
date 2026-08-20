import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, ChevronLeft, ImagePlus, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useBillingInfo, useIsPro } from "@/hooks/useBilling";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";
import { useChatSheet } from "@/components/ChatSheet";
import { useProUpgradeSheet } from "@/components/ProUpgradeSheet";
import { sendPushNotification } from "@/lib/push-notifications.functions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ChatSafetyMenu } from "@/components/ChatSafetyMenu";

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
  if (mins < 5) return "Active now";
  if (mins < 60) return `Active ${mins}m ago`;
  if (mins < 1440) return `Active ${Math.round(mins / 60)}h ago`;
  return "Active recently";
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

export function ChatPanel({ matchId, className }: { matchId: string; leading?: React.ReactNode; className?: string }) {
  const queryClient = useQueryClient();
  const { closeChat } = useChatSheet();
  const sendPush = useServerFn(sendPushNotification);
  const { data: billing } = useBillingInfo();
  const isPro = useIsPro();
  const { open: openPro } = useProUpgradeSheet();
  const settings = useSettings();
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  // Only the most recent slice is rendered; older history loads on demand so a
  // long conversation never mounts thousands of nodes at once.
  const PAGE = 40;
  const [limit, setLimit] = useState(PAGE);
  // Signed URLs are expensive to mint, so reuse them across refetches.
  const signedCache = useRef(new Map<string, string>());

  const signImages = useCallback(async (rows: Message[]) => {
    const missing = rows
      .filter((m) => m.kind === "image" && !signedCache.current.has(m.content))
      .map((m) => m.content);
    if (missing.length) {
      const { data: signed } = await supabase.storage
        .from("chat-media")
        .createSignedUrls(missing, 3600);
      for (const item of signed ?? []) {
        if (item.signedUrl) signedCache.current.set(item.path, item.signedUrl);
      }
    }
    return rows.map((m) =>
      m.kind === "image" ? { ...m, mediaUrl: signedCache.current.get(m.content) } : m,
    );
  }, []);

  const { data: page } = useQuery({
    queryKey: ["messages", matchId, limit],
    // Keep the previous window on screen while a bigger page streams in.
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at, kind, lat, lng")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (error) throw error;
      const rows = (data ?? []) as Message[];
      const hasMore = rows.length > limit;
      const window = (hasMore ? rows.slice(0, limit) : rows).reverse();
      return { messages: await signImages(window), hasMore };
    },
  });

  const messages = page?.messages ?? [];
  const hasMore = page?.hasMore ?? false;

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        async (payload) => {
          // Append the single new row instead of refetching the whole thread.
          const row = payload.new as Message;
          const [withMedia] = await signImages([row]);
          queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(
            ["messages", matchId, limit],
            (prev) =>
              !prev || prev.messages.some((m) => m.id === row.id)
                ? prev
                : { ...prev, messages: [...prev.messages, withMedia] },
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, queryClient, limit, signImages]);

  // Always keep the newest message in view.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Grow the composer with its content, capped so the transcript keeps room.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !me) return;
    // Free-tier message cap (admin controlled, skipped for Pro members).
    if (
      billing?.enabled &&
      billing.pro_unlimited_messages &&
      !isPro &&
      billing.free_messages_per_match > 0
    ) {
      const mine = messages.filter((m: any) => m.sender_id === me).length;
      if (mine >= billing.free_messages_per_match) {
        toast.error(
          `Free chats are limited to ${billing.free_messages_per_match} messages. Upgrade to keep chatting.`,
          { action: { label: "Go Pro", onClick: () => openPro() } },
        );
        return;
      }
    }
    setText("");
    const { error } = await supabase.from("messages").insert({ match_id: matchId, sender_id: me, content });
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
    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      setUploading(false);
      toast.error("Picture didn't upload");
      return;
    }
    const { error: messageError } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: me, kind: "image", content: path });
    setUploading(false);
    if (messageError) {
      await supabase.storage.from("chat-media").remove([path]);
      toast.error("Picture didn't send");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["messages", matchId] });
  }

  const name = other?.display_name ?? other?.username ?? "Chat";

  return (
    <div className={className ?? "flex h-full min-h-0 flex-col"}>
      {/* Header */}
      <header
        className="relative z-20 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background/70 px-1.5 pb-2 backdrop-blur-xl"
        style={{ paddingTop: "calc(var(--safe-top) + 0.25rem)" }}
      >
        <button
          type="button"
          onClick={closeChat}
          aria-label="Back"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-primary transition active:scale-90"
        >
          <ChevronLeft className="size-7" strokeWidth={2.5} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <PersonAvatar
            path={other?.avatar_url}
            name={other?.display_name}
            username={other?.username ?? "?"}
            gender={other?.gender as import("@/components/PersonAvatar").Gender}
            className="size-9 rounded-full"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">
              {name}
              {other?.verified && <VerifiedBadge className="size-3.5" />}
            </p>
            <p className="truncate text-[11.5px] leading-tight text-muted-foreground">
              {other ? lastSeenLabel(other.last_seen) : ""}
            </p>
          </div>
        </div>

        <ChatSafetyMenu otherId={other?.id} otherName={name} onBlocked={closeChat} />
      </header>

      {/* Transcript */}
      <div
        ref={scrollRef}
        data-scrollable
        data-selectable
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-3 pt-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="mt-auto" />

        <div className="mb-6 flex flex-col items-center px-8 text-center">
          <PersonAvatar
            path={other?.avatar_url}
            name={other?.display_name}
            username={other?.username ?? "?"}
            gender={other?.gender as import("@/components/PersonAvatar").Gender}
            className="size-16 rounded-full"
          />
          <p className="mt-2.5 text-[15px] font-semibold leading-tight">{other ? name : ""}</p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            You both signalled nearby — this conversation stays between you two.
          </p>
        </div>

        {messages.map((m, index) => {
          const mine = m.sender_id === me;
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const newDay =
            !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
          const grouped =
            !newDay &&
            prev?.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000;
          const lastOfGroup =
            !next ||
            next.sender_id !== m.sender_id ||
            new Date(next.created_at).getTime() - new Date(m.created_at).getTime() >= 5 * 60000;

          const corner = `rounded-[20px] ${lastOfGroup ? (mine ? "rounded-br-[7px]" : "rounded-bl-[7px]") : ""}`;
          const skin = mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground";

          return (
            <div key={m.id} className="shrink-0">
              {newDay && (
                <div className="my-4 flex justify-center">
                  <span className="rounded-full bg-secondary/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}

              <div
                className={`flex ${grouped ? "mt-[3px]" : "mt-2.5"} ${mine ? "justify-end pl-12" : "justify-start pr-12"}`}
              >
                <div className={`flex max-w-full flex-col ${mine ? "items-end" : "items-start"}`}>
                  {m.kind === "image" ? (
                    m.mediaUrl ? (
                      <a
                        href={m.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`block overflow-hidden ${corner} bg-secondary`}
                      >
                        <img src={m.mediaUrl} alt="Shared in chat" className="max-h-72 w-full object-cover" loading="lazy" />
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
                      className={`flex items-center gap-2 px-4 py-2.5 text-[15px] ${corner} ${skin}`}
                    >
                      <MapPin className="size-4" />
                      <span>Meet-up pin</span>
                    </a>
                  ) : (
                    <div className={`px-3.5 py-[7px] ${corner} ${skin}`}>
                      <p className="whitespace-pre-wrap break-words text-[16px] leading-[1.35]">{m.content}</p>
                    </div>
                  )}
                  {lastOfGroup && (
                    <span className="mt-[3px] px-1 text-[10.5px] leading-none text-muted-foreground">
                      {timeLabel(m.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="z-20 flex shrink-0 items-end gap-2 border-t border-border/40 bg-background/70 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
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
        <button
          type="button"
          aria-label="Upload a picture"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-90 disabled:opacity-40"
        >
          {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-[22px]" />}
        </button>

        <div className="flex min-w-0 flex-1 items-end rounded-[20px] bg-secondary px-3.5 py-[7px]">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={settings.chat_prompt_text}
            rows={1}
            maxLength={settings.max_message_len}
            className="max-h-[120px] w-full resize-none border-0 bg-transparent p-0 text-[16px] leading-[1.35] outline-none placeholder:text-muted-foreground/70"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
        </div>

        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          // iOS: the keyboard closing on blur can move the button out from
          // under the finger before "click" fires, so commit on pointer down.
          onPointerDown={(e) => {
            if (!text.trim()) return;
            e.preventDefault();
            void send();
          }}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-90 disabled:opacity-30"
        >
          <ArrowUp className="size-5" strokeWidth={2.5} />
        </button>

      </form>
    </div>
  );
}
