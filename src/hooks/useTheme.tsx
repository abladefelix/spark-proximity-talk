import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "skanaround-theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void }>({
  theme: "light",
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const read = () => {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      // Admin's default theme is cached so the pre-paint boot script and this
      // hook agree — otherwise the app flashes the old theme on every launch.
      const adminDefault = localStorage.getItem("skanaround-default-theme") as Theme | null;
      return (
        // Light is the product default; system preference does not override it.
        stored ?? adminDefault ?? "light"
      );
    };
    setThemeState(read());
    // The early boot fetch may land after mount with a newer admin default.
    const onBoot = () => setThemeState(read());
    window.addEventListener("skanaround-theme-boot", onBoot);
    return () => window.removeEventListener("skanaround-theme-boot", onBoot);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
