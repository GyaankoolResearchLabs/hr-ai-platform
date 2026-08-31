import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   HELPERS
========================================================= */

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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

/* =========================================================
   DEADLINE STATUSES
========================================================= */

const ALLOWED_STATUSES = [
  "upcoming",
  "completed",
  "overdue",
];

/* =========================================================
   REQUIREMENT STATUSES

   The UI currently uses Active / Inactive.
   Database values are stored in lowercase.
========================================================= */

const ALLOWED_REQUIREMENT_STATUSES = [
  "active",
  "inactive",
];

/* =========================================================
   ORGANIZATION RESOLUTION
========================================================= */

async function resolveOrganization(req) {
  /*
   * 1. Already resolved organization
   */
  if (req.organization?.id) {
    return {
      id: req.organization.id,
      role: req.organization.role || null,
    };
  }

  /*
   * 2. organization_id on authenticated user
   */
  if (req.user?.organization_id) {
    return {
      id: req.user.organization_id,
      role: req.user.role || null,
    };
  }

  /*
   * 3. organizationId on authenticated user
   */
  if (req.user?.organizationId) {
    return {
      id: req.user.organizationId,
      role: req.user.role || null,
    };
  }

  /*
   * 4. Resolve through organization_members
   */
  const userId = req.user?.id;

  if (!userId) {
    console.error(
      "[ComplianceCalendar] Authenticated user ID missing.",
      {
        user: req.user,
      },
    );

    return null;
  }

  const {
    data: membership,
    error,
  } = await supabaseAdmin
    .from("organization_members")
    .select("organization_id, user_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[ComplianceCalendar] Organization membership lookup failed:",
      error,
    );

    throw error;
  }

  if (!membership?.organization_id) {
    console.error(
      "[ComplianceCalendar] No organization membership found.",
      {
        userId,
      },
    );

    return null;
  }

  return {
    id: membership.organization_id,
    role: membership.role || null,
  };
}

/* =========================================================
   ORGANIZATION MIDDLEWARE
========================================================= */

router.use(async (req, res, next) => {
  try {
    const organization = await resolveOrganization(req);

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
      "[ComplianceCalendar] Organization resolution error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization.",
      error: error.message,
    });
  }
});

/* =========================================================
   ORGANIZATION ID
========================================================= */

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET ALL COMPLIANCE DEADLINES

   GET /api/compliance-calendar
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    const search = clean(req.query.search);
    const status = clean(req.query.status).toLowerCase();

    let query = supabaseAdmin
      .from("compliance_deadlines")
      .select("*")
      .eq("organization_id", organizationId)
      .order("due_date", {
        ascending: true,
      });

    if (status && ALLOWED_STATUSES.includes(status)) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(
        [
          `title.ilike.%${search}%`,
          `requirement_id.ilike.%${search}%`,
          `notes.ilike.%${search}%`,
        ].join(","),
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "[ComplianceCalendar] Fetch deadlines error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load compliance deadlines.",
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }

    return res.status(200).json({
      deadlines: data || [],
    });
  } catch (error) {
    console.error(
      "[ComplianceCalendar] GET deadlines unexpected error:",
      error,
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading compliance deadlines.",
      error: error.message,
    });
  }
});

/* =========================================================
   GET COMPLIANCE STATISTICS

   GET /api/compliance-calendar/stats

   IMPORTANT:
   This route must stay before /:id.
========================================================= */

router.get("/stats", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message: "Organization could not be determined.",
      });
    }

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("compliance_deadlines")
      .select("id, status, due_date")
      .eq("organization_id", organizationId);

    if (error) {
      console.error(
        "[ComplianceCalendar] Stats fetch error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load compliance statistics.",
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }

    const deadlines = data || [];

    const total = deadlines.length;

    const upcoming = deadlines.filter(
      (deadline) =>
        deadline.status === "upcoming",
    ).length;

    const completed = deadlines.filter(
      (deadline) =>
        deadline.status === "completed",
    ).length;

    const overdue = deadlines.filter(
      (deadline) =>
        deadline.status === "overdue",
    ).length;

    return res.status(200).json({
      stats: {
        total,
        upcoming,
        overdue,
        completed,
      },
    });
  } catch (error) {
    console.error(
      "[ComplianceCalendar] Stats unexpected error:",
      error,
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading compliance statistics.",
      error: error.message,
    });
  }
});

/* =========================================================
   GET ALL COMPLIANCE REQUIREMENTS

   GET /api/compliance-calendar/requirements
========================================================= */

router.get("/requirements", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Organization could not be determined.",
      });
    }

    const search = clean(req.query.search);

    let query = supabaseAdmin
      .from("compliance_requirements")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order("name", {
        ascending: true,
      });

    if (search) {
      query = query.or(
        [
          `name.ilike.%${search}%`,
          `description.ilike.%${search}%`,
          `jurisdiction.ilike.%${search}%`,
          `authority.ilike.%${search}%`,
          `compliance_type.ilike.%${search}%`,
          `frequency.ilike.%${search}%`,
        ].join(","),
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      console.error(
        "[ComplianceCalendar] Fetch requirements error:",
        error,
      );

      return res.status(500).json({
        message:
          "Failed to load compliance requirements.",
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }

    return res.status(200).json({
      requirements: data || [],
    });
  } catch (error) {
    console.error(
      "[ComplianceCalendar] Requirements GET unexpected error:",
      error,
    );

    return res.status(500).json({
      message:
        "Unexpected error while loading compliance requirements.",
      error: error.message,
    });
  }
});

/* =========================================================
   GET ONE COMPLIANCE REQUIREMENT

   GET /api/compliance-calendar/requirements/:id
========================================================= */

router.get(
  "/requirements/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const requirementId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(requirementId)) {
        return res.status(400).json({
          message:
            "Invalid compliance requirement ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("compliance_requirements")
        .select("*")
        .eq(
          "id",
          requirementId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Fetch requirement error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to load compliance requirement.",
          error: error.message,
          details: error.details || null,
          hint: error.hint || null,
          code: error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance requirement not found.",
        });
      }

      return res.status(200).json({
        requirement: data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Single requirement unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while loading compliance requirement.",
        error: error.message,
      });
    }
  },
);

/* =========================================================
   CREATE COMPLIANCE REQUIREMENT

   POST /api/compliance-calendar/requirements

   This is the route that was missing from the previous
   complianceCalendar.routes.js.
========================================================= */

router.post(
  "/requirements",
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
        name,
        description,
        jurisdiction,
        authority,
        compliance_type,
        complianceType,
        frequency,
        responsible_employee_id,
        responsibleEmployeeId,
        alert_days_before,
        alertDaysBefore,
        status,
      } = req.body || {};

      /* =====================================================
         NORMALIZE INPUT
      ===================================================== */

      const finalName =
        clean(name);

      const finalDescription =
        optional(description);

      const finalJurisdiction =
        optional(jurisdiction);

      const finalAuthority =
        optional(authority);

      const finalComplianceType =
        clean(compliance_type) ||
        clean(complianceType);

      const finalFrequency =
        clean(frequency);

      const finalResponsibleEmployeeId =
        clean(
          responsible_employee_id,
        ) ||
        clean(
          responsibleEmployeeId,
        );

      const rawAlertDays =
        alert_days_before !== undefined
          ? alert_days_before
          : alertDaysBefore;

      let finalAlertDays = 0;

      if (
        rawAlertDays !== undefined &&
        rawAlertDays !== null &&
        rawAlertDays !== ""
      ) {
        finalAlertDays =
          Number(rawAlertDays);

        if (
          !Number.isInteger(
            finalAlertDays,
          ) ||
          finalAlertDays < 0
        ) {
          return res.status(400).json({
            message:
              "Alert days before must be a non-negative whole number.",
          });
        }
      }

      const normalizedStatus =
        clean(status).toLowerCase();

      const finalStatus =
        normalizedStatus || "active";

      /* =====================================================
         VALIDATE NAME
      ===================================================== */

      if (!finalName) {
        return res.status(400).json({
          message:
            "Compliance requirement name is required.",
        });
      }

      /* =====================================================
         VALIDATE COMPLIANCE TYPE
      ===================================================== */

      if (!finalComplianceType) {
        return res.status(400).json({
          message:
            "Compliance type is required.",
        });
      }

      /* =====================================================
         VALIDATE FREQUENCY
      ===================================================== */

      if (!finalFrequency) {
        return res.status(400).json({
          message:
            "Frequency is required.",
        });
      }

      /* =====================================================
         VALIDATE STATUS
      ===================================================== */

      if (
        !ALLOWED_REQUIREMENT_STATUSES.includes(
          finalStatus,
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid compliance requirement status.",
        });
      }

      /* =====================================================
         VALIDATE RESPONSIBLE EMPLOYEE
      ===================================================== */

      let responsibleEmployeeValue =
        finalResponsibleEmployeeId ||
        null;

      if (
        responsibleEmployeeValue &&
        !validUuid(
          responsibleEmployeeValue,
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid responsible employee ID.",
        });
      }

      /*
       * If an employee ID is supplied, verify that it
       * belongs to the same organization.
       *
       * We intentionally do not make this lookup mandatory
       * when the employees table is unavailable.
       */

      if (responsibleEmployeeValue) {
        const {
          data: employee,
          error: employeeError,
        } = await supabaseAdmin
          .from("employees")
          .select(
            "id, organization_id",
          )
          .eq(
            "id",
            responsibleEmployeeValue,
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .maybeSingle();

        if (employeeError) {
          console.warn(
            "[ComplianceCalendar] Employee validation warning:",
            employeeError.message,
          );
        } else if (!employee) {
          return res.status(400).json({
            message:
              "Responsible employee was not found in this organization.",
          });
        }
      }

      /* =====================================================
         DUPLICATE CHECK
      ===================================================== */

      const {
        data: existingRequirement,
        error: duplicateError,
      } = await supabaseAdmin
        .from("compliance_requirements")
        .select("id, name")
        .eq(
          "organization_id",
          organizationId,
        )
        .ilike(
          "name",
          finalName,
        )
        .limit(1)
        .maybeSingle();

      if (duplicateError) {
        console.error(
          "[ComplianceCalendar] Requirement duplicate check error:",
          duplicateError,
        );

        return res.status(500).json({
          message:
            "Failed to validate existing compliance requirements.",
          error:
            duplicateError.message,
          details:
            duplicateError.details || null,
          hint:
            duplicateError.hint || null,
          code:
            duplicateError.code || null,
        });
      }

      if (existingRequirement) {
        return res.status(409).json({
          message:
            "A compliance requirement with this name already exists.",
          requirement:
            existingRequirement,
        });
      }

      /* =====================================================
         CREATE PAYLOAD

         Do not trust organization_id from the browser.
         It always comes from the authenticated user.
      ===================================================== */

      const payload = {
        organization_id:
          organizationId,

        name:
          finalName,

        description:
          finalDescription,

        jurisdiction:
          finalJurisdiction,

        authority:
          finalAuthority,

        compliance_type:
          finalComplianceType,

        frequency:
          finalFrequency,

        alert_days_before:
          finalAlertDays,

        status:
          finalStatus,
      };

      /*
       * Only add responsible_employee_id when supplied.
       * This prevents unnecessary NULL/schema issues.
       */

      if (responsibleEmployeeValue) {
        payload.responsible_employee_id =
          responsibleEmployeeValue;
      }

      console.log(
        "[ComplianceCalendar] Creating requirement:",
        {
          organizationId,
          name: finalName,
          description: finalDescription,
          jurisdiction: finalJurisdiction,
          authority: finalAuthority,
          complianceType:
            finalComplianceType,
          frequency:
            finalFrequency,
          responsibleEmployeeId:
            responsibleEmployeeValue,
          alertDaysBefore:
            finalAlertDays,
          status:
            finalStatus,
        },
      );

      /* =====================================================
         INSERT
      ===================================================== */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("compliance_requirements")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error(
          "================================================",
        );

        console.error(
          "[ComplianceCalendar] SUPABASE REQUIREMENT INSERT ERROR",
        );

        console.error(
          "message:",
          error.message,
        );

        console.error(
          "details:",
          error.details,
        );

        console.error(
          "hint:",
          error.hint,
        );

        console.error(
          "code:",
          error.code,
        );

        console.error(
          "payload:",
          payload,
        );

        console.error(
          "================================================",
        );

        return res.status(500).json({
          message:
            "Failed to create compliance requirement.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      console.log(
        "[ComplianceCalendar] Requirement created successfully:",
        data,
      );

      return res.status(201).json({
        message:
          "Compliance requirement created successfully.",
        requirement:
          data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Create requirement unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while creating compliance requirement.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   UPDATE COMPLIANCE REQUIREMENT

   PUT /api/compliance-calendar/requirements/:id
========================================================= */

router.put(
  "/requirements/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const requirementId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(requirementId)) {
        return res.status(400).json({
          message:
            "Invalid compliance requirement ID.",
        });
      }

      const {
        name,
        description,
        jurisdiction,
        authority,
        compliance_type,
        complianceType,
        frequency,
        responsible_employee_id,
        responsibleEmployeeId,
        alert_days_before,
        alertDaysBefore,
        status,
      } = req.body || {};

      const updatePayload = {};

      /* =====================================================
         NAME
      ===================================================== */

      if (name !== undefined) {
        const finalName =
          clean(name);

        if (!finalName) {
          return res.status(400).json({
            message:
              "Compliance requirement name cannot be empty.",
          });
        }

        updatePayload.name =
          finalName;
      }

      /* =====================================================
         DESCRIPTION
      ===================================================== */

      if (
        description !== undefined
      ) {
        updatePayload.description =
          optional(description);
      }

      /* =====================================================
         JURISDICTION
      ===================================================== */

      if (
        jurisdiction !== undefined
      ) {
        updatePayload.jurisdiction =
          optional(jurisdiction);
      }

      /* =====================================================
         AUTHORITY
      ===================================================== */

      if (
        authority !== undefined
      ) {
        updatePayload.authority =
          optional(authority);
      }

      /* =====================================================
         COMPLIANCE TYPE
      ===================================================== */

      if (
        compliance_type !==
          undefined ||
        complianceType !==
          undefined
      ) {
        const finalComplianceType =
          clean(
            compliance_type,
          ) ||
          clean(
            complianceType,
          );

        if (!finalComplianceType) {
          return res.status(400).json({
            message:
              "Compliance type cannot be empty.",
          });
        }

        updatePayload.compliance_type =
          finalComplianceType;
      }

      /* =====================================================
         FREQUENCY
      ===================================================== */

      if (
        frequency !== undefined
      ) {
        const finalFrequency =
          clean(frequency);

        if (!finalFrequency) {
          return res.status(400).json({
            message:
              "Frequency cannot be empty.",
          });
        }

        updatePayload.frequency =
          finalFrequency;
      }

      /* =====================================================
         RESPONSIBLE EMPLOYEE
      ===================================================== */

      if (
        responsible_employee_id !==
          undefined ||
        responsibleEmployeeId !==
          undefined
      ) {
        const finalEmployeeId =
          clean(
            responsible_employee_id,
          ) ||
          clean(
            responsibleEmployeeId,
          );

        if (
          finalEmployeeId &&
          !validUuid(
            finalEmployeeId,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid responsible employee ID.",
          });
        }

        updatePayload.responsible_employee_id =
          finalEmployeeId || null;

        if (finalEmployeeId) {
          const {
            data: employee,
            error: employeeError,
          } = await supabaseAdmin
            .from("employees")
            .select(
              "id, organization_id",
            )
            .eq(
              "id",
              finalEmployeeId,
            )
            .eq(
              "organization_id",
              organizationId,
            )
            .maybeSingle();

          if (employeeError) {
            console.warn(
              "[ComplianceCalendar] Employee validation warning:",
              employeeError.message,
            );
          } else if (!employee) {
            return res.status(400).json({
              message:
                "Responsible employee was not found in this organization.",
            });
          }
        }
      }

      /* =====================================================
         ALERT DAYS
      ===================================================== */

      if (
        alert_days_before !==
          undefined ||
        alertDaysBefore !==
          undefined
      ) {
        const rawAlertDays =
          alert_days_before !==
          undefined
            ? alert_days_before
            : alertDaysBefore;

        const alertDays =
          Number(rawAlertDays);

        if (
          !Number.isInteger(
            alertDays,
          ) ||
          alertDays < 0
        ) {
          return res.status(400).json({
            message:
              "Alert days before must be a non-negative whole number.",
          });
        }

        updatePayload.alert_days_before =
          alertDays;
      }

      /* =====================================================
         STATUS
      ===================================================== */

      if (
        status !== undefined
      ) {
        const normalizedStatus =
          clean(status).toLowerCase();

        if (
          !ALLOWED_REQUIREMENT_STATUSES.includes(
            normalizedStatus,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid compliance requirement status.",
          });
        }

        updatePayload.status =
          normalizedStatus;
      }

      /* =====================================================
         NO FIELDS
      ===================================================== */

      if (
        Object.keys(
          updatePayload,
        ).length === 0
      ) {
        return res.status(400).json({
          message:
            "No fields were provided for update.",
        });
      }

      /* =====================================================
         DUPLICATE NAME CHECK
      ===================================================== */

      if (
        updatePayload.name
      ) {
        const {
          data: duplicate,
          error: duplicateError,
        } = await supabaseAdmin
          .from(
            "compliance_requirements",
          )
          .select(
            "id, name",
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .ilike(
            "name",
            updatePayload.name,
          )
          .neq(
            "id",
            requirementId,
          )
          .limit(1)
          .maybeSingle();

        if (duplicateError) {
          console.error(
            "[ComplianceCalendar] Requirement duplicate check error:",
            duplicateError,
          );

          return res.status(500).json({
            message:
              "Failed to validate existing compliance requirements.",
            error:
              duplicateError.message,
            details:
              duplicateError.details ||
              null,
            hint:
              duplicateError.hint ||
              null,
            code:
              duplicateError.code ||
              null,
          });
        }

        if (duplicate) {
          return res.status(409).json({
            message:
              "Another compliance requirement with this name already exists.",
          });
        }
      }

      /* =====================================================
         UPDATE
      ===================================================== */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_requirements",
        )
        .update(
          updatePayload,
        )
        .eq(
          "id",
          requirementId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Update requirement error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to update compliance requirement.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance requirement not found.",
        });
      }

      return res.status(200).json({
        message:
          "Compliance requirement updated successfully.",
        requirement:
          data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Update requirement unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while updating compliance requirement.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   DELETE COMPLIANCE REQUIREMENT

   DELETE /api/compliance-calendar/requirements/:id

   We prevent deletion when deadlines reference it.
========================================================= */

router.delete(
  "/requirements/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const requirementId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(requirementId)) {
        return res.status(400).json({
          message:
            "Invalid compliance requirement ID.",
        });
      }

      /* =====================================================
         CHECK FOR RELATED DEADLINES
      ===================================================== */

      const {
        data: deadlines,
        error: deadlineError,
      } = await supabaseAdmin
        .from(
          "compliance_deadlines",
        )
        .select("id")
        .eq(
          "requirement_id",
          requirementId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .limit(1);

      if (deadlineError) {
        console.error(
          "[ComplianceCalendar] Requirement deadline lookup error:",
          deadlineError,
        );

        return res.status(500).json({
          message:
            "Failed to check related compliance deadlines.",
          error:
            deadlineError.message,
        });
      }

      if (
        deadlines &&
        deadlines.length > 0
      ) {
        return res.status(409).json({
          message:
            "This compliance requirement cannot be deleted because it has associated deadlines.",
        });
      }

      /* =====================================================
         DELETE
      ===================================================== */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_requirements",
        )
        .delete()
        .eq(
          "id",
          requirementId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Delete requirement error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to delete compliance requirement.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance requirement not found.",
        });
      }

      return res.status(200).json({
        message:
          "Compliance requirement deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Delete requirement unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while deleting compliance requirement.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   GET ONE COMPLIANCE DEADLINE

   GET /api/compliance-calendar/:id
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const deadlineId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(deadlineId)) {
        return res.status(400).json({
          message:
            "Invalid deadline ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_deadlines",
        )
        .select("*")
        .eq(
          "id",
          deadlineId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Fetch deadline error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to load compliance deadline.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance deadline not found.",
        });
      }

      return res.status(200).json({
        deadline:
          data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Single deadline unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while loading compliance deadline.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   CREATE COMPLIANCE DEADLINE

   POST /api/compliance-calendar
========================================================= */

router.post(
  "/",
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
        requirement_id,
        requirementId,
        title,
        due_date,
        dueDate,
        status,
        notes,
      } = req.body || {};

      const finalRequirementId =
        clean(requirement_id) ||
        clean(requirementId);

      const finalDueDate =
        clean(due_date) ||
        clean(dueDate);

      const finalTitle =
        clean(title);

      /* =====================================================
         REQUIREMENT
      ===================================================== */

      if (!finalRequirementId) {
        return res.status(400).json({
          message:
            "Requirement ID is required.",
        });
      }

      if (
        !validUuid(
          finalRequirementId,
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid requirement ID.",
        });
      }

      const {
        data: requirement,
        error: requirementError,
      } = await supabaseAdmin
        .from(
          "compliance_requirements",
        )
        .select(
          "id, organization_id, name, status",
        )
        .eq(
          "id",
          finalRequirementId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .maybeSingle();

      if (requirementError) {
        console.error(
          "[ComplianceCalendar] Requirement validation error:",
          requirementError,
        );

        return res.status(500).json({
          message:
            "Failed to validate compliance requirement.",
          error:
            requirementError.message,
          details:
            requirementError.details ||
            null,
          hint:
            requirementError.hint ||
            null,
          code:
            requirementError.code ||
            null,
        });
      }

      if (!requirement) {
        return res.status(400).json({
          message:
            "Selected compliance requirement does not belong to this organization.",
        });
      }

      /* =====================================================
         TITLE
      ===================================================== */

      if (!finalTitle) {
        return res.status(400).json({
          message:
            "Deadline title is required.",
        });
      }

      /* =====================================================
         DATE
      ===================================================== */

      if (!finalDueDate) {
        return res.status(400).json({
          message:
            "Due date is required.",
        });
      }

      const parsedDate =
        new Date(
          `${finalDueDate}T00:00:00`,
        );

      if (
        Number.isNaN(
          parsedDate.getTime(),
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid due date.",
        });
      }

      /* =====================================================
         STATUS
      ===================================================== */

      const normalizedStatus =
        clean(status).toLowerCase();

      const finalStatus =
        ALLOWED_STATUSES.includes(
          normalizedStatus,
        )
          ? normalizedStatus
          : "upcoming";

      /* =====================================================
         PAYLOAD
      ===================================================== */

      const payload = {
        organization_id:
          organizationId,

        requirement_id:
          finalRequirementId,

        title:
          finalTitle,

        due_date:
          finalDueDate,

        status:
          finalStatus,

        notes:
          optional(notes),

        created_by:
          req.user?.id || null,
      };

      console.log(
        "[ComplianceCalendar] Creating deadline:",
        payload,
      );

      /* =====================================================
         INSERT
      ===================================================== */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_deadlines",
        )
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error(
          "[ComplianceCalendar] Create deadline error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to create compliance deadline.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      return res.status(201).json({
        message:
          "Compliance deadline created successfully.",
        deadline:
          data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Create deadline unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while creating compliance deadline.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   UPDATE COMPLIANCE DEADLINE

   PUT /api/compliance-calendar/:id
========================================================= */

router.put(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const deadlineId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(deadlineId)) {
        return res.status(400).json({
          message:
            "Invalid deadline ID.",
        });
      }

      const {
        requirement_id,
        requirementId,
        title,
        due_date,
        dueDate,
        status,
        notes,
      } = req.body || {};

      const updatePayload = {};

      /* =====================================================
         REQUIREMENT
      ===================================================== */

      if (
        requirement_id !==
          undefined ||
        requirementId !==
          undefined
      ) {
        const finalRequirementId =
          clean(
            requirement_id,
          ) ||
          clean(
            requirementId,
          );

        if (
          !validUuid(
            finalRequirementId,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid requirement ID.",
          });
        }

        const {
          data: requirement,
          error: requirementError,
        } = await supabaseAdmin
          .from(
            "compliance_requirements",
          )
          .select("id")
          .eq(
            "id",
            finalRequirementId,
          )
          .eq(
            "organization_id",
            organizationId,
          )
          .maybeSingle();

        if (requirementError) {
          console.error(
            "[ComplianceCalendar] Requirement validation error:",
            requirementError,
          );

          return res.status(500).json({
            message:
              "Failed to validate compliance requirement.",
            error:
              requirementError.message,
          });
        }

        if (!requirement) {
          return res.status(400).json({
            message:
              "Selected compliance requirement does not belong to this organization.",
          });
        }

        updatePayload.requirement_id =
          finalRequirementId;
      }

      /* =====================================================
         TITLE
      ===================================================== */

      if (
        title !== undefined
      ) {
        const finalTitle =
          clean(title);

        if (!finalTitle) {
          return res.status(400).json({
            message:
              "Deadline title cannot be empty.",
          });
        }

        updatePayload.title =
          finalTitle;
      }

      /* =====================================================
         DUE DATE
      ===================================================== */

      if (
        due_date !==
          undefined ||
        dueDate !==
          undefined
      ) {
        const finalDueDate =
          clean(
            due_date,
          ) ||
          clean(
            dueDate,
          );

        if (!finalDueDate) {
          return res.status(400).json({
            message:
              "Due date cannot be empty.",
          });
        }

        const parsedDate =
          new Date(
            `${finalDueDate}T00:00:00`,
          );

        if (
          Number.isNaN(
            parsedDate.getTime(),
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid due date.",
          });
        }

        updatePayload.due_date =
          finalDueDate;
      }

      /* =====================================================
         STATUS
      ===================================================== */

      if (
        status !== undefined
      ) {
        const normalizedStatus =
          clean(status).toLowerCase();

        if (
          !ALLOWED_STATUSES.includes(
            normalizedStatus,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid compliance deadline status.",
          });
        }

        updatePayload.status =
          normalizedStatus;

        if (
          normalizedStatus ===
          "completed"
        ) {
          updatePayload.completed_at =
            new Date().toISOString();

          updatePayload.completed_by =
            req.user?.id || null;
        } else {
          updatePayload.completed_at =
            null;

          updatePayload.completed_by =
            null;
        }
      }

      /* =====================================================
         NOTES
      ===================================================== */

      if (
        notes !== undefined
      ) {
        updatePayload.notes =
          optional(notes);
      }

      /* =====================================================
         CHECK FIELDS
      ===================================================== */

      if (
        Object.keys(
          updatePayload,
        ).length === 0
      ) {
        return res.status(400).json({
          message:
            "No fields were provided for update.",
        });
      }

      /* =====================================================
         UPDATE
      ===================================================== */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_deadlines",
        )
        .update(
          updatePayload,
        )
        .eq(
          "id",
          deadlineId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("*")
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Update deadline error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to update compliance deadline.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance deadline not found.",
        });
      }

      return res.status(200).json({
        message:
          "Compliance deadline updated successfully.",
        deadline:
          data,
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Update deadline unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while updating compliance deadline.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   DELETE COMPLIANCE DEADLINE

   DELETE /api/compliance-calendar/:id
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const deadlineId =
        req.params.id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Organization could not be determined.",
        });
      }

      if (!validUuid(deadlineId)) {
        return res.status(400).json({
          message:
            "Invalid deadline ID.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "compliance_deadlines",
        )
        .delete()
        .eq(
          "id",
          deadlineId,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(
          "[ComplianceCalendar] Delete deadline error:",
          error,
        );

        return res.status(500).json({
          message:
            "Failed to delete compliance deadline.",
          error:
            error.message,
          details:
            error.details || null,
          hint:
            error.hint || null,
          code:
            error.code || null,
        });
      }

      if (!data) {
        return res.status(404).json({
          message:
            "Compliance deadline not found.",
        });
      }

      return res.status(200).json({
        message:
          "Compliance deadline deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[ComplianceCalendar] Delete deadline unexpected error:",
        error,
      );

      return res.status(500).json({
        message:
          "Unexpected error while deleting compliance deadline.",
        error:
          error.message,
      });
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;