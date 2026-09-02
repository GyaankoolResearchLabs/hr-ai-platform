import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION RESOLUTION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organizationId =
      req.user?.organization_id ||
      req.user?.organizationId;

    if (!organizationId) {
      return res.status(403).json({
        success: false,
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    /*
     * Verify the organization through the existing
     * organization lookup service as an additional
     * isolation check.
     */
    const organization = await getOrganizationForUser(
      req.user.id
    );

    if (!organization) {
      return res.status(403).json({
        success: false,
        message: "Complete organization setup first.",
      });
    }

    if (organization.id !== organizationId) {
      console.error(
        "[AuditLogs] Organization mismatch:",
        {
          requestOrganizationId: organizationId,
          resolvedOrganizationId: organization.id,
          userId: req.user.id,
        }
      );

      return res.status(403).json({
        success: false,
        message: "Organization access denied.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[AuditLogs] Organization lookup error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   CONSTANTS
========================================================= */

const ALLOWED_STATUSES = [
  "success",
  "failed",
];

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/* =========================================================
   HELPERS
========================================================= */

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (
    Number.isNaN(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return parsed;
}

function cleanQueryValue(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const cleaned = String(value).trim();

  return cleaned || null;
}

function parseLimit(value) {
  const parsed = parsePositiveInteger(
    value,
    DEFAULT_LIMIT
  );

  return Math.min(
    parsed,
    MAX_LIMIT
  );
}

function parsePage(value) {
  return parsePositiveInteger(
    value,
    1
  );
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

/*
 * Converts a database audit row into the shape
 * consumed by the frontend.
 */
function formatAuditLog(row) {
  return {
    id: row.id,

    organization_id:
      row.organization_id,

    user_id:
      row.user_id,

    action:
      row.action,

    resource_type:
      row.resource_type,

    resource_id:
      row.resource_id,

    resource_name:
      row.resource_name,

    description:
      row.description,

    status:
      row.status,

    ip_address:
      row.ip_address,

    user_agent:
      row.user_agent,

    metadata:
      row.metadata || {},

    created_at:
      row.created_at,
  };
}

/*
 * Build a human-readable actor label from the
 * authenticated user when the event belongs to
 * the current user.
 *
 * We intentionally do NOT expose arbitrary users'
 * auth records because auth.users is not a normal
 * application table.
 */
function addActorInformation(log, currentUser) {
  const isCurrentUser =
    log.user_id === currentUser?.id;

  return {
    ...log,

    actor: {
      user_id: log.user_id,

      email:
        isCurrentUser
          ? currentUser?.email || null
          : null,

      is_current_user:
        isCurrentUser,
    },
  };
}

/* =========================================================
   GET AUDIT LOGS
   GET /api/audit-logs
========================================================= */

/*
 * Supported query parameters:
 *
 * search
 * action
 * resource_type
 * status
 * user_id
 * from
 * to
 * page
 * limit
 *
 * Examples:
 *
 * GET /api/audit-logs
 *
 * GET /api/audit-logs?page=1&limit=25
 *
 * GET /api/audit-logs?search=employee
 *
 * GET /api/audit-logs?action=view
 *
 * GET /api/audit-logs?resource_type=employee
 *
 * GET /api/audit-logs?status=success
 *
 * GET /api/audit-logs?from=2026-09-01
 *
 * GET /api/audit-logs?from=2026-09-01&to=2026-09-02
 */

router.get("/", async (req, res) => {
  const startedAt = Date.now();

  try {
    const organizationId =
      req.organization.id;

    const search =
      cleanQueryValue(
        req.query.search
      );

    const action =
      cleanQueryValue(
        req.query.action
      );

    const resourceType =
      cleanQueryValue(
        req.query.resource_type
      );

    const status =
      cleanQueryValue(
        req.query.status
      );

    const userId =
      cleanQueryValue(
        req.query.user_id
      );

    const fromDate =
      parseDate(
        cleanQueryValue(
          req.query.from
        )
      );

    const toDate =
      parseDate(
        cleanQueryValue(
          req.query.to
        )
      );

    const page =
      parsePage(
        req.query.page
      );

    const limit =
      parseLimit(
        req.query.limit
      );

    /*
     * Validate status if supplied.
     */
    if (
      status &&
      !ALLOWED_STATUSES.includes(
        status.toLowerCase()
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    /*
     * Validate date range.
     */
    if (
      fromDate &&
      toDate &&
      new Date(fromDate) >
        new Date(toDate)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The from date cannot be later than the to date.",
      });
    }

    const offset =
      (page - 1) * limit;

    /*
     * Supabase range uses an inclusive
     * start and end.
     */
    const rangeStart =
      offset;

    const rangeEnd =
      offset + limit - 1;

    /*
     * IMPORTANT:
     *
     * The organization_id condition is applied
     * directly to every audit query.
     *
     * This prevents one organization from
     * retrieving another organization's audit data.
     */
    let query = supabaseAdmin
      .from("audit_logs")
      .select(
        [
          "id",
          "organization_id",
          "user_id",
          "action",
          "resource_type",
          "resource_id",
          "resource_name",
          "description",
          "status",
          "ip_address",
          "user_agent",
          "metadata",
          "created_at",
        ].join(","),
        {
          count: "exact",
        }
      )
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .range(
        rangeStart,
        rangeEnd
      );

    /*
     * Action filter.
     */
    if (action) {
      query = query.eq(
        "action",
        action
      );
    }

    /*
     * Resource type filter.
     */
    if (resourceType) {
      query = query.eq(
        "resource_type",
        resourceType
      );
    }

    /*
     * Status filter.
     */
    if (status) {
      query = query.eq(
        "status",
        status.toLowerCase()
      );
    }

    /*
     * Specific user filter.
     */
    if (userId) {
      query = query.eq(
        "user_id",
        userId
      );
    }

    /*
     * Date filters.
     */
    if (fromDate) {
      query = query.gte(
        "created_at",
        fromDate
      );
    }

    if (toDate) {
      query = query.lte(
        "created_at",
        toDate
      );
    }

    /*
     * Search across the fields that are useful
     * to an HR administrator.
     *
     * We search:
     * - action
     * - resource_type
     * - resource_name
     * - description
     */
    if (search) {
      const escapedSearch =
        search
          .replace(/\\/g, "\\\\")
          .replace(/,/g, "\\,")
          .replace(/%/g, "\\%")
          .replace(/_/g, "\\_");

      query = query.or(
        [
          `action.ilike.%${escapedSearch}%`,
          `resource_type.ilike.%${escapedSearch}%`,
          `resource_name.ilike.%${escapedSearch}%`,
          `description.ilike.%${escapedSearch}%`,
        ].join(",")
      );
    }

    const {
      data,
      error,
      count,
    } = await query;

    if (error) {
      console.error(
        "[AuditLogs] Failed to load audit logs:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load audit logs.",
        detail:
          error.message,
      });
    }

    const logs =
      (data || []).map(
        (row) =>
          addActorInformation(
            formatAuditLog(row),
            req.user
          )
      );

    const total =
      Number(count || 0);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(
            total / limit
          );

    const hasNextPage =
      page < totalPages;

    const hasPreviousPage =
      page > 1 &&
      totalPages > 0;

    console.log(
      "[AuditLogs] Logs loaded:",
      {
        organizationId,
        page,
        limit,
        total,
        returned: logs.length,
        durationMs:
          Date.now() -
          startedAt,
      }
    );

    return res.json({
      success: true,

      data: logs,

      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next_page:
          hasNextPage,
        has_previous_page:
          hasPreviousPage,
      },

      filters: {
        search,
        action,
        resource_type:
          resourceType,
        status,
        user_id:
          userId,
        from:
          fromDate,
        to:
          toDate,
      },
    });
  } catch (error) {
    console.error(
      "[AuditLogs] Unexpected error loading logs:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Could not load audit logs.",
    });
  }
});

/* =========================================================
   GET AUDIT LOG SUMMARY
   GET /api/audit-logs/summary
========================================================= */

/*
 * Returns the summary cards used by the
 * Audit Log Viewer.
 *
 * Current period:
 * - total events
 * - successful events
 * - failed events
 * - today's events
 */

router.get(
  "/summary",
  async (req, res) => {
    const startedAt =
      Date.now();

    try {
      const organizationId =
        req.organization.id;

      /*
       * Start of today in UTC.
       *
       * The database stores timestamptz.
       */
      const now =
        new Date();

      const startOfToday =
        new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate()
          )
        );

      const todayIso =
        startOfToday.toISOString();

      /*
       * Total events.
       */
      const {
        count: totalEvents,
        error: totalError,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "organization_id",
          organizationId
        );

      if (totalError) {
        console.error(
          "[AuditLogs] Total summary error:",
          totalError
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit summary.",
          detail:
            totalError.message,
        });
      }

      /*
       * Successful events.
       */
      const {
        count: successfulEvents,
        error: successError,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "status",
          "success"
        );

      if (successError) {
        console.error(
          "[AuditLogs] Success summary error:",
          successError
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit summary.",
          detail:
            successError.message,
        });
      }

      /*
       * Failed events.
       */
      const {
        count: failedEvents,
        error: failedError,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "status",
          "failed"
        );

      if (failedError) {
        console.error(
          "[AuditLogs] Failed summary error:",
          failedError
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit summary.",
          detail:
            failedError.message,
        });
      }

      /*
       * Today's events.
       */
      const {
        count: todayEvents,
        error: todayError,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          "id",
          {
            count: "exact",
            head: true,
          }
        )
        .eq(
          "organization_id",
          organizationId
        )
        .gte(
          "created_at",
          todayIso
        );

      if (todayError) {
        console.error(
          "[AuditLogs] Today summary error:",
          todayError
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit summary.",
          detail:
            todayError.message,
        });
      }

      console.log(
        "[AuditLogs] Summary loaded:",
        {
          organizationId,
          totalEvents:
            totalEvents || 0,
          successfulEvents:
            successfulEvents || 0,
          failedEvents:
            failedEvents || 0,
          todayEvents:
            todayEvents || 0,
          durationMs:
            Date.now() -
            startedAt,
        }
      );

      return res.json({
        success: true,

        data: {
          total_events:
            totalEvents || 0,

          today_events:
            todayEvents || 0,

          successful_events:
            successfulEvents || 0,

          failed_events:
            failedEvents || 0,
        },
      });
    } catch (error) {
      console.error(
        "[AuditLogs] Unexpected summary error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load audit summary.",
      });
    }
  }
);

/* =========================================================
   GET AVAILABLE FILTER VALUES
   GET /api/audit-logs/filters
========================================================= */

/*
 * The frontend uses this endpoint to populate
 * dropdowns without hardcoding database values.
 */

router.get(
  "/filters",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          "action, resource_type, status"
        )
        .eq(
          "organization_id",
          organizationId
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        )
        .limit(1000);

      if (error) {
        console.error(
          "[AuditLogs] Filter lookup error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit filters.",
          detail:
            error.message,
        });
      }

      const actions =
        [
          ...new Set(
            (data || [])
              .map(
                (row) =>
                  row.action
              )
              .filter(Boolean)
          ),
        ].sort();

      const resourceTypes =
        [
          ...new Set(
            (data || [])
              .map(
                (row) =>
                  row.resource_type
              )
              .filter(Boolean)
          ),
        ].sort();

      const statuses =
        [
          ...new Set(
            (data || [])
              .map(
                (row) =>
                  row.status
              )
              .filter(Boolean)
          ),
        ].sort();

      return res.json({
        success: true,

        data: {
          actions,
          resource_types:
            resourceTypes,
          statuses,
        },
      });
    } catch (error) {
      console.error(
        "[AuditLogs] Unexpected filter error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load audit filters.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE AUDIT LOG
   GET /api/audit-logs/:id
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const auditLogId =
        String(
          req.params.id || ""
        ).trim();

      if (!auditLogId) {
        return res.status(400).json({
          success: false,
          message:
            "Audit log ID is required.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("audit_logs")
        .select(
          [
            "id",
            "organization_id",
            "user_id",
            "action",
            "resource_type",
            "resource_id",
            "resource_name",
            "description",
            "status",
            "ip_address",
            "user_agent",
            "metadata",
            "created_at",
          ].join(",")
        )
        .eq(
          "id",
          auditLogId
        )
        .eq(
          "organization_id",
          organizationId
        )
        .maybeSingle();

      if (error) {
        console.error(
          "[AuditLogs] Single log lookup error:",
          error
        );

        return res.status(500).json({
          success: false,
          message:
            "Could not load audit log.",
          detail:
            error.message,
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          message:
            "Audit log not found.",
        });
      }

      const formatted =
        addActorInformation(
          formatAuditLog(data),
          req.user
        );

      return res.json({
        success: true,
        data: formatted,
      });
    } catch (error) {
      console.error(
        "[AuditLogs] Unexpected single log error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Could not load audit log.",
      });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;