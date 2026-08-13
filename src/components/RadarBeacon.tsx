import { cn } from "@/lib/utils";

interface RadarBeaconProps {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  size?: "sm" | "md" | "lg";
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
  size = "md",
}: RadarBeaconProps) {
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      {active && (
        <>
          <span className="absolute inset-[-6px] rounded-full border border-primary/25" />
          <span className="beacon-ping absolute inset-[-5px] rounded-full border border-primary/40" />
        </>
      )}

      <div
        className={cn(
          "relative z-10 flex items-center justify-center overflow-hidden rounded-full bg-card ring-1 ring-border/60 shadow-heat",
          sizeClasses[size],
        )}
      >
        {children}
      </div>

      {active && (
        <span className="absolute -right-0.5 -top-0.5 z-20 size-2.5 rounded-full bg-primary ring-2 ring-background" />
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
