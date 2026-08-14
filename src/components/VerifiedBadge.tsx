import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      aria-label="Verified profile"
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-full bg-green-500 text-white",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full p-0.5" aria-hidden="true">
        <path
          d="M6 12l4 4 8-8"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
