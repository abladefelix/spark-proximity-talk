import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import logoUrl from "@/assets/skanaround-logo.png";
import { reportAppError } from "../lib/app-error-reporting";

import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/hooks/useTheme";
import { AccentProvider } from "@/hooks/useAccent";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceStatusBanner } from "@/components/ServiceStatusBanner";
import { WebGate } from "@/components/WebGate";
import { ProUpgradeSheetProvider } from "@/components/ProUpgradeSheet";
import { isNetworkError, isAbortError, errorMessage } from "@/lib/net";
import { reportServiceProblem, reportServiceSuccess } from "@/lib/service-health";
import { startCachePersistence } from "@/lib/query-persist";
import { getAppLook, type AppLook } from "@/lib/app-look.functions";
import { Button } from "@/components/ui/button";


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
    <div data-scrollable className="flex min-h-dvh items-center justify-center overflow-y-auto bg-background px-4 pb-[var(--safe-bottom)] pt-[var(--safe-top)]">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Button asChild><Link to="/">Go home</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const aborted = isAbortError(error);
  const offline = isNetworkError(error);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (aborted) {
      // The request was cancelled (navigation away / reload). Nothing broke —
      // quietly re-run the route instead of showing an error screen.
      router.invalidate();
      reset();
      return;
    }
    console.error(error);
    reportAppError(error, { boundary: "tanstack_root_error_component" });
    reportServiceProblem("root_error_boundary");
  }, [error, aborted]);


  // A failed load leaves nothing to re-render, so a soft retry can silently do
  // nothing. Force a real reload as the fallback, and retry by itself the
  // moment the connection is back.
  const retry = () => {
    setRetrying(true);
    try {
      router.invalidate();
      reset();
    } catch {
      /* fall through to the hard reload */
    }
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.reload();
    }, 600);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBackOnline = () => window.location.reload();
    window.addEventListener("online", onBackOnline);
    return () => window.removeEventListener("online", onBackOnline);
  }, []);

  return (
    <div data-scrollable className="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-4 pb-[var(--safe-bottom)] pt-[var(--safe-top)]">
      <div className="max-w-md text-center">
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          className="mx-auto mb-5 size-16 object-contain"
        />
        <p className="mb-4 text-xs font-semibold tracking-[0.28em] text-muted-foreground">
          SKANAROUND
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {offline ? "You're offline" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {offline
            ? errorMessage(error)
            : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            onClick={retry}
            disabled={retrying}
          >
            {retrying ? "Trying…" : "Try again"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/";
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      return { look: await getAppLook() };
    } catch {
      return { look: null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
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
  // The admin-configured look, fetched server-side, so the very first paint is
  // already correct instead of flashing the built-in scheme.
  let look: AppLook | null = null;
  try {
    look = (Route.useLoaderData() as { look: AppLook | null } | undefined)?.look ?? null;
  } catch {
    look = null;
  }
  const serverLook = JSON.stringify(look);

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
              `var sv=${serverLook};`+
              // Light is the product default; only an explicit user choice
              // switches to dark.
              "var t=ls.getItem('skanaround-theme')||'light';"+
              "if(t==='dark')d.classList.add('dark');"+
              // Server value wins over the cached one so an admin change shows
              // on the very next launch.
              "var h=(sv&&sv.accent_hue!=null?String(sv.accent_hue):null)||ls.getItem('skanaround-accent-hue');"+
              "if(h){var p=t==='dark'?'oklch(0.74 0.135 '+h+')':'oklch(0.65 0.16 '+h+')';var f=t==='dark'?'oklch(0.17 0.02 '+h+')':'oklch(0.99 0.005 '+h+')';d.style.setProperty('--primary',p);d.style.setProperty('--primary-foreground',f);d.style.setProperty('--sidebar-primary',p);d.style.setProperty('--sidebar-primary-foreground',f);d.style.setProperty('--ring',p);try{ls.setItem('skanaround-accent-hue',h);}catch(e2){}}"+
              "var fam=(sv&&sv.font_family)||ls.getItem('skanaround-font');if(fam){d.style.setProperty('--font-sans-active','\"'+fam+'\", ui-sans-serif, system-ui, sans-serif');try{ls.setItem('skanaround-font',fam);}catch(e3){}}"+
              "var gm=(sv&&sv.color_male&&sv.color_female&&sv.color_other)?[sv.color_male,sv.color_female,sv.color_other].join(','):ls.getItem('skanaround-gender-colors');"+
              "if(gm){var g=gm.split(',');d.style.setProperty('--gender-male',g[0]);d.style.setProperty('--gender-female',g[1]);d.style.setProperty('--gender-other',g[2]);try{ls.setItem('skanaround-gender-colors',gm);}catch(e4){}}"+
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

  // One native back handler keeps Android navigation aligned with the app.
  // Escape closes the top Radix overlay; otherwise Router history handles the
  // current screen (including the chat sheet's pushed history entry).
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.getPlatform() !== "android") return;
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          const overlay = document.querySelector<HTMLElement>(
            '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
          );
          if (overlay) {
            overlay.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
            return;
          }
          if (router.history.canGoBack() || canGoBack) router.history.back();
          else void App.minimizeApp();
        });
        if (cancelled) void handle.remove();
        else remove = () => void handle.remove();
      } catch {
        /* browser preview */
      }
    })();
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

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

  // Feed query/mutation failures into the service-health monitor so the
  // banner appears when things break and clears itself when they recover.
  useEffect(() => {
    const unsubQueries = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== "updated") return;
      const status = event.query.state.status;
      if (status === "error") {
        reportServiceProblem("query", event.query.state.error);
      } else if (status === "success" && event.query.state.dataUpdatedAt > 0) {
        reportServiceSuccess();
      }
    });
    const unsubMutations = queryClient.getMutationCache().subscribe((event) => {
      if (event?.type !== "updated") return;
      const status = event.mutation.state.status;
      if (status === "error") {
        reportServiceProblem("mutation", event.mutation.state.error);
      } else if (status === "success") {
        reportServiceSuccess();
      }
    });
    return () => {
      unsubQueries();
      unsubMutations();
    };
  }, [queryClient]);




  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AccentProvider>
          <AppSettingsProvider>
            <ProUpgradeSheetProvider>
              <OfflineBanner />
              <ServiceStatusBanner />
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

