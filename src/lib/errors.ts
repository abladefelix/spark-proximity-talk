/**
 * Pull a readable message out of anything that gets thrown.
 *
 * Backend errors arrive as plain objects (not Error instances), so an
 * `e instanceof Error` check hides the real reason behind a generic message.
 */
export function errorMessage(e: unknown, fallback: string): string {
  const raw = rawMessage(e);
  if (!raw) return fallback;
  return friendly(raw) ?? raw;
}

function rawMessage(e: unknown): string {
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown };
    for (const v of [o.message, o.error_description, o.details]) {
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return "";
}

/**
 * Turn internal backend wording into something a member can act on. These are
 * the two shapes that reach people when the server is mid-update or a session
 * has lapsed; the raw text is meaningless to them.
 */
function friendly(raw: string): string | null {
  const t = raw.toLowerCase();
  if (t.includes("schema cache") || t.includes("does not exist")) {
    return "This feature is updating on our side. Please try again in a moment.";
  }
  if (t.includes("permission denied") || t.includes("jwt") || t.includes("not authenticated")) {
    return "Your session expired. Sign in again to continue.";
  }
  return null;
}
