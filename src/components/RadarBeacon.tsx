import { cn } from "@/lib/utils";

interface RadarBeaconProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  /** Verified members get their own beacon colour. */
  verified?: boolean;
  size?: "sm" | "md" | "lg";
  /** Explicit pixel size, overrides the `size` preset (used by the auto-zoom radar). */
  sizePx?: number;
}

const sizeClasses = {
  sm: "size-8",
  md: "size-10",
  lg: "size-11",
};

export function RadarBeacon({
  children,
  className,
  active,
  verified,
  size = "md",
  sizePx,
}: RadarBeaconProps) {
  const px = sizePx ?? 40;
  const tail = Math.max(6, Math.round(px * 0.28));

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {active && (
        <>
          <span
            className={cn(
              "absolute inset-[-6px] rounded-full border",
              verified ? "border-[oklch(0.78_0.14_190)]/30" : "border-primary/25",
            )}
          />
          <span
            className={cn(
              "beacon-ping absolute inset-[-5px] rounded-full border",
              verified ? "border-[oklch(0.78_0.14_190)]/50" : "border-primary/40",
            )}
          />
        </>
      )}

      {/* Soft glow pooled under the icon so it reads as a light source on the radar. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-[-30%] z-0 rounded-full blur-md",
          verified
            ? "bg-[oklch(0.78_0.14_190)]/25"
            : active
              ? "bg-primary/25"
              : "bg-primary/10",
        )}
      />

      <div
        style={sizePx ? { width: sizePx, height: sizePx } : undefined}
        className={cn(
          "relative z-10 flex items-center justify-center overflow-hidden rounded-full bg-card ring-2",
          verified ? "ring-[oklch(0.78_0.14_190)]" : active ? "ring-primary" : "ring-border/60",
          active ? "beacon-glow" : "shadow-heat",
          !sizePx && sizeClasses[size],
        )}
      >
        {children}
      </div>

      {active && (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 z-20 size-2.5 rounded-full ring-2 ring-background",
            verified ? "bg-[oklch(0.78_0.14_190)]" : "bg-primary",
          )}
        />
      )}
    </div>
  );
}


export function RadarBeaconInitial({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center bg-card text-sm font-semibold text-card-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
