import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useServerFn } from "@tanstack/react-start";
import { useChatSheet } from "@/components/ChatSheet";
import { registerPushToken } from "@/lib/push-notifications.functions";
import { useSettings } from "@/hooks/useAppSettings";

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

    void PushNotifications.addListener(
      "pushNotificationActionPerformed",
      ({ notification }) => {
        const raw = notification.data;
        const kind = typeof raw?.kind === "string" ? raw.kind : "";
        const relatedId = typeof raw?.relatedId === "string" ? raw.relatedId : "";
        if ((kind === "match" || kind === "message") && relatedId) {
          openChat(relatedId);
        }
      },
    ).then((handle) => {
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [openChat]);

  useEffect(() => {
    if (!userId || !settings.push_enabled || !Capacitor.isNativePlatform()) return;

    // Android push needs a google-services.json in the native project. Without
    // it FirebaseApp never initialises and PushNotifications.register() throws
    // a FATAL native exception that kills the app. Registration is therefore
    // opt-in: set VITE_FIREBASE_CONFIGURED=true once the file is in place.
    if (
      Capacitor.getPlatform() === "android" &&
      import.meta.env['VITE_FIREBASE_CONFIGURED'] !== "true"
    ) {
      return;
    }

    let unmounted = false;
    const listeners: Promise<{ remove: () => void }>[] = [];

    PushNotifications.requestPermissions().then((res) => {
      if (res.receive === "granted") {
        PushNotifications.register();
      }
    });

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

    listeners.push(
      PushNotifications.addListener("pushNotificationReceived", async () => {
        // Foreground notification: Supabase realtime already updates the UI,
        // so we don't need to show an extra alert here.
      })
    );

    return () => {
      unmounted = true;
      listeners.forEach((l) => l.then((h) => h.remove()));
    };
  }, [userId, settings.push_enabled, register]);
}
