# SkanAround Launch Guide

Complete commands to clone, build, and run SkanAround on iOS and Android.

## Prerequisites

| Platform | Required |
| --- | --- |
| Both | Node.js 20+, Git, Bun, `@capacitor/cli` (bundled in project) |
| iOS | macOS, Xcode 15+, Apple Developer account for device testing |
| Android | Android Studio Ladybug+, JDK 17, Android SDK 34+ |

> **Note on the GitHub repo** — If this repo is not yet in your GitHub account, connect it first in Lovable: **+ menu → GitHub → Connect project**. Then replace `<repo-url>` below with the actual clone URL.

## 1. Clone and install

```bash
# Clone the repository
git clone <repo-url>
cd <repository-name>

# Install dependencies
bun install

# Build the web app and sync into native platforms
bun run build
npx cap sync
```

## 2. Run on iOS

```bash
# Open the iOS project in Xcode
npx cap open ios
```

Inside Xcode:

1. Select the **App** target.
2. Go to **Signing & Capabilities** → choose your Team.
3. Confirm **Push Notifications** capability is present.
4. Pick a simulator or connect an iPhone, then press **Run** (⌘R).

## 3. Run on Android

```bash
# Open the Android project in Android Studio
npx cap open android
```

Inside Android Studio:

1. Let Gradle sync finish.
2. Choose a device or emulator.
3. Press **Run** (▶).

For push notifications on Android, place `google-services.json` from Firebase in `android/app/` before building.

## 4. After making web changes

Whenever you edit the web code, rebuild and sync before the native apps reflect the changes:

```bash
bun run build
npx cap sync
```

## 5. Syncing back to GitHub

If you edit locally, push back to the default branch so Lovable stays in sync:

```bash
git add .
git commit -m "Update native app setup"
git push origin main
```

## 6. Troubleshooting

| Problem | Fix |
| --- | --- |
| `bun: command not found` | Install Bun: `curl -fsSL https://bun.sh/install \| bash` |
| iOS pods not installed | Run `cd ios && pod install && cd ..` then `npx cap sync` |
| iOS signing error | In Xcode, select a valid Team in **Signing & Capabilities** |
| Android Gradle fails | Use JDK 17, not 21; check `java -version` |
| Blank screen on device | Check `capacitor.config.ts` server URL is reachable |
| No location permission | Already declared in `Info.plist` and `AndroidManifest.xml` — reset privacy in device settings |

---

See [MOBILE.md](./MOBILE.md) for detailed Capacitor configuration, permissions, and store release checklists.
