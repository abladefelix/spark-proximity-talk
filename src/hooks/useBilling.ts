import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BillingInfo = {
  enabled: boolean;
  provider: string;
  ios_api_key: string | null;
  android_api_key: string | null;
  entitlement_id: string;
  monthly_product_id: string | null;
  yearly_product_id: string | null;
  currency: string;
  monthly_amount: number;
  yearly_amount: number;
  pro_label: string;
  pro_pitch: string;
  free_daily_signals: number;
  free_max_radius_m: number;
  free_messages_per_match: number;
  pro_unlimited_signals: boolean;
  pro_extended_radius: boolean;
  pro_unlimited_messages: boolean;
  pro_see_who_signaled: boolean;
  pro_priority_beacon: boolean;
  pro_custom_beacon: boolean;
};

export const BILLING_INFO_KEY = ["billing-info"] as const;
export const MY_SUB_KEY = ["my-subscription"] as const;

export const BILLING_DEFAULTS: BillingInfo = {
  enabled: false,
  provider: "revenuecat",
  ios_api_key: null,
  android_api_key: null,
  entitlement_id: "pro",
  monthly_product_id: null,
  yearly_product_id: null,
  currency: "USD",
  monthly_amount: 0,
  yearly_amount: 0,
  pro_label: "SKANAROUND Pro",
  pro_pitch: "Unlock unlimited signals, longer range and more.",
  free_daily_signals: 5,
  free_max_radius_m: 500,
  free_messages_per_match: 0,
  pro_unlimited_signals: true,
  pro_extended_radius: true,
  pro_unlimited_messages: true,
  pro_see_who_signaled: true,
  pro_priority_beacon: true,
  pro_custom_beacon: true,
};



/** Public, safe billing configuration (never includes the secret key). */
export function useBillingInfo() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        void queryClient.invalidateQueries({ queryKey: BILLING_INFO_KEY });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return useQuery({
    queryKey: BILLING_INFO_KEY,
    staleTime: 60_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<BillingInfo> => {
      // billing_public_info is intentionally restricted to signed-in members.
      // Waiting for getSession also gives the auth client a chance to restore or
      // refresh its token on a native cold launch before the RPC is sent.
      const { data: auth, error: authError } = await supabase.auth.getSession();
      if (authError) throw new Error(authError.message);
      if (!auth.session) throw new Error("Sign in to load membership settings.");
      const { data, error } = await (supabase as any).rpc("billing_public_info");
      // Never swallow this: a silent failure hides the whole membership card.
      if (error) throw new Error(error.message ?? "Could not load membership settings.");
      const row = Array.isArray(data) ? data[0] : data;
      return { ...BILLING_DEFAULTS, ...(row ?? {}) } as BillingInfo;
    },
  });
}


export type MySubscription = {
  status: string;
  plan: string;
  expiresAt: string | null;
  isPro: boolean;
};

/** The signed-in member's subscription state. */
export function useMySubscription() {
  return useQuery({
    queryKey: MY_SUB_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<MySubscription> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { status: "none", plan: "free", expiresAt: null, isPro: false };
      const { data, error } = await (supabase as any)
        .from("subscriptions")
        .select("status, plan, expires_at")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw new Error(error.message ?? "Could not load your membership.");

      const active =
        data?.status === "active" &&
        (!data.expires_at || new Date(data.expires_at) > new Date());
      return {
        status: data?.status ?? "none",
        plan: data?.plan ?? "free",
        expiresAt: data?.expires_at ?? null,
        isPro: Boolean(active),
      };
    },
  });
}

/** Convenience flag used to gate premium features across the app. */
export function useIsPro() {
  const { data } = useMySubscription();
  return Boolean(data?.isPro);
}

export function formatAmount(minor: number, currency: string) {
  const value = (Number(minor) || 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
