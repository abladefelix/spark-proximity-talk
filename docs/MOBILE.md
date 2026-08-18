# SKANAROUND — Mobile (iOS + Android)

SKANAROUND ships as a Capacitor shell around the live web app. The native apps load
`https://shatta.caymanirs.com`, so web updates go live without an app-store resubmit.

## Project layout

```text
capacitor.config.ts   shared native config (appId, appName, server URL, plugins)
ios/                  Xcode project
android/              Android Studio / Gradle project
dist/                 web build copied into both platforms by `npx cap sync`
```

App ID: `app.skanaround.mobile`
App name: `SKANAROUND`

## Prerequisites

- Node/Bun, plus `npx cap` (bundled via `@capacitor/cli`)
- iOS: macOS + Xcode 15+, an Apple Developer account
- Android: Android Studio Ladybug+, JDK 17, Android SDK 34+

## Build and sync

```bash
bun install
bun run build          # produces dist/
npx cap sync           # copies web assets + plugin config into ios/ and android/
```

Run `npx cap sync` after every dependency change or web build you want embedded.

## Run on iOS

```bash
npx cap open ios
```

1. Select the **App** target → **Signing & Capabilities** → choose your Team.
2. Confirm **Push Notifications** capability is present (`App.entitlements`).
3. Connect an iPhone, press **Run**.

Permissions declared in `ios/App/App/Info.plist`: location when-in-use, camera,
photo library, and `remote-notification` background mode.

## Run on Android

```bash
npx cap open android
```

1. Let Gradle sync, then pick a device/emulator and press **Run**.
2. For push, drop `google-services.json` into `android/app/` (see below).

Permissions declared in `android/app/src/main/AndroidManifest.xml`:
`INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`,
`POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES`, `VIBRATE`.

## Release builds

- iOS: Xcode → Product → Archive → distribute to App Store Connect.
- Android:
  ```bash
  cd android && ./gradlew bundleRelease   # app/build/outputs/bundle/release/
  ```
  Sign with your upload keystore (configure in `android/app/build.gradle` or
  Android Studio's *Generate Signed Bundle*).

## Store checklist

- Privacy: SKANAROUND collects coarse/precise location, photos, and account email.
  Declare location, photos, identifiers, and user content in App Privacy /
  Data Safety forms.
- Provide the moderation story (report, block, ban, appeals) — required for
  social discovery apps on both stores.
- Age rating: 17+/Mature (user-generated content and real-time chat).
