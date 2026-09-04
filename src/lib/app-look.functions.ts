import { createServerFn } from "@tanstack/react-start";

export type AppLook = {
  accent_hue: number | null;
  default_theme: string | null;
  color_male: string | null;
  color_female: string | null;
  color_other: string | null;
  font_family: string | null;
};

/**
 * Public, unauthenticated read of the admin-configured look so the very first
 * paint already uses the right colours (no flash of the built-in scheme).
 */
export const getAppLook = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppLook | null> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;
    try {
      const res = await fetch(
        `${url}/rest/v1/app_settings?id=eq.global&select=accent_hue,default_theme,color_male,color_female,color_other,font_family`,
        { headers: { apikey: key, accept: "application/json" } },
      );
      if (!res.ok) return null;
      const rows = (await res.json()) as AppLook[];
      return Array.isArray(rows) ? (rows[0] ?? null) : null;
    } catch {
      return null;
    }
  },
);
