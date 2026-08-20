import { cn } from "@/lib/utils";

export type AvatarGender = "male" | "female" | "other" | null | undefined;

/**
 * Modern gender-symbol beacon icons for the radar.
 * Simple, bold glyphs so male/female/neutral read instantly at small sizes.
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
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9.5" cy="14.5" r="5.5" />
        <path d="M20 6 14.5 11.5" />
        <path d="M20 6h-5" />
        <path d="M20 6v5" />
      </svg>
    );
  }

  if (gender === "female") {
    return (
      <svg
        viewBox="0 0 24 24"
        className={cn(className)}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="9.5" r="5.5" />
        <path d="M12 15v6" />
        <path d="M9 19h6" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M12 15v5" />
      <path d="m9 20 3-1 3 1" />
    </svg>
  );
}
