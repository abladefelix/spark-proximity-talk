/**
 * Connection-loss guard for the browser/web view.
 *
 * When the connection drops mid-session (aeroplane mode), any code the app
 * still needs to download fails. Safari rejects those with a raw
 * "Load failed" / error Event, which otherwise bubbles up as an ugly crash
 * message. Here we swallow those, let the offline banner speak instead, and
 * quietly reload once the connection is back so the app repairs itself.
 */

import { isNetworkError, isOnline } from "./net";

let armed = false;
let reloadScheduled = false;

const RELOAD_MARK = "skanaround-recovery-reload";
const RELOAD_WINDOW_MS = 60_000;
const MAX_RELOADS = 1;

/** Allow at most one automatic repair reload per minute, per tab. */
function mayReload(): boolean {
  if (reloadScheduled) return false;
  try {
    const raw = sessionStorage.getItem(RELOAD_MARK);
    const [countRaw, atRaw] = (raw ?? "").split(":");
    const at = Number(atRaw);
    const recent = Number.isFinite(at) && Date.now() - at < RELOAD_WINDOW_MS;
    const count = recent ? Number(countRaw) || 0 : 0;
    if (count >= MAX_RELOADS) return false;
    sessionStorage.setItem(RELOAD_MARK, `${count + 1}:${Date.now()}`);
  } catch {
    /* storage unavailable — still allow a single reload this tab */
  }
  reloadScheduled = true;
  return true;
}

function looksLikeLostConnection(value: unknown): boolean {
  if (!value) return false;
  if (typeof Event !== "undefined" && value instanceof Event) return true;
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : ((value as { message?: unknown }).message as string | undefined) ?? "";
  return isNetworkError(new Error(String(message)));
}

const CHUNK_HINTS = [
  "dynamically imported module",
  "importing a module script failed",
  "module script failed",
  "chunk",
];

/** True only for a failed code download — not for ordinary data requests. */
function isMissingCode(value: unknown): boolean {
  const message = (
    value instanceof Error ? value.message : typeof value === "string" ? value : ""
  ).toLowerCase();
  return CHUNK_HINTS.some((hint) => message.includes(hint));
}

function reloadWhenBack() {
  if (typeof window === "undefined") return;
  if (!mayReload()) return;
  const go = () => {
    window.removeEventListener("online", go);
    window.location.reload();
  };
  if (isOnline()) {
    // Online again already — give the network a beat, then repair.
    window.setTimeout(go, 1500);
  } else {
    window.addEventListener("online", go);
  }
}

export function startChunkRecovery() {
  if (armed || typeof window === "undefined") return;
  armed = true;

  // Vite tells us directly when a lazily loaded piece of the app fails.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadWhenBack();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (!looksLikeLostConnection(event.reason)) return;
    // Silence the raw browser error; only a missing piece of app code needs a
    // reload — ordinary failed requests must never disturb what you're typing.
    event.preventDefault();
    if (isMissingCode(event.reason)) reloadWhenBack();
  });

  window.addEventListener("error", (event) => {
    const detail = (event as ErrorEvent).error ?? (event as ErrorEvent).message;
    if (!looksLikeLostConnection(detail)) return;
    event.preventDefault();
  });
}
