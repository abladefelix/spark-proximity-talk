import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skanaround",
  appName: "SKANAROUND",
  webDir: ".output/public",
  server: {
    // The app is a server-rendered TanStack Start site (server functions power
    // auth, radar and chat), so the web view must load the live deployment.
    // A purely bundled build has no index.html and cannot reach the backend.
    url: "https://skanaround.bytenetdigital.com",
    cleartext: false,
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
