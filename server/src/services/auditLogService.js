import { supabaseAdmin } from "../config/supabase.js";

/**
 * Create a centralized audit log entry.
 *
 * This service intentionally does not throw when audit logging fails.
 * A failure to write an audit record must not break the primary
 * employee/business operation.
 */
export async function createAuditLog({
  organizationId,
  userId,
  action,
  resourceType,
  resourceId = null,
  resourceName = null,
  description = null,
  status = "success",
  req = null,
  metadata = {},
}) {
  try {
    if (!organizationId) {
      console.error(
        "[AuditLog] Missing organizationId."
      );

      return {
        success: false,
        error: "Missing organizationId",
      };
    }

    if (!userId) {
      console.error(
        "[AuditLog] Missing userId."
      );

      return {
        success: false,
        error: "Missing userId",
      };
    }

    if (!action) {
      console.error(
        "[AuditLog] Missing action."
      );

      return {
        success: false,
        error: "Missing action",
      };
    }

    if (!resourceType) {
      console.error(
        "[AuditLog] Missing resourceType."
      );

      return {
        success: false,
        error: "Missing resourceType",
      };
    }

    const safeStatus =
      status === "failed"
        ? "failed"
        : "success";

    const ipAddress =
      getClientIpAddress(req);

    const userAgent =
      req?.get?.("user-agent") ||
      null;

    const safeMetadata =
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? metadata
        : {};

    const payload = {
      organization_id:
        organizationId,

      user_id:
        userId,

      action:
        String(action).trim(),

      resource_type:
        String(resourceType).trim(),

      resource_id:
        resourceId || null,

      resource_name:
        resourceName
          ? String(resourceName).trim()
          : null,

      description:
        description
          ? String(description).trim()
          : null,

      status:
        safeStatus,

      ip_address:
        ipAddress,

      user_agent:
        userAgent,

      metadata:
        safeMetadata,
    };

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("audit_logs")
        .insert(payload)
        .select()
        .single();

    if (error) {
      console.error(
        "[AuditLog] Failed to create audit log:",
        error
      );

      return {
        success: false,
        error: error.message,
      };
    }

    console.log(
      "[AuditLog] Audit event created:",
      {
        id: data?.id,
        organizationId,
        userId,
        action,
        resourceType,
        resourceId,
        status: safeStatus,
      }
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error(
      "[AuditLog] Unexpected audit logging error:",
      error
    );

    return {
      success: false,
      error:
        error?.message ||
        "Unexpected audit logging error",
    };
  }
}

/**
 * Get the originating client IP address.
 *
 * Express may receive proxy information through x-forwarded-for.
 * We take the first address in that header when available and
 * otherwise fall back to req.ip.
 */
function getClientIpAddress(req) {
  if (!req) {
    return null;
  }

  const forwardedFor =
    req.headers?.["x-forwarded-for"];

  if (forwardedFor) {
    const firstIp =
      String(forwardedFor)
        .split(",")[0]
        .trim();

    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  if (req.ip) {
    return normalizeIp(
      String(req.ip).trim()
    );
  }

  return null;
}

/**
 * Normalize IPv4-mapped IPv6 addresses.
 *
 * Example:
 * ::ffff:127.0.0.1
 * becomes:
 * 127.0.0.1
 */
function normalizeIp(ip) {
  if (!ip) {
    return null;
  }

  const normalized =
    String(ip).trim();

  if (
    normalized.startsWith(
      "::ffff:"
    )
  ) {
    return normalized.substring(
      7
    );
  }

  return normalized;
}