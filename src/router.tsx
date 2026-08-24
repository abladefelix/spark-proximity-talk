import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isNetworkError } from "./lib/net";
import { bootTheme } from "./lib/theme-boot";

// Fetch the admin-configured look immediately, before React mounts, so a stale
// cached theme/accent is replaced as early as possible on cold start.
void bootTheme();

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Keep showing cached data while offline instead of hanging on a spinner.
        networkMode: "offlineFirst",
        refetchOnReconnect: true,
        refetchOnWindowFocus: false,
        // Serve cached data instantly on revisit, refresh quietly behind it.
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (failureCount, error) => (isNetworkError(error) ? failureCount < 3 : failureCount < 1),
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: {
        networkMode: "offlineFirst",
        retry: (failureCount, error) => isNetworkError(error) && failureCount < 2,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
