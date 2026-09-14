import api from "./api";

/**
 * clientErrorReportService
 * -----------------------------------------------------------------------
 * Best-effort beacon that reports a client-side caught error back to the
 * same platform_error_logs table the server writes to. Two callers today:
 * components/common/ErrorBoundary.jsx (a render crash — eventType
 * defaults to "client_error") and services/authService.js (a failed
 * Supabase sign-in — eventType: "login_failure"; see authService.js for
 * why login failures are reported from here rather than from the mostly
 * unused server-side POST /api/auth/login route).
 *
 * Never throws, never retries, never surfaces anything to the caller —
 * a failure here must never compound whatever already went wrong.
 */
export async function reportClientError({
  error,
  componentStack,
  route,
  user,
  eventType,
} = {}) {
  try {
    await api.post("/client-error-report", {
      eventType: eventType || undefined,
      message: error?.message || String(error || "Unknown client error"),
      stack: error?.stack || null,
      componentStack: componentStack || null,
      route: route || window.location?.pathname || null,
      userEmail: user?.email || null,
      userId: user?.id || null,
    });
  } catch {
    // Intentionally silent — see module doc comment above.
  }
}

export default reportClientError;
