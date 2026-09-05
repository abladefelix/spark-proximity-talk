# Production fixes

- [x] Make subscription checkout bounded, actionable, and free of stale store errors
- [x] Make Pro dialogs responsive to safe areas, keyboard, and small screens
- [x] Audit and repair high-confidence native layout/navigation/error issues across iOS and Android
- [x] Validate core mobile flows at representative phone sizes
- [x] Add Android Studio diagnostics for the post-sign-in location crash
- [x] Prevent fatal Android push registration when Firebase is not configured, including calls from an older live web bundle

- [x] Show full Bat-Signal help details
- [x] Keep the Android chat composer above system navigation
- [x] Remove offline members from the radar and prevent stuck signals
- [x] Prevent Android notification crashes
- [x] Harden Google Play subscription setup and guidance
- [x] Verify build and mobile-facing behavior
- [x] Make the app shell adapt to Android status bars, gesture navigation, 3-button navigation, and short screens
- [x] Lift the Android app surface slightly and contain the device-session warning on narrow screens
- [x] Replace the Android visual offset with native system-bar insets and make compass activation opt-in