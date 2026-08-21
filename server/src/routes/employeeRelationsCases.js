import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

const CASE_TYPES = [
  "grievance",
  "disciplinary",
  "misconduct",
  "workplace_conflict",
  "attendance",
  "policy_violation",
  "other",
];

const STATUSES = [
  "open",
  "under_review",
  "investigation",
  "resolved",
  "closed",
];

const PRIORITIES = [
  "low",
  "normal",
  "high",
  "critical",
];

/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| ORGANIZATION
|--------------------------------------------------------------------------
| IMPORTANT:
| The auth middleware gives us req.user.id, but this project does not
| reliably populate req.organization on every route.
|
| Therefore this route performs the same organization lookup used by the
| working organization-aware routes and explicitly sets req.organization.
|--------------------------------------------------------------------------
*/

async function requireOrganization(req, res, next) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user ID is missing.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization?.id) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error("[ER Cases] Organization lookup error:", error);

    return res.status(500).json({
      message: "Could not determine organization.",
      detail: error?.message || "Unknown organization lookup error.",
    });
  }
}

router.use(requireOrganization);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

function getUserId(req) {
  return req.user?.id || null;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function optional(value) {
  const valueClean = clean(value);
  return valueClean || null;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function enumValue(value, allowed, fallback) {
  const normalized = clean(value).toLowerCase();

  return allowed.includes(normalized)
    ? normalized
    : fallback;
}

/*
|--------------------------------------------------------------------------
| EMPLOYEE ENRICHMENT
|--------------------------------------------------------------------------
| Do NOT use a Supabase nested employee relation here. The project schema
| has caused relation/foreign-key problems in previous versions.
|--------------------------------------------------------------------------
*/

async function attachEmployees(cases, organizationId) {
  const rows = Array.isArray(cases) ? cases : [];

  const employeeIds = [
    ...new Set(
      rows
        .map((item) => item?.employee_id)
        .filter((id) => validUuid(id)),
    ),
  ];

  if (employeeIds.length === 0) {
    return rows.map((item) => ({
      ...item,
      employee: null,
    }));
  }

  const {
    data: employees,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, email, department, title")
    .eq("organization_id", organizationId)
    .in("id", employeeIds);

  if (error) {
    throw new Error(
      `Failed to load employees for ER cases: ${error.message}`,
    );
  }

  const employeeMap = new Map(
    (employees || []).map((employee) => [
      employee.id,
      employee,
    ]),
  );

  return rows.map((item) => ({
    ...item,
    employee:
      employeeMap.get(item.employee_id) || null,
  }));
}

async function getCaseById(caseId, organizationId) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employee_relations_cases")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", caseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [withEmployee] = await attachEmployees(
    [data],
    organizationId,
  );

  return withEmployee;
}

/*
|--------------------------------------------------------------------------
| GET ALL ER CASES
| GET /api/er-cases
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const search = clean(req.query.search);
    const status = clean(req.query.status).toLowerCase();
    const priority = clean(req.query.priority).toLowerCase();
    const caseType = clean(req.query.case_type).toLowerCase();

    let query = supabaseAdmin
      .from("employee_relations_cases")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (status && STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    if (priority && PRIORITIES.includes(priority)) {
      query = query.eq("priority", priority);
    }

    if (caseType && CASE_TYPES.includes(caseType)) {
      query = query.eq("case_type", caseType);
    }

    if (search) {
      const safeSearch = search.replace(/[(),]/g, " ");

      query = query.or(
        `case_number.ilike.%${safeSearch}%,title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`,
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error("[ER Cases] Fetch error:", error);

      return res.status(500).json({
        message: "Failed to load ER cases.",
        detail: error.message,
      });
    }

    const cases = await attachEmployees(
      data || [],
      organizationId,
    );

    return res.json({
      cases,
    });
  } catch (error) {
    console.error("[ER Cases] Unexpected fetch error:", error);

    return res.status(500).json({
      message: "Failed to load ER cases.",
      detail: error?.message || "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET STATISTICS
| GET /api/er-cases/stats
|--------------------------------------------------------------------------
*/

router.get("/stats", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employee_relations_cases")
      .select("status, priority, case_type")
      .eq("organization_id", organizationId);

    if (error) {
      console.error("[ER Cases] Stats error:", error);

      return res.status(500).json({
        message: "Failed to load ER statistics.",
        detail: error.message,
      });
    }

    const cases = data || [];

    return res.json({
      stats: {
        total: cases.length,
        open: cases.filter(
          (item) => item.status === "open",
        ).length,
        under_review: cases.filter(
          (item) => item.status === "under_review",
        ).length,
        investigation: cases.filter(
          (item) => item.status === "investigation",
        ).length,
        resolved: cases.filter(
          (item) => item.status === "resolved",
        ).length,
        closed: cases.filter(
          (item) => item.status === "closed",
        ).length,
        critical: cases.filter(
          (item) => item.priority === "critical",
        ).length,
      },
    });
  } catch (error) {
    console.error("[ER Cases] Stats unexpected error:", error);

    return res.status(500).json({
      message: "Failed to load ER statistics.",
      detail: error?.message || "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET SINGLE ER CASE
| GET /api/er-cases/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const caseId = clean(req.params.id);

    if (!validUuid(caseId)) {
      return res.status(400).json({
        message: "Invalid ER case ID.",
      });
    }

    const data = await getCaseById(
      caseId,
      organizationId,
    );

    if (!data) {
      return res.status(404).json({
        message: "ER case not found.",
      });
    }

    return res.json({
      case: data,
    });
  } catch (error) {
    console.error("[ER Cases] Single case error:", error);

    return res.status(500).json({
      message: "Failed to load ER case.",
      detail: error?.message || "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE ER CASE
| POST /api/er-cases
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const userId = getUserId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user ID is missing.",
      });
    }

    const employeeId = optional(
      req.body?.employee_id,
    );

    const title = clean(req.body?.title);

    const description = optional(
      req.body?.description,
    );

    if (!employeeId) {
      return res.status(400).json({
        message: "Employee is required.",
      });
    }

    if (!validUuid(employeeId)) {
      return res.status(400).json({
        message: "Invalid employee ID.",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "Case title is required.",
      });
    }

    if (!description) {
      return res.status(400).json({
        message: "Case description is required.",
      });
    }

    /*
     * Verify employee belongs to this organization.
     */

    const {
      data: employee,
      error: employeeError,
    } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, email, department, title")
      .eq("organization_id", organizationId)
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError) {
      console.error(
        "[ER Cases] Employee lookup error:",
        employeeError,
      );

      return res.status(500).json({
        message: "Failed to verify employee.",
        detail: employeeError.message,
      });
    }

    if (!employee?.id) {
      return res.status(404).json({
        message:
          "Employee not found in this organization.",
      });
    }

    const payload = {
      organization_id: organizationId,

      case_number:
        optional(req.body?.case_number) ||
        `ER-${Date.now()}`,

      employee_id: employeeId,

      case_type: enumValue(
        req.body?.case_type,
        CASE_TYPES,
        "grievance",
      ),

      title,

      description,

      priority: enumValue(
        req.body?.priority,
        PRIORITIES,
        "normal",
      ),

      status: enumValue(
        req.body?.status,
        STATUSES,
        "open",
      ),

      opened_at:
        optional(req.body?.opened_at) ||
        new Date().toISOString(),

      target_date:
        optional(req.body?.target_date),

      owner_name:
        optional(req.body?.owner_name),

      resolution:
        optional(req.body?.resolution),

      notes:
        optional(req.body?.notes),

      created_by: userId,
    };

    console.log(
      "[ER Cases] Creating case:",
      {
        organizationId,
        userId,
        employeeId,
        caseType: payload.case_type,
        priority: payload.priority,
        status: payload.status,
      },
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employee_relations_cases")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error(
        "[ER Cases] Create error:",
        error,
      );

      return res.status(500).json({
        message: "Failed to create ER case.",
        detail: error.message,
      });
    }

    let createdCase = data;

    try {
      const enriched = await getCaseById(
        data.id,
        organizationId,
      );

      if (enriched) {
        createdCase = enriched;
      }
    } catch (enrichmentError) {
      /*
       * The insert already succeeded. Do not turn a successful create
       * into a 500 only because employee enrichment failed.
       */
      console.error(
        "[ER Cases] Post-create employee enrichment error:",
        enrichmentError,
      );
    }

    return res.status(201).json({
      message: "ER case created successfully.",
      case: createdCase,
    });
  } catch (error) {
    console.error(
      "[ER Cases] Unexpected create error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to create ER case.",
      detail:
        error?.message ||
        "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE ER CASE
| PUT /api/er-cases/:id
|--------------------------------------------------------------------------
*/

router.put("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const caseId = clean(req.params.id);

    if (!validUuid(caseId)) {
      return res.status(400).json({
        message: "Invalid ER case ID.",
      });
    }

    const existing = await getCaseById(
      caseId,
      organizationId,
    );

    if (!existing) {
      return res.status(404).json({
        message: "ER case not found.",
      });
    }

    const updates = {};

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "case_number",
      )
    ) {
      updates.case_number =
        optional(req.body.case_number);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "employee_id",
      )
    ) {
      const employeeId = optional(
        req.body.employee_id,
      );

      if (!employeeId || !validUuid(employeeId)) {
        return res.status(400).json({
          message: "Invalid employee ID.",
        });
      }

      const {
        data: employee,
        error,
      } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("id", employeeId)
        .maybeSingle();

      if (error) {
        return res.status(500).json({
          message: "Failed to verify employee.",
          detail: error.message,
        });
      }

      if (!employee?.id) {
        return res.status(404).json({
          message:
            "Employee not found in this organization.",
        });
      }

      updates.employee_id = employeeId;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "case_type",
      )
    ) {
      updates.case_type = enumValue(
        req.body.case_type,
        CASE_TYPES,
        "other",
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "title",
      )
    ) {
      const title = clean(req.body.title);

      if (!title) {
        return res.status(400).json({
          message: "Case title is required.",
        });
      }

      updates.title = title;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "description",
      )
    ) {
      updates.description =
        optional(req.body.description);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "priority",
      )
    ) {
      updates.priority = enumValue(
        req.body.priority,
        PRIORITIES,
        "normal",
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "status",
      )
    ) {
      updates.status = enumValue(
        req.body.status,
        STATUSES,
        "open",
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "opened_at",
      )
    ) {
      updates.opened_at =
        optional(req.body.opened_at);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "target_date",
      )
    ) {
      updates.target_date =
        optional(req.body.target_date);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "owner_name",
      )
    ) {
      updates.owner_name =
        optional(req.body.owner_name);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "resolution",
      )
    ) {
      updates.resolution =
        optional(req.body.resolution);
    }

    if (
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "notes",
      )
    ) {
      updates.notes =
        optional(req.body.notes);
    }

    updates.updated_at =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employee_relations_cases")
      .update(updates)
      .eq("organization_id", organizationId)
      .eq("id", caseId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error(
        "[ER Cases] Update error:",
        error,
      );

      return res.status(500).json({
        message: "Failed to update ER case.",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "ER case not found.",
      });
    }

    let updatedCase = data;

    try {
      const enriched = await getCaseById(
        caseId,
        organizationId,
      );

      if (enriched) {
        updatedCase = enriched;
      }
    } catch (enrichmentError) {
      console.error(
        "[ER Cases] Post-update enrichment error:",
        enrichmentError,
      );
    }

    return res.json({
      message: "ER case updated successfully.",
      case: updatedCase,
    });
  } catch (error) {
    console.error(
      "[ER Cases] Unexpected update error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to update ER case.",
      detail:
        error?.message ||
        "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE STATUS
| PATCH /api/er-cases/:id/status
|--------------------------------------------------------------------------
*/

router.patch("/:id/status", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const caseId = clean(req.params.id);

    if (!validUuid(caseId)) {
      return res.status(400).json({
        message: "Invalid ER case ID.",
      });
    }

    const status = clean(
      req.body?.status,
    ).toLowerCase();

    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Invalid case status.",
      });
    }

    const existing = await getCaseById(
      caseId,
      organizationId,
    );

    if (!existing) {
      return res.status(404).json({
        message: "ER case not found.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employee_relations_cases")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId)
      .eq("id", caseId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error(
        "[ER Cases] Status update error:",
        error,
      );

      return res.status(500).json({
        message: "Failed to update case status.",
        detail: error.message,
      });
    }

    let updatedCase = data;

    try {
      const enriched = await getCaseById(
        caseId,
        organizationId,
      );

      if (enriched) {
        updatedCase = enriched;
      }
    } catch (enrichmentError) {
      console.error(
        "[ER Cases] Status enrichment error:",
        enrichmentError,
      );
    }

    return res.json({
      message: "Case status updated successfully.",
      case: updatedCase,
    });
  } catch (error) {
    console.error(
      "[ER Cases] Unexpected status error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to update case status.",
      detail:
        error?.message ||
        "Unknown server error.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE ER CASE
| DELETE /api/er-cases/:id
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization not found.",
      });
    }

    const caseId = clean(req.params.id);

    if (!validUuid(caseId)) {
      return res.status(400).json({
        message: "Invalid ER case ID.",
      });
    }

    const existing = await getCaseById(
      caseId,
      organizationId,
    );

    if (!existing) {
      return res.status(404).json({
        message: "ER case not found.",
      });
    }

    const {
      error,
    } = await supabaseAdmin
      .from("employee_relations_cases")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", caseId);

    if (error) {
      console.error(
        "[ER Cases] Delete error:",
        error,
      );

      return res.status(500).json({
        message: "Failed to delete ER case.",
        detail: error.message,
      });
    }

    return res.json({
      message: "ER case deleted successfully.",
    });
  } catch (error) {
    console.error(
      "[ER Cases] Unexpected delete error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to delete ER case.",
      detail:
        error?.message ||
        "Unknown server error.",
    });
  }
});

export default router;


/*
==========================================================================
INDEX.JS MOUNTING

The frontend has used BOTH of these paths during the previous fixes:

  /api/er-cases
  /api/employee-relations-cases

To stop the route mismatch completely, mount the SAME router at both paths
in server/src/index.js.

Keep this import:

import employeeRelationsCasesRoutes from "./routes/employeeRelationsCases.js";

Then use BOTH mounts:

app.use(
  "/api/er-cases",
  employeeRelationsCasesRoutes,
);

app.use(
  "/api/employee-relations-cases",
  employeeRelationsCasesRoutes,
);

Do NOT create a second ER route file.
Do NOT mount an older employeeRelationsCases.js.
Do NOT use employeeRelationsCases_FIXED2.js as the runtime route.
==========================================================================
*/