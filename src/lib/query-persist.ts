import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

/**
 * Warm start: the last known chats, profiles and settings are written to
 * localStorage so a relaunch paints real content instantly instead of
 * spinners, then quietly refreshes in the background.
 *
 * Client-only — call it from an effect, never during SSR.
 */
export function startCachePersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => {};

  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "skanaround-query-cache",
      throttleTime: 1000,
    });

    const [unsubscribe] = persistQueryClient({
      queryClient,
      persister,
      // Anything older than a day is stale enough to just refetch.
      maxAge: 24 * 60 * 60 * 1000,
      buster: "v1",
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          if (query.state.status !== "success") return false;
          const root = String(query.queryKey[0] ?? "");
          // Never persist admin data or anything holding short-lived signed URLs.
          return !root.startsWith("admin") && root !== "backup";
        },
      },
    });

    return unsubscribe;
  } catch {
    // Private mode / storage full — caching is a bonus, not a requirement.
    return () => {};
  }
}
