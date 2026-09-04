import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, CloudSun } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";
import { isServiceDegraded, subscribeServiceHealth } from "@/lib/service-health";

/**
 * Status strip shown when the app can't reach the service (backend errors,
 * repeated request failures) even though the device itself is online.
 * While degraded the health monitor keeps retrying; the moment the backend
 * answers again this switches to a short "Back to normal" flash and hides.
 */
export function ServiceStatusBanner() {
  const degraded = useSyncExternalStore(subscribeServiceHealth, isServiceDegraded, () => false);
  const online = useOnline();
  const queryClient = useQueryClient();
  const wasDegraded = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (degraded) {
      wasDegraded.current = true;
      setRestored(false);
      return;
    }
    if (!wasDegraded.current) return;
    wasDegraded.current = false;
    // Service is back: refresh whatever failed while things were broken.
    queryClient.invalidateQueries();
    setRestored(true);
    const timer = setTimeout(() => setRestored(false), 2500);
    return () => clearTimeout(timer);
  }, [degraded, queryClient]);

  // When the device is offline the OfflineBanner already covers it.
  const showProblem = degraded && online;
  if (!showProblem && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[99] flex justify-center pt-[calc(var(--safe-top,0px)+2.75rem)]"
    >
      <div
        className={`mt-1 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${
          showProblem
            ? "bg-amber-500/90 text-white"
            : "bg-primary/90 text-primary-foreground"
        }`}
      >
        {showProblem ? (
          <>
            <CloudOff className="size-3.5 animate-pulse" aria-hidden="true" />
            Something isn't working right — retrying automatically
          </>
        ) : (
          <>
            <CloudSun className="size-3.5" aria-hidden="true" />
            Back to normal
          </>
        )}
      </div>
    </div>
  );
}
