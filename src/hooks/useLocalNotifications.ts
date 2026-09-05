import { useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Beacon = {
  id: string;
};

type Broadcast = {
  id: string;
  mine: boolean;
  my_answer: number | null;
};

type Zone = {
  id: string;
  claimed_code: string | null;
};

function savedRadiusM() {
  if (typeof window === "undefined") return 1000;
  const saved = Number(window.localStorage.getItem("skan-radius") ?? "");
  return Number.isFinite(saved) && saved > 0 ? saved : 1000;
}

/** Count of actionable items on the Local tab: help beacons, unanswered polls, and unclaimed venue perks. */
export function useLocalNotificationsCount() {
  const radiusM = savedRadiusM();

  const [beacons, broadcasts, zone] = useQueries({
    queries: [
      {
        queryKey: ["help-beacons"],
        refetchInterval: 15_000,
        queryFn: async (): Promise<Beacon[]> => {
          const { data, error } = await (supabase as any).rpc("nearby_help_beacons");
          if (error) return [];
          return (data ?? []) as Beacon[];
        },
      },
      {
        queryKey: ["broadcasts", radiusM],
        refetchInterval: 20_000,
        queryFn: async (): Promise<Broadcast[]> => {
          const { data, error } = await (supabase as any).rpc("nearby_broadcasts", {
            radius_m: radiusM,
          });
          if (error) return [];
          return (data ?? []) as Broadcast[];
        },
      },
      {
        queryKey: ["my-zone"],
        refetchInterval: 60_000,
        queryFn: async (): Promise<Zone | null> => {
          const { data, error } = await (supabase as any).rpc("my_zone");
          if (error) return null;
          const rows = (data ?? []) as Zone[];
          return rows[0] ?? null;
        },
      },
    ],
  });

  const beaconCount = (beacons.data ?? []).length;
  const broadcastCount = (broadcasts.data ?? []).filter((b) => !b.mine && b.my_answer == null).length;
  const zoneCount = zone.data && !zone.data.claimed_code ? 1 : 0;

  const total = beaconCount + broadcastCount + zoneCount;

  return {
    count: total,
    beaconCount,
    broadcastCount,
    zoneCount,
    isLoading: beacons.isLoading || broadcasts.isLoading || zone.isLoading,
  };
}
