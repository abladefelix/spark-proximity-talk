import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LifeBuoy, Radio } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { HELP_KINDS, helpKindFor } from "@/lib/intents";
import { errorMessage } from "@/lib/errors";
import { publishMyLocation } from "@/lib/publish-location";
import { useChatSheet } from "@/components/ChatSheet";
import { PersonAvatar } from "@/components/PersonAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Beacon = {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  kind: string;
  note: string | null;
  distance_m: number;
  expires_at: string;
  mine: boolean;
  match_id: string | null;
};

function useHelpBeacons() {
  return useQuery({
    queryKey: ["help-beacons"],
    refetchInterval: 15_000,
    queryFn: async (): Promise<Beacon[]> => {
      const { data, error } = await (supabase as any).rpc("nearby_help_beacons");
      if (error) return [];
      return (data ?? []) as Beacon[];
    },
  });
}

/** The red button: a 3-minute, 200-metre call for help. */
export function BatSignalButton() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>(HELP_KINDS[0].key);
  const [note, setNote] = useState("");
  const qc = useQueryClient();

  const drop = useMutation({
    mutationFn: async () => {
      await publishMyLocation();
      const { error } = await (supabase as any).rpc("drop_help_beacon", {
        _kind: kind,
        _note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["help-beacons"] });
      setOpen(false);
      setNote("");
      toast.success("Bat-Signal sent", {
        description: "Everyone within 200 m sees it for the next 3 minutes.",
      });
    },
    onError: (e) => toast.error(errorMessage(e, "Could not send")),
  });

  return (
    <>
      <Button
        variant="outline"
        className="w-full justify-start gap-2 border-destructive/40 text-destructive"
        onClick={() => setOpen(true)}
      >
        <LifeBuoy className="size-4" /> Bat-Signal — I need help now
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Send a Bat-Signal</DialogTitle>
            <DialogDescription>
              This is for real, urgent help. It goes to everyone within 200 metres for 3 minutes,
              then disappears.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {HELP_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                onClick={() => setKind(k.key)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs ${
                  kind === k.key ? "border-destructive bg-destructive/10" : "border-border"
                }`}
              >
                <span className="text-base leading-none">{k.emoji}</span>
                <span className="truncate">{k.label}</span>
              </button>
            ))}
          </div>

          <Input
            value={note}
            maxLength={120}
            placeholder="Where are you and what do you need?"
            onChange={(e) => setNote(e.target.value)}
          />

          <Button
            variant="heat"
            disabled={drop.isPending}
            onClick={() => drop.mutate()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Radio className="size-4" /> Send Bat-Signal
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Live list of nearby people asking for help. */
export function HelpBeaconList() {
  const { data: beacons = [] } = useHelpBeacons();
  const { openChat } = useChatSheet();
  const qc = useQueryClient();

  const respond = useMutation({
    mutationFn: async (b: Beacon) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("signals")
        .insert({ from_user: me, to_user: b.user_id, intent: "help", intent_note: "On my way" });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: (_r, b) => {
      qc.invalidateQueries({ queryKey: ["help-beacons"] });
      qc.invalidateQueries({ queryKey: ["nearby"] });
      if (b.match_id) openChat(b.match_id);
      else toast.success("They've been told you can help");
    },
    onError: (e) => toast.error(errorMessage(e, "Could not respond")),
  });

  if (beacons.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-medium uppercase tracking-wide text-destructive">
        Someone needs help
      </p>
      {beacons.map((b) => {
        const k = helpKindFor(b.kind);
        return (
          <div
            key={b.id}
            className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-3 py-2.5"
          >
            <PersonAvatar
              path={b.avatar_url}
              name={b.display_name}
              username={b.username}
              gender={null}
              className="size-10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {k?.emoji} {k?.label ?? b.kind}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {b.note ? `${b.note} · ` : ""}
                {Math.round(b.distance_m)} m away
              </p>
            </div>
            {b.mine ? (
              <span className="text-[11px] text-muted-foreground">Your signal</span>
            ) : b.match_id ? (
              <Button size="sm" variant="heat" onClick={() => openChat(b.match_id as string)}>
                Chat
              </Button>
            ) : (
              <Button
                size="sm"
                variant="heat"
                disabled={respond.isPending}
                onClick={() => respond.mutate(b)}
              >
                I can help
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
