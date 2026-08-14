import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useAppSettings";

export const VERIFIED_BADGE_STYLES = {
  check: "M6 12l4 4 8-8",
  star: "M12 5.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z",
  shield: "M12 4l6 2.4v4.4c0 3.6-2.5 6.4-6 7.7-3.5-1.3-6-4.1-6-7.7V6.4z",
  bolt: "M13.5 4L7 13h4l-.5 7 6.5-9h-4z",
  heart: "M12 19s-6-3.9-6-8a3.4 3.4 0 016-2.1A3.4 3.4 0 0118 11c0 4.1-6 8-6 8z",
  crown: "M5 17h14l1-9-4.5 3L12 6 8.5 11 4 8z",
} as const;

export type VerifiedBadgeStyle = keyof typeof VERIFIED_BADGE_STYLES;

export function VerifiedBadgeMark({
  style,
  color,
  className,
}: {
  style: VerifiedBadgeStyle;
  color: string;
  className?: string | undefined;
}) {
  const path = VERIFIED_BADGE_STYLES[style] ?? VERIFIED_BADGE_STYLES.check;
  const filled = style !== "check";
  return (
    <span
      aria-label="Verified profile"
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-white",
        className,
      )}
      style={{ backgroundColor: color }}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full p-0.5" aria-hidden="true">
        <path
          d={path}
          stroke="currentColor"
          fill={filled ? "currentColor" : "none"}
          strokeWidth={filled ? 1.5 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function VerifiedBadge({ className }: { className?: string | undefined }) {
  const settings = useSettings();
  return (
    <VerifiedBadgeMark
      style={(settings.verified_badge_style as VerifiedBadgeStyle) ?? "check"}
      color={settings.verified_badge_color ?? "#22c55e"}
      className={className}
    />
  );
}
