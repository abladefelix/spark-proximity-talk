import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBillingInfo, useMySubscription } from "@/hooks/useBilling";

export type ProFeature = {
  key: string;
  label: string;
  description: string;
  pro_only: boolean;
  sort_order: number;
};

export type ProPackage = {
  id: string;
  name: string;
  description: string;
  entitlement_id: string;
  monthly_product_id: string | null;
  yearly_product_id: string | null;
  currency: string;
  monthly_amount: number;
  yearly_amount: number;
  features: string[];
  active: boolean;
  sort_order: number;
};

export const PRO_FEATURES_KEY = ["pro-features"] as const;
export const PRO_PACKAGES_KEY = ["pro-packages"] as const;

/** Feature keys the app gates on. Admin decides which of these are paid. */
export const FEATURE = {
  unlimitedSignals: "unlimited_signals",
  extendedRadius: "extended_radius",
  unlimitedMessages: "unlimited_messages",
  seeWhoSignaled: "see_who_signaled",
  priorityBeacon: "priority_beacon",
  customBeacon: "custom_beacon",
  invisibleMode: "invisible_mode",
} as const;

export function useProFeatures() {
  return useQuery({
    queryKey: PRO_FEATURES_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<ProFeature[]> => {
      const { data } = await (supabase as any)
        .from("pro_features")
        .select("key, label, description, pro_only, sort_order")
        .order("sort_order", { ascending: true });
      return (data ?? []) as ProFeature[];
    },
  });
}

export function useProPackages(includeInactive = false) {
  return useQuery({
    queryKey: [...PRO_PACKAGES_KEY, includeInactive],
    staleTime: 60_000,
    queryFn: async (): Promise<ProPackage[]> => {
      let q = (supabase as any)
        .from("pro_packages")
        .select("*")
        .order("sort_order", { ascending: true });
      if (!includeInactive) q = q.eq("active", true);
      const { data } = await q;
      return (data ?? []) as ProPackage[];
    },
  });
}

/**
 * Feature gating for the signed-in member.
 * A feature is locked when memberships are on, the admin marked it paid,
 * and the member's active package doesn't include it.
 */
export function useFeatureAccess() {
  const { data: billing } = useBillingInfo();
  const { data: features = [] } = useProFeatures();
  const { data: packages = [] } = useProPackages();
  const { data: sub } = useMySubscription();

  const billingOn = Boolean(billing?.enabled);
  const isPro = Boolean(sub?.isPro);
  const plan = sub?.plan ?? "free";

  const active =
    packages.find((p) => p.id === plan) ??
    packages.find(
      (p) => p.monthly_product_id === plan || p.yearly_product_id === plan,
    ) ??
    packages.find((p) => p.entitlement_id === plan) ??
    null;

  const isPaidFeature = (key: string) => {
    const f = features.find((x) => x.key === key);
    // Unknown keys default to paid so nothing leaks before the catalog loads.
    return billingOn && (f ? f.pro_only : true);
  };

  const has = (key: string) => {
    if (!isPaidFeature(key)) return true;
    if (!isPro) return false;
    // Admin grants and legacy plans (no matching package) unlock everything paid.
    if (!active) return true;
    return active.features.includes(key);
  };

  return { isPro, billingOn, features, packages, activePackage: active, has, isPaidFeature };
}

/** True when the member may NOT use this feature. */
export function useFeatureLocked(key: string) {
  const { has } = useFeatureAccess();
  return !has(key);
}
