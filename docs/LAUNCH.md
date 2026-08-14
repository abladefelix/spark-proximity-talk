# SkanAround — VS Code Terminal Setup (Line-by-Line)

Copy each command block and paste it into your VS Code terminal. Run them in order.

---

## A. Install prerequisites (one-time only)

### macOS

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

Install Xcode from the Mac App Store, then open it once:

```bash
xcode-select --install
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

Install CocoaPods:

```bash
sudo gem install cocoapods
```

### Windows

Install Node.js LTS from https://nodejs.org (pick the 20+ installer).

Install Git from https://git-scm.com/download/win.

Install Bun in PowerShell (run as Administrator):

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Android (all OS)

1. Install Android Studio from https://developer.android.com/studio.
2. Open Android Studio → More Actions → SDK Manager.
3. Install:
   - Android SDK 34
   - Android SDK Platform-Tools
   - Android SDK Build-Tools 34
   - JDK 17 (bundled with Android Studio is fine)

---

## B. Clone the project

Replace `<repo-url>` with your GitHub repository URL (or your private storage URL).

```bash
# Pick a folder for your project
mkdir -p ~/Projects
cd ~/Projects

# Clone the repository
git clone <repo-url>

# Enter the project folder
cd <repository-name>
```

---

## C. Install dependencies

```bash
bun install
```

---

## D. Build the web app and sync native platforms

```bash
bun run build
npx cap sync
```

---

## E. Run on iOS

```bash
npx cap open ios
```

Xcode opens. In the Xcode window:

1. Click the project navigator top item → **App**.
2. Select the **App** target.
3. Go to **Signing & Capabilities**.
4. Set **Team** to your Apple Developer team.
5. In the top toolbar, choose an iPhone simulator or a connected device.
6. Press **Cmd + R** or click the Run button (▶).

To run again after web edits:

```bash
bun run build
npx cap sync
npx cap open ios
```

If you see missing CocoaPods files:

```bash
cd ios
pod install --repo-update
cd ..
npx cap sync
```

---

## F. Run on Android

```bash
npx cap open android
```

Android Studio opens. In the IDE:

1. Wait for Gradle sync to finish.
2. Select a device or emulator in the toolbar.
3. Click the Run button (▶) or press **Shift + F10**.

To run again after web edits:

```bash
bun run build
npx cap sync
npx cap open android
```

For Firebase push notifications, download `google-services.json` from your Firebase project and place it at:

```text
android/app/google-services.json
```

Then rebuild:

```bash
bun run build
npx cap sync
npx cap open android
```

---

## G. Push your local changes back to GitHub

Run:

```bash
git add .
git commit -m "Update from VS Code"
git push origin main
```

---

## H. Common fixes

| Problem | Terminal command or fix |
| --- | --- |
| `bun: command not found` | Reinstall Bun: `curl -fsSL https://bun.sh/install \| bash` |
| iOS pod install fails | `cd ios && pod install --repo-update && cd .. && npx cap sync` |
| iOS signing error | In Xcode, set a valid Team in Signing & Capabilities |
| Android build fails | Check `java -version` shows 17; install JDK 17 in Android Studio |
| Blank screen on device | Check `capacitor.config.ts` server URL is reachable in a browser |
| No location permission | Reset location privacy in iOS/Android Settings → Privacy |

---

See [MOBILE.md](./MOBILE.md) for detailed Capacitor config, release builds, and store checklists.
