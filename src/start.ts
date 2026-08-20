import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
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
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
