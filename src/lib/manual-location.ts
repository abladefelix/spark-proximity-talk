import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { runNativePermissionPrompt } from "@/lib/native-permission-queue";

/** Only call from an explicit user action. Never watch, restore or auto-refresh. */
export async function getManualPosition() {
  if (Capacitor.isNativePlatform()) {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
      const result = await runNativePermissionPrompt(() => Geolocation.requestPermissions());
      if (result.location !== "granted" && result.coarseLocation !== "granted") {
        throw new Error("Allow location in your device settings, then check in again.");
      }
    }
    return (
      await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
    ).coords;
  }
  if (!navigator.geolocation) throw new Error("Location is unavailable on this device.");
  return (
    await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    })
  ).coords;
}
