import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="Verified profile"
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-primary",
        "verified-glow",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full" aria-hidden="true">
        {/* central locked beacon */}
        <circle cx="12" cy="12" r="2.6" fill="currentColor" />
        {/* inner sweep arc — radar has locked */}
        <path
          d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="opacity-90"
        />
        <path
          d="M12 18.5a6.5 6.5 0 0 1-6.5-6.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="opacity-40"
        />
        {/* outer confirmation ring */}
        <path
          d="M18.5 12a6.5 6.5 0 0 1-6.5 6.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="opacity-60"
        />
        <path
          d="M5.5 12a6.5 6.5 0 0 1 6.5-6.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="opacity-30"
        />
      </svg>
    </span>
  );
}
