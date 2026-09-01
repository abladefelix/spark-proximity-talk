import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { isClientDisconnect } from "./lib/error-capture";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

function isRequestCancellation(error: unknown, request: Request): boolean {
  return request.signal.aborted || isClientDisconnect(error);
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // Navigations, reloads, and native WebView suspension can close an HTTP
    // stream before SSR finishes. This is cancellation, not an application
    // failure. Consume it so it cannot become a 500 or a false blank-screen
    // crash report; a connected caller receives the conventional 499 status.
    if (isRequestCancellation(error, request)) {
      return new Response(null, { status: 499, statusText: "Client Closed Request" });
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
//
// Behind a reverse proxy (Caddy -> 127.0.0.1:3000) the request URL the server
// sees is http://host, while the browser sends an https Origin. The default
// strict origin === request-origin check then rejects every legitimate server
// function call with a plain-text 403 "Forbidden". Compare hosts instead, and
// allow any extra origins listed in APP_ORIGINS (comma separated).
function allowedOrigin(origin: string, ctx: { request: Request }): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const requestHost =
    ctx.request.headers.get("x-forwarded-host") ??
    ctx.request.headers.get("host") ??
    new URL(ctx.request.url).host;
  if (originHost === requestHost) return true;

  const extra = (process.env["APP_ORIGINS"] ?? process.env["SITE_URL"] ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return extra.some((entry) => {
    try {
      return new URL(entry).host === originHost;
    } catch {
      return entry === originHost;
    }
  });
}

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: allowedOrigin,
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));

