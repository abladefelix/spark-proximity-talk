import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import type { Tables } from "@/integrations/supabase/types";

export type AppSettings = Tables<"app_settings">;

export const APP_SETTINGS_KEY = ["app-settings"] as const;

export const APP_SETTINGS_DEFAULTS = {
  tagline: "Find people around you",
  welcome_text: "Turn on location to see who is nearby.",
  empty_radar_text: "No one around right now.",
  chat_prompt_text: "Say hello",
  terms_text: "",
  privacy_text: "",
  chat_enabled: true,
  location_sharing_enabled: true,
  verification_enabled: true,
  reports_enabled: true,
  signups_enabled: true,
  push_enabled: true,
  radar_sweep_enabled: true,
  signal_expiry_hours: 6,
  presence_timeout_min: 5,
  default_radius_m: 500,
  max_message_len: 1000,
  daily_signal_limit: 100,
  color_male: "#3b82f6",
  color_female: "#ec4899",
  color_other: "#f59e0b",
  default_theme: "dark",
  font_family: "Sora",
  verified_badge_style: "check",
  verified_badge_color: "#22c55e",
} satisfies Partial<AppSettings>;

export type AppSettingsValue = AppSettings & typeof APP_SETTINGS_DEFAULTS;

/** Full app-wide configuration row, editable by admins. */
export function useAppSettings() {
  return useQuery({
    queryKey: APP_SETTINGS_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", "global")
        .maybeSingle();
      return { ...APP_SETTINGS_DEFAULTS, ...(data ?? {}) } as AppSettingsValue;
    },
  });
}

/** Convenience accessor with defaults always present. */
export function useSettings(): AppSettingsValue {
  const { data } = useAppSettings();
  return (data ?? (APP_SETTINGS_DEFAULTS as AppSettingsValue)) as AppSettingsValue;
}

export function useSaveAppSettings() {
  const queryClient = useQueryClient();
  return async (patch: Partial<AppSettings>) => {
    const { error } = await supabase
      .from("app_settings")
      .update(patch)
      .eq("id", "global");
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: APP_SETTINGS_KEY });
    await queryClient.invalidateQueries({ queryKey: ["app-branding"] });
    await queryClient.invalidateQueries({ queryKey: ["app-accent"] });
    await queryClient.invalidateQueries({ queryKey: ["app-max-radius"] });
    await queryClient.invalidateQueries({ queryKey: ["app-chat-ttl"] });
  };
}

export const FONT_OPTIONS = [
  "Sora",
  "Inter",
  "Manrope",
  "Space Grotesk",
  "DM Sans",
  "Outfit",
] as const;

/** Applies admin-controlled look & feel (beacon colours, font, default theme). */
export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--gender-male", settings.color_male);
    root.style.setProperty("--gender-female", settings.color_female);
    root.style.setProperty("--gender-other", settings.color_other);
    try {
      localStorage.setItem(
        "skanaround-gender-colors",
        [settings.color_male, settings.color_female, settings.color_other].join(","),
      );
    } catch {
      /* storage unavailable */
    }
  }, [settings.color_male, settings.color_female, settings.color_other]);

  useEffect(() => {
    // Only the two default families ship in the blocking <link>; any other
    // admin-picked family is fetched lazily so cold start stays fast.
    const family = settings.font_family;
    if (family && family !== "Sora" && family !== "Manrope") {
      const id = `font-${family.replace(/\s+/g, "-")}`;
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
          family,
        ).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
    }
    document.documentElement.style.setProperty(
      "--font-sans-active",
      `"${settings.font_family}", ui-sans-serif, system-ui, sans-serif`,
    );
    document.body.style.fontFamily = `var(--font-sans-active)`;
    try {
      localStorage.setItem("skanaround-font", settings.font_family);
    } catch {
      /* storage unavailable */
    }
  }, [settings.font_family]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const preferred = settings.default_theme === "light" ? "light" : "dark";
    // Cached so the pre-paint boot script can apply it on the next cold start.
    try {
      localStorage.setItem("skanaround-default-theme", preferred);
    } catch {
      /* storage unavailable */
    }
    if (localStorage.getItem("skanaround-theme")) return;
    if (preferred !== theme) setTheme(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.default_theme]);

  return <>{children}</>;
}
