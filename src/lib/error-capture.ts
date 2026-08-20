// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

// h3's HTTPError serializes to {"status":500,"unhandled":true,"message":"HTTPError"} —
// no stack, no cause — so a plain console.error(error) reaches the log pipeline with
// the failure detail stripped. Expand Error-like args into a string that keeps the
// message, stack, and the full cause chain.
const CAUSE_DEPTH_LIMIT = 5;
const DESCRIPTION_LENGTH_LIMIT = 8_000;

export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) {
      parts.push(typeof current === "string" ? current : safeStringify(current));
      break;
    }
    const label = depth === 0 ? "" : "caused by: ";
    const status = describeStatus(current);
    parts.push(`${label}${current.stack ?? `${current.name}: ${current.message}`}${status}`);
    current = current.cause;
  }
  return parts.join("\n").slice(0, DESCRIPTION_LENGTH_LIMIT);
}

function describeStatus(error: Error): string {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const value = status ?? statusCode;
  return typeof value === "number" ? ` (status ${value})` : "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isErrorLike(value: unknown): value is Error {
  return value instanceof Error;
}

// A client that closes the socket mid-response (reload, navigation, native
// WebView suspend) surfaces as node's `Error: aborted` from _http_server.
// That is cancellation, not an app failure — never record or report it.
export function isClientDisconnect(value: unknown): boolean {
  let current: unknown = value;
  for (let depth = 0; depth < CAUSE_DEPTH_LIMIT && current != null; depth++) {
    if (!(current instanceof Error)) return false;
    const message = current.message.toLowerCase();
    if (
      current.name === "AbortError" ||
      message === "aborted" ||
      message.includes("request aborted") ||
      message.includes("aborted\n    at abortincoming") ||
      message.includes("premature close") ||
      message.includes("connection reset") ||
      message.includes("epipe") ||
      message.includes("econnreset")
    ) {
      return true;
    }
    if (typeof current.stack === "string" && current.stack.includes("abortIncoming")) return true;
    current = current.cause;
  }
  return false;
}

// Wrap console.error so errors logged by any layer — including h3's internal
// unhandled-error logging, which this file cannot hook directly — are both
// recorded for consumeLastCapturedError and expanded before serialization.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  // Downgrade client disconnects to a quiet debug line: logging them as errors
  // is what surfaces "Error: aborted" as a runtime error / blank-screen report.
  if (args.some((arg) => isErrorLike(arg) && isClientDisconnect(arg))) {
    console.debug("client disconnected before the response finished");
    return;
  }
  const expanded = args.map((arg) => {
    if (!isErrorLike(arg)) return arg;
    record(arg);
    return describeError(arg);
  });
  originalConsoleError(...expanded);
};

// In dev the app runs on a Node HTTP server. When a client closes the socket
// mid-response, node emits `Error: aborted` from abortIncoming as an
// uncaughtException — outside any middleware. Swallow it there too, otherwise
// it is reported as a runtime error with a blank screen.
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;
if (nodeProcess && typeof nodeProcess.on === "function") {
  nodeProcess.on("uncaughtException", (error: unknown) => {
    if (isClientDisconnect(error)) {
      console.debug("client disconnected before the response finished");
      return;
    }
    record(error);
    originalConsoleError(describeError(error));
  });
  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    if (isClientDisconnect(reason)) return;
    record(reason);
    originalConsoleError(describeError(reason));
  });
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const error = (event as ErrorEvent).error ?? event;
    if (!isClientDisconnect(error)) record(error);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    if (!isClientDisconnect(reason)) record(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
