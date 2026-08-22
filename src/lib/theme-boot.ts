/**
 * Cold-start theming.
 *
 * The pre-paint script in __root paints the *cached* look instantly, but that
 * cache can be stale after an admin changes the theme or accent. This module
 * fires a single, dependency-free request for the live look the moment the
 * bundle is evaluated — before React mounts, before auth, before any query —
 * and applies it as soon as it lands, so the stale colours are on screen for
 * the shortest possible time.
 */

type BootLook = {
  accent_hue: number | null;
  default_theme: string | null;
  color_male: string | null;
  color_female: string | null;
  color_other: string | null;
  font_family: string | null;
};

function applyAccent(hue: number, theme: "light" | "dark") {
  const root = document.documentElement;
  const primary = theme === "dark" ? `oklch(0.74 0.135 ${hue})` : `oklch(0.65 0.16 ${hue})`;
  const fg = theme === "dark" ? `oklch(0.17 0.02 ${hue})` : `oklch(0.99 0.005 ${hue})`;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", fg);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", fg);
  root.style.setProperty("--ring", primary);
}

function cache(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function applyLook(look: BootLook) {
  const root = document.documentElement;

  // Theme: an explicit user choice always wins over the admin default.
  const adminTheme = look.default_theme === "light" ? "light" : "dark";
  cache("skanaround-default-theme", adminTheme);
  let userTheme: string | null = null;
  try {
    userTheme = localStorage.getItem("skanaround-theme");
  } catch {
    /* storage unavailable */
  }
  const theme: "light" | "dark" =
    userTheme === "light" || userTheme === "dark" ? userTheme : adminTheme;
  root.classList.toggle("dark", theme === "dark");

  const hue = Number(look.accent_hue);
  if (Number.isFinite(hue)) {
    applyAccent(hue, theme);
    cache("skanaround-accent-hue", String(hue));
  }

  if (look.color_male && look.color_female && look.color_other) {
    root.style.setProperty("--gender-male", look.color_male);
    root.style.setProperty("--gender-female", look.color_female);
    root.style.setProperty("--gender-other", look.color_other);
    cache(
      "skanaround-gender-colors",
      [look.color_male, look.color_female, look.color_other].join(","),
    );
  }

  if (look.font_family) cache("skanaround-font", look.font_family);

  window.dispatchEvent(new CustomEvent("skanaround-theme-boot", { detail: theme }));
}

let started: Promise<void> | null = null;

/** Fetches and applies the admin-configured look as early as possible. */
export function bootTheme(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (started) return started;

  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined;
  if (!url || !key) return Promise.resolve();

  started = fetch(
    `${url}/rest/v1/app_settings?id=eq.global&select=accent_hue,default_theme,color_male,color_female,color_other,font_family`,
    { headers: { apikey: key, accept: "application/json" } },
  )
    .then((res) => (res.ok ? res.json() : null))
    .then((rows: BootLook[] | null) => {
      const look = Array.isArray(rows) ? rows[0] : null;
      if (look) applyLook(look);
    })
    .catch(() => {
      /* offline / blocked — the cached look stays */
    });

  return started;
}
