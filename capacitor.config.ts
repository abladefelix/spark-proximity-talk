import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.skanaround.mobile",
  appName: "SkanAround",
  webDir: ".output/public",
  server: {
    // Live URL — the native shell loads your published web app so updates are instant
    // without resubmitting to the App Store. Swap this for a local dev IP when testing
    // on an iPhone simulator or device via `npx cap run ios` with live reload.
    // NOTE: no query string here — Capacitor uses this to decide which URLs are
    // "internal". A query string makes every load look external and it opens in Safari.
    url: "https://shatta.caymanirs.com",
    hostname: "shatta.caymanirs.com",
    allowNavigation: [
      "shatta.caymanirs.com",
      "*.caymanirs.com",
      "*.lovable.app",
      "*.supabase.co",
    ],
    cleartext: true,
  },

  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
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
