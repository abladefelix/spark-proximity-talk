# Push Notifications (APNs + FCM)

SKANAROUND sends push for three events: a new **signal**, a mutual **match**, and a
new chat **message**.

## Pipeline

```text
client (Capacitor)  →  registerPushToken   →  push_tokens (user_id, token, platform)
app event           →  sendPushNotification →  APNs  (platform = ios)
                                            →  FCM v1 (platform = android)
```

Files:

- `src/hooks/usePushNotifications.ts` — permission prompt, token registration
  (`Capacitor.getPlatform()` decides the stored platform), tap → open chat.
- `src/lib/push-notifications.functions.ts` — authenticated server functions.
  `sendPushNotification` verifies the caller really has the signal/match/message
  relationship before delivering. Invalid tokens are pruned.
- `src/lib/push-notifications.server.ts` — APNs HTTP/2 with ES256 JWT signing.
- `src/lib/fcm.server.ts` — FCM HTTP v1 with a service-account RS256 JWT.

## iOS setup (APNs)

1. Apple Developer → Keys → create an **APNs** key, download the `.p8`.
2. Add backend secrets:
   - `APNS_KEY` — full `.p8` contents
   - `APNS_KEY_ID` — 10-char key ID
   - `APNS_TEAM_ID` — Apple Team ID
   - `APNS_BUNDLE_ID` — defaults to `com.skanaround`
   - `APNS_PRODUCTION` — `true` for TestFlight/App Store builds, unset for dev
3. Xcode: enable the Push Notifications capability (already in `App.entitlements`).

## Android setup (FCM)

1. Firebase console → create/select a project → add an Android app with package
   `com.skanaround`.
2. Download `google-services.json` → place at `android/app/google-services.json`.
3. Firebase → Project settings → Service accounts → **Generate new private key**.
4. Add backend secret `FCM_SERVICE_ACCOUNT` — the entire service-account JSON as
   one string.

If `google-services.json` is absent or invalid, the Android app now skips native
push registration safely instead of crashing; in-app notifications still work.
Without the backend secrets, remote pushes are skipped gracefully with reason
`apns-not-configured` / `fcm-not-configured`; in-app realtime alerts keep working.

## Testing

- Push only works on physical devices (iOS) or a device/emulator with Google
  Play services (Android). Foreground taps route to the chat sheet.
- Check server-function logs for the delivery `reason` when nothing arrives.
