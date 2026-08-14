import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useServerFn } from "@tanstack/react-start";
import { useChatSheet } from "@/components/ChatSheet";
import { registerPushToken } from "@/lib/push-notifications.functions";

export function usePushNotifications(userId: string | null) {
  const { openChat } = useChatSheet();
  const register = useServerFn(registerPushToken);

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform()) return;

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

    listeners.push(
      PushNotifications.addListener("pushNotificationActionPerformed", async ({ notification }) => {
        const data = notification.data as { kind?: string; relatedId?: string } | undefined;
        if (data?.kind === "match" || data?.kind === "message") {
          if (data.relatedId) openChat(data.relatedId);
        }
      })
    );

    return () => {
      unmounted = true;
      listeners.forEach((l) => l.then((h) => h.remove()));
    };
  }, [userId, openChat, register]);
}
