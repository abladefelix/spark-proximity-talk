import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { CapgoCompass } from "@capgo/capacitor-compass";

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
  const nativeRestart = useRef<(() => Promise<boolean>) | null>(null);
  const requestIosOrientation = useRef<(() => Promise<boolean>) | null>(null);

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

    // Shared DOM fallback: works in the browser and inside the native WebView
    // when the plugin never delivers a reading.
    const domHandler = (event: DeviceOrientationEvent) => {
      const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkit === "number" && Number.isFinite(webkit)) {
        apply(webkit);
        return;
      }
      if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
        apply((360 - event.alpha) % 360);
      }
    };

    if (Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      const orientationEvent = window.DeviceOrientationEvent as
        | (typeof DeviceOrientationEvent & { requestPermission?: () => Promise<PermissionState> })
        | undefined;
      let disposed = false;
      let headingHandle: { remove: () => Promise<void> } | null = null;
      let accuracyHandle: { remove: () => Promise<void> } | null = null;
      let fallbackAttached = false;
      const attachFallback = () => {
        if (fallbackAttached || disposed) return;
        fallbackAttached = true;
        setListening(true);
        window.addEventListener("deviceorientationabsolute", domHandler as EventListener);
        window.addEventListener("deviceorientation", domHandler as EventListener);
      };

      // WKWebView requires this API to be called directly from a tap. The
      // native compass uses Core Location, but the WebKit sensor is the most
      // reliable fallback on iPhone when true-heading updates stall.
      if (platform === "ios" && typeof orientationEvent?.requestPermission === "function") {
        setNeedsPermission(true);
        requestIosOrientation.current = async () => {
          try {
            const state = await orientationEvent.requestPermission?.();
            if (state !== "granted") return false;
            setNeedsPermission(false);
            samples.current = 0;
            setSettled(false);
            attachFallback();
            return true;
          } catch {
            return false;
          }
        };
      }
      // If the plugin hasn't produced a heading shortly after start, stop
      // showing "Finding north…" forever and use the WebView sensors instead.
      const fallbackTimer = window.setTimeout(() => {
        if (smoothed.current == null) attachFallback();
      }, 3000);


      const startNative = async () => {
        try {
          // Android exposes the magnetometer without a runtime permission, and
          // some plugin versions report "prompt"/"denied" there anyway. Only
          // gate on the permission state for iOS, which really does need it.
          if (platform === "ios") {
            const permission = await CapgoCompass.checkPermissions().catch(() => null);
            if (permission && permission.compass !== "granted") {
              const asked = await CapgoCompass.requestPermissions().catch(() => null);
              if (!asked || asked.compass !== "granted") {
                setNeedsPermission(true);
                return false;
              }
            }
          }
          if (platform !== "ios" || typeof orientationEvent?.requestPermission !== "function") {
            setNeedsPermission(false);
          }
          samples.current = 0;
          setSettled(false);
          setListening(true);
          headingHandle = await CapgoCompass.addListener("headingChange", ({ value }) => {
            if (!disposed && Number.isFinite(value)) apply((value + 360) % 360);
          });
          accuracyHandle = await CapgoCompass.addListener("accuracyChange", ({ accuracy }) => {
            if (!disposed && accuracy > 0) setSettled(true);
          });
          await CapgoCompass.startListening({ minInterval: 80, minHeadingChange: 1 });
          // A one-off read is a nice-to-have: some devices reject it until the
          // first sensor tick arrives, which must not fail the whole start.
          try {
            const initial = await CapgoCompass.getCurrentHeading();
            if (!disposed && Number.isFinite(initial.value)) apply((initial.value + 360) % 360);
          } catch {
            /* readings will still arrive through the listener */
          }
          return true;
        } catch {
          setListening(false);
          return false;
        }
      };

      nativeRestart.current = async () => {
        try {
          if (platform === "ios") {
            const permission = await CapgoCompass.requestPermissions().catch(() => null);
            if (permission && permission.compass !== "granted") return false;
          }
          await CapgoCompass.stopListening().catch(() => undefined);
          await headingHandle?.remove().catch(() => undefined);
          await accuracyHandle?.remove().catch(() => undefined);
          headingHandle = null;
          accuracyHandle = null;
          return startNative();
        } catch {
          return false;
        }
      };

      void startNative();

      return () => {
        disposed = true;
        window.clearTimeout(fallbackTimer);
        nativeRestart.current = null;
        requestIosOrientation.current = null;
        window.removeEventListener("deviceorientationabsolute", domHandler as EventListener);
        window.removeEventListener("deviceorientation", domHandler as EventListener);
        void headingHandle?.remove();
        void accuracyHandle?.remove();
        void CapgoCompass.stopListening().catch(() => undefined);
        setListening(false);
      };
    }

    const handler = domHandler;



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
    if (Capacitor.isNativePlatform()) {
      const iosOrientation = requestIosOrientation.current;
      const orientationGranted = iosOrientation ? await iosOrientation() : false;
      // No live session yet (compass turned off): let the caller switch it on,
      // the effect will start the sensor. Only report failure on a real restart.
      if (!nativeRestart.current) return true;
      const nativeStarted = await nativeRestart.current();
      return orientationGranted || nativeStarted;
    }

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
        else if (typeof event.alpha === "number" && Number.isFinite(event.alpha))
          apply((360 - event.alpha) % 360);

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
