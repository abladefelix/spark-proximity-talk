import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.b0859620d8d149a093f5f6acf2710f99",
  appName: "SHATTA",
  webDir: "dist",
  server: {
    // Live URL — the native shell loads your published web app so updates are instant
    // without resubmitting to the App Store. Swap this for a local dev IP when testing
    // on an iPhone simulator or device via `npx cap run ios` with live reload.
    url: "https://shatta.caymanirs.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: "false",
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
