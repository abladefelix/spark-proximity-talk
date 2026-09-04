import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircleQuestion, Plus, Zap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useChatSheet } from "@/components/ChatSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Broadcast = {
  id: string;
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

function minutesLeft(iso: string) {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  return m > 0 ? `${m}m left` : "expiring";
}

export function QuestionBroadcasts({ radiusM = 500 }: { radiusM?: number }) {
  const qc = useQueryClient();
  const { openChat } = useChatSheet();
  const [composing, setComposing] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const { data: items = [] } = useQuery({
    queryKey: ["broadcasts", radiusM],
    refetchInterval: 20_000,
    queryFn: async (): Promise<Broadcast[]> => {
      const { data, error } = await (supabase as any).rpc("nearby_broadcasts", {
        radius_m: radiusM,
      });
      if (error) return [];
      return (data ?? []) as Broadcast[];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      const opts = options.map((o) => o.trim()).filter(Boolean);
      const { error } = await (supabase as any).rpc("post_broadcast", {
        _question: question.trim(),
        _options: opts,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
      setComposing(false);
      setQuestion("");
      setOptions(["", ""]);
      toast.success("Asked the area", { description: "Answers are anonymous for 15 minutes." });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post"),
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not answer"),
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not signal"),
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
          No questions nearby. Ask one — it's anonymous and vanishes in 15 minutes.
        </p>
      ) : null}

      {items.map((b) => (
        <div key={b.id} className="space-y-2 rounded-2xl border border-border bg-card/70 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="flex-1 text-sm">{b.question}</p>
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
              Nobody sees who asked or who answered. The question disappears after 15 minutes.
            </DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
