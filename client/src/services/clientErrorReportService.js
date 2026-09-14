import api from "./api";

/**
 * clientErrorReportService
 * -----------------------------------------------------------------------
 * Best-effort beacon that reports a client-side caught error (currently:
 * components/common/ErrorBoundary.jsx) back to the same
 * platform_error_logs table the server writes to. Never throws, never
 * retries, never surfaces anything to the caller — a failure here must
 * never compound whatever already went wrong.
 */
export async function reportClientError({
  error,
  componentStack,
  route,
  user,
} = {}) {
  try {
    await api.post("/client-error-report", {
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
