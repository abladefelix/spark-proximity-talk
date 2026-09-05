import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_RADIUS_M = 1000;

function savedRadiusM(): number {
  if (typeof window === "undefined") return DEFAULT_RADIUS_M;
  const raw = window.localStorage.getItem("skan-radius");
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RADIUS_M;
}

type NearbyRow = {
  they_signaled: boolean;
  match_id: string | null;
};

/** Count of nearby people who signaled you but aren't a match yet. */
export function useRadarNotificationsCount() {
  const { user } = useAuth();
  const { coords } = useUserPosition();
  const queryClient = useQueryClient();
  const radius = savedRadiusM();

  const query = useQuery({
    queryKey: ["nearby-signal-count", radius],
    enabled: !!user,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("nearby_people", {
        radius_m: radius,
      });
      if (error) throw error;
      const rows = (data ?? []) as NearbyRow[];
      return rows.filter((r) => r.they_signaled && !r.match_id).length;
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("radar-signal-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signals" },
        () => {
          void queryClient.invalidateQueries({
            queryKey: ["nearby-signal-count"],
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { count: query.data ?? 0, isLoading: query.isLoading, coords };
}
