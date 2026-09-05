import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// This shared config already includes TanStack Start, React, Tailwind CSS,
// path aliases, Vite env injection, and build tooling. Add project-specific
// options below only; do not duplicate those plugins.


export default defineConfig({
  // RevenueCat must stay bundled so its official client can register the
  // native Capacitor plugin without Node trying to resolve its ESM internals.
  ssr: {
    noExternal: [
      "@revenuecat/purchases-capacitor",
      "@revenuecat/purchases-typescript-internal-esm",
    ],
  },
  // Self-hosting: build a plain Node server (works on a Windows VPS).
  // Inside Lovable, LOVABLE_NITRO_PRESET overrides this automatically.
  nitro: { preset: "node-server" },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
