import { cn } from "@/lib/utils";

export type AvatarGender = "male" | "female" | "other" | null | undefined;

/**
 * Bold, filled gender-symbol beacon icons for the radar.
 * Designed to read instantly at small sizes inside a glowing ring.
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
        {/* bold filled male symbol: circle + arrow */}
        <circle cx="9.5" cy="14.5" r="4.8" />
        <path d="M19.2 5.5 14.1 10.6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M19.2 5.5V10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M19.2 5.5H14.7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
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
        {/* bold filled female symbol: circle + cross */}
        <circle cx="12" cy="9.5" r="4.8" />
        <path d="M12 14.3V20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M9.4 17.15H14.6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(className)}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* bold filled neutral/transgender symbol */}
      <circle cx="12" cy="9.5" r="4.8" />
      <path d="M12 14.3V20" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M9.4 19.2 12 17.2 14.6 19.2" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
