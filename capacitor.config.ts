import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.skanaround.mobile",
  appName: "SkanAround",
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
      "*.supabase.co",
      "*.google.com",
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
