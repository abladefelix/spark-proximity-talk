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
    webContentsDebuggingEnabled: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Keep enabled for production-device diagnosis. Android Studio Logcat and
    // chrome://inspect can then expose WebView failures that would otherwise
    // look like an unexplained native app exit.
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    Keyboard: {
      // Keep the native web view at a stable height. The chat composer alone is
      // moved above the keyboard using the native keyboard-height event.
      resize: "none",
      resizeOnFullScreen: true,
    },
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
    },
  },
};

export default config;
