import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, ChevronLeft, ImagePlus, LoaderCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useBillingInfo, useIsPro } from "@/hooks/useBilling";
import { useFeatureAccess, FEATURE } from "@/hooks/useProFeatures";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";
import { useChatSheet } from "@/components/ChatSheet";
import { useProUpgradeSheet } from "@/components/ProUpgradeSheet";
import { sendPushNotification } from "@/lib/push-notifications.functions";
import { PersonAvatar } from "@/components/PersonAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ChatSafetyMenu } from "@/components/ChatSafetyMenu";
import { useChatRetention, DEFAULT_CHAT_TTL_DAYS } from "@/hooks/useChatTtl";
import { TranscriptSkeleton } from "@/components/Skeletons";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  kind: "text" | "pin" | "image";
  lat: number | null;
  lng: number | null;
  mediaUrl?: string;
  /** True while the row is still on its way to the server. */
  pending?: boolean;
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

type BubbleProps = {
  m: Message;
  mine: boolean;
  newDay: boolean;
  grouped: boolean;
  lastOfGroup: boolean;
};

/** Memoized so a new message never re-renders the whole transcript. */
const Bubble = memo(function Bubble({ m, mine, newDay, grouped }: BubbleProps) {
  // WhatsApp-style geometry: small 8px radius, a pointed tail only on the
  // first bubble of a run, and the timestamp tucked inside the bubble.
  const tail = !grouped;
  const corner = `rounded-[10px] ${tail ? (mine ? "rounded-tr-[3px]" : "rounded-tl-[3px]") : ""}`;
  const skin = mine
    ? "bg-primary text-primary-foreground"
    : "bg-card text-foreground border border-border/50";

  const stamp = (
    <span
      className={`ml-2 shrink-0 translate-y-[3px] text-[10px] leading-none ${
        mine ? "text-primary-foreground/70" : "text-muted-foreground"
      }`}
    >
      {timeLabel(m.created_at)}
    </span>
  );

  return (
    <div
      className={`shrink-0 [content-visibility:auto] [contain-intrinsic-size:auto_48px] transition-opacity ${
        m.pending ? "opacity-60" : "opacity-100"
      }`}
    >
      {newDay && (
        <div className="my-3 flex justify-center">
          <span className="rounded-[7px] bg-card px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground shadow-sm">
            {dayLabel(m.created_at)}
          </span>
        </div>
      )}

      <div
        className={`relative flex ${grouped ? "mt-[2px]" : "mt-2"} ${mine ? "justify-end pl-12" : "justify-start pr-12"}`}
      >
        <div className={`relative flex max-w-[82%] flex-col ${mine ? "items-end" : "items-start"}`}>
          {m.kind === "image" ? (
            <div className={`relative overflow-hidden ${corner} ${skin} p-[3px] shadow-sm`}>
              {m.mediaUrl ? (
                <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[8px]">
                  <img
                    src={m.mediaUrl}
                    alt="Shared in chat"
                    className="max-h-72 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ) : (
                <div className="flex h-32 w-48 items-center justify-center rounded-[8px] bg-secondary text-[11px] text-muted-foreground">
                  Picture unavailable
                </div>
              )}
              <span className="absolute bottom-2 right-2 rounded-full bg-foreground/55 px-1.5 py-[2px] text-[10px] leading-none text-background">
                {timeLabel(m.created_at)}
              </span>
            </div>
          ) : m.kind === "pin" && m.lat != null && m.lng != null ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`}
              target="_blank"
              rel="noreferrer"
              className={`flex items-end px-2.5 py-[6px] shadow-sm ${corner} ${skin}`}
            >
              <span className="flex items-center gap-1.5 text-[14.5px]">
                <MapPin className="size-3.5" />
                Meet-up pin
              </span>
              {stamp}
            </a>
          ) : (
            <div className={`flex items-end px-2.5 py-[5px] shadow-sm ${corner} ${skin}`}>
              <p className="whitespace-pre-wrap break-words text-[14.5px] leading-[1.32]">{m.content}</p>
              {stamp}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});


export function ChatPanel({ matchId, className }: { matchId: string; leading?: React.ReactNode; className?: string }) {
  const queryClient = useQueryClient();
  const { closeChat } = useChatSheet();
  const sendPush = useServerFn(sendPushNotification);
  const { data: billing } = useBillingInfo();
  const hasUnlimitedMessages = useFeatureAccess().has(FEATURE.unlimitedMessages);
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
  const { data: retention } = useChatRetention();
  const retentionDays = retention?.effectiveDays ?? DEFAULT_CHAT_TTL_DAYS;
  // Signed URLs are expensive to mint, so reuse them across refetches.
  const signedCache = useRef(new Map<string, string>());

  const signImages = useCallback(async (rows: Message[]): Promise<Message[]> => {
    const missing = rows
      .filter((m) => m.kind === "image" && !signedCache.current.has(m.content))
      .map((m) => m.content);
    if (missing.length) {
      const { data: signed } = await supabase.storage
        .from("chat-media")
        .createSignedUrls(missing, 3600);
      for (const item of signed ?? []) {
        const url = item.signedUrl;
        const path = item.path;
        if (url && path) signedCache.current.set(path, url);
      }
    }
    return rows.map((m) => {
      if (m.kind !== "image") return m;
      const url = signedCache.current.get(m.content);
      return url ? { ...m, mediaUrl: url } : m;
    });
  }, []);

  const { data: page, isLoading: loadingMessages } = useQuery({
    queryKey: ["messages", matchId, limit, retentionDays],
    // Keep the previous window on screen while a bigger page streams in.
    placeholderData: (prev) => prev,
    staleTime: 30_000,
    queryFn: async () => {
      // Messages older than the retention window are treated as gone, even
      // before the nightly purge removes them from the database.
      const cutoff =
        retentionDays > 0
          ? new Date(Date.now() - retentionDays * 86400000).toISOString()
          : new Date(0).toISOString();
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, content, created_at, kind, lat, lng")
        .eq("match_id", matchId)
        .gte("created_at", cutoff)
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
          const signedRows = await signImages([row]);
          const withMedia = signedRows[0] ?? row;
          queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(
            ["messages", matchId, limit, retentionDays],
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

  // Keep the newest message in view, but don't yank the view when older
  // history is prepended.
  const newestId = messages[messages.length - 1]?.id;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [newestId]);

  // Grouping/day-separator maths run once per transcript change, not per render.
  const rows = useMemo<BubbleProps[]>(
    () =>
      messages.map((m, index) => {
        const prev = messages[index - 1];
        const next = messages[index + 1];
        const newDay =
          !prev ||
          new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
        return {
          m,
          mine: m.sender_id === me,
          newDay,
          grouped:
            !newDay &&
            prev?.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60000,
          lastOfGroup:
            !next ||
            next.sender_id !== m.sender_id ||
            new Date(next.created_at).getTime() - new Date(m.created_at).getTime() >= 5 * 60000,
        };
      }),
    [messages, me],
  );

  const loadEarlier = useCallback(() => {
    const el = scrollRef.current;
    const before = el?.scrollHeight ?? 0;
    setLimit((n) => n + PAGE);
    // Hold the reading position once the older page renders above.
    requestAnimationFrame(() => {
      const node = scrollRef.current;
      if (node) node.scrollTop += node.scrollHeight - before;
    });
  }, []);


  // Grow the composer with its content, capped so the transcript keeps room.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 108)}px`;
  }, [text]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const content = text.trim();
    if (!content || !me) return;
    // Free-tier message cap (admin controlled, skipped for Pro members).
    if (
      billing?.enabled &&
      !hasUnlimitedMessages &&
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

    // Optimistic bubble: it appears the instant you hit send, then swaps for
    // the real row (or disappears if the send failed).
    const tempId = `pending-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: me,
      content,
      created_at: new Date().toISOString(),
      kind: "text",
      lat: null,
      lng: null,
      pending: true,
    };
    const key = ["messages", matchId, limit, retentionDays];
    queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(key, (prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev,
    );

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({ match_id: matchId, sender_id: me, content })
      .select("id, sender_id, content, created_at, kind, lat, lng")
      .maybeSingle();

    if (error) {
      queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(key, (prev) =>
        prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempId) } : prev,
      );
      toast.error("Message didn't send");
      setText(content);
      return;
    }

    const row = (inserted as Message | null) ?? null;
    queryClient.setQueryData<{ messages: Message[]; hasMore: boolean }>(key, (prev) => {
      if (!prev) return prev;
      const withoutTemp = prev.messages.filter((m) => m.id !== tempId);
      if (!row) return { ...prev, messages: withoutTemp };
      return withoutTemp.some((m) => m.id === row.id)
        ? { ...prev, messages: withoutTemp }
        : { ...prev, messages: [...withoutTemp, row] };
    });
    queryClient.invalidateQueries({ queryKey: ["active-chats"] });
    queryClient.invalidateQueries({ queryKey: ["matches"] });
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
    }
  }

  const name = other?.display_name ?? other?.username ?? "Chat";

  return (
    <div className={className ?? "flex h-full min-h-0 flex-col"}>
      {/* Scrollable area; the header is sticky so it stays pinned while messages scroll. */}
      <div
        ref={scrollRef}
        data-scrollable
        data-selectable
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [transform:translateZ(0)]"
        style={{ WebkitOverflowScrolling: "touch", contain: "layout paint" }}
      >
        {/* Header pinned at the top of the chat. */}
        <header
          className="sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-border/40 bg-background px-1.5 pb-2"
          style={{ paddingTop: "calc(var(--safe-top) + 0.25rem)" }}
        >
          <button
            type="button"
            onClick={closeChat}
            aria-label="Back"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-primary transition active:scale-90"
          >
            <ChevronLeft className="size-6" strokeWidth={2.5} />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <PersonAvatar
              path={other?.avatar_url}
              name={other?.display_name}
              username={other?.username ?? "?"}
              gender={other?.gender as import("@/components/PersonAvatar").Gender}
              className="size-8 rounded-full"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1 truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">
                {name}
                {other?.verified && <VerifiedBadge className="size-3" />}
              </p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {other ? lastSeenLabel(other.last_seen) : ""}
              </p>
            </div>
          </div>

          <ChatSafetyMenu matchId={matchId} otherId={other?.id} otherName={name} onBlocked={closeChat} />
        </header>

        <div className="px-3 pb-3 pt-3">
          {/* WhatsApp-style intro: a small encryption note, then a contact card. */}
          <div className="mx-auto mb-3 max-w-[85%] rounded-[10px] bg-accent/40 px-3 py-2 text-center text-[11px] leading-snug text-muted-foreground">
            Messages here stay between you two. You matched by being nearby — meet in public places.
          </div>

          {/* Members should always know how long this conversation will live. */}
          <div className="mx-auto mb-3 max-w-[85%] text-center text-[11px] leading-snug text-muted-foreground">
            This chat vanishes {retentionDays} {retentionDays === 1 ? "day" : "days"} after each message
            {retention && !retention.isPro && retention.proDays > retention.freeDays
              ? ` — Pro keeps chats for ${retention.proDays} days.`
              : "."}
          </div>

          <div className="mb-4 flex flex-col items-center rounded-[14px] bg-card px-6 py-5 text-center shadow-sm">
            <PersonAvatar
              path={other?.avatar_url}
              name={other?.display_name}
              username={other?.username ?? "?"}
              gender={other?.gender as import("@/components/PersonAvatar").Gender}
              className="size-20 rounded-full"
            />
            <p className="mt-3 flex items-center gap-1 text-[15px] font-semibold leading-tight">
              {other ? name : ""}
              {other?.verified && <VerifiedBadge className="size-3.5" />}
            </p>
            {other?.username && (
              <p className="mt-0.5 text-[12px] text-muted-foreground">@{other.username}</p>
            )}
            <p className="mt-1 text-[12px] text-muted-foreground">
              Not a contact • Matched nearby
            </p>
          </div>


          {hasMore && (
            <div className="mb-3 flex justify-center">
              <button
                type="button"
                onClick={loadEarlier}
                className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground transition active:scale-95"
              >
                Load earlier messages
              </button>
            </div>
          )}

          {loadingMessages && rows.length === 0 ? (
            <TranscriptSkeleton />
          ) : (
            rows.map((row) => <Bubble key={row.m.id} {...row} />)
          )}
        </div>
      </div>

      {/* Composer stays at the bottom, never scrolls. */}
      <form
        onSubmit={send}
        className="z-20 flex shrink-0 items-end gap-1.5 bg-background/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5"
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
        <div className="flex min-w-0 flex-1 items-end gap-1.5 rounded-[22px] bg-card px-2 py-[6px] shadow-sm ring-1 ring-border/50">
          <button
            type="button"
            aria-label="Upload a picture"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition active:scale-90 disabled:opacity-40"
          >
            {uploading ? <LoaderCircle className="size-[18px] animate-spin" /> : <ImagePlus className="size-[19px]" />}
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={settings.chat_prompt_text}
            rows={1}
            maxLength={settings.max_message_len}
            className="max-h-[108px] w-full resize-none border-0 bg-transparent py-[5px] pr-1 text-[15px] leading-[1.3] outline-none placeholder:text-muted-foreground/70"
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
          className="mb-[1px] flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition active:scale-90 disabled:opacity-40"
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.5} />
        </button>

      </form>
    </div>
  );
}
