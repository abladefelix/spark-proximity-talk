import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return "unsupported" as const;
  return Notification.requestPermission();
}

function push(title: string, body: string) {
  if (notificationsSupported() && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.ico", tag: title });
      return;
    } catch {
      /* fall through to toast */
    }
  }
  toast(title, { description: body });
}

async function nameOf(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? (data?.username ? `@${data.username}` : "Someone");
}

/** Global listener: notifies on new signals, new matches and new messages. */
export function useNotifications(myId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel("skanaround-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals", filter: `to_user=eq.${myId}` },
        async (payload) => {
          const from = (payload.new as { from_user: string }).from_user;
          push("New signal on SKANAROUND", `${await nameOf(from)} wants to chat.`);
          queryClient.invalidateQueries({ queryKey: ["nearby"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "matches" },
        (payload) => {
          const m = payload.new as { user_a: string; user_b: string };
          if (m.user_a !== myId && m.user_b !== myId) return;
          push("It's mutual", "Your chat just unlocked.");
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["nearby"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as { sender_id: string; content: string; match_id: string };
          if (msg.sender_id === myId) return;
          if (window.location.pathname.includes(msg.match_id)) return;
          push(await nameOf(msg.sender_id), msg.content.slice(0, 120));
          queryClient.invalidateQueries({ queryKey: ["matches"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId, queryClient]);
}
