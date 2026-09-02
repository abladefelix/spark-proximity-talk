# SKANAROUND — Google Play Store submission guide

Everything below is specific to this app. Follow it top to bottom.

| Fact | Value |
| --- | --- |
| App name | SKANAROUND |
| Package (application id) | `app.skanaround.mobile` |
| Version | `versionName 1.0.0`, `versionCode 1` (`android/app/build.gradle`) |
| Category | Social |
| Content rating | Mature 17+ (user-generated content + location) |
| Target audience | 18+ only (app enforces a date-of-birth age gate) |
| Privacy policy URL | `https://skanaround.bytenetdigital.com/privacy` |
| Terms / EULA URL | `https://skanaround.bytenetdigital.com/terms` |
| Account deletion URL | `https://skanaround.bytenetdigital.com/delete-account` |
| Support email | the value set in Admin → App (`support_email`) |

> Those three legal URLs are live routes in the app and are reachable in a browser even
> while the web version is toggled off in Admin. Verify each one opens before submitting.

---

## 1. One-time account setup

1. Create a Google Play Developer account (US$25 one-off) at
   https://play.google.com/console. Individual accounts must verify ID; organisation
   accounts need a D-U-N-S number. Verification can take a few days — start here first.
2. If you registered as an individual after Nov 2023, Google requires **12 testers opted
   in to a closed test for 14 continuous days** before you may apply for production.
   Plan for that: create the closed test early (section 6).
3. Accept the Developer Distribution Agreement and set up a payments profile only if you
   sell subscriptions (SKANAROUND Pro — see section 8).

## 2. Build the release bundle

On your machine, from the repo root:

```bash
bun install
bun run build
npx cap sync android
```

Create an upload keystore once, and never lose it:

```bash
keytool -genkey -v -keystore ~/skanaround-upload.jks \
  -alias skanaround -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/key.properties` (this file is git-ignored — keep it off GitHub):

```properties
storeFile=/absolute/path/to/skanaround-upload.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=skanaround
keyPassword=YOUR_KEY_PASSWORD
```

Then in Android Studio: **Build → Generate Signed App Bundle → Android App Bundle**,
select the keystore, choose **release**, and upload the resulting `app-release.aab`.
(Play only accepts `.aab`, not `.apk`.) Enrol in **Play App Signing** when prompted.

Every later upload must increase `versionCode` in `android/app/build.gradle`.

## 3. Firebase / push notifications

The app uses FCM. Before the release build:

1. In the Firebase console add an Android app with package `app.skanaround.mobile`.
2. Add the SHA-1 and SHA-256 of your **upload key** and of the **Play App Signing key**
   (Play Console → Setup → App signing).
3. Download `google-services.json` into `android/app/google-services.json`.
4. Paste the Firebase service-account JSON into Admin → Notifications so the server can
   send pushes.

Without step 3 the release build will not receive notifications.

## 4. Store listing content

- **App name (30 chars):** `SKANAROUND`
- **Short description (80 chars):** e.g. "Discover people nearby on a live radar and chat when you both say yes."
- **Full description (4000 chars):** explain proximity discovery, mutual signalling
  before any chat, verified badges, blocking/reporting, and that exact location is never
  shown to other users. Do not use words like "hookup" or "dating for minors".
- **Graphics:** app icon 512×512 PNG, feature graphic 1024×500, at least 2 phone
  screenshots (16:9 or 9:16, min 1080px on the short side). Use the radar, a profile
  dialog, incoming signals and a chat.
- Screenshots must show the real app; no device frames with fake UI.

## 5. Play Console declarations (the parts reviewers reject)

### Data safety form
Declare these, all **collected and linked to the user**, encrypted in transit, deletable
by the user:

| Data type | Purpose |
| --- | --- |
| Approximate + precise location | App functionality (radar proximity) |
| Email address | Account management |
| User IDs, name/username | Account management, app functionality |
| Photos | App functionality (profile picture) |
| In-app messages | App functionality (chat between matched users) |
| Device IDs / push token | App functionality (notifications), single-device sign-in |
| Crash logs / diagnostics | Analytics, app functionality |

Answer **Yes** to "Users can request that data be deleted" and give the deletion URL above.
Declare **no data is shared with third parties** and **no advertising or tracking**.

### Permissions
Location is used only while the app is in use — there is **no background location**, so
you will not need the sensitive-permission declaration form. Say so if asked.
`CAMERA`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS` and `HIGH_SAMPLING_RATE_SENSORS`
(compass) are all justified by profile photos, notifications and the radar heading.

### Content rating questionnaire
Answer honestly: users can interact, share user-generated content, share their
approximate location with other users, and exchange messages. This produces a Mature 17+
/ PEGI 16-18 rating. Under-declaring here is a common rejection cause.

### App content section (each item must be completed)
- Privacy policy URL
- Ads: **No ads**
- App access: provide a **test account** (username + password) so reviewers can sign in —
  the app has no anonymous mode. Add a note that a second account may be needed to see
  another beacon, and that the radar needs a location fix.
- Target audience: 18 and over; not designed for children.
- News app: No. COVID/health: No. Financial features: No.
- Data safety (above), Government apps: No.
- Advertising ID: not used — declare "No".

### Social / UGC compliance (Play's UGC policy)
Have these ready to point at; they already exist in the app:
- Reporting: report a user from their profile dialog and from inside a chat.
- Blocking: block from the chat safety menu and profile.
- Moderation: Admin queue with a stated 24-hour response commitment in Terms.
- Terms with a zero-tolerance clause for abusive content.
- Age gate at sign-up (18+ date of birth).
- In-app account deletion in Profile, plus the public deletion page.

## 6. Testing tracks

1. **Internal testing** — up to 100 testers, instant. Use it to verify signing, push and
   location on real devices.
2. **Closed testing** — required for new individual developers: 12 testers, 14 days.
   Collect their Gmail addresses into an email list in Play Console.
3. **Production** — apply for production access, answer the questions about your test
   results, then roll out (start at 20% staged rollout).

## 7. Pre-submission checklist

- [ ] `versionCode` incremented, signed `.aab` built
- [ ] `google-services.json` present for the release package
- [ ] `/privacy`, `/terms`, `/delete-account` load in a browser
- [ ] Support email set in Admin → App and answered
- [ ] Test account created and still valid; not a single-device-locked account that
      blocks the reviewer (sign out of it everywhere before submitting)
- [ ] Location prompt shows the pre-permission explainer first
- [ ] Report / block reachable in profile and chat
- [ ] Delete account works end to end and signs the user out
- [ ] Backend at `skanaround.bytenetdigital.com` is up, with a valid TLS certificate

## 8. Pro subscriptions (only if selling in this release)

Play requires digital subscriptions to use Google Play Billing — SKANAROUND already uses
RevenueCat over Play Billing, with no external checkout in the app.

1. Play Console → Monetise → Subscriptions: create `skanaround_pro_monthly` and
   `skanaround_pro_yearly`, each with a base plan, then activate them.
2. Upload the Play service-account JSON into RevenueCat and import the products into the
   `pro` entitlement.
3. Paste the Android public SDK key and the RevenueCat secret key into Admin → Billing
   and turn "Memberships active" on.
4. RevenueCat webhook URL: `https://skanaround.bytenetdigital.com/api/public/revenuecat/webhook`
   with the Authorization value from Admin → Billing.
5. Add licence testers in Play Console → Setup → Licence testing to test purchases free.
6. The purchase screen must show price, period, auto-renew wording, Restore purchases and
   links to Terms and Privacy — all already implemented.

Note: the Paystack `/upgrade` page is web-only and is never linked from inside the app.
Keep it that way, or the release will be rejected under the Payments policy.

## 9. Common rejection reasons for this app type

| Reason | How we avoid it |
| --- | --- |
| Data safety form doesn't match observed behaviour | Declare location, photos, messages and device IDs exactly as in section 5 |
| No way for reviewers to sign in | Provide the test account under App access |
| Missing account deletion | In-app deletion plus the public `/delete-account` URL |
| UGC without moderation tools | Report, block, admin queue, 24-hour commitment |
| Under-rated content | Answer the rating questionnaire as a social app with UGC and location |
| Background location suspicion | We only request while-in-use; never add background location |
| Broken deep links / blank web pages | Legal routes stay allowlisted in `WebGate` |

---

See [MOBILE.md](./MOBILE.md) for build details and [LAUNCH.md](./LAUNCH.md) for the local
run instructions.
