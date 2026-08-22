import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useChatSheet } from "@/components/ChatSheet";
import { supabase } from "@/integrations/supabase/client";
import { sendPushNotification } from "@/lib/push-notifications.functions";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useBillingInfo, useIsPro } from "@/hooks/useBilling";
import { useProUpgradeSheet } from "@/components/ProUpgradeSheet";
import { Crown } from "lucide-react";


type Incoming = {
  id: string;
  from_user: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  gender: "male" | "female" | "other" | null;
  match_id: string | null;
};

export function IncomingSignals() {
  const { openChat } = useChatSheet();
  const queryClient = useQueryClient();
  const sendPush = useServerFn(sendPushNotification);
  const { data: billing } = useBillingInfo();
  const isPro = useIsPro();
  const { open: openPro } = useProUpgradeSheet();
  // Pro perk: free members see that someone signalled them, but not who.
  const hideIdentity = Boolean(billing?.enabled && billing.pro_see_who_signaled && !isPro);


  const { data: incoming = [] } = useQuery({
    queryKey: ["incoming-signals"],
    refetchInterval: 10000,
    queryFn: async (): Promise<Incoming[]> => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return [];
      const { data: signals, error } = await supabase
        .from("signals")
        .select("id, from_user")
        .eq("to_user", me)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      if (error || !signals?.length) return [];

      const ids = signals.map((s) => s.from_user);
      const [{ data: profiles }, { data: matches }] = await Promise.all([
        supabase.from("profiles").select("id, username, display_name, avatar_url, gender").in("id", ids),
        supabase.from("matches").select("id, user_a, user_b").or(`user_a.eq.${me},user_b.eq.${me}`),
      ]);

      return signals
        .map((s) => {
          const p = profiles?.find((x) => x.id === s.from_user);
          if (!p) return null;
          const match = matches?.find(
            (m) =>
              (m.user_a === me && m.user_b === s.from_user) ||
              (m.user_b === me && m.user_a === s.from_user),
          );
          return {
            id: s.id,
            from_user: s.from_user,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            gender: p.gender as Incoming["gender"],
            match_id: match?.id ?? null,
          };
        })
        .filter((x): x is Incoming => x !== null && x.match_id === null);
    },
  });

  const accept = useMutation({
    mutationFn: async (person: Incoming) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const { error } = await supabase
        .from("signals")
        .insert({ from_user: me, to_user: person.from_user });
      if (error && !error.message.includes("duplicate")) throw error;

      // The match row is created by a trigger; give it a moment if needed.
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: matches } = await supabase
          .from("matches")
          .select("id, user_a, user_b")
          .or(`user_a.eq.${me},user_b.eq.${me}`);
        const match = matches?.find(
          (m) =>
            (m.user_a === me && m.user_b === person.from_user) ||
            (m.user_b === me && m.user_a === person.from_user),
        );
        if (match) return match.id;
        await new Promise((r) => setTimeout(r, 250));
      }
      throw new Error("Couldn't open the chat — try again");
    },
    onSuccess: (matchId, person) => {
      // Drop the card immediately so the queue closes before the chat opens.
      queryClient.setQueryData<Incoming[]>(["incoming-signals"], (prev) =>
        (prev ?? []).filter((p) => p.id !== person.id),
      );
      queryClient.invalidateQueries({ queryKey: ["incoming-signals"] });
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
      openChat(matchId);

      sendPush({
        data: {
          kind: "match",
          recipientId: person.from_user,
          title: "It's mutual",
          body: "Your chat on SKANAROUND is unlocked",
          relatedId: matchId,
        },
      }).catch(() => {
        /* push failure is non-fatal */
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not accept"),
  });


  const decline = useMutation({
    mutationFn: async (person: Incoming) => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) throw new Error("Not signed in");
      const { error } = await supabase.from("blocks").insert({ blocker: me, blocked: person.from_user });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incoming-signals"] });
      queryClient.invalidateQueries({ queryKey: ["nearby"] });
      toast.success("Declined");
    },
    onError: () => toast.error("Couldn't decline"),
  });

  if (incoming.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Waiting to chat
        </p>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
          {incoming.length} in queue
        </span>
      </div>
      {incoming.map((person, index) => (
        <div
          key={person.id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-3 py-2.5"
        >
          <div className={hideIdentity ? "shrink-0 overflow-hidden rounded-full blur-[6px]" : "shrink-0"}>
            <PersonAvatar
              path={person.avatar_url}
              name={person.display_name}
              username={person.username}
              gender={person.gender}
              className="size-10 shrink-0"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {hideIdentity ? "Someone nearby" : (person.display_name ?? person.username)}
            </p>
            {hideIdentity ? (
              <button
                type="button"
                onClick={() => openPro()}
                className="flex items-center gap-1 text-xs font-medium text-primary"
              >
                <Crown className="size-3" /> Go Pro to see who
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">
                wants to chat{index > 0 ? ` · #${index + 1} in queue` : ""}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => decline.mutate(person)}
            disabled={decline.isPending}
          >
            Decline
          </Button>
          <Button
            size="sm"
            variant="heat"
            className="gap-1 text-xs"
            onClick={() => accept.mutate(person)}
            disabled={accept.isPending}
          >
            <Zap className="size-3.5" />
            Accept
          </Button>
        </div>
      ))}
    </div>
  );
}
