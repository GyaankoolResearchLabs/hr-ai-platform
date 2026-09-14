import { supabaseAdmin } from "../config/supabase.js";

/*
|--------------------------------------------------------------------------
| PLATFORM ERROR LOG
|--------------------------------------------------------------------------
|
| Writes to platform_error_logs — a table completely separate from every
| business table, visible only through the platform-admin-gated API
| (routes/platformAdmin.js). This is the ONLY place server-side error
| detail (message + stack trace) is ever written to storage; it must
| never also be sent to the client that triggered it — see
| middleware/errorHandler.js and routes/auth.js for the call sites.
|
| Same convention as services/auditLogService.js: this never throws. A
| failure to write a log entry must never break (or mask a 500 behind a
| different failure in) the request that triggered it.
|--------------------------------------------------------------------------
*/

/**
 * @param {object} params
 * @param {string} params.eventType e.g. "login_failure", "unhandled_exception",
 *   "invalid_token", "validation_error", "client_error"
 * @param {import("express").Request} [params.req] used to fill route/method/ip/user-agent
 *   when not passed explicitly
 * @param {string} [params.route]
 * @param {string} [params.method]
 * @param {string|null} [params.userId]
 * @param {string|null} [params.userEmail]
 * @param {string|Error} [params.error] message/stack are pulled from this when provided
 * @param {string} [params.message]
 * @param {string} [params.stack]
 * @param {object} [params.context] arbitrary, non-sensitive debugging context
 *   — NEVER pass passwords, tokens, or full request bodies through here.
 */
export async function logPlatformError({
  eventType,
  req = null,
  route = null,
  method = null,
  userId = null,
  userEmail = null,
  error = null,
  message = null,
  stack = null,
  context = {},
} = {}) {
  try {
    if (!eventType) {
      console.error("[PlatformErrorLog] Missing eventType.");
      return { success: false, error: "Missing eventType" };
    }

    const resolvedMessage =
      message ||
      (error instanceof Error ? error.message : typeof error === "string" ? error : null) ||
      "Unknown error";

    const resolvedStack =
      stack ||
      (error instanceof Error ? error.stack : null) ||
      null;

    const safeContext =
      context && typeof context === "object" && !Array.isArray(context)
        ? context
        : {};

    const payload = {
      event_type: String(eventType).trim(),
      route: route || req?.originalUrl || null,
      method: method || req?.method || null,
      user_id: userId || req?.user?.id || null,
      user_email: userEmail || req?.user?.email || null,
      message: String(resolvedMessage).slice(0, 4000),
      stack: resolvedStack ? String(resolvedStack).slice(0, 8000) : null,
      context: safeContext,
      ip_address: getClientIpAddress(req),
      user_agent: req?.get?.("user-agent") || null,
    };

    const { data, error: insertError } = await supabaseAdmin
      .from("platform_error_logs")
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error(
        "[PlatformErrorLog] Failed to write error log:",
        insertError
      );

      return { success: false, error: insertError.message };
    }

    return { success: true, data };
  } catch (unexpectedError) {
    console.error(
      "[PlatformErrorLog] Unexpected logging failure:",
      unexpectedError
    );

    return {
      success: false,
      error: unexpectedError?.message || "Unexpected logging failure",
    };
  }
}

/*
 * Same IP-extraction logic as services/auditLogService.js. Duplicated
 * rather than imported/shared — this is a small, self-contained
 * monitoring system by design (see the module doc comment above).
 */
function getClientIpAddress(req) {
  if (!req) {
    return null;
  }

  const forwardedFor = req.headers?.["x-forwarded-for"];

  if (forwardedFor) {
    const firstIp = String(forwardedFor).split(",")[0].trim();

    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  if (req.ip) {
    return normalizeIp(String(req.ip).trim());
  }

  return null;
}

function normalizeIp(ip) {
  if (!ip) {
    return null;
  }

  const normalized = String(ip).trim();

  if (normalized.startsWith("::ffff:")) {
    return normalized.substring(7);
  }

  return normalized;
}

export default logPlatformError;
