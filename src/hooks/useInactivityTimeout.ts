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
 * Signs a member out after a stretch of no interaction. Only time with the app
 * actually open counts — closing or backgrounding the app pauses the clock, so
 * reopening never forces a fresh sign-in while the session is still valid.
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
    // Launching or reopening the app is itself activity — reset the clock so a
    // member who closed the app a while ago is never greeted by a sign-out.
    touch();

    // A fresh sign-in must never be voided by a stale timestamp left over from
    // an earlier session on this device.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") touch();
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
      // Returning to the foreground counts as activity; the idle clock only
      // runs while the app is open and untouched.
      if (document.visibilityState === "visible") touch();
      else touch();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Wait for the current session before the first check: a sign-in that
    // happened after the stored timestamp counts as activity.
    void supabase.auth.getSession().then(({ data }) => {
      if (done) return;
      const signedInAt = Date.parse(data.session?.user?.last_sign_in_at ?? "");
      if (Number.isFinite(signedInAt) && signedInAt > readLastActive()) touch();
      check();
    });

    const timer = window.setInterval(check, CHECK_MS);
    return () => {
      window.clearInterval(timer);
      authSub.subscription.unsubscribe();
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, minutes, navigate]);
}
