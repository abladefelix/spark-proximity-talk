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
    // Shown instead of a blank white web view whenever the live site cannot be
    // reached (deploy restarts, flaky network). It retries on its own.
    errorPath: "offline.html",
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
      // Keep the app window stable. ChatPanel uses the reported keyboard height
      // to shorten only the conversation screen, so opening the keyboard never
      // compresses the radar or the rest of the app behind it.
      resize: "none",
      resizeOnFullScreen: false,
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
