const KEY = "skanaround.device-id";

/** Stable per-install identifier used to enforce one active device per account. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "";
  }
}

/** Human-readable device name shown when a sign-in is blocked. */
export function getDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const os = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android phone"
        : /Mac OS X/i.test(ua)
          ? "Mac"
          : /Windows/i.test(ua)
            ? "Windows PC"
            : "Device";
  const browser = /CriOS|Chrome/i.test(ua)
    ? "Chrome"
    : /Firefox/i.test(ua)
      ? "Firefox"
      : /Safari/i.test(ua)
        ? "Safari"
        : "app";
  return `${os} · ${browser}`;
}
