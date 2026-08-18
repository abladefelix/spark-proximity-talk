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

/** Always-available fallback background. */
export const NONE_BACKGROUND: ChatBackground = { id: "none", name: "None" };

function parseBackgrounds(value: unknown): ChatBackground[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item["id"] !== "string" || typeof item["name"] !== "string") return [];
    const bg: ChatBackground = { id: item["id"], name: item["name"] };
    if (typeof item["css"] === "string") bg.css = item["css"];
    if (typeof item["path"] === "string") bg.path = item["path"];
    // Require at least one renderable source (css for built-ins, path for uploads).
    if (!bg.css && !bg.path) return [];
    return [bg];
  });
}

/** All backgrounds configured by admins: built-in presets + uploads with signed URLs. */
export function useChatBackgrounds() {
  const settings = useSettings();
  const configured = parseBackgrounds((settings as { chat_backgrounds?: unknown }).chat_backgrounds);
  const paths = configured.map((c) => c.path).filter((p): p is string => Boolean(p)).sort();

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

  const withUrls = configured.map((c) => (c.path ? { ...c, url: signed?.[c.path] } : c));
  const byId = new Map<string, ChatBackground>();
  byId.set(NONE_BACKGROUND.id, NONE_BACKGROUND);
  for (const bg of withUrls) {
    byId.set(bg.id, bg);
  }
  return Array.from(byId.values());
}

/** CSS background shorthand for a background, or undefined for "none". */
export function backgroundCss(bg: ChatBackground | undefined) {
  if (!bg) return undefined;
  if (bg.css) return bg.css;
  if (bg.url) return `url("${bg.url}") center/cover no-repeat`;
  return undefined;
}
