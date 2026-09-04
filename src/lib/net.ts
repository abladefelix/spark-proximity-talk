/** Network helpers shared across the app: timeouts, offline detection, error text. */

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Resolve a promise with a hard deadline. Used for calls that can hang
 * indefinitely offline (auth session refresh, native geolocation bridges).
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms = 6000, label = "Request"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(`${label} timed out`)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Same as withTimeout but never throws — returns the fallback instead. */
export async function withTimeoutFallback<T>(
  promise: PromiseLike<T>,
  fallback: T,
  ms = 6000,
  label = "Request",
): Promise<T> {
  try {
    return await withTimeout(promise, ms, label);
  } catch {
    return fallback;
  }
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

const OFFLINE_HINTS = [
  "failed to fetch",
  "networkerror",
  "network request failed",
  "load failed",
  "timed out",
  "err_internet_disconnected",
];

/**
 * True for a request the browser or server simply cancelled (navigation away,
 * closed tab, HMR reload). Not a real fault — never show it to the user.
 */
export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    if (error.name === "AbortError") return true;
  }
  const name = (error as { name?: string } | null)?.name ?? "";
  if (name === "AbortError" || name === "CanceledError") return true;
  const message = (error instanceof Error ? error.message : String(error ?? ""))
    .toLowerCase()
    .trim();
  return (
    message === "aborted" ||
    message === "error: aborted" ||
    message.includes("the operation was aborted") ||
    message.includes("request aborted") ||
    message.includes("socket hang up")
  );
}

/** True when an error looks like a connectivity problem rather than a real bug. */
export function isNetworkError(error: unknown): boolean {
  if (!isOnline()) return true;
  if (error instanceof TimeoutError) return true;
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return OFFLINE_HINTS.some((hint) => message.includes(hint));
}

/** User-facing message for any thrown value. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (isNetworkError(error)) {
    return isOnline()
      ? "Connection problem. Check your internet and try again."
      : "You're offline. Reconnect to continue.";
  }
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}
