import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

function isRequestCancellation(error: unknown, request: Request): boolean {
  if (request.signal.aborted) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    message === "aborted" ||
    message.includes("request aborted") ||
    message.includes("premature close") ||
    message.includes("connection reset")
  );
}

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    // Navigations, reloads, and native WebView suspension can close an HTTP
    // stream before SSR finishes. This is cancellation, not an application
    // failure; preserve it so Start can dispose of the stream quietly instead
    // of turning it into a 500 page and reporting a false blank-screen crash.
    if (isRequestCancellation(error, request)) throw error;
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
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
