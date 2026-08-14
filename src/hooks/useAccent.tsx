import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";

export const ACCENT_PRESETS: { name: string; hue: number }[] = [
  { name: "Amber", hue: 46 },
  { name: "Coral", hue: 25 },
  { name: "Rose", hue: 5 },
  { name: "Violet", hue: 300 },
  { name: "Indigo", hue: 265 },
  { name: "Azure", hue: 240 },
  { name: "Teal", hue: 190 },
  { name: "Green", hue: 150 },
];

export const DEFAULT_HUE = 46;

export function accentSwatch(hue: number) {
  return `oklch(0.68 0.16 ${hue})`;
}

export function useAccentHue() {
  return useQuery({
    queryKey: ["app-accent"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("accent_hue")
        .eq("id", "global")
        .maybeSingle();
      return Number(data?.accent_hue ?? DEFAULT_HUE);
    },
  });
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { data: hue } = useAccentHue();

  useEffect(() => {
    const h = hue ?? DEFAULT_HUE;
    const root = document.documentElement;
    const primary = theme === "dark" ? `oklch(0.74 0.135 ${h})` : `oklch(0.65 0.16 ${h})`;
    const fg = theme === "dark" ? `oklch(0.17 0.02 ${h})` : `oklch(0.99 0.005 ${h})`;
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-foreground", fg);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-primary-foreground", fg);
    root.style.setProperty("--ring", primary);
  }, [hue, theme]);

  return <>{children}</>;
}

/** Parse a hex / rgb() / hsl() colour string into an OKLCH hue (0-360). */
export function parseColorToHue(input: string): number | null {
  const rgb = parseColorToRgb(input);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  if (Math.abs(a) < 1e-6 && Math.abs(bb) < 1e-6) return null;
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return Math.round((hue + 360) % 360);
}

export function parseColorToRgb(input: string): [number, number, number] | null {
  const v = input.trim().toLowerCase();
  const hex = v.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const rgbMatch = v.match(/^rgba?\(([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length === 3) {
      const nums = parts.map((p) =>
        p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p),
      );
      if (nums.every((n) => Number.isFinite(n))) {
        return nums.map((n) => Math.min(255, Math.max(0, n))) as [number, number, number];
      }
    }
  }
  const hslMatch = v.match(/^hsla?\(([^)]+)\)$/);
  if (hslMatch) {
    const parts = hslMatch[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    if (parts.length === 3) {
      const h = ((parseFloat(parts[0]) % 360) + 360) % 360;
      const sat = parseFloat(parts[1]) / 100;
      const light = parseFloat(parts[2]) / 100;
      if ([h, sat, light].every((n) => Number.isFinite(n))) {
        const c = (1 - Math.abs(2 * light - 1)) * sat;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const mm = light - c / 2;
        const seg: [number, number, number] =
          h < 60 ? [c, x, 0]
          : h < 120 ? [x, c, 0]
          : h < 180 ? [0, c, x]
          : h < 240 ? [0, x, c]
          : h < 300 ? [x, 0, c]
          : [c, 0, x];
        return seg.map((n) => Math.round((n + mm) * 255)) as [number, number, number];
      }
    }
  }
  return null;
}
