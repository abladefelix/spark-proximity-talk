# SKANAROUND — VS Code Terminal Setup (Line-by-Line)

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

---

## I. Pro memberships (App Store & Google Play billing)

Apple (guideline 3.1.1) and Google (Payments policy) require digital
subscriptions to be sold through their own billing. SKANAROUND uses
RevenueCat on top of Apple In-App Purchase and Google Play Billing — there is
no external checkout anywhere in the app.

1. **App Store Connect** → your app → Subscriptions: create a group and two
   auto-renewable products, e.g. `skanaround_pro_monthly` and
   `skanaround_pro_yearly`. Set prices, add a localised display name,
   description and a review screenshot. Paid apps agreement and banking must
   be complete or the products stay "Missing Metadata".
2. **Google Play Console** → Monetise → Subscriptions: create the same two
   product ids with a base plan each, then activate them.
3. **RevenueCat**: create a project, add the iOS and Android apps, upload the
   App Store In-App Purchase key and the Play service-account JSON, import the
   products, create an entitlement named `pro`, and attach both products to a
   default offering with `$rc_monthly` / `$rc_annual` packages.
4. **Admin → Billing** in SKANAROUND: paste the iOS public SDK key, the Android
   public SDK key, the RevenueCat secret API key, the entitlement name (`pro`),
   both product ids, and a long random webhook authorization value. Turn
   "Memberships active" on.
5. **RevenueCat → Integrations → Webhooks**: URL
   `https://<your-app-domain>/api/public/revenuecat/webhook`, Authorization
   header = the same value you saved in Admin.
6. Rebuild the native apps (`bun run build && npx cap sync`) and test with a
   Sandbox tester (iOS) and a licence tester on an internal testing track
   (Android).

Review checklist that is already handled in the app: a visible "Restore
purchases" button, price, period and auto-renew disclosure on the purchase
screen, links to the Terms/EULA and Privacy Policy, subscription management
that deep-links to the store, and account deletion in Profile.
