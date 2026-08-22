export type GuideItem = { term: string; body: string };

export type GuideSection = {
  id: string;
  title: string;
  icon:
    | "radar"
    | "beacon"
    | "compass"
    | "signal"
    | "chat"
    | "profile"
    | "verified"
    | "pro"
    | "safety"
    | "bell"
    | "help";
  summary: string;
  /** Screenshot captured from the live app, illustrating the section. */
  shot?: "radar" | "beacon" | "chat" | "chats" | "profile";
  shotCaption?: string;
  items: GuideItem[];
};

/**
 * The in-app user guide. Written as plain data so the page can render, filter
 * and search it without pulling in a markdown renderer.
 */
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "start",
    shot: "radar",
    shotCaption: "The radar home screen — you sit in the centre, everyone else is placed by real distance and direction.",
    title: "Getting started",
    icon: "help",
    summary: "What the app does and the three steps to your first chat.",
    items: [
      {
        term: "The idea",
        body: "You discover people who are physically near you right now. Nobody needs to know each other beforehand — being in the same place at the same time is the only thing you have in common.",
      },
      {
        term: "Step 1 — Turn on location",
        body: "Allow location when the app asks. Your position is only used to place you on other people's radar and to work out distances. Without it the radar stays empty.",
      },
      {
        term: "Step 2 — Send a signal",
        body: "Tap anyone on the radar to open their card, then send a signal. They get a notification with your photo and name.",
      },
      {
        term: "Step 3 — Match and chat",
        body: "If they signal back, you match and a chat opens for both of you. No signal back means no chat — interest has to go both ways.",
      },
      {
        term: "Age requirement",
        body: "You must be 18 or older (or the minimum age set for your region) to create an account. Date of birth is required at sign-up.",
      },
    ],
  },
  {
    id: "radar",
    shot: "radar",
    shotCaption: "Rings mark distance bands, the sweep shows the live scan, N/E/S/W keep you oriented.",
    title: "The radar",
    icon: "radar",
    summary: "How the circles, sweep and positions work.",
    items: [
      {
        term: "You are the centre",
        body: "The dot in the middle of the scope is you. Everything else is drawn relative to your current position.",
      },
      {
        term: "Rings and grid",
        body: "Each ring is a slice of your scan range. Someone on the outer ring is near the edge of your range; someone close to the centre is a few steps away.",
      },
      {
        term: "Direction",
        body: "A person's angle on the scope is their real compass bearing from you. With the compass on, the radar rotates with your phone, so the top of the screen is the direction you are facing — walk straight ahead and a beacon at the top gets closer.",
      },
      {
        term: "The sweep",
        body: "The rotating glow is just the scan animation. It does not mean someone is being detected at that moment.",
      },
      {
        term: "Zoom",
        body: "Pinch (or scroll on the web) to zoom in and out. When several people stand in the same spot, zooming in spreads their beacons apart so you can tap the right one.",
      },
      {
        term: "Refresh",
        body: "The radar refreshes every few seconds. People vanish from it when they move out of range, hide themselves, or go offline.",
      },
    ],
  },
  {
    id: "beacons",
    shot: "beacon",
    shotCaption: "Tapping a beacon opens their card: photo or gender avatar, name, verified tick, exact distance and bearing.",
    title: "Beacons and what colours mean",
    icon: "beacon",
    summary: "Reading a person at a glance.",
    items: [
      {
        term: "The beacon",
        body: "Each person is a beacon showing their profile photo. If they have no photo you see a male or female avatar based on the gender on their profile.",
      },
      {
        term: "The pointer",
        body: "The small arrow under a beacon points at the exact spot the person is standing.",
      },
      {
        term: "Colours",
        body: "The halo colour follows gender (set by the admin), so you can tell men and women apart at a glance. Verified members get their own distinct colour ring.",
      },
      {
        term: "Distance label",
        body: "The distance sits right under the name in the profile card and under the beacon. Very short distances are shown in feet for precision, longer ones in metres or kilometres.",
      },
      {
        term: "Online glow",
        body: "A pulsing beacon means the person is active right now. Faded beacons are people whose last position is a little older.",
      },
      {
        term: "Pro beacons",
        body: "Pro members can pick a custom beacon style and may appear higher in the list when the area is crowded.",
      },
    ],
  },
  {
    id: "compass",
    title: "Compass and accuracy",
    icon: "compass",
    summary: "Getting the direction and distance exact.",
    items: [
      {
        term: "Enabling the compass",
        body: "The compass is on by default. The button sits below the radar — tap it to switch between heading-up (rotates with you) and north-up (fixed).",
      },
      {
        term: "Calibrating",
        body: "When you first enable it you may see a calibrating notice. Wave the phone in a figure-8 for a few seconds and it settles.",
      },
      {
        term: "iPhone",
        body: "iOS asks once for motion & orientation permission. If you declined, enable it again in your phone's settings for this app.",
      },
      {
        term: "Android",
        body: "No prompt is needed — the app reads the built-in magnetometer directly. Keep away from magnets, metal desks and phone cases with magnetic clips.",
      },
      {
        term: "Why distance shifts",
        body: "GPS jitters, especially indoors. The app smooths readings and ignores low-accuracy fixes, but expect a few metres of drift inside buildings or near tall walls.",
      },
    ],
  },
  {
    id: "signals",
    shot: "beacon",
    shotCaption: "The Signal button sends your interest. A chat only opens once they signal back.",
    title: "Signals and matching",
    icon: "signal",
    summary: "How interest is expressed and answered.",
    items: [
      {
        term: "Sending a signal",
        body: "Open a person's card and send a signal. It shares your username and photo with them — nothing else, and no chat opens yet.",
      },
      {
        term: "Receiving one",
        body: "Incoming signals appear at the top of the radar screen. Accept to match, or decline to dismiss it quietly. The sender is not told that you declined.",
      },
      {
        term: "Matching",
        body: "When both sides have signalled, the chat opens for both of you and the dialog closes automatically.",
      },
      {
        term: "Signals expire",
        body: "Unanswered signals expire after the window set by the admin, so nothing lingers forever. You can always send a new one.",
      },
      {
        term: "Daily limit",
        body: "Free accounts can send a limited number of signals per day. Pro removes the cap when the admin has enabled that feature.",
      },
    ],
  },
  {
    id: "chats",
    shot: "chat",
    shotCaption: "A match chat — your messages on the right, theirs on the left, photos via the icon in the input bar.",
    title: "Chats",
    icon: "chat",
    summary: "Talking after you match.",
    items: [
      {
        term: "Active chats",
        body: "Your chats stack as folded cards with the newest on top. Tap the stack to unfold and scroll through all of them.",
      },
      {
        term: "Sending",
        body: "Type and send text, photos, or share your live spot so the other person can walk to you.",
      },
      {
        term: "Backgrounds",
        body: "Pick a chat wallpaper in your profile. It is softened behind the messages so text stays readable, and the admin can add more choices.",
      },
      {
        term: "Message limits",
        body: "On a free account each chat has a message allowance. Pro lifts it when that feature is turned on.",
      },
      {
        term: "Chats do not last forever",
        body: "Old conversations are cleared automatically after the retention period the admin sets.",
      },
      {
        term: "Trouble in a chat",
        body: "Use report or block from inside the conversation. Blocking removes the person from your radar and theirs.",
      },
    ],
  },
  {
    id: "profile",
    shot: "profile",
    shotCaption: "Your profile controls your photo, display name, bio, gender avatar and Pro status.",
    title: "Your profile and privacy",
    icon: "profile",
    summary: "What others see and what you control.",
    items: [
      {
        term: "Photo and name",
        body: "Tap your photo to view it full size and change it. Your display name, username and short bio are what people read on your card.",
      },
      {
        term: "Visible on radar",
        body: "This switch controls whether others can see you. Turning it off (invisible mode) is a Pro feature — you keep scanning while staying hidden.",
      },
      {
        term: "Scan range",
        body: "Choose how far you want to look. The admin sets the maximum; free accounts may have a shorter cap than Pro.",
      },
      {
        term: "Radar sound",
        body: "Optional tone when new people appear on your scope. Choose the tone or switch it off entirely.",
      },
      {
        term: "App lock",
        body: "Turn on biometrics so Face ID, Touch ID or your fingerprint is required to open the app.",
      },
      {
        term: "Theme",
        body: "Light or dark, switched from the toggle at the top of the radar.",
      },
      {
        term: "Deleting your account",
        body: "Delete from your profile page. Your profile, chats, signals and photos are removed permanently.",
      },
    ],
  },
  {
    id: "verification",
    title: "Verification",
    icon: "verified",
    summary: "The badge and why it helps.",
    items: [
      {
        term: "What it is",
        body: "Verified members carry a badge on their card and a distinct beacon colour, which tells others the account was checked by a moderator.",
      },
      {
        term: "Getting verified",
        body: "Submit a verification request from your profile. A moderator reviews it and the badge appears once approved.",
      },
    ],
  },
  {
    id: "pro",
    title: "Pro membership",
    icon: "pro",
    summary: "What upgrading unlocks and how billing works.",
    items: [
      {
        term: "What you get",
        body: "The exact perks are set by the admin, and typically include unlimited signals, a wider scan range, unlimited messages, invisible mode, custom beacons and priority placement. The upgrade screen always lists what is included in your plan.",
      },
      {
        term: "How to buy",
        body: "Pro is purchased through the App Store or Google Play from the Go Pro screen. Prices come straight from the store in your local currency.",
      },
      {
        term: "Restoring",
        body: "Changed phone or reinstalled? Tap Restore purchases on the Go Pro screen to bring your subscription back.",
      },
      {
        term: "Cancelling",
        body: "Subscriptions renew automatically. Cancel any time from your Apple ID subscriptions or Google Play subscriptions — the app cannot cancel it for you.",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: "bell",
    summary: "Staying on top of signals and messages.",
    items: [
      {
        term: "What triggers one",
        body: "New signals, new matches, new messages, and announcements sent by the team.",
      },
      {
        term: "The bell",
        body: "The bell on the radar screen holds announcements and anything you have not read yet.",
      },
      {
        term: "Not receiving any?",
        body: "Allow notifications from your profile page, and check that they are not blocked for the app in your phone settings.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety and etiquette",
    icon: "safety",
    summary: "Meeting strangers sensibly.",
    items: [
      {
        term: "Meet in public",
        body: "First meets belong in busy, public places. Tell a friend where you are going and stay in the app until you are comfortable.",
      },
      {
        term: "Guard your details",
        body: "Never share your home address, banking details, or one-time codes. Nobody from the team will ever ask for them.",
      },
      {
        term: "Report and block",
        body: "Report harassment, nudity, scams or anyone who seems underage. Reports go straight to moderators and blocking is instant and silent.",
      },
      {
        term: "Bans",
        body: "Accounts that break the rules are banned. If you believe it was a mistake, submit a reactivation request and a moderator will review it.",
      },
    ],
  },
  {
    id: "trouble",
    title: "Troubleshooting",
    icon: "help",
    summary: "Quick fixes for the usual problems.",
    items: [
      {
        term: "Radar is empty",
        body: "Check that location permission is granted, that you are visible on radar, and widen your scan range. Empty simply means nobody is using the app near you right now.",
      },
      {
        term: "Someone sees me but I cannot see them",
        body: "Pull the radar to refresh and make sure the app is in the foreground — the app publishes your position while it is open.",
      },
      {
        term: "Compass stuck",
        body: "Toggle it off and on, then wave the phone in a figure-8. On iPhone confirm motion & orientation access is allowed.",
      },
      {
        term: "No internet",
        body: "A banner appears when the connection drops. The app reconnects and refreshes on its own once you are back online.",
      },
      {
        term: "Still stuck",
        body: "Contact support from the Legal & support box on your profile page.",
      },
    ],
  },
];
