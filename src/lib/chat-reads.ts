const KEY = "skan-chat-reads";
export const CHAT_READS_EVENT = "skan-chat-reads-changed";

/** Map of matchId -> ISO timestamp of the newest message the user has seen. */
export function getChatReads(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Remember that everything up to `at` in this conversation has been read. */
export function markChatRead(matchId: string, at: string) {
  if (typeof window === "undefined") return;
  const reads = getChatReads();
  if (reads[matchId] && new Date(reads[matchId]).getTime() >= new Date(at).getTime()) return;
  reads[matchId] = at;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(reads));
  } catch {
    /* storage full or blocked — badge falls back to unread */
  }
  window.dispatchEvent(new Event(CHAT_READS_EVENT));
}
