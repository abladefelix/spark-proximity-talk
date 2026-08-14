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
      <div className="mx-auto min-h-screen w-full max-w-lg pb-24">
        <Outlet />
        <BottomNav />
      </div>
    </ChatSheetProvider>
  );
}

function PushManager({ userId }: { userId: string | null }) {
  usePushNotifications(userId);
  return null;
}

