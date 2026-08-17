import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/**
 * Thin status strip pinned under the status bar whenever the device drops
 * offline, plus an automatic refetch of everything once it comes back.
 */
export function OfflineBanner() {
  const online = useOnline();
  const queryClient = useQueryClient();
  const wasOffline = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    queryClient.invalidateQueries();
    setRestored(true);
    const timer = setTimeout(() => setRestored(false), 2500);
    return () => clearTimeout(timer);
  }, [online, queryClient]);

  if (online && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center pt-[var(--safe-top,0px)]"
    >
      <div
        className={`mt-1 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur ${
          online
            ? "bg-primary/90 text-primary-foreground"
            : "bg-destructive/90 text-destructive-foreground"
        }`}
      >
        <WifiOff className="size-3.5" aria-hidden="true" />
        {online ? "Back online" : "No internet connection"}
      </div>
    </div>
  );
}
