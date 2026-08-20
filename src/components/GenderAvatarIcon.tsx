import { cn } from "@/lib/utils";

export type AvatarGender = "male" | "female" | "other" | null | undefined;

/**
 * Person-shaped avatar glyphs so men and women read differently at a glance
 * on the radar (short hair vs. long hair, plus a neutral fallback).
 */
export function GenderAvatarIcon({
  gender,
  className,
}: {
  gender: AvatarGender;
  className?: string;
}) {
  if (gender === "female") {
    return (
      <svg viewBox="0 0 24 24" className={cn(className)} fill="currentColor" aria-hidden="true">
        {/* long hair framing the face */}
        <path
          d="M12 2.2c-3.5 0-5.7 2.4-5.7 5.9 0 1.6-.4 3-1.1 4.2-.3.6.1 1.3.8 1.3h1.2a5.9 5.9 0 0 1-.5-2.4V8.6c1.9-.3 3.6-1.2 4.8-2.6a7.4 7.4 0 0 0 4.5 2.6v2.6c0 .9-.2 1.7-.5 2.4h1.2c.7 0 1.1-.7.8-1.3a9 9 0 0 1-1.1-4.2c0-3.5-2.9-5.9-4.4-5.9Z"
          opacity="0.85"
        />
        <circle cx="12" cy="10" r="3.6" />
        <path d="M12 14.6c-3.6 0-6.6 2.4-7.3 5.6-.2.9.5 1.8 1.5 1.8h11.6c1 0 1.7-.9 1.5-1.8-.7-3.2-3.7-5.6-7.3-5.6Z" />
      </svg>
    );
  }

  if (gender === "male") {
    return (
      <svg viewBox="0 0 24 24" className={cn(className)} fill="currentColor" aria-hidden="true">
        {/* short cropped hair */}
        <path
          d="M12 2.6c-3 0-5.2 1.9-5.2 4.6 0 .5.4.9.9.9h8.6c.5 0 .9-.4.9-.9 0-2.7-2.2-4.6-5.2-4.6Z"
          opacity="0.85"
        />
        <circle cx="12" cy="10" r="3.6" />
        <path d="M12 14.6c-3.6 0-6.6 2.4-7.3 5.6-.2.9.5 1.8 1.5 1.8h11.6c1 0 1.7-.9 1.5-1.8-.7-3.2-3.7-5.6-7.3-5.6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={cn(className)} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="9.2" r="3.9" />
      <path d="M12 14.4c-3.6 0-6.6 2.4-7.3 5.6-.2.9.5 1.8 1.5 1.8h11.6c1 0 1.7-.9 1.5-1.8-.7-3.2-3.7-5.6-7.3-5.6Z" />
    </svg>
  );
}
