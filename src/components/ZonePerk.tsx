import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  perk_text: string | null;
  distance_m: number;
  claimed_code: string | null;
};

/** The venue you're standing in, and the perk it offers everyone on the radar. */
export function ZonePerk() {
  const qc = useQueryClient();
  const { data: zone } = useQuery({
    queryKey: ["my-zone"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Zone | null> => {
      const { data, error } = await (supabase as any).rpc("my_zone");
      if (error) return null;
      const rows = (data ?? []) as Zone[];
      return rows[0] ?? null;
    },
  });

  const claim = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc("claim_zone_perk", { _zone_id: id });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-zone"] });
      toast.success("Perk claimed — show the code at the counter");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not claim"),
  });

  if (!zone) return null;

  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Store className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">You're at {zone.name}</p>
      </div>
      {zone.description ? (
        <p className="mt-1 text-xs text-muted-foreground">{zone.description}</p>
      ) : null}
      {zone.perk_text ? (
        <div className="mt-2 flex items-center gap-2">
          <Gift className="size-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-xs">{zone.perk_text}</p>
          {zone.claimed_code ? (
            <span className="shrink-0 rounded-lg bg-primary px-2 py-1 font-mono text-xs text-primary-foreground">
              {zone.claimed_code}
            </span>
          ) : (
            <Button
              size="sm"
              variant="heat"
              disabled={claim.isPending}
              onClick={() => claim.mutate(zone.id)}
            >
              Claim
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
