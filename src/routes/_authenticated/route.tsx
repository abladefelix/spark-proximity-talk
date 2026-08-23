import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { withTimeoutFallback } from "@/lib/net";
import { ChatSheetProvider } from "@/components/ChatSheet";
import { BottomNav } from "@/components/BottomNav";
import { useNotifications } from "@/hooks/useNotifications";
import { useDeviceSessionGuard } from "@/hooks/useDeviceSessionGuard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { BiometricGate } from "@/components/BiometricGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession() reads the locally cached session; getUser() hits the network
    // on every navigation and made cold app launches feel slow.
    // Offline, a token refresh inside getSession() can hang forever and the app
    // never finishes booting — cap it and fall back to "no session".
    const { data } = await withTimeoutFallback(
      supabase.auth.getSession(),
      { data: { session: null } } as Awaited<ReturnType<typeof supabase.auth.getSession>>,
      5000,
      "Session check",
    );
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  useNotifications(user?.id ?? null);

  return (
    <BiometricGate>
    <ChatSheetProvider>
      <PushManager userId={user?.id ?? null} />
      <div
        data-app-shell
        className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden overscroll-none"
      >
        <div
          data-scrollable
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pt-[var(--safe-top)] pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
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

