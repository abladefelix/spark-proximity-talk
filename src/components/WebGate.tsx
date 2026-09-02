import { useEffect, useState, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";

export const APP_STORE_URL = "https://apps.apple.com/app/skanaround";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.skanaround.mobile";

/** Pages that stay reachable in a normal browser while the web app is off. */
const WEB_ALLOWED = ["/verified", "/privacy", "/terms", "/upgrade", "/admin", "/delete-account"];

/**
 * The product ships as a native app for now. In a desktop/mobile browser every
 * app screen is replaced by a download page; only legal/utility pages remain.
 */
/** Admin switch: is the browser version of the app turned on? */
export function useWebAppEnabled() {
  return useQuery({
    queryKey: ["web-app-enabled"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("web_app_enabled")
        .eq("id", "global")
        .maybeSingle();
      return Boolean(data?.web_app_enabled);
    },
  });
}

export function WebGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  const allowed = WEB_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isNative = hydrated && Capacitor.isNativePlatform();
  const { data: webEnabled, isLoading } = useWebAppEnabled();

  if (!hydrated || isNative || allowed) return <>{children}</>;
  // Wait for the admin setting before deciding, so the wall never flashes.
  if (isLoading) return null;
  if (webEnabled) return <>{children}</>;

  return <DownloadWall />;
}

function DownloadWall() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center">
          <BrandMark size={64} />
        </div>
        <p className="mt-4 text-xs font-semibold tracking-[0.32em] text-muted-foreground">
          SKANAROUND
        </p>
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-foreground">
          Get the app
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          SKANAROUND lives on your phone — proximity discovery needs your location and compass.
          Download it to see who&rsquo;s around you right now.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={APP_STORE_URL}
            className="flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Download for iPhone
          </a>
          <a
            href={PLAY_STORE_URL}
            className="flex w-full items-center justify-center rounded-2xl border border-border px-5 py-3.5 text-sm font-semibold text-foreground transition hover:bg-accent"
          >
            Download for Android
          </a>
        </div>

        <div className="mt-10 flex justify-center gap-5 text-xs text-muted-foreground">
          <a href="/privacy" className="underline underline-offset-4">
            Privacy
          </a>
          <a href="/terms" className="underline underline-offset-4">
            Terms
          </a>
        </div>
      </div>
    </main>
  );
}
