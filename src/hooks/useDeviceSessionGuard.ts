import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId } from "@/lib/device-id";
import { checkDeviceSession } from "@/lib/device-session.functions";

/**
 * Keeps one account on one device: if the session was claimed elsewhere (or
 * revoked from the new device), this device signs itself out.
 */
export function useDeviceSessionGuard(userId: string | null) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await checkDeviceSession({ data: { deviceId } });
        if (cancelled || res.active) return;
        cancelled = true;
        await supabase.auth.signOut();
        toast.error("Signed out", {
          description: "Your account was signed in on another device.",
        });
        navigate({ to: "/auth", replace: true });
      } catch {
        /* offline or transient — keep the session */
      }
    }

    check();
    const timer = window.setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, navigate]);
}
