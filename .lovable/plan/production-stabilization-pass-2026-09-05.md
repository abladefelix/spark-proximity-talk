# Production stabilization pass

## Goal
Make subscriptions complete or fail cleanly instead of hanging, keep the Pro sheet usable on every supported phone size, and remove high-confidence native/mobile defects found during a full app audit.

## Implementation

### 1. Repair store checkout end to end
- Replace unbounded store configuration, product lookup, purchase, restore, and post-purchase sync calls with one reusable deadline wrapper.
- Stop treating admin-entered prices as purchasable store products unless the matching Apple/Google product can actually be resolved. Admin prices remain an immediate preview, but checkout will first resolve the exact store product/base plan and then open the native payment screen.
- On Android, select the correct subscription option/base plan returned by Google Play instead of manufacturing `product:monthly` and `product:yearly` identifiers.
- Clear stale load errors once products resolve or a new checkout begins; turn every timeout/failure into a concise in-sheet message and restore the buttons immediately.
- Prevent duplicate taps and safely handle app background/resume while the native payment screen is open.

### 2. Make the Pro experience phone-safe
- Convert both Pro entry points to the same mobile-safe sheet behavior with safe-area spacing, a fixed header/close control, and an independently scrolling body.
- Constrain width and height to the visible viewport so long errors or diagnostics cannot stretch the dialog off-screen.
- Remove raw diagnostic JSON from the member-facing purchase sheet; retain a compact support detail that cannot distort the layout.
- Keep Apple and Android behavior equivalent while preserving store-only in-app payments.

### 3. Production mobile audit and targeted repairs
- Test the public/authenticated shell, radar, person/signal dialogs, Local, Chats, chat keyboard/composer, Profile, Pro sheet, loading, error, and offline states at representative small and modern iPhone/Android dimensions.
- Fix reproducible overflow, overlap, blocked scrolling/taps, unsafe-area, keyboard, and back-navigation problems found in those flows.
- Keep changes limited to concrete defects; do not redesign working screens or change product rules.

### 4. Verification and release readiness
- Run focused checks for store helpers and loading-state cleanup, then the project build.
- Exercise the web-testable flows in phone-sized browser sessions and inspect screenshots for clipping or overlap.
- Validate Android native compilation/integration locally where the environment permits, and review iOS/Android configuration parity.
- Update the production checklist/changelog and bump both mobile builds together only after the fixes pass.

## Important store test condition
A real Google checkout can only be verified in an app installed from a Google Play testing track with an invited tester signed into Play; Apple checkout likewise needs StoreKit/TestFlight/App Store test context. The app will no longer hang outside those conditions—it will explain the unavailable store and remain usable—but it cannot bypass the stores or purchase directly from admin pricing.
