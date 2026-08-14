import { useEffect, useState } from "react";
import { Radar } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useMaxRadius, DEFAULT_MAX_RADIUS } from "@/hooks/useMaxRadius";
import { useSettings } from "@/hooks/useAppSettings";

const MIN_RADIUS = 100;

function label(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

export function ScanRangeSetting() {
  const { data: maxRadius } = useMaxRadius();
  const settings = useSettings();
  const cap = maxRadius ?? DEFAULT_MAX_RADIUS;
  const [radius, setRadius] = useState(settings.default_radius_m);

  useEffect(() => {
    const saved = Number(localStorage.getItem("skan-radius") ?? "");
    if (Number.isFinite(saved) && saved > 0) setRadius(saved);
    else setRadius(settings.default_radius_m);
  }, [settings.default_radius_m]);

  const value = Math.min(Math.max(radius, MIN_RADIUS), cap);

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Radar className="size-4 text-primary" /> Scan range
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        How far around you the radar looks for people. Max {label(cap)}.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <Slider
          value={[value]}
          min={MIN_RADIUS}
          max={cap}
          step={50}
          aria-label="Scan range"
          className="flex-1"
          onValueChange={([v]) => {
            const next = v ?? value;
            setRadius(next);
            localStorage.setItem("skan-radius", String(next));
          }}
        />
        <span className="w-16 shrink-0 text-right text-xs font-medium tabular-nums">
          {label(value)}
        </span>
      </div>
    </div>
  );
}
