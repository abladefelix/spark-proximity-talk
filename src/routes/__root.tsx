import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/app-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/useTheme";
import { AccentProvider } from "@/hooks/useAccent";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { OfflineBanner } from "@/components/OfflineBanner";
import { WebGate } from "@/components/WebGate";
import { ProUpgradeSheetProvider } from "@/components/ProUpgradeSheet";
import { isNetworkError, errorMessage } from "@/lib/net";
import { startCachePersistence } from "@/lib/query-persist";

function useNativeViewportLock() {
  useEffect(() => {
    const lastY = new WeakMap<EventTarget, number>();
    const preventOverscroll = (e: TouchEvent) => {
      // Browser-only pages (admin console) keep native document scrolling.
      if (document.body.hasAttribute("data-web-page")) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const scrollable = target.closest("[data-scrollable]");
      if (!scrollable) {
        e.preventDefault();
        return;
      }
      const el = scrollable as HTMLElement;
      const touch = e.touches[0];
      if (!touch) return;
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const prevY = lastY.get(e.target as EventTarget) ?? touch.clientY;
      const goingDown = touch.clientY > prevY;
      const goingUp = touch.clientY < prevY;
      if ((atTop && goingDown) || (atBottom && goingUp)) {
        e.preventDefault();
      }
      lastY.set(e.target as EventTarget, touch.clientY);
    };
    document.addEventListener("touchmove", preventOverscroll, { passive: false });
    return () => document.removeEventListener("touchmove", preventOverscroll);
  }, []);
}


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const offline = isNetworkError(error);
  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {offline ? "You're offline" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {offline
            ? errorMessage(error)
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "SKANAROUND — Proximity chat" },
      {
        name: "description",
        content: "Discover people near you, send a signal, and chat when it's mutual.",
      },
      { name: "theme-color", content: "#241a13" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement,ls=localStorage;"+
              // Light is the product default; only an explicit user choice
              // switches to dark.
              "var t=ls.getItem('skanaround-theme')||'light';"+
              "if(t==='dark')d.classList.add('dark');"+
              "var h=ls.getItem('skanaround-accent-hue');if(h){var p=t==='dark'?'oklch(0.74 0.135 '+h+')':'oklch(0.65 0.16 '+h+')';var f=t==='dark'?'oklch(0.17 0.02 '+h+')':'oklch(0.99 0.005 '+h+')';d.style.setProperty('--primary',p);d.style.setProperty('--primary-foreground',f);d.style.setProperty('--sidebar-primary',p);d.style.setProperty('--sidebar-primary-foreground',f);d.style.setProperty('--ring',p);}"+
              "var fam=ls.getItem('skanaround-font');if(fam){d.style.setProperty('--font-sans-active','\"'+fam+'\", ui-sans-serif, system-ui, sans-serif');}"+
              "var gm=ls.getItem('skanaround-gender-colors');if(gm){var g=gm.split(',');d.style.setProperty('--gender-male',g[0]);d.style.setProperty('--gender-female',g[1]);d.style.setProperty('--gender-other',g[2]);}"+
              "}catch(e){}",
          }}
        />
        <div id="app-scroll">{children}</div>
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useNativeViewportLock();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });

    // Native shells (and backgrounded tabs) can come back with a session that
    // was established outside this document — re-read it instead of waiting
    // for a full app relaunch.
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          router.invalidate();
          queryClient.invalidateQueries();
        }
      });
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("pageshow", recheck);

    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("pageshow", recheck);
    };
  }, [router, queryClient]);

  // Keep the last known data on disk so a relaunch paints instantly.
  useEffect(() => startCachePersistence(queryClient), [queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AccentProvider>
          <AppSettingsProvider>
            <ProUpgradeSheetProvider>
              <OfflineBanner />
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <WebGate>
                <Outlet />
              </WebGate>
              <Toaster position="top-center" />
            </ProUpgradeSheetProvider>
          </AppSettingsProvider>
        </AccentProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

