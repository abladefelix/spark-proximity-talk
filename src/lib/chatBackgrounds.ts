import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useAppSettings";

export type ChatBackground = {
  id: string;
  name: string;
  /** CSS background value for built-in gradient presets. */
  css?: string | undefined;
  /** Storage path in the `chat-backgrounds` bucket for admin uploads. */
  path?: string | undefined;
  /** Resolved signed URL (filled in at runtime for uploads). */
  url?: string | undefined;
};

/** Built-in presets always available to members. */
export const BUILTIN_BACKGROUNDS: ChatBackground[] = [
  { id: "none", name: "None" },
  {
    id: "dusk",
    name: "Dusk",
    css: "linear-gradient(160deg, oklch(0.62 0.17 32), oklch(0.42 0.16 300))",
  },
  {
    id: "signal",
    name: "Signal",
    css: "radial-gradient(120% 90% at 20% 0%, oklch(0.75 0.15 55), transparent 60%), linear-gradient(200deg, oklch(0.55 0.13 220), oklch(0.30 0.09 265))",
  },
  {
    id: "mint",
    name: "Mint",
    css: "linear-gradient(150deg, oklch(0.85 0.12 165), oklch(0.62 0.11 205))",
  },
  {
    id: "ember",
    name: "Ember",
    css: "radial-gradient(100% 80% at 80% 10%, oklch(0.72 0.19 25), transparent 65%), linear-gradient(180deg, oklch(0.35 0.08 20), oklch(0.20 0.04 300))",
  },
  {
    id: "grid",
    name: "Night grid",
    css: "repeating-linear-gradient(0deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), linear-gradient(160deg, oklch(0.28 0.05 265), oklch(0.18 0.03 280))",
  },
];

function parseCustom(value: unknown): ChatBackground[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item["id"] !== "string" || typeof item["path"] !== "string") return [];
    return [
      {
        id: item["id"],
        name: typeof item["name"] === "string" ? item["name"] : "Background",
        path: item["path"],
      },
    ];
  });
}

/** All backgrounds: built-in presets plus admin uploads with signed URLs. */
export function useChatBackgrounds() {
  const settings = useSettings();
  const custom = parseCustom((settings as { chat_backgrounds?: unknown }).chat_backgrounds);
  const paths = custom.map((c) => c.path!).sort();

  const { data: signed } = useQuery({
    queryKey: ["chat-background-urls", paths],
    enabled: paths.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage
        .from("chat-backgrounds")
        .createSignedUrls(paths, 60 * 60);
      const map: Record<string, string> = {};
      (data ?? []).forEach((entry) => {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      });
      return map;
    },
  });

  const uploads = custom.map((c) => ({ ...c, url: signed?.[c.path!] }));
  return [...BUILTIN_BACKGROUNDS, ...uploads];
}

/** CSS background shorthand for a background, or undefined for "none". */
export function backgroundCss(bg: ChatBackground | undefined) {
  if (!bg) return undefined;
  if (bg.css) return bg.css;
  if (bg.url) return `url("${bg.url}") center/cover no-repeat`;
  return undefined;
}
