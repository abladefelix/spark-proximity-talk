import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.skanaround.mobile",
  appName: "SKANAROUND",
  webDir: ".output/public",
  server: {
    // The web build is bundled inside the binary (no remote `url`), so the
    // stores see a real native app rather than a webview wrapper.
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      "skanaround.bytenetdigital.com",
      "*.bytenetdigital.com",
      "*.supabase.co",
    ],
  },


  ios: {
    contentInset: "never",
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
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
