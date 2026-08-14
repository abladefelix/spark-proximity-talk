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
