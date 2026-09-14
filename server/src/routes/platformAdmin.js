import { Router } from "express";
import { requireAuthWithoutOrg } from "../middleware/auth.js";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| PLATFORM MONITORING API — operator-only
|--------------------------------------------------------------------------
|
| Never reachable by a customer's organization account, regardless of
| organization_role. Every route below runs behind:
|
|   1. requireAuthWithoutOrg — the caller must present a real,
|      Supabase-verified JWT. requireAuthWithoutOrg (not requireAuth) is
|      used deliberately: platform admins are not necessarily members of
|      any organization, so requiring one would lock this out for an
|      operator account that has never set one up.
|   2. requirePlatformAdmin — the caller's verified email must be in
|      platform_admins. Rejects with 404, not 403 (see that middleware
|      for why) — so from the outside this whole API looks like it does
|      not exist to anyone not on the list.
|
| GET /api/platform-admin/logs           list + filter + paginate
| GET /api/platform-admin/logs/filters   distinct event types / routes
| GET /api/platform-admin/logs/:id       single log detail
|--------------------------------------------------------------------------
*/

router.use(requireAuthWithoutOrg);
router.use(requirePlatformAdmin);

/* =========================================================
   CONSTANTS
========================================================= */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/* =========================================================
   HELPERS
========================================================= */

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function cleanQueryValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const cleaned = String(value).trim();

  return cleaned || null;
}

function parseLimit(value) {
  return Math.min(
    parsePositiveInteger(value, DEFAULT_LIMIT),
    MAX_LIMIT
  );
}

function parsePage(value) {
  return parsePositiveInteger(value, 1);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

const LIST_COLUMNS = [
  "id",
  "created_at",
  "event_type",
  "route",
  "method",
  "user_id",
  "user_email",
  "message",
  "ip_address",
  "user_agent",
].join(",");

const DETAIL_COLUMNS = [
  "id",
  "created_at",
  "event_type",
  "route",
  "method",
  "user_id",
  "user_email",
  "message",
  "stack",
  "context",
  "ip_address",
  "user_agent",
].join(",");

/* =========================================================
   GET LOGS
   GET /api/platform-admin/logs
========================================================= */

/*
 * Supported query parameters:
 *
 * search       — matches event_type, route, user_email, message
 * event_type
 * user_email
 * from / to    — created_at range
 * page / limit
 */
router.get("/logs", async (req, res) => {
  try {
    const search = cleanQueryValue(req.query.search);
    const eventType = cleanQueryValue(req.query.event_type);
    const userEmail = cleanQueryValue(req.query.user_email);
    const fromDate = parseDate(cleanQueryValue(req.query.from));
    const toDate = parseDate(cleanQueryValue(req.query.to));
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        success: false,
        message: "The from date cannot be later than the to date.",
      });
    }

    const offset = (page - 1) * limit;
    const rangeStart = offset;
    const rangeEnd = offset + limit - 1;

    let query = supabaseAdmin
      .from("platform_error_logs")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(rangeStart, rangeEnd);

    if (eventType) {
      query = query.eq("event_type", eventType);
    }

    if (userEmail) {
      query = query.ilike("user_email", userEmail);
    }

    if (fromDate) {
      query = query.gte("created_at", fromDate);
    }

    if (toDate) {
      query = query.lte("created_at", toDate);
    }

    if (search) {
      const escapedSearch = search
        .replace(/\\/g, "\\\\")
        .replace(/,/g, "\\,")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");

      query = query.or(
        [
          `event_type.ilike.%${escapedSearch}%`,
          `route.ilike.%${escapedSearch}%`,
          `user_email.ilike.%${escapedSearch}%`,
          `message.ilike.%${escapedSearch}%`,
        ].join(",")
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[PlatformAdmin] Failed to load logs:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load logs.",
        detail: error.message,
      });
    }

    const total = Number(count || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next_page: page < totalPages,
        has_previous_page: page > 1 && totalPages > 0,
      },
      filters: {
        search,
        event_type: eventType,
        user_email: userEmail,
        from: fromDate,
        to: toDate,
      },
    });
  } catch (error) {
    console.error("[PlatformAdmin] Unexpected error loading logs:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load logs.",
    });
  }
});

/* =========================================================
   GET AVAILABLE FILTER VALUES
   GET /api/platform-admin/logs/filters
========================================================= */

router.get("/logs/filters", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("platform_error_logs")
      .select("event_type, route")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      console.error("[PlatformAdmin] Filter lookup error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load filters.",
        detail: error.message,
      });
    }

    const eventTypes = [
      ...new Set((data || []).map((row) => row.event_type).filter(Boolean)),
    ].sort();

    const routes = [
      ...new Set((data || []).map((row) => row.route).filter(Boolean)),
    ].sort();

    return res.json({
      success: true,
      data: {
        event_types: eventTypes,
        routes,
      },
    });
  } catch (error) {
    console.error("[PlatformAdmin] Unexpected filter error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load filters.",
    });
  }
});

/* =========================================================
   GET SINGLE LOG
   GET /api/platform-admin/logs/:id
========================================================= */

router.get("/logs/:id", async (req, res) => {
  try {
    const logId = String(req.params.id || "").trim();

    if (!logId) {
      return res.status(400).json({
        success: false,
        message: "Log ID is required.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("platform_error_logs")
      .select(DETAIL_COLUMNS)
      .eq("id", logId)
      .maybeSingle();

    if (error) {
      console.error("[PlatformAdmin] Single log lookup error:", error);

      return res.status(500).json({
        success: false,
        message: "Could not load log.",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Log not found.",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[PlatformAdmin] Unexpected single log error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not load log.",
    });
  }
});

export default router;
