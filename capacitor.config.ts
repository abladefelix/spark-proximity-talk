import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.skanaround.mobile",
  appName: "SKANAROUND",
  webDir: ".output/public",
  server: {
    // Live URL — the native shell loads the published web app so updates ship
    // without resubmitting to the stores. No query string, and no `hostname`
    // alongside `url`: setting both makes iOS treat the first load as an
    // external link and hand it to Safari.
    url: "https://shatta.caymanirs.com",
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      "shatta.caymanirs.com",
      "*.caymanirs.com",
      "*.lovable.app",
      "oauth.lovable.app",
      "*.lovable.dev",
      "*.supabase.co",
    ],
    cleartext: true,
  },


  ios: {
    contentInset: "never",
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
