import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.b0859620d8d149a093f5f6acf2710f99",
  appName: "SHATTA",
  webDir: "dist",
  server: {
    // Points the native shell at the live app so iOS/Android always run the
    // latest build. Swap to your published domain before shipping to stores.
    url: "https://b0859620-d8d1-49a0-93f5-f6acf2710f99.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#141210",
      showSpinner: false,
    },
  },
};

export default config;
