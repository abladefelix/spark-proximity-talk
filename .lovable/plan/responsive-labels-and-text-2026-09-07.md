# Responsive labels and text

## Goal
Keep labels and text readable and contained across narrow Android and iOS screens, including translated or unusually long wording.

## Changes
- Add an app-wide text-fitting baseline so long words wrap instead of overflowing their containers.
- Update shared labels to wrap cleanly with comfortable line height.
- Update shared buttons to allow multi-line text, use flexible height, and reduce label size only on exceptionally narrow phone screens; icon-only buttons remain fixed-size.
- Keep inputs and text areas at a mobile-safe readable size while allowing their contents and placeholders to fit without clipping.
- Check the main mobile screens for local one-line constraints that still cut off important labels, preserving intentional truncation for usernames and message previews.
- Verify the result on narrow Android- and iPhone-sized viewports, then run the project checks.

## Technical details
- Use shared Tailwind component styles and global CSS rather than one-off hardcoded fixes.
- Avoid fluid viewport typography; use wrapping first and one discrete narrow-screen adjustment where needed.
- Preserve 16px form text on phones to prevent iOS focus zoom.
