import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Flag,
  MessageCircleQuestion,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Trash2,
  Zap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";
import { publishMyLocation } from "@/lib/publish-location";
import { useChatSheet } from "@/components/ChatSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Broadcast = {
  id: string;
  author_id: string;
  username: string;
  question: string;
  options: string[];
  counts: number[];
  total: number;
  my_answer: number | null;
  mine: boolean;
  distance_m: number;
  expires_at: string;
  match_id: string | null;
};

const CLIENT_BLOCKED_CONTENT =
  /(kill\s+yourself|rape|child\s*(sex|porn)|csam|porn|nudes?|explicit\s+sex|fuck|fucking|cunt|bomb\s+threat|terrorist\s+threat)/i;

function containsBlockedContent(text: string) {
  return CLIENT_BLOCKED_CONTENT.test(text);
}

function minutesLeft(iso: string) {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return m > 0 ? `${m}m left` : "expiring";
}

export function QuestionBroadcasts({ radiusM }: { radiusM?: number } = {}) {
  const savedRadius = (() => {
    if (radiusM) return radiusM;
    if (typeof window === "undefined") return 1000;
    const saved = Number(window.localStorage.getItem("skan-radius") ?? "");
    return Number.isFinite(saved) && saved > 0 ? saved : 1000;
  })();

  const qc = useQueryClient();
  const { openChat } = useChatSheet();
  const [composing, setComposing] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [reporting, setReporting] = useState<Broadcast | null>(null);
  const [reportReason, setReportReason] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["broadcasts", savedRadius],
    refetchInterval: 20_000,
    queryFn: async (): Promise<Broadcast[]> => {
      const { data, error } = await (supabase as any).rpc("nearby_broadcasts", {
        radius_m: savedRadius,
      });
      if (error) return [];
      return (data ?? []) as Broadcast[];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const cleanQuestion = question.trim();
      const opts = options.map((o) => o.trim()).filter(Boolean);

      if (containsBlockedContent(cleanQuestion) || opts.some(containsBlockedContent)) {
        throw new Error(
          "This content may violate SKANAROUND Community Rules. Please edit it and try again.",
        );
      }

      await publishMyLocation();
      const { error } = await (supabase as any).rpc("post_broadcast", {
        _question: cleanQuestion,
        _options: opts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      setComposing(false);
      setQuestion("");
      setOptions(["", ""]);
      toast.success("Question posted", {
        description: "Your username is shown. Answers remain private for 15 minutes.",
      });
    },
    onError: (e) => {
      const message = errorMessage(e, "Could not post");
      toast.error(
        /content_not_allowed/i.test(message)
          ? "This content may violate SKANAROUND Community Rules. Please edit it and try again."
          : message,
      );
    },
  });

  const answer = useMutation({
    mutationFn: async (v: { id: string; index: number }) => {
      const { error } = await (supabase as any).rpc("answer_broadcast", {
        _broadcast_id: v.id,
        _option_index: v.index,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
    onError: (e) => toast.error(errorMessage(e, "Could not answer")),
  });

  const reachOut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("signal_broadcast_author", {
        _broadcast_id: id,
      });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (matchId) => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      if (matchId) openChat(matchId);
      else toast.success("Signal sent — they'll see it on their radar");
    },
    onError: (e) => toast.error(errorMessage(e, "Could not signal")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("delete_my_broadcast", {
        _broadcast_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      toast.success("Question removed");
    },
    onError: (e) => toast.error(errorMessage(e, "Could not remove question")),
  });

  const block = useMutation({
    mutationFn: async (b: Broadcast) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Sign in again to block this user");
      const { error } = await supabase.from("blocks").insert({
        blocker: me,
        blocked: b.author_id,
      });
      if (error && !/duplicate/i.test(error.message)) throw error;
    },
    onSuccess: (_data, b) => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      qc.invalidateQueries({ queryKey: ["nearby"] });
      toast.success(`@${b.username} blocked`);
    },
    onError: (e) => toast.error(errorMessage(e, "Could not block user")),
  });

  const report = useMutation({
    mutationFn: async () => {
      if (!reporting) return;
      const { error } = await (supabase as any).rpc("report_broadcast", {
        _broadcast_id: reporting.id,
        _reason: reportReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReporting(null);
      setReportReason("");
      toast.success("Report sent", {
        description: "The question is hidden from you after you block the user. Reports are reviewed within 24 hours.",
      });
    },
    onError: (e) => toast.error(errorMessage(e, "Could not send report")),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Ask the area
        </p>
        <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setComposing(true)}>
          <Plus className="size-3.5" /> Ask
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No questions nearby. Ask one — your username is shown and it vanishes in 15 minutes.
        </p>
      ) : null}

      {items.map((b) => (
        <div key={b.id} className="space-y-2 rounded-2xl border border-border bg-card/70 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">@{b.username}</p>
              <p className="text-sm">{b.question}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Question safety options"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {b.mine ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (window.confirm("Remove this question immediately?")) remove.mutate(b.id);
                    }}
                  >
                    <Trash2 className="size-4" /> Delete my question
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        setReportReason("");
                        setReporting(b);
                      }}
                    >
                      <Flag className="size-4" /> Report question
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        if (window.confirm(`Block @${b.username}? You will no longer see each other.`)) {
                          block.mutate(b);
                        }
                      }}
                    >
                      <Ban className="size-4" /> Block @{b.username}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1">
            {b.options.map((o, i) => {
              const count = b.counts?.[i] ?? 0;
              const pct = b.total > 0 ? Math.round((count / b.total) * 100) : 0;
              const answered = b.my_answer != null;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered || b.mine || answer.isPending}
                  onClick={() => answer.mutate({ id: b.id, index: i })}
                  className={`relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                    b.my_answer === i ? "border-primary" : "border-border"
                  }`}
                >
                  {answered || b.mine ? (
                    <span
                      aria-hidden
                      className="absolute inset-y-0 left-0 bg-primary/15"
                      style={{ width: `${pct}%` }}
                    />
                  ) : null}
                  <span className="relative flex justify-between gap-2">
                    <span className="truncate">{o}</span>
                    {answered || b.mine ? <span className="text-muted-foreground">{pct}%</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {Math.round(b.distance_m)} m · {b.total} answered · {minutesLeft(b.expires_at)}
            </span>
            {b.mine ? null : b.match_id ? (
              <button type="button" className="text-primary" onClick={() => openChat(b.match_id as string)}>
                Chat
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-primary"
                disabled={reachOut.isPending}
                onClick={() => reachOut.mutate(b.id)}
              >
                <Zap className="size-3" /> Signal them
              </button>
            )}
          </div>
        </div>
      ))}

      <Dialog open={composing} onOpenChange={setComposing}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Ask the people around you</DialogTitle>
            <DialogDescription>
              Your SKANAROUND username is shown with the question. Answers remain private.
              Questions disappear after 15 minutes.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <ShieldAlert className="size-3.5" /> Community safety
            </span>
            <p className="mt-1">
              No harassment, sexual content, hate speech, threats, scams, illegal content or abuse.
              Posts may be removed and accounts may be suspended.
            </p>
          </div>

          <Input
            value={question}
            maxLength={140}
            placeholder="Is the queue at the coffee place long?"
            onChange={(e) => setQuestion(e.target.value)}
          />

          {options.map((o, i) => (
            <Input
              key={i}
              value={o}
              maxLength={40}
              placeholder={`Answer ${i + 1}`}
              onChange={(e) =>
                setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
              }
            />
          ))}

          {options.length < 4 ? (
            <Button variant="ghost" size="sm" onClick={() => setOptions((p) => [...p, ""])}>
              <Plus className="size-3.5" /> Add answer
            </Button>
          ) : null}

          <Button
            variant="heat"
            disabled={
              post.isPending ||
              question.trim().length < 3 ||
              options.filter((o) => o.trim()).length < 2
            }
            onClick={() => post.mutate()}
          >
            Post question
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            By posting, you agree to the Community Rules in our Terms of Service.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reporting)}
        onOpenChange={(open) => {
          if (!open) {
            setReporting(null);
            setReportReason("");
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Report question</DialogTitle>
            <DialogDescription>
              Tell us why this question is unsafe or inappropriate. Our moderation team reviews
              reports within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            maxLength={500}
            rows={4}
            placeholder="Harassment, sexual content, hate speech, threat, scam, spam, or another concern…"
            onChange={(e) => setReportReason(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={report.isPending || reportReason.trim().length < 3}
            onClick={() => report.mutate()}
          >
            <Flag className="mr-2 size-4" /> Submit report
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
