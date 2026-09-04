import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_INACTIVITY_MIN = 60;
const STORAGE_KEY = "skanaround-last-active";
const CHECK_MS = 30_000;

/** Admin-controlled auto sign-out delay, in minutes (0 = never). */
export function useInactivityTimeoutMinutes() {
  return useQuery({
    queryKey: ["app-inactivity-timeout"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("inactivity_timeout_min")
        .eq("id", "global")
        .maybeSingle();
      const value = Number(data?.inactivity_timeout_min ?? DEFAULT_INACTIVITY_MIN);
      return Number.isFinite(value) && value >= 0 ? value : DEFAULT_INACTIVITY_MIN;
    },
  });
}

function readLastActive(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : Date.now();
  } catch {
    return Date.now();
  }
}

function writeLastActive(at: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Signs a member out after a stretch of no interaction. The timestamp lives in
 * storage, so time spent with the app closed or backgrounded counts too.
 */
export function useInactivityTimeout(userId: string | null) {
  const navigate = useNavigate();
  const { data: minutes } = useInactivityTimeoutMinutes();

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const limitMs = (minutes ?? DEFAULT_INACTIVITY_MIN) * 60_000;
    if (limitMs <= 0) return;

    let done = false;
    const touch = () => writeLastActive(Date.now());
    if (!localStorage.getItem(STORAGE_KEY)) touch();

    // A fresh sign-in must never be voided by a stale timestamp left over from
    // an earlier session on this device.
    const authSub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") touch();
    });

    async function expire() {
      if (done) return;
      done = true;
      writeLastActive(Date.now());
      await supabase.auth.signOut();
      toast("Signed out", { description: "You were inactive for a while." });
      navigate({ to: "/auth", replace: true });
    }

    function check() {
      if (Date.now() - readLastActive() >= limitMs) void expire();
    }

    const events = ["pointerdown", "keydown", "touchstart", "wheel", "focus"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
      else touch();
    };
    document.addEventListener("visibilitychange", onVisible);

    check();
    const timer = window.setInterval(check, CHECK_MS);
    return () => {
      window.clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, minutes, navigate]);
}
