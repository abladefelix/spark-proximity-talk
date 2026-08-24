import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder rows for the "Your links" chat list. */
export function ChatListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder bubbles while a conversation loads. */
export function TranscriptSkeleton() {
  const widths = ["58%", "40%", "72%", "34%", "64%"];
  return (
    <div className="space-y-3 py-2" aria-hidden>
      {widths.map((w, i) => {
        const mine = i % 2 === 1;
        return (
          <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <Skeleton
              className={`h-9 rounded-[10px] ${mine ? "rounded-tr-[3px]" : "rounded-tl-[3px]"}`}
              style={{ width: w }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Placeholder for the stacked chat deck on the radar. */
export function ActiveChatsSkeleton() {
  return (
    <div className="relative z-10 mt-4" aria-hidden>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm">
        <Skeleton className="size-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}
