import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

/** Resolves a stored avatar path in the private "avatars" bucket to a signed URL. */
export async function getAvatarUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cached = cache.get(path);
  if (cached) return cached;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  cache.set(path, data.signedUrl);
  return data.signedUrl;
}

export function initials(name: string | null | undefined, fallback: string) {
  const source = (name ?? fallback).trim();
  return source.slice(0, 2).toUpperCase();
}
