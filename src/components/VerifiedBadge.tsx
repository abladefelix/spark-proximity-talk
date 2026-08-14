import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="Verified profile"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-primary",
        "verified-glow",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
        {/* outer sonar-lock ring */}
        <path
          d="M12 2.5a2.7 2.7 0 0 1 2.3 1.3l3.6 6.2a2.7 2.7 0 0 1 0 2.7l-3.6 6.2A2.7 2.7 0 0 1 12 20.5a2.7 2.7 0 0 1-2.3-1.3L6.1 13a2.7 2.7 0 0 1 0-2.7l3.6-6.2A2.7 2.7 0 0 1 12 2.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          className="opacity-90"
        />
        {/* inner beacon dot */}
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        {/* left echo arc */}
        <path
          d="M6.8 10c-1.2 1.2-1.2 3.2 0 4.3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="verified-echo"
        />
        {/* right echo arc */}
        <path
          d="M17.2 10c1.2 1.2 1.2 3.2 0 4.3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="verified-echo"
        />
        {/* top/bottom cross-hair ticks */}
        <path
          d="M12 6.2v1.8M12 16v1.8"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          className="opacity-60"
        />
      </svg>
    </span>
  );
}
