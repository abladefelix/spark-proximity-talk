import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.skanaround",
  appName: "SKANAROUND",
  webDir: "dist/client",
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
      // Let the native window become exactly as tall as the space above the
      // keyboard. Fixed chat headers stay put while the transcript shortens and
      // the composer naturally rests on the keyboard, like a native messenger.
      resize: "native",
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
