import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MAX_RADIUS = 2000;
export const MIN_RADIUS = 100;

/** App-wide cap on how far members may scan, set by admins. */
export function useMaxRadius() {
  return useQuery({
    queryKey: ["app-max-radius"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("max_radius_m")
        .eq("id", "global")
        .maybeSingle();
      return Number(data?.max_radius_m ?? DEFAULT_MAX_RADIUS);
    },
  });
}
