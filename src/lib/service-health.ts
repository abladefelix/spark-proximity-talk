/**
 * Lightweight service-health monitor.
 *
 * Anything in the app that hits an unexpected failure (query error boundary,
 * failed query/mutation, reported runtime error) calls reportServiceProblem().
 * After a couple of consecutive failures the app is marked "degraded" and the
 * ServiceStatusBanner shows. While degraded we ping the backend every few
 * seconds; the first successful ping clears the state and the banner
 * disappears on its own — no refresh needed.
 */

import { isOnline } from "./net";

type Listener = (degraded: boolean) => void;

const listeners = new Set<Listener>();
let degraded = false;
let consecutiveFailures = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let pinging = false;
let firstFailureAt = 0;
let mutedUntil = 0;

/** How many genuine service failures in a row before we tell the user. */
const FAILURE_THRESHOLD = 3;
/** Failures must cluster inside this window to count as an outage. */
const FAILURE_WINDOW_MS = 20_000;
/** Re-check interval while degraded. */
const RETRY_MS = 12_000;
/**
 * After a recovery, ignore new reports for this long. Prevents the flap loop
 * where recovering re-fires a persistently-failing query and re-trips the
 * banner instantly.
 */
const RECOVERY_MUTE_MS = 45_000;

function healthUrl(): string | null {
  const base = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  if (!base) return null;
  // REST root answers (200/401) even without a session — a pure liveness probe.
  return `${base.replace(/\/$/, "")}/rest/v1/`;
}

function emit() {
  listeners.forEach((listener) => listener(degraded));
}

async function ping() {
  const url = healthUrl();
  if (!url || pinging) return;
  pinging = true;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { apikey: (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string) ?? "" },
      cache: "no-store",
    });
    // Any HTTP response means the backend is reachable again.
    if (res.status > 0) {
      consecutiveFailures = 0;
      firstFailureAt = 0;
      mutedUntil = Date.now() + RECOVERY_MUTE_MS;
      setDegraded(false);
    }
  } catch {
    // Still unreachable — stay degraded, next tick retries.
  } finally {
    pinging = false;
  }
}

function startRetrying() {
  if (timer) return;
  void ping();
  timer = setInterval(() => void ping(), RETRY_MS);
}

function stopRetrying() {
  if (timer) clearInterval(timer);
  timer = null;
}

function setDegraded(value: boolean) {
  if (degraded === value) return;
  degraded = value;
  emit();
  if (value) startRetrying();
  else stopRetrying();
}

/**
 * Decide whether an error signals a service problem. Ordinary client errors
 * (401/403/404, validation failures, aborted requests) are app-level — they
 * must never flip the status banner, otherwise one broken query loops the
 * banner forever.
 */
function isServiceLevelError(error: unknown): boolean {
  if (!error) return true;
  const err = error as { name?: string; status?: number; code?: string; context?: { status?: number } };
  if (err.name === "AbortError") return false;
  const status =
    typeof err.status === "number"
      ? err.status
      : typeof err.context?.status === "number"
        ? err.context.status
        : undefined;
  if (typeof status === "number") {
    // 4xx = the request itself was wrong/unauthorized, not a service outage.
    if (status >= 400 && status < 500) return false;
    return true;
  }
  // No status at all (TypeError: fetch failed, network reset) = connectivity.
  return true;
}

/** Call this when a request/load fails unexpectedly. */
export function reportServiceProblem(_source: string, error?: unknown) {
  // Offline is handled by OfflineBanner; don't double-report.
  if (!isOnline()) return;
  if (!isServiceLevelError(error)) return;
  // Freshly recovered — don't let one stubborn query re-trip the banner.
  if (Date.now() < mutedUntil) return;

  const now = Date.now();
  if (now - firstFailureAt > FAILURE_WINDOW_MS) {
    // Outside the cluster window: start a new streak.
    firstFailureAt = now;
    consecutiveFailures = 1;
  } else {
    consecutiveFailures += 1;
  }
  if (consecutiveFailures >= FAILURE_THRESHOLD) setDegraded(true);
}

/** Call this when a request succeeds — proves the service is fine. */
export function reportServiceSuccess() {
  if (degraded) return; // only the health probe clears a degraded state
  consecutiveFailures = 0;
  firstFailureAt = 0;
}

export function isServiceDegraded(): boolean {
  return degraded;
}

export function subscribeServiceHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
