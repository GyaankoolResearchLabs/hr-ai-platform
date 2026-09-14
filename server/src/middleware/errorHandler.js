import { logPlatformError } from "../services/platformErrorLogService.js";

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
|
| Mounted last in index.js (app.use((err, req, res, next) => ...)).
|
| Known, expected failure shapes (CORS rejection, malformed JSON body,
| oversized payload, multer/file-validation errors) still return their
| own specific, safe message — that behavior is unchanged from before
| this file existed.
|
| Anything else falls through to the generic branch at the bottom, which:
|
|   1. Logs the FULL error (message + stack trace + route/method/caller)
|      to platform_error_logs, server-side only, via
|      services/platformErrorLogService.js.
|   2. Returns a fixed, generic message to the client — NEVER err.message,
|      never the stack. Never both the log and the raw error at once to
|      the same audience: full detail goes to the platform-admin log only,
|      the caller gets the safe string below.
|--------------------------------------------------------------------------
*/

const GENERIC_CLIENT_MESSAGE =
  "Something went wrong. Please try again.";

export function errorHandler(err, req, res, next) {
  console.error("[SERVER] Unhandled server error:", err);

  /*
   * CORS errors
   */
  if (err?.message?.startsWith("CORS blocked origin:")) {
    return res.status(403).json({
      message: err.message,
    });
  }

  /*
   * JSON body errors
   */
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON request body.",
    });
  }

  /*
   * Payload too large
   */
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request payload is too large.",
    });
  }

  /*
   * Multer errors
   */
  if (err?.name === "MulterError") {
    return res.status(400).json({
      message: err.message || "File upload failed",
    });
  }

  /*
   * File validation errors
   */
  if (
    err?.message?.includes(
      "Only JPG, PNG, WEBP and PDF files are allowed"
    )
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  if (
    err?.message?.includes(
      "Only PDF, DOC and DOCX resume files are allowed"
    )
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  /*
   * Generic / unexpected server error
   *
   * This is the only branch that represents a genuinely unhandled
   * exception, so it is the only one captured as event_type
   * "unhandled_exception".
   */
  logPlatformError({
    eventType: "unhandled_exception",
    req,
    error: err,
  }).catch((loggingError) => {
    console.error(
      "[SERVER] Failed to record unhandled_exception log:",
      loggingError
    );
  });

  return res.status(500).json({
    message: GENERIC_CLIENT_MESSAGE,
  });
}

export default errorHandler;
