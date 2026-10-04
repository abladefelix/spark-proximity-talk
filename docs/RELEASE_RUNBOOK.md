# SKANAROUND — Release Runbook

This is the repeatable process for future iOS, Android and subscription releases.

## Current identifiers

| Item | Value |
| --- | --- |
| App version line | `1.1.7` |
| Android package | `com.skanaround` |
| iOS bundle ID | `app.skanaround.mobile` |
| RevenueCat entitlement | `skanaround_pro` |
| RevenueCat offering | `default` |
| Monthly product | `skanaround_pro_monthly` |
| Yearly product | `skanaround_pro_yearly` |

## Before every release

1. pull latest `main`;
2. create a release branch;
3. confirm production URLs and billing health;
4. increment store build/version codes;
5. run build/tests;
6. generate signed native artifacts;
7. test purchase + restore on store testing tracks;
8. submit;
9. merge the release branch/PR so Git matches what was uploaded.

## Android

### Versioning

Every Play upload must have a higher `versionCode`.

`android/app/build.gradle`:

```gradle
versionCode <increase every upload>
versionName "<customer-facing version>"
```

For release `1.1.7`, the new upload used versionCode `20`.

### Signing

- keystore: `~/skanaround-upload.jks`
- alias: `skanaround`
- expected upload SHA-1:
  `F2:BC:5A:F9:9E:81:66:6F:51:51:7E:72:06:0C:17:5B:60:9B:EC:D8`

Passwords stay in the password manager.

Build:

```bash
cd android
./gradlew clean
./gradlew bundleRelease
find . -type f -name "*.aab" -print
```

Or Android Studio:

**Build → Generate Signed Bundle / APK → Android App Bundle → release**

Before creating the bundle, verify Android Studio is actually open on
`~/spark-proximity-talk/android` and that the selected App ID is
`com.skanaround`.

## iOS

- bundle ID: `app.skanaround.mobile`
- archive in Xcode;
- upload/select the build in App Store Connect;
- App Store version should match the binary's
  `CFBundleShortVersionString`;
- increment build number for every uploaded binary.

First subscriptions must be reviewed together with an app version.

## App Store metadata reminders

- Primary category: **Social Networking**
- App price: **Free**
- Privacy: `https://skanaround.bytenetdigital.com/privacy`
- Terms: `https://skanaround.bytenetdigital.com/terms`
- Account deletion: `https://skanaround.bytenetdigital.com/delete-account`
- Support URL must resolve publicly before submission.

If iPad is supported by the binary, App Store Connect requires the corresponding
iPad screenshots. The safest screenshots are captured from the matching iPad
Simulator rather than resized phone screenshots.

## Subscriptions and RevenueCat

Subscription group:

`SKANAROUND Pro`

Products:

- monthly: `skanaround_pro_monthly`
- yearly: `skanaround_pro_yearly`

Entitlement:

`skanaround_pro`

Offering:

`default`

Apple launch prices configured during the 1.1.7 submission:

- $4.99/month
- $39.99/year

The same product IDs must exist in:

1. App Store Connect / Play Console;
2. RevenueCat;
3. SKANAROUND Admin billing configuration.

Do not rename a live product ID casually. Store product IDs are long-lived
integration identifiers.

## Review credentials

Reviewer/test credentials belong in the store's secure review metadata and the
password manager. Do not commit them to GitHub.

## After approval

1. confirm the public store listing;
2. install the production build from the store;
3. test sign-in, location, radar, push, purchase and restore;
4. record final store URLs;
5. update release notes/docs;
6. merge any release/version PR still open;
7. tag the release if desired.
