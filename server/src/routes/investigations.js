import express from "express";
import { supabaseAdmin } from "../config/supabase.js";
import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

function normalizeString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const valueString = String(value).trim();

  return valueString || null;
}

function normalizePriority(value) {
  const allowed = [
    "low",
    "normal",
    "high",
    "critical",
  ];

  const normalized =
    String(value || "normal")
      .trim()
      .toLowerCase();

  return allowed.includes(normalized)
    ? normalized
    : "normal";
}

function normalizeStatus(value) {
  const allowed = [
    "open",
    "under_review",
    "investigation",
    "in_progress",
    "pending",
    "closed",
    "resolved",
    "cancelled",
  ];

  const normalized =
    String(value || "open")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  return allowed.includes(normalized)
    ? normalized
    : "open";
}

function normalizeInvestigationType(value) {
  const allowed = [
    "misconduct",
    "harassment",
    "discrimination",
    "policy_violation",
    "grievance",
    "fraud",
    "workplace_safety",
    "employee_complaint",
    "other",
  ];

  const normalized =
    String(value || "other")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

  return allowed.includes(normalized)
    ? normalized
    : "other";
}

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.organization?.organization_id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

async function resolveOrganization(req) {
  if (req.organization?.id) {
    return req.organization;
  }

  if (req.user?.organization_id) {
    return {
      id: req.user.organization_id,
    };
  }

  if (req.user?.organizationId) {
    return {
      id: req.user.organizationId,
    };
  }

  if (!req.user?.id) {
    return null;
  }

  return await getOrganizationForUser(req.user.id);
}

async function verifyInvestigation(
  organizationId,
  investigationId
) {
  if (!organizationId || !investigationId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("investigations")
    .select("*")
    .eq("id", investigationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function verifyEmployeeBelongsToOrganization(
  organizationId,
  employeeId
) {
  if (!employeeId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, full_name, email, department, title"
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function verifyMemberBelongsToOrganization(
  organizationId,
  userId
) {
  if (!userId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   ORGANIZATION CONTEXT
========================================================= */

router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    const organization =
      await resolveOrganization(req);

    if (!organization?.id) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[Investigations] Organization lookup failed:",
      error
    );

    return res.status(500).json({
      message:
        "Could not determine organization.",
      error: error.message,
    });
  }
});

/* =========================================================
   GET /api/investigations
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Organization could not be determined.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("investigations")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "[Investigations] Fetch error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to fetch investigations.",
        error: error.message,
      });
    }

    return res.status(200).json({
      investigations: data || [],
    });
  } catch (error) {
    console.error(
      "[Investigations] Unexpected fetch error:",
      error
    );

    return res.status(500).json({
      message:
        "Unexpected error while fetching investigations.",
      error: error.message,
    });
  }
});

/* =========================================================
   GET /api/investigations/assignees
========================================================= */

router.get(
  "/assignees",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const {
        data: members,
        error: membersError,
      } = await supabaseAdmin
        .from("organization_members")
        .select("user_id, role")
        .eq(
          "organization_id",
          organizationId
        )
        .order("created_at", {
          ascending: true,
        });

      if (membersError) {
        console.error(
          "[Investigations] Assignees lookup error:",
          membersError
        );

        return res.status(500).json({
          message:
            "Failed to load investigators.",
          error:
            membersError.message,
        });
      }

      if (
        !members ||
        members.length === 0
      ) {
        return res.status(200).json({
          assignees: [],
        });
      }

      const {
        data: users,
        error: usersError,
      } =
        await supabaseAdmin.auth.admin.listUsers(
          {
            page: 1,
            perPage: 1000,
          }
        );

      if (usersError) {
        console.error(
          "[Investigations] Auth users lookup error:",
          usersError
        );

        return res.status(500).json({
          message:
            "Failed to load investigator details.",
          error:
            usersError.message,
        });
      }

      const userMap = new Map(
        (users?.users || []).map(
          (user) => [
            user.id,
            user,
          ]
        )
      );

      const assignees =
        members.map((member) => {
          const user =
            userMap.get(
              member.user_id
            );

          const metadata =
            user?.user_metadata || {};

          const name =
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            user?.email ||
            member.user_id;

          return {
            user_id:
              member.user_id,

            role:
              member.role,

            name,

            email:
              user?.email || null,
          };
        });

      return res.status(200).json({
        assignees,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected assignees error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while loading investigators.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   GET /api/investigations/:id
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      return res.status(200).json({
        investigation,
      });
    } catch (error) {
      console.error(
        "[Investigations] Get single error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while fetching investigation.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   POST /api/investigations
========================================================= */

router.post(
  "/",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const userId =
        req.user?.id || null;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const {
        investigation_number,
        employee_id,
        title,
        description,
        investigation_type,
        priority,
        status,
        investigator_id,
        opened_at,
        target_date,
        findings,
        resolution,
        notes,
      } = req.body || {};

      if (!employee_id) {
        return res.status(400).json({
          message:
            "Employee is required.",
        });
      }

      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message:
            "Investigation title is required.",
        });
      }

      const employee =
        await verifyEmployeeBelongsToOrganization(
          organizationId,
          employee_id
        );

      if (!employee) {
        return res.status(400).json({
          message:
            "Selected employee does not belong to this organization.",
        });
      }

      if (investigator_id) {
        const investigator =
          await verifyMemberBelongsToOrganization(
            organizationId,
            investigator_id
          );

        if (!investigator) {
          return res.status(400).json({
            message:
              "Selected investigator does not belong to this organization.",
          });
        }
      }

      let investigationNumber =
        normalizeString(
          investigation_number
        );

      if (!investigationNumber) {
        const {
          count,
          error: countError,
        } =
          await supabaseAdmin
            .from("investigations")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq(
              "organization_id",
              organizationId
            );

        if (countError) {
          console.error(
            "[Investigations] Number generation error:",
            countError
          );

          return res.status(500).json({
            message:
              "Failed to generate investigation number.",
            error:
              countError.message,
          });
        }

        investigationNumber =
          `INV-${String(
            (count || 0) + 1
          ).padStart(5, "0")}`;
      }

      const investigationPayload = {
        organization_id:
          organizationId,

        investigation_number:
          investigationNumber,

        employee_id,

        title:
          String(title).trim(),

        description:
          normalizeString(
            description
          ),

        investigation_type:
          normalizeInvestigationType(
            investigation_type
          ),

        priority:
          normalizePriority(priority),

        status:
          normalizeStatus(status),

        investigator_id:
          investigator_id || null,

        opened_at:
          opened_at ||
          new Date().toISOString(),

        target_date:
          target_date || null,

        findings:
          normalizeString(findings),

        resolution:
          normalizeString(resolution),

        notes:
          normalizeString(notes),

        created_by:
          userId,

        created_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      };

      const {
        data: investigation,
        error: createError,
      } =
        await supabaseAdmin
          .from("investigations")
          .insert(
            investigationPayload
          )
          .select("*")
          .single();

      if (createError) {
        console.error(
          "[Investigations] Create error:",
          createError
        );

        return res.status(500).json({
          message:
            "Failed to create investigation.",
          error:
            createError.message,
          code:
            createError.code,
        });
      }

      const {
        error: eventError,
      } =
        await supabaseAdmin
          .from(
            "investigation_events"
          )
          .insert({
            organization_id:
              organizationId,

            investigation_id:
              investigation.id,

            event_type:
              "created",

            title:
              "Investigation created",

            description:
              "Investigation record created.",

            event_at:
              investigation.opened_at ||
              new Date().toISOString(),

            created_by:
              userId,
          });

      if (eventError) {
        console.error(
          "[Investigations] Initial event creation error:",
          eventError
        );
      }

      return res.status(201).json({
        message:
          "Investigation created successfully.",

        investigation,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected create error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while creating investigation.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   PUT /api/investigations/:id
========================================================= */

router.put(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const existing =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!existing) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        employee_id,
        title,
        description,
        investigation_type,
        priority,
        status,
        investigator_id,
        opened_at,
        target_date,
        findings,
        resolution,
        notes,
      } = req.body || {};

      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message:
            "Investigation title is required.",
        });
      }

      if (employee_id) {
        const employee =
          await verifyEmployeeBelongsToOrganization(
            organizationId,
            employee_id
          );

        if (!employee) {
          return res.status(400).json({
            message:
              "Selected employee does not belong to this organization.",
          });
        }
      }

      if (investigator_id) {
        const investigator =
          await verifyMemberBelongsToOrganization(
            organizationId,
            investigator_id
          );

        if (!investigator) {
          return res.status(400).json({
            message:
              "Selected investigator does not belong to this organization.",
          });
        }
      }

      const updates = {
        employee_id:
          employee_id ||
          existing.employee_id,

        title:
          String(title).trim(),

        description:
          normalizeString(
            description
          ),

        investigation_type:
          normalizeInvestigationType(
            investigation_type
          ),

        priority:
          normalizePriority(priority),

        status:
          normalizeStatus(status),

        investigator_id:
          investigator_id || null,

        opened_at:
          opened_at ||
          existing.opened_at,

        target_date:
          target_date || null,

        findings:
          normalizeString(findings),

        resolution:
          normalizeString(resolution),

        notes:
          normalizeString(notes),

        updated_at:
          new Date().toISOString(),
      };

      const {
        data: investigation,
        error,
      } =
        await supabaseAdmin
          .from("investigations")
          .update(updates)
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "[Investigations] Update error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to update investigation.",
          error:
            error.message,
        });
      }

      if (
        existing.status !==
        investigation.status
      ) {
        await supabaseAdmin
          .from(
            "investigation_events"
          )
          .insert({
            organization_id:
              organizationId,

            investigation_id:
              investigation.id,

            event_type:
              "status_change",

            title:
              "Investigation status changed",

            description:
              `Status changed from "${existing.status}" to "${investigation.status}".`,

            event_at:
              new Date().toISOString(),

            created_by:
              req.user?.id || null,
          });
      }

      return res.status(200).json({
        message:
          "Investigation updated successfully.",

        investigation,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected update error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while updating investigation.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   PATCH /api/investigations/:id/status
========================================================= */

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const { status } =
        req.body || {};

      if (!status) {
        return res.status(400).json({
          message:
            "Status is required.",
        });
      }

      const normalizedStatus =
        normalizeStatus(status);

      const existing =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!existing) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      if (
        existing.status ===
        normalizedStatus
      ) {
        return res.status(200).json({
          message:
            "Investigation status is already set to the selected status.",

          investigation:
            existing,
        });
      }

      const {
        data: investigation,
        error,
      } =
        await supabaseAdmin
          .from("investigations")
          .update({
            status:
              normalizedStatus,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            organizationId
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "[Investigations] Status update error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to update investigation status.",
          error:
            error.message,
        });
      }

      await supabaseAdmin
        .from(
          "investigation_events"
        )
        .insert({
          organization_id:
            organizationId,

          investigation_id:
            investigation.id,

          event_type:
            "status_change",

          title:
            "Investigation status changed",

          description:
            `Status changed from "${existing.status}" to "${investigation.status}".`,

          event_at:
            new Date().toISOString(),

          created_by:
            req.user?.id || null,
        });

      return res.status(200).json({
        message:
          "Investigation status updated successfully.",

        investigation,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected status error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while updating status.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   DELETE /api/investigations/:id
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const existing =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!existing) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        error:
          evidenceDeleteError,
      } =
        await supabaseAdmin
          .from(
            "investigation_evidence"
          )
          .delete()
          .eq(
            "investigation_id",
            req.params.id
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (evidenceDeleteError) {
        console.error(
          "[Investigations] Evidence delete error:",
          evidenceDeleteError
        );

        return res.status(500).json({
          message:
            "Failed to delete investigation evidence.",
          error:
            evidenceDeleteError.message,
        });
      }

      const {
        error:
          eventsDeleteError,
      } =
        await supabaseAdmin
          .from(
            "investigation_events"
          )
          .delete()
          .eq(
            "investigation_id",
            req.params.id
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (eventsDeleteError) {
        console.error(
          "[Investigations] Event delete error:",
          eventsDeleteError
        );

        return res.status(500).json({
          message:
            "Failed to delete investigation events.",
          error:
            eventsDeleteError.message,
        });
      }

      const {
        error: deleteError,
      } =
        await supabaseAdmin
          .from("investigations")
          .delete()
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "organization_id",
            organizationId
          );

      if (deleteError) {
        console.error(
          "[Investigations] Delete error:",
          deleteError
        );

        return res.status(500).json({
          message:
            "Failed to delete investigation.",
          error:
            deleteError.message,
        });
      }

      return res.status(200).json({
        message:
          "Investigation deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected delete error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while deleting investigation.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   GET /api/investigations/:id/events
========================================================= */

router.get(
  "/:id/events",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "investigation_events"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "investigation_id",
            req.params.id
          )
          .order("event_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "[Investigations] Events fetch error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to fetch investigation events.",
          error:
            error.message,
        });
      }

      return res.status(200).json({
        events: data || [],
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected events error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while fetching events.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   POST /api/investigations/:id/events
========================================================= */

router.post(
  "/:id/events",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        event_type,
        title,
        description,
        event_at,
      } = req.body || {};

      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message:
            "Event title is required.",
        });
      }

      const allowedTypes = [
        "created",
        "status_change",
        "interview",
        "evidence",
        "finding",
        "action",
        "note",
        "resolution",
        "other",
      ];

      const requestedType =
        String(
          event_type || ""
        )
          .trim()
          .toLowerCase();

      const normalizedType =
        allowedTypes.includes(
          requestedType
        )
          ? requestedType
          : "note";

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "investigation_events"
          )
          .insert({
            organization_id:
              organizationId,

            investigation_id:
              req.params.id,

            event_type:
              normalizedType,

            title:
              String(title).trim(),

            description:
              normalizeString(
                description
              ),

            event_at:
              event_at ||
              new Date().toISOString(),

            created_by:
              req.user?.id || null,
          })
          .select("*")
          .single();

      if (error) {
        console.error(
          "[Investigations] Event create error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to create investigation event.",
          error:
            error.message,
        });
      }

      return res.status(201).json({
        message:
          "Investigation event created successfully.",

        event: data,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected event create error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while creating event.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   GET /api/investigations/:id/evidence
========================================================= */

router.get(
  "/:id/evidence",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "investigation_evidence"
          )
          .select("*")
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "investigation_id",
            req.params.id
          )
          .order("created_at", {
            ascending: false,
          });

      if (error) {
        console.error(
          "[Investigations] Evidence fetch error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to fetch investigation evidence.",
          error:
            error.message,
        });
      }

      return res.status(200).json({
        evidence: data || [],
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected evidence fetch error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while fetching evidence.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   POST /api/investigations/:id/evidence
========================================================= */

router.post(
  "/:id/evidence",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        evidence_type,
        title,
        description,
        source_url,
        collected_at,
        collected_by,
      } = req.body || {};

      if (
        !title ||
        !String(title).trim()
      ) {
        return res.status(400).json({
          message:
            "Evidence title is required.",
        });
      }

      const allowedTypes = [
        "document",
        "email",
        "image",
        "video",
        "audio",
        "message",
        "interview",
        "other",
      ];

      const requestedType =
        String(
          evidence_type || ""
        )
          .trim()
          .toLowerCase();

      const normalizedType =
        allowedTypes.includes(
          requestedType
        )
          ? requestedType
          : "document";

      const collectorId =
        collected_by ||
        req.user?.id ||
        null;

      if (collectorId) {
        const member =
          await verifyMemberBelongsToOrganization(
            organizationId,
            collectorId
          );

        if (!member) {
          return res.status(400).json({
            message:
              "Evidence collector does not belong to this organization.",
          });
        }
      }

      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "investigation_evidence"
          )
          .insert({
            organization_id:
              organizationId,

            investigation_id:
              req.params.id,

            evidence_type:
              normalizedType,

            title:
              String(title).trim(),

            description:
              normalizeString(
                description
              ),

            source_url:
              normalizeString(
                source_url
              ),

            collected_at:
              collected_at || null,

            collected_by:
              collectorId,
          })
          .select("*")
          .single();

      if (error) {
        console.error(
          "[Investigations] Evidence create error:",
          error
        );

        return res.status(500).json({
          message:
            "Failed to create investigation evidence.",
          error:
            error.message,
        });
      }

      await supabaseAdmin
        .from(
          "investigation_events"
        )
        .insert({
          organization_id:
            organizationId,

          investigation_id:
            req.params.id,

          event_type:
            "evidence",

          title:
            `Evidence added: ${String(title).trim()}`,

          description:
            normalizeString(
              description
            ),

          event_at:
            collected_at ||
            new Date().toISOString(),

          created_by:
            req.user?.id || null,
        });

      return res.status(201).json({
        message:
          "Investigation evidence created successfully.",

        evidence: data,
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected evidence create error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while creating evidence.",
        error:
          error.message,
      });
    }
  }
);

/* =========================================================
   DELETE /api/investigations/:id/evidence/:evidenceId
========================================================= */

router.delete(
  "/:id/evidence/:evidenceId",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      const investigation =
        await verifyInvestigation(
          organizationId,
          req.params.id
        );

      if (!investigation) {
        return res.status(404).json({
          message:
            "Investigation not found.",
        });
      }

      const {
        data: evidence,
        error:
          evidenceLookupError,
      } =
        await supabaseAdmin
          .from(
            "investigation_evidence"
          )
          .select("id")
          .eq(
            "id",
            req.params.evidenceId
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "investigation_id",
            req.params.id
          )
          .maybeSingle();

      if (evidenceLookupError) {
        return res.status(500).json({
          message:
            "Failed to verify investigation evidence.",
          error:
            evidenceLookupError.message,
        });
      }

      if (!evidence) {
        return res.status(404).json({
          message:
            "Evidence not found.",
        });
      }

      const {
        error: deleteError,
      } =
        await supabaseAdmin
          .from(
            "investigation_evidence"
          )
          .delete()
          .eq(
            "id",
            req.params.evidenceId
          )
          .eq(
            "organization_id",
            organizationId
          )
          .eq(
            "investigation_id",
            req.params.id
          );

      if (deleteError) {
        console.error(
          "[Investigations] Evidence delete error:",
          deleteError
        );

        return res.status(500).json({
          message:
            "Failed to delete investigation evidence.",
          error:
            deleteError.message,
        });
      }

      return res.status(200).json({
        message:
          "Investigation evidence deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[Investigations] Unexpected evidence delete error:",
        error
      );

      return res.status(500).json({
        message:
          "Unexpected error while deleting evidence.",
        error:
          error.message,
      });
    }
  }
);

export default router;