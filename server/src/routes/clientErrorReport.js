import { Router } from "express";
import { logPlatformError } from "../services/platformErrorLogService.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| CLIENT ERROR REPORTING
|--------------------------------------------------------------------------
|
| POST /api/client-error-report
|
| Lets the frontend report an error it caught on its own back into the
| same platform_error_logs table used by the server's own capture
| points, via the same logPlatformError() call — a single, consistent
| write path regardless of which side detected the failure. Two known
| callers today:
|
|   - A React error boundary (client/src/components/common/
|     ErrorBoundary.jsx) — a render crash, eventType "client_error".
|   - services/authService.js's signIn() — a failed Supabase
|     signInWithPassword() call, eventType "login_failure". This is the
|     real capture point for login failures: the frontend's actual
|     login flow authenticates directly against Supabase from the
|     browser (see authService.js) and never calls the Express
|     POST /api/auth/login route, so that route's own (now dead)
|     login-failure logging was never reachable — see the comment
|     there.
|
| eventType is caller-supplied but constrained to ALLOWED_EVENT_TYPES
| below — an unrecognized/missing value falls back to "client_error"
| rather than writing an arbitrary caller-chosen taxonomy value.
|
| Deliberately NOT behind requirePlatformAdmin — every signed-in AND
| signed-out visitor's browser must be able to reach this (a crash can
| happen before login, e.g. on the Login page itself). It is a write-only,
| best-effort sink: no auth is required, nothing here ever reads back
| logged data (that stays behind /api/platform-admin/*), and every field
| is capped/validated so a malformed or hostile payload can't do more
| than write one oversized-but-bounded row.
|--------------------------------------------------------------------------
*/

const ALLOWED_EVENT_TYPES = new Set(["client_error", "login_failure"]);

function cleanString(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

router.post("/", async (req, res) => {
  try {
    const requestedEventType = cleanString(req.body?.eventType, 40);
    const eventType = ALLOWED_EVENT_TYPES.has(requestedEventType)
      ? requestedEventType
      : "client_error";

    const message = cleanString(req.body?.message, 2000) || "Client-reported error";
    const stack = cleanString(req.body?.stack, 8000);
    const route = cleanString(req.body?.route, 500);
    const componentStack = cleanString(req.body?.componentStack, 4000);

    // The caller's own account, if they were logged in when the error
    // happened. This is diagnostic-only and best-effort — unlike the
    // server-side capture points, there is no verified JWT to trust it
    // against here (an anonymous/pre-login crash has none at all), so
    // it is never used for anything but "who to ask" when looking at
    // this log entry.
    const userEmail = cleanString(req.body?.userEmail, 320);
    const userId = cleanString(req.body?.userId, 100);

    await logPlatformError({
      eventType,
      req,
      route,
      userId,
      userEmail,
      message,
      stack,
      context: componentStack ? { componentStack } : {},
    });

    // Always 204 regardless of whether the write succeeded — this is a
    // fire-and-forget diagnostic beacon, not something the calling page
    // should retry, branch on, or surface to the end user.
    return res.status(204).end();
  } catch (error) {
    console.error("[ClientErrorReport] Unexpected error:", error);

    return res.status(204).end();
  }
});

export default router;
