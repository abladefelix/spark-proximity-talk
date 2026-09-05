import { Capacitor } from "@capacitor/core";

type DebugDetails = Record<string, unknown>;

function safeDetails(details?: DebugDetails) {
  if (!details) return "";
  try {
    return JSON.stringify(details);
  } catch {
    return "[unserializable details]";
  }
}

/**
 * Search Android Studio Logcat for SKAN_DEBUG to follow the native startup
 * sequence. Never include passwords, tokens, email addresses, or coordinates.
 */
export function nativeDebug(stage: string, details?: DebugDetails) {
  if (!Capacitor.isNativePlatform()) return;
  console.info(`[SKAN_DEBUG] ${stage}`, safeDetails(details));
}

/** Search Android Studio Logcat for SKAN_CRASH to find captured JS failures. */
export function nativeDebugError(stage: string, error: unknown) {
  if (!Capacitor.isNativePlatform()) return;
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[SKAN_CRASH] ${stage}`, safeDetails({ message, stack }));
}