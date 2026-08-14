import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_CHAT_TTL_DAYS = 30;

export function useChatTtlDays() {
  return useQuery({
    queryKey: ["app-chat-ttl"],
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { data } = await supabase
        .from("app_settings")
        .select("chat_ttl_days")
        .eq("id", "global")
        .maybeSingle();
      return Number(data?.chat_ttl_days ?? DEFAULT_CHAT_TTL_DAYS);
    },
  });
}
