import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type AvatarGender = "male" | "female" | "other" | null | undefined;

/**
 * Venus / Mars gender symbol beacon icons for the radar.
 * Bold rounded strokes so they read instantly inside the glowing ring.
 * Neutral gender is intentionally bare — only the glow ring marks the beacon.
 */
export function GenderAvatarIcon({
  gender,
  className,
  style,
}: {
  gender: AvatarGender;
  className?: string;
  style?: CSSProperties;
}) {
  if (gender === "male") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn(className)}
        style={style}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Mars: circle with arrow to upper-right */}
        <circle cx="9.5" cy="14.5" r="5.6" />
        <path d="M13.6 10.4 20.5 3.5" />
        <path d="M14.8 3.5h5.7v5.7" />
      </svg>
    );
  }

  if (gender === "female") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn(className)}
        style={style}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* Venus: circle with cross below */}
        <circle cx="12" cy="8.2" r="5.6" />
        <path d="M12 13.8V22" />
        <path d="M8.4 18.4h7.2" />
      </svg>
    );
  }

  // Neutral gender intentionally has no icon inside the beacon; the glow ring is enough.
  return null;
}


