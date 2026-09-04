import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MyIntent = {
  intent: string | null;
  intent_note: string | null;
  intent_expires_at: string | null;
  mood: string | null;
};

export const MY_INTENT_KEY = ["my-intent"] as const;

/** My own active intent and mood, as other people would see them. */
export function useMyIntent() {
  return useQuery({
    queryKey: MY_INTENT_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<MyIntent> => {
      const me = (await supabase.auth.getUser()).data.user?.id;
      if (!me) return { intent: null, intent_note: null, intent_expires_at: null, mood: null };
      const { data } = await (supabase as any)
        .from("profiles")
        .select("intent, intent_note, intent_expires_at, mood")
        .eq("id", me)
        .maybeSingle();
      const row = (data ?? {}) as Partial<MyIntent>;
      const live = row.intent_expires_at && new Date(row.intent_expires_at) > new Date();
      return {
        intent: live ? (row.intent ?? null) : null,
        intent_note: live ? (row.intent_note ?? null) : null,
        intent_expires_at: live ? (row.intent_expires_at ?? null) : null,
        mood: row.mood ?? null,
      };
    },
  });
}

export function useSetIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { intent: string | null; note?: string; minutes?: number }) => {
      const { error } = await (supabase as any).rpc("set_my_intent", {
        _intent: v.intent ?? "",
        _note: v.note ?? "",
        _minutes: v.minutes ?? 60,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_INTENT_KEY });
      qc.invalidateQueries({ queryKey: ["nearby"] });
    },
  });
}

export function useSetMood() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mood: string) => {
      const { error } = await (supabase as any).rpc("set_my_mood", { _mood: mood });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_INTENT_KEY });
      qc.invalidateQueries({ queryKey: ["nearby"] });
    },
  });
}
