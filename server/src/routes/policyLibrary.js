import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = express.Router();

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error(
      "[Policy Library] Organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

function clean(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function optional(value) {
  const cleaned = clean(value);
  return cleaned || null;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

const POLICY_STATUSES = [
  "draft",
  "published",
  "archived",
];

const VERSION_STATUSES = [
  "draft",
  "published",
  "archived",
];

const ASSIGNMENT_STATUSES = [
  "pending",
  "acknowledged",
  "overdue",
];

/* =========================================================
   GET POLICY LIBRARY
   GET /api/policy-library
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const search = clean(req.query.search);
    const status = clean(req.query.status).toLowerCase();

    let query = supabaseAdmin
      .from("policies")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (search) {
      query = query.or(
        `policy_code.ilike.%${search}%,title.ilike.%${search}%,category.ilike.%${search}%`,
      );
    }

    if (
      status &&
      POLICY_STATUSES.includes(status)
    ) {
      query = query.eq("status", status);
    }

    const {
      data: policies,
      error: policiesError,
    } = await query;

    if (policiesError) {
      console.error(
        "[Policy Library] Load policies error:",
        policiesError,
      );

      return res.status(500).json({
        message: "Failed to load policies.",
        detail: policiesError.message,
      });
    }

    const policyRows = policies || [];

    const policyIds = policyRows
      .map((policy) => policy.id)
      .filter(Boolean);

    let versions = [];
    let assignments = [];

    if (policyIds.length > 0) {
      const [
        versionsResult,
        assignmentsResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("policy_versions")
          .select(
            "id, policy_id, version_number, status, effective_date, published_at, created_at, updated_at",
          )
          .eq("organization_id", organizationId)
          .in("policy_id", policyIds)
          .order("version_number", {
            ascending: false,
          }),

        supabaseAdmin
          .from("policy_assignments")
          .select(
            "id, policy_id, policy_version_id, employee_id, assigned_at, due_date, status, acknowledged_at, acknowledged_by, acknowledgment_note",
          )
          .eq("organization_id", organizationId)
          .in("policy_id", policyIds)
          .order("assigned_at", {
            ascending: false,
          }),
      ]);

      if (versionsResult.error) {
        console.error(
          "[Policy Library] Load versions error:",
          versionsResult.error,
        );

        return res.status(500).json({
          message: "Failed to load policy versions.",
          detail: versionsResult.error.message,
        });
      }

      if (assignmentsResult.error) {
        console.error(
          "[Policy Library] Load assignments error:",
          assignmentsResult.error,
        );

        return res.status(500).json({
          message:
            "Failed to load policy assignments.",
          detail: assignmentsResult.error.message,
        });
      }

      versions = versionsResult.data || [];
      assignments = assignmentsResult.data || [];
    }

    const policiesWithDetails = policyRows.map(
      (policy) => {
        const policyVersions = versions.filter(
          (version) =>
            version.policy_id === policy.id,
        );

        const policyAssignments =
          assignments.filter(
            (assignment) =>
              assignment.policy_id === policy.id,
          );

        const latestVersion =
          policyVersions.length > 0
            ? policyVersions[0]
            : null;

        return {
          ...policy,

          versions: policyVersions,

          latest_version: latestVersion,

          assignments: policyAssignments,

          assignment_count:
            policyAssignments.length,

          pending_acknowledgment_count:
            policyAssignments.filter(
              (assignment) =>
                assignment.status === "pending" ||
                assignment.status === "overdue",
            ).length,

          acknowledged_count:
            policyAssignments.filter(
              (assignment) =>
                assignment.status ===
                "acknowledged",
            ).length,
        };
      },
    );

    const stats = {
      total_policies: policyRows.length,

      published_policies:
        policyRows.filter(
          (policy) =>
            policy.status === "published",
        ).length,

      total_versions: versions.length,

      pending_acknowledgments:
        assignments.filter(
          (assignment) =>
            assignment.status === "pending" ||
            assignment.status === "overdue",
        ).length,
    };

    return res.json({
      policies: policiesWithDetails,
      stats,
    });
  } catch (error) {
    console.error(
      "[Policy Library] Unexpected load error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to load policy library.",
      detail: error?.message || null,
    });
  }
});

/* =========================================================
   GET POLICY STATS
   GET /api/policy-library/stats
========================================================= */

router.get("/stats", async (req, res) => {
  try {
    const organizationId = req.organization.id;

    const [
      totalResult,
      publishedResult,
      versionsResult,
      pendingResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("policies")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          organizationId,
        ),

      supabaseAdmin
        .from("policies")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          organizationId,
        )
        .eq("status", "published"),

      supabaseAdmin
        .from("policy_versions")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          organizationId,
        ),

      supabaseAdmin
        .from("policy_assignments")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "organization_id",
          organizationId,
        )
        .in("status", [
          "pending",
          "overdue",
        ]),
    ]);

    const firstError =
      totalResult.error ||
      publishedResult.error ||
      versionsResult.error ||
      pendingResult.error;

    if (firstError) {
      console.error(
        "[Policy Library] Stats error:",
        firstError,
      );

      return res.status(500).json({
        message: "Failed to load policy statistics.",
        detail: firstError.message,
      });
    }

    return res.json({
      total_policies:
        totalResult.count || 0,

      published_policies:
        publishedResult.count || 0,

      total_versions:
        versionsResult.count || 0,

      pending_acknowledgments:
        pendingResult.count || 0,
    });
  } catch (error) {
    console.error(
      "[Policy Library] Unexpected stats error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to load policy statistics.",
    });
  }
});

/* =========================================================
   GET SINGLE POLICY
   GET /api/policy-library/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const policyId = req.params.id;

    if (!validUuid(policyId)) {
      return res.status(400).json({
        message: "Invalid policy ID.",
      });
    }

    const {
      data: policy,
      error: policyError,
    } = await supabaseAdmin
      .from("policies")
      .select("*")
      .eq("id", policyId)
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

    if (policyError) {
      console.error(
        "[Policy Library] Policy lookup error:",
        policyError,
      );

      return res.status(500).json({
        message: "Failed to load policy.",
        detail: policyError.message,
      });
    }

    if (!policy) {
      return res.status(404).json({
        message: "Policy not found.",
      });
    }

    const [
      versionsResult,
      assignmentsResult,
      eventsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("policy_versions")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq("policy_id", policyId)
        .order("version_number", {
          ascending: false,
        }),

      supabaseAdmin
        .from("policy_assignments")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq("policy_id", policyId)
        .order("assigned_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("policy_events")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq("policy_id", policyId)
        .order("event_at", {
          ascending: false,
        }),
    ]);

    const firstError =
      versionsResult.error ||
      assignmentsResult.error ||
      eventsResult.error;

    if (firstError) {
      console.error(
        "[Policy Library] Policy details error:",
        firstError,
      );

      return res.status(500).json({
        message:
          "Failed to load policy details.",
        detail: firstError.message,
      });
    }

    return res.json({
      policy: {
        ...policy,
        versions:
          versionsResult.data || [],
        assignments:
          assignmentsResult.data || [],
        events:
          eventsResult.data || [],
      },
    });
  } catch (error) {
    console.error(
      "[Policy Library] Unexpected policy lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to load policy.",
    });
  }
});

/* =========================================================
   CREATE POLICY
   POST /api/policy-library
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId = req.organization.id;
    const userId = req.user?.id || null;

    const {
      policy_code,
      title,
      category,
      description,
      status,
      content,
      source_url,
      effective_date,
    } = req.body || {};

    const cleanCode = clean(policy_code);
    const cleanTitle = clean(title);
    const cleanCategory = optional(category);
    const cleanDescription = optional(
      description,
    );

    const cleanStatus =
      clean(status).toLowerCase() || "draft";

    if (!cleanCode) {
      return res.status(400).json({
        message: "Policy code is required.",
      });
    }

    if (!cleanTitle) {
      return res.status(400).json({
        message: "Policy title is required.",
      });
    }

    if (
      !POLICY_STATUSES.includes(
        cleanStatus,
      )
    ) {
      return res.status(400).json({
        message: "Invalid policy status.",
      });
    }

    const {
      data: existingPolicy,
      error: existingError,
    } = await supabaseAdmin
      .from("policies")
      .select("id")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("policy_code", cleanCode)
      .maybeSingle();

    if (existingError) {
      console.error(
        "[Policy Library] Existing policy check error:",
        existingError,
      );

      return res.status(500).json({
        message:
          "Could not validate policy code.",
        detail: existingError.message,
      });
    }

    if (existingPolicy) {
      return res.status(409).json({
        message:
          "A policy with this code already exists.",
      });
    }

    const {
      data: policy,
      error: policyError,
    } = await supabaseAdmin
      .from("policies")
      .insert({
        organization_id:
          organizationId,

        policy_code: cleanCode,

        title: cleanTitle,

        category:
          cleanCategory,

        description:
          cleanDescription,

        status: cleanStatus,

        created_by: userId,
      })
      .select("*")
      .single();

    if (policyError) {
      console.error(
        "[Policy Library] Create policy error:",
        policyError,
      );

      return res.status(500).json({
        message: "Failed to create policy.",
        detail: policyError.message,
      });
    }

    let version = null;

    const cleanContent = clean(content);

    if (cleanContent) {
      const {
        data: versionData,
        error: versionError,
      } = await supabaseAdmin
        .from("policy_versions")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            policy.id,

          version_number: 1,

          content:
            cleanContent,

          source_url:
            optional(source_url),

          status:
            cleanStatus === "published"
              ? "published"
              : "draft",

          effective_date:
            optional(effective_date),

          published_at:
            cleanStatus === "published"
              ? new Date().toISOString()
              : null,

          published_by:
            cleanStatus === "published"
              ? userId
              : null,

          created_by:
            userId,
        })
        .select("*")
        .single();

      if (versionError) {
        console.error(
          "[Policy Library] Create initial version error:",
          versionError,
        );

        await supabaseAdmin
          .from("policies")
          .delete()
          .eq("id", policy.id)
          .eq(
            "organization_id",
            organizationId,
          );

        return res.status(500).json({
          message:
            "Failed to create initial policy version.",
          detail: versionError.message,
        });
      }

      version = versionData;
    }

    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,

        policy_id:
          policy.id,

        policy_version_id:
          version?.id || null,

        event_type:
          "policy_created",

        description:
          `Policy ${cleanCode} created.`,

        performed_by:
          userId,
      });

    return res.status(201).json({
      message:
        "Policy created successfully.",

      policy,

      version,
    });
  } catch (error) {
    console.error(
      "[Policy Library] Unexpected create error:",
      error,
    );

    return res.status(500).json({
      message: "Failed to create policy.",
    });
  }
});

/* =========================================================
   UPDATE POLICY
   PATCH /api/policy-library/:id
========================================================= */

router.patch("/:id", async (req, res) => {
  try {
    const organizationId =
      req.organization.id;

    const userId =
      req.user?.id || null;

    const policyId =
      req.params.id;

    if (!validUuid(policyId)) {
      return res.status(400).json({
        message: "Invalid policy ID.",
      });
    }

    const {
      policy_code,
      title,
      category,
      description,
      status,
    } = req.body || {};

    const updates = {};

    if (policy_code !== undefined) {
      const value = clean(policy_code);

      if (!value) {
        return res.status(400).json({
          message:
            "Policy code cannot be empty.",
        });
      }

      updates.policy_code = value;
    }

    if (title !== undefined) {
      const value = clean(title);

      if (!value) {
        return res.status(400).json({
          message:
            "Policy title cannot be empty.",
        });
      }

      updates.title = value;
    }

    if (category !== undefined) {
      updates.category =
        optional(category);
    }

    if (description !== undefined) {
      updates.description =
        optional(description);
    }

    if (status !== undefined) {
      const value =
        clean(status).toLowerCase();

      if (
        !POLICY_STATUSES.includes(value)
      ) {
        return res.status(400).json({
          message:
            "Invalid policy status.",
        });
      }

      updates.status = value;
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return res.status(400).json({
        message:
          "No policy changes were provided.",
      });
    }

    updates.updated_at =
      new Date().toISOString();

    const {
      data: policy,
      error,
    } = await supabaseAdmin
      .from("policies")
      .update(updates)
      .eq("id", policyId)
      .eq(
        "organization_id",
        organizationId,
      )
      .select("*")
      .maybeSingle();

    if (error) {
      console.error(
        "[Policy Library] Update policy error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to update policy.",
        detail: error.message,
      });
    }

    if (!policy) {
      return res.status(404).json({
        message:
          "Policy not found.",
      });
    }

    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,

        policy_id:
          policyId,

        event_type:
          "policy_updated",

        description:
          "Policy details updated.",

        performed_by:
          userId,
      });

    return res.json({
      message:
        "Policy updated successfully.",

      policy,
    });
  } catch (error) {
    console.error(
      "[Policy Library] Unexpected update error:",
      error,
    );

    return res.status(500).json({
      message:
        "Failed to update policy.",
    });
  }
});

/* =========================================================
   GET POLICY VERSIONS
   GET /api/policy-library/:id/versions
========================================================= */

router.get(
  "/:id/versions",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const policyId =
        req.params.id;

      if (!validUuid(policyId)) {
        return res.status(400).json({
          message:
            "Invalid policy ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("policy_versions")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "policy_id",
          policyId,
        )
        .order(
          "version_number",
          {
            ascending: false,
          },
        );

      if (error) {
        console.error(
          "[Policy Library] Load versions error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to load policy versions.",
          detail: error.message,
        });
      }

      return res.json({
        versions: data || [],
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected versions error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load policy versions.",
      });
    }
  },
);

/* =========================================================
   CREATE POLICY VERSION
   POST /api/policy-library/:id/versions
========================================================= */

router.post(
  "/:id/versions",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const userId =
        req.user?.id || null;

      const policyId =
        req.params.id;

      const {
        content,
        source_url,
        status,
        effective_date,
      } = req.body || {};

      if (!validUuid(policyId)) {
        return res.status(400).json({
          message:
            "Invalid policy ID.",
        });
      }

      const cleanContent =
        clean(content);

      if (!cleanContent) {
        return res.status(400).json({
          message:
            "Policy content is required.",
        });
      }

      const {
        data: policy,
        error: policyError,
      } = await supabaseAdmin
        .from("policies")
        .select("id")
        .eq(
          "id",
          policyId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .maybeSingle();

      if (policyError) {
        return res.status(500).json({
          message:
            "Failed to validate policy.",
          detail:
            policyError.message,
        });
      }

      if (!policy) {
        return res.status(404).json({
          message:
            "Policy not found.",
        });
      }

      const {
        data: latestVersion,
        error: latestError,
      } = await supabaseAdmin
        .from("policy_versions")
        .select(
          "version_number",
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "policy_id",
          policyId,
        )
        .order(
          "version_number",
          {
            ascending: false,
          },
        )
        .limit(1)
        .maybeSingle();

      if (latestError) {
        return res.status(500).json({
          message:
            "Failed to determine next version.",
          detail:
            latestError.message,
        });
      }

      const nextVersion =
        Number(
          latestVersion?.version_number ||
            0,
        ) + 1;

      const cleanStatus =
        clean(status).toLowerCase() ||
        "draft";

      if (
        !VERSION_STATUSES.includes(
          cleanStatus,
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid version status.",
        });
      }

      const isPublished =
        cleanStatus === "published";

      const {
        data: version,
        error: versionError,
      } = await supabaseAdmin
        .from("policy_versions")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            policyId,

          version_number:
            nextVersion,

          content:
            cleanContent,

          source_url:
            optional(source_url),

          status:
            cleanStatus,

          effective_date:
            optional(effective_date),

          published_at:
            isPublished
              ? new Date().toISOString()
              : null,

          published_by:
            isPublished
              ? userId
              : null,

          created_by:
            userId,
        })
        .select("*")
        .single();

      if (versionError) {
        console.error(
          "[Policy Library] Create version error:",
          versionError,
        );

        return res.status(500).json({
          message:
            "Failed to create policy version.",
          detail:
            versionError.message,
        });
      }

      if (isPublished) {
        await supabaseAdmin
          .from("policies")
          .update({
            status: "published",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            policyId,
          )
          .eq(
            "organization_id",
            organizationId,
          );
      }

      await supabaseAdmin
        .from("policy_events")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            policyId,

          policy_version_id:
            version.id,

          event_type:
            "version_created",

          description:
            `Policy version ${nextVersion} created.`,

          performed_by:
            userId,
        });

      return res.status(201).json({
        message:
          "Policy version created successfully.",

        version,
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected version creation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to create policy version.",
      });
    }
  },
);

/* =========================================================
   GET POLICY ASSIGNMENTS
   GET /api/policy-library/:id/assignments
========================================================= */

router.get(
  "/:id/assignments",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const policyId =
        req.params.id;

      if (!validUuid(policyId)) {
        return res.status(400).json({
          message:
            "Invalid policy ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("policy_assignments")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "policy_id",
          policyId,
        )
        .order(
          "assigned_at",
          {
            ascending: false,
          },
        );

      if (error) {
        console.error(
          "[Policy Library] Load assignments error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to load policy assignments.",
          detail:
            error.message,
        });
      }

      return res.json({
        assignments:
          data || [],
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected assignments error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load policy assignments.",
      });
    }
  },
);

/* =========================================================
   ASSIGN POLICY
   POST /api/policy-library/:id/assignments
========================================================= */

router.post(
  "/:id/assignments",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const userId =
        req.user?.id || null;

      const policyId =
        req.params.id;

      const {
        policy_version_id,
        employee_id,
        due_date,
      } = req.body || {};

      if (!validUuid(policyId)) {
        return res.status(400).json({
          message:
            "Invalid policy ID.",
        });
      }

      if (!validUuid(employee_id)) {
        return res.status(400).json({
          message:
            "Valid employee ID is required.",
        });
      }

      if (
        !validUuid(
          policy_version_id,
        )
      ) {
        return res.status(400).json({
          message:
            "Valid policy version ID is required.",
        });
      }

      const [
        policyResult,
        versionResult,
        employeeResult,
      ] = await Promise.all([
        supabaseAdmin
          .from("policies")
          .select("id")
          .eq(
            "id",
            policyId,
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .maybeSingle(),

        supabaseAdmin
          .from("policy_versions")
          .select("id")
          .eq(
            "id",
            policy_version_id,
          )
          .eq(
            "policy_id",
            policyId,
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .maybeSingle(),

        supabaseAdmin
          .from("employees")
          .select("id")
          .eq(
            "id",
            employee_id,
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .maybeSingle(),
      ]);

      const validationError =
        policyResult.error ||
        versionResult.error ||
        employeeResult.error;

      if (validationError) {
        return res.status(500).json({
          message:
            "Failed to validate assignment.",
          detail:
            validationError.message,
        });
      }

      if (!policyResult.data) {
        return res.status(404).json({
          message:
            "Policy not found.",
        });
      }

      if (!versionResult.data) {
        return res.status(404).json({
          message:
            "Policy version not found.",
        });
      }

      if (!employeeResult.data) {
        return res.status(400).json({
          message:
            "Employee does not belong to this organization.",
        });
      }

      const {
        data: assignment,
        error,
      } = await supabaseAdmin
        .from("policy_assignments")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            policyId,

          policy_version_id:
            policy_version_id,

          employee_id:
            employee_id,

          due_date:
            optional(due_date),

          status:
            "pending",
        })
        .select("*")
        .single();

      if (error) {
        console.error(
          "[Policy Library] Assignment creation error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to assign policy.",
          detail:
            error.message,
        });
      }

      await supabaseAdmin
        .from("policy_events")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            policyId,

          policy_version_id:
            policy_version_id,

          assignment_id:
            assignment.id,

          event_type:
            "policy_assigned",

          description:
            "Policy assigned to employee.",

          performed_by:
            userId,
        });

      return res.status(201).json({
        message:
          "Policy assigned successfully.",

        assignment,
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected assignment error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to assign policy.",
      });
    }
  },
);

/* =========================================================
   ACKNOWLEDGE POLICY
   PATCH /api/policy-library/assignments/:assignmentId/acknowledge
========================================================= */

router.patch(
  "/assignments/:assignmentId/acknowledge",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const userId =
        req.user?.id || null;

      const assignmentId =
        req.params.assignmentId;

      const {
        acknowledgment_note,
      } = req.body || {};

      if (!validUuid(assignmentId)) {
        return res.status(400).json({
          message:
            "Invalid assignment ID.",
        });
      }

      const {
        data: existingAssignment,
        error: lookupError,
      } = await supabaseAdmin
        .from("policy_assignments")
        .select("*")
        .eq(
          "id",
          assignmentId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .maybeSingle();

      if (lookupError) {
        return res.status(500).json({
          message:
            "Failed to load assignment.",
          detail:
            lookupError.message,
        });
      }

      if (!existingAssignment) {
        return res.status(404).json({
          message:
            "Policy assignment not found.",
        });
      }

      const {
        data: assignment,
        error,
      } = await supabaseAdmin
        .from("policy_assignments")
        .update({
          status:
            "acknowledged",

          acknowledged_at:
            new Date().toISOString(),

          acknowledged_by:
            userId,

          acknowledgment_note:
            optional(
              acknowledgment_note,
            ),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          assignmentId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("*")
        .single();

      if (error) {
        console.error(
          "[Policy Library] Acknowledgment error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to acknowledge policy.",
          detail:
            error.message,
        });
      }

      await supabaseAdmin
        .from("policy_events")
        .insert({
          organization_id:
            organizationId,

          policy_id:
            assignment.policy_id,

          policy_version_id:
            assignment.policy_version_id,

          assignment_id:
            assignment.id,

          event_type:
            "policy_acknowledged",

          description:
            "Policy acknowledgment recorded.",

          performed_by:
            userId,
        });

      return res.json({
        message:
          "Policy acknowledged successfully.",

        assignment,
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected acknowledgment error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to acknowledge policy.",
      });
    }
  },
);

/* =========================================================
   GET POLICY EVENTS
   GET /api/policy-library/:id/events
========================================================= */

router.get(
  "/:id/events",
  async (req, res) => {
    try {
      const organizationId =
        req.organization.id;

      const policyId =
        req.params.id;

      if (!validUuid(policyId)) {
        return res.status(400).json({
          message:
            "Invalid policy ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("policy_events")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "policy_id",
          policyId,
        )
        .order(
          "event_at",
          {
            ascending: false,
          },
        );

      if (error) {
        console.error(
          "[Policy Library] Events lookup error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to load policy events.",
          detail:
            error.message,
        });
      }

      return res.json({
        events: data || [],
      });
    } catch (error) {
      console.error(
        "[Policy Library] Unexpected events error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load policy events.",
      });
    }
  },
);

export default router;