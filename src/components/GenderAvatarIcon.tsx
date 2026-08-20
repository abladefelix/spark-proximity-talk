import { cn } from "@/lib/utils";

export type AvatarGender = "male" | "female" | "other" | null | undefined;

/**
 * Hair-silhouette beacon icons for the radar.
 * Bold, filled shapes so male (short hair) and female (long hair) read
 * instantly inside the glowing ring. Neutral gender is intentionally bare —
 * only the glow ring marks the beacon.
 */
export function GenderAvatarIcon({
  gender,
  className,
}: {
  gender: AvatarGender;
  className?: string;
}) {
  if (gender === "male") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn(className)}
        fill="currentColor"
        aria-hidden="true"
      >
        {/* short cropped hair silhouette */}
        <path
          d="M12 2.5c-3.2 0-5.5 2.1-5.5 5.1 0 .4.3.7.7.7h9.6c.4 0 .7-.3.7-.7 0-3-2.3-5.1-5.5-5.1Z"
          opacity="0.9"
        />
        <circle cx="12" cy="10" r="3.8" />
        <path d="M12 14.4c-3.5 0-6.4 2.3-7.1 5.4-.2.9.5 1.8 1.5 1.8h11.2c1 0 1.7-.9 1.5-1.8-.7-3.1-3.6-5.4-7.1-5.4Z" />
      </svg>
    );
  }

  if (gender === "female") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn(className)}
        fill="currentColor"
        aria-hidden="true"
      >
        {/* long hair framing the face */}
        <path
          d="M12 2.2c-3.6 0-6 2.5-6 6.1 0 1.8-.5 3.3-1.2 4.6-.3.6.1 1.3.8 1.3h1.2c-.3-.8-.5-1.7-.5-2.7V8.8c1.9-.3 3.6-1.2 4.8-2.6a7.4 7.4 0 0 0 4.5 2.6v2.6c0 1-.2 1.9-.5 2.7h1.2c.7 0 1.1-.7.8-1.3a9 9 0 0 1-1.1-4.6c0-3.6-3-6.1-4.4-6.1Z"
          opacity="0.9"
        />
        <circle cx="12" cy="10" r="3.6" />
        <path d="M12 14.6c-3.6 0-6.6 2.4-7.3 5.6-.2.9.5 1.8 1.5 1.8h11.6c1 0 1.7-.9 1.5-1.8-.7-3.2-3.7-5.6-7.3-5.6Z" />
      </svg>
    );
  }

  // Neutral gender intentionally has no icon inside the beacon; the glow ring is enough.
  return null;
}

