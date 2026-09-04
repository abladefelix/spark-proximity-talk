/**
 * Pull a readable message out of anything that gets thrown.
 *
 * Backend errors arrive as plain objects (not Error instances), so an
 * `e instanceof Error` check hides the real reason behind a generic message.
 */
export function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; error_description?: unknown; details?: unknown };
    for (const v of [o.message, o.error_description, o.details]) {
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return fallback;
}
