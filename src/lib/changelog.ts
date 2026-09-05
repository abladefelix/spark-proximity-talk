/**
 * Release history shown on /changelog. Newest first — add an entry here
 * whenever a notable change ships, so members, reviewers and the store
 * listing always have an up-to-date public record.
 */

export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  date: string; // e.g. "4 September 2026"
  title: string;
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "5 September 2026",
    title: "Data access & small-screen fixes",
    changes: [
      { kind: "fixed", text: "Restored account data permissions — profiles, chats, signals, notifications and settings load again instead of failing silently or freezing the screen." },
      { kind: "fixed", text: "The radar top bar no longer overlaps the bell and visibility switch on narrow phones." },
      { kind: "fixed", text: "The radar circle now stays round and fits the screen on short phones instead of overlapping the text above it." },
    ],
  },
  {

    date: "5 September 2026",
    title: "Store checkout & phone reliability",
    changes: [
      { kind: "fixed", text: "Pro checkout can no longer spin forever when Google Play or the App Store is unavailable; every store action now finishes or gives a clear retry message." },
      { kind: "fixed", text: "Google Play monthly and yearly base plans are now selected from the plans returned by Google instead of guessed product names." },
      { kind: "improved", text: "The Pro membership screen now stays fitted, scrollable and responsive on small iPhone and Android screens." },
      { kind: "fixed", text: "Android's back button now closes open dialogs first and otherwise follows the app's navigation instead of leaving a stuck overlay." },
      { kind: "fixed", text: "Error, missing-page and app-download screens now respect phone safe areas and remain scrollable on short displays." },
    ],
  },
  {
    date: "4 September 2026",
    title: "Reliability, logs & status updates",
    changes: [
      { kind: "new", text: "Admin activity log: a searchable, filterable record of everything that happens in the app, with calendar date pickers, summaries, exports and automatic purging." },
      { kind: "new", text: "Service status banner: if something goes wrong on our side a small notice appears in the app and clears itself automatically the moment service is restored." },
      { kind: "new", text: "Offline screens with the SKANAROUND logo: opening the app with no connection (or aeroplane mode on) shows a branded \"You're offline\" screen that recovers on its own, on both iPhone and Android." },
      { kind: "new", text: "You can now change the email address on your account from your profile — a confirmation link goes to the new address." },
      { kind: "improved", text: "The app and admin console now always start in light mode; dark mode only turns on when you choose it." },
      { kind: "improved", text: "Chat is tighter and more responsive: full-height layout, blurred header and composer, and the back button (including the Android hardware button) always takes you out of a chat." },
      { kind: "improved", text: "Bat-Signals now show the full help category and message so nearby responders can understand what is needed." },
      { kind: "fixed", text: "Offline people now leave the radar when the configured presence window expires, and sending a signal can no longer leave the profile dialog stuck." },
      { kind: "fixed", text: "The Android chat composer now stays clear of system navigation controls." },
      { kind: "fixed", text: "Android notifications now use a dedicated compatible status icon and safely handle notification taps." },
      { kind: "fixed", text: "Added the Android billing declarations required for reliable Google Play subscription loading." },
      { kind: "fixed", text: "Website membership payments now show a clear, friendly message when the payment service is unavailable instead of a technical error." },
      { kind: "improved", text: "Admin console: search, filters and pagination on every tab, plus search and filters inside pop-up dialogs." },
      { kind: "improved", text: "Sign out is now a clearly visible button on your profile." },
      { kind: "fixed", text: "Fixed a glitch where the status banner flickered between \"Something isn't working right\" and \"Back to normal\" in a loop." },
      { kind: "fixed", text: "Fixed the \"Try again\" and \"Go home\" buttons on the connection error screen — they now work, and the page recovers by itself when the connection returns." },
    ],
  },
  {
    date: "August 2026",
    title: "Pro, admin console & store readiness",
    changes: [
      { kind: "new", text: "SKANAROUND Pro: monthly and yearly membership with extended range, longer chat history and premium perks, purchased securely through the App Store or Google Play." },
      { kind: "new", text: "Full admin console: people, verification, reports, appeals, notifications, zones, insights, billing, backups and settings." },
      { kind: "new", text: "Verified beacons, gender avatar symbols, precise distances, compass heading, scan-range control and radar sounds." },
      { kind: "new", text: "Biometric app lock, device session guard, and a one-time gender lock for account integrity." },
      { kind: "new", text: "iPhone and Android apps via the stores, plus push notifications." },
      { kind: "improved", text: "Faster radar with smarter GPS filtering, skeleton loaders and offline-friendly caching." },
      { kind: "fixed", text: "Security hardening across sign-in, verification and admin actions." },
    ],
  },
  {
    date: "July 2026",
    title: "First release",
    changes: [
      { kind: "new", text: "Proximity radar: discover people near you as beacons — no contacts or friend lists needed." },
      { kind: "new", text: "Signals: show interest with a ping; when it's mutual you can chat and link up." },
      { kind: "new", text: "Minimal glass radar design with light and dark themes." },
      { kind: "new", text: "Reporting and blocking on every profile and chat, with a 24-hour moderation promise." },
    ],
  },
];
