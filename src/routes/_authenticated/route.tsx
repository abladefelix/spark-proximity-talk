import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ChatSheetProvider } from "@/components/ChatSheet";
import { BottomNav } from "@/components/BottomNav";
import { useNotifications } from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  useNotifications(user?.id ?? null);

  return (
    <ChatSheetProvider>
      <PushManager userId={user?.id ?? null} />
      <div
        data-app-shell
        className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden overscroll-none"
      >
        <div
          data-scrollable
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(3.5rem+env(safe-area-inset-bottom))]"
        >
          <Outlet />
        </div>
        <BottomNav />
      </div>
    </ChatSheetProvider>
  );
}

function PushManager({ userId }: { userId: string | null }) {
  usePushNotifications(userId);
  return null;
}

