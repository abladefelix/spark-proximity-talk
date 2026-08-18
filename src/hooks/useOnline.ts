import { useCallback, useEffect, useRef, useState } from "react";

/**
 * `navigator.onLine` only reports that an interface is up — a Wi-Fi network
 * with no upstream still reads as online. We confirm with a cheap same-origin
 * request so a dead connection is treated as offline.
 */
async function probe(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    await fetch(`/favicon.png?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

/** Live connectivity state, safe for SSR (assumes online until hydrated). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  const running = useRef(false);

  const check = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const ok = await probe();
    running.current = false;
    setOnline(ok);
  }, []);

  useEffect(() => {
    const sync = () => {
      if (navigator.onLine === false) {
        setOnline(false);
        return;
      }
      void check();
    };
    sync();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, 10_000);

    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [check]);

  return online;
}
