import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live device compass heading in degrees (0 = true/magnetic north, clockwise).
 *
 * iOS Safari/WKWebView exposes `webkitCompassHeading` (already true north).
 * Other browsers use the absolute `deviceorientation` event where
 * heading = 360 - alpha. Returns null when no compass is available.
 */
export function useCompassHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [listening, setListening] = useState(false);
  const [settled, setSettled] = useState(false);
  const smoothed = useRef<number | null>(null);
  const samples = useRef(0);

  const apply = useCallback((next: number) => {
    const prev = smoothed.current;
    if (prev == null) {
      smoothed.current = next;
    } else {
      // Shortest-arc low-pass filter so the rose doesn't jitter or spin
      // the long way round when crossing 0/360.
      let delta = ((next - prev + 540) % 360) - 180;
      delta *= 0.25;
      smoothed.current = (prev + delta + 360) % 360;
    }
    samples.current += 1;
    // The first readings lag behind reality while the magnetometer settles,
    // so only trust the rose once enough samples have flowed through.
    if (samples.current >= 12) setSettled(true);
    setHeading(smoothed.current);
  }, []);


  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handler = (event: DeviceOrientationEvent) => {
      const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkit === "number" && Number.isFinite(webkit)) {
        apply(webkit);
        return;
      }
      if (event.absolute && typeof event.alpha === "number") {
        apply((360 - event.alpha) % 360);
      }
    };

    const anyEvent = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> })
      | undefined;

    let attached = false;
    const attach = () => {
      if (attached) return;
      attached = true;
      samples.current = 0;
      setSettled(false);
      setListening(true);
      window.addEventListener("deviceorientationabsolute", handler as EventListener);
      window.addEventListener("deviceorientation", handler as EventListener);
    };

    if (anyEvent && typeof anyEvent.requestPermission === "function") {
      // iOS 13+: needs a user gesture. Flag it and let the UI ask.
      setNeedsPermission(true);
    } else if (anyEvent) {
      attach();
    }


    return () => {
      window.removeEventListener("deviceorientationabsolute", handler as EventListener);
      window.removeEventListener("deviceorientation", handler as EventListener);
    };
  }, [enabled, apply]);

  // Safety net: some devices emit readings slowly, so stop showing
  // "calibrating" after a few seconds once any heading has arrived.
  useEffect(() => {
    if (!listening || settled) return;
    const id = window.setTimeout(() => setSettled(true), 5000);
    return () => window.clearTimeout(id);
  }, [listening, settled]);

  const request = useCallback(async () => {
    const anyEvent = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> })
      | undefined;
    if (!anyEvent?.requestPermission) return false;
    try {
      const state = await anyEvent.requestPermission();
      if (state !== "granted") return false;
      setNeedsPermission(false);
      samples.current = 0;
      setSettled(false);
      setListening(true);
      const handler = (event: DeviceOrientationEvent) => {
        const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
          .webkitCompassHeading;
        if (typeof webkit === "number" && Number.isFinite(webkit)) apply(webkit);
        else if (event.absolute && typeof event.alpha === "number") apply((360 - event.alpha) % 360);
      };
      window.addEventListener("deviceorientation", handler as EventListener);
      return true;
    } catch {
      return false;
    }
  }, [apply]);

  return {
    heading,
    needsPermission,
    request,
    /** True while the magnetometer settles right after the compass is enabled. */
    calibrating: enabled && listening && !settled,
  };
}


const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Human compass point for a bearing, e.g. 47 -> "NE". */
export function compassPoint(bearing: number) {
  return POINTS[Math.round(((bearing % 360) + 360) % 360 / 45) % 8]!;
}
