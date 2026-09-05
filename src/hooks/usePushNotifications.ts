import { useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useServerFn } from "@tanstack/react-start";
import { useChatSheet } from "@/components/ChatSheet";
import { registerPushToken } from "@/lib/push-notifications.functions";
import { useSettings } from "@/hooks/useAppSettings";
import { nativeDebug, nativeDebugError } from "@/lib/native-debug";

type FirebaseStatusPlugin = {
  getStatus: () => Promise<{ configured: boolean }>;
};

const FirebaseStatus = registerPlugin<FirebaseStatusPlugin>("FirebaseStatus");

async function canRegisterForPush() {
  if (Capacitor.getPlatform() !== "android") return true;
  try {
    const status = await FirebaseStatus.getStatus();
    nativeDebug("android Firebase status checked", { configured: status.configured });
    return status.configured;
  } catch (error) {
    nativeDebugError("android Firebase status check failed", error);
    return false;
  }
}

export function usePushNotifications(userId: string | null) {
  const { openChat } = useChatSheet();
  const register = useServerFn(registerPushToken);
  const settings = useSettings();

  // Listen for notification taps as soon as the signed-in app shell mounts.
  // Token registration can wait for settings, but a cold-start tap cannot.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;

    const handles: Promise<{ remove: () => void }>[] = [];

    // Android 8+ drops (and in some OEM builds crashes on) a notification whose
    // channel does not exist. Create ours before any message can arrive.
    if (Capacitor.getPlatform() === "android") {
      void PushNotifications.createChannel({
        id: "skanaround_default",
        name: "SKANAROUND",
        description: "Signals, matches and messages",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
      }).catch((e) => console.error("[Push] channel setup failed", e));
    }

    const tap = PushNotifications.addListener(
      "pushNotificationActionPerformed",
      ({ notification }) => {
        try {
          const raw = (notification?.data ?? {}) as Record<string, unknown>;
          const kind = typeof raw['kind'] === "string" ? raw['kind'] : "";
          const relatedId = typeof raw['relatedId'] === "string" ? raw['relatedId'].trim() : "";

          if ((kind === "match" || kind === "message") && relatedId) {
            openChat(relatedId);
          }
        } catch (e) {
          console.error("[Push] tap handling failed", e);
        }
      },
    );
    handles.push(tap);
    void tap.then((handle) => {
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    }).catch((e) => console.error("[Push] tap listener failed", e));

    // A foreground push must never bubble as an unhandled error.
    handles.push(
      PushNotifications.addListener("pushNotificationReceived", () => {
        // Realtime already refreshes the UI; nothing extra to show.
      }),
    );

    return () => {
      cancelled = true;
      remove?.();
      handles.forEach((h) => void h.then((x) => x.remove()).catch(() => {}));
    };
  }, [openChat]);


  useEffect(() => {
    if (!userId || !settings.push_enabled || !Capacitor.isNativePlatform()) return;

    let unmounted = false;
    const listeners: Promise<{ remove: () => void }>[] = [];

    canRegisterForPush()
      .then((configured) => {
        if (!configured || unmounted) return undefined;
        return PushNotifications.requestPermissions();
      })
      .then((res) => {
        if (res?.receive === "granted" && !unmounted) {
          nativeDebug("registering Android push notifications");
          return PushNotifications.register();
        }
        return undefined;
      })
      .catch((error) => nativeDebugError("push registration failed", error));

    listeners.push(
      PushNotifications.addListener("registration", async ({ value }) => {
        if (unmounted || !value) return;
        try {
          await register({ data: { token: value, platform: Capacitor.getPlatform() } });
        } catch (e) {
          console.error("[Push] token registration failed", e);
        }
      })
    );

    listeners.push(
      PushNotifications.addListener("registrationError", async (err) => {
        console.error("[Push] registration error", err);
      })
    );

    return () => {
      unmounted = true;
      listeners.forEach((l) => void l.then((h) => h.remove()).catch(() => {}));
    };
  }, [userId, settings.push_enabled, register]);

}
