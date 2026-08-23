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

export type ChatRetention = {
  freeDays: number;
  proDays: number;
  /** How long chats last for *this* member (Pro members may get longer). */
  effectiveDays: number;
  isPro: boolean;
};

/**
 * How long conversations stick around for the signed-in member. Admin sets the
 * free window; Pro members get the longer window when that perk is switched on.
 */
export function useChatRetention() {
  return useQuery({
    queryKey: ["chat-retention"],
    staleTime: 60_000,
    queryFn: async (): Promise<ChatRetention> => {
      const { data } = await supabase.rpc("chat_retention");
      const row = Array.isArray(data) ? data[0] : null;
      const freeDays = Number(row?.free_days ?? DEFAULT_CHAT_TTL_DAYS);
      return {
        freeDays,
        proDays: Number(row?.pro_days ?? freeDays),
        effectiveDays: Number(row?.effective_days ?? freeDays),
        isPro: Boolean(row?.is_pro),
      };
    },
  });
}
