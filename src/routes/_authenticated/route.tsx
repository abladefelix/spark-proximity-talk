import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { withTimeoutFallback } from "@/lib/net";
import { ChatSheetProvider } from "@/components/ChatSheet";
import { BottomNav } from "@/components/BottomNav";
import { useNotifications } from "@/hooks/useNotifications";
import { useDeviceSessionGuard } from "@/hooks/useDeviceSessionGuard";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { BiometricGate } from "@/components/BiometricGate";

/** Reads the session the auth client persisted, without any network call. */
function storedSessionUser(): { id: string } | null {
  try {
    const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
    const ref = url ? new URL(url).hostname.split(".")[0] : "";
    const raw = ref ? localStorage.getItem(`sb-${ref}-auth-token`) : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { refresh_token?: string; user?: { id?: string } };
    return parsed.refresh_token && parsed.user?.id ? { id: parsed.user.id } : null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the locally cached session; getUser() hits the network
    // on every navigation and made cold app launches feel slow.
    // Offline, a token refresh inside getSession() can hang forever and the app
    // never finishes booting — cap it and fall back to the stored session.
    const { data } = await withTimeoutFallback(
      supabase.auth.getSession(),
      { data: { session: null } } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
      5000,
      "Session check",
    );
    if (data.session?.user) return { user: data.session.user };
    // No live session — the check may have timed out on a cold launch with
    // slow or no network. A stored session means the member is still signed
    // in, so let them in; the client's background refresh renews the token
    // once the network allows. A genuine sign-out clears the stored session,
    // so this never resurrects one.
    const stored = storedSessionUser();
    if (stored) return { user: stored as never };
    throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  useNotifications(user?.id ?? null);
  useDeviceSessionGuard(user?.id ?? null);
  useInactivityTimeout(user?.id ?? null);


  return (
    <BiometricGate>
    <ChatSheetProvider>
      <PushManager userId={user?.id ?? null} />
      <div
        data-app-shell
        className={`mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden overscroll-none ${
          Capacitor.getPlatform() === "android" ? "-translate-y-1.5" : ""
        }`}
      >
        <div
          data-scrollable
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </ChatSheetProvider>
    </BiometricGate>
  );
}

function PushManager({ userId }: { userId: string | null }) {
  usePushNotifications(userId);
  return null;
}

