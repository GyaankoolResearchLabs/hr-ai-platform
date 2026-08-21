import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

/* =========================================================
   ORGANIZATION CHECK
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error(
      "Comp review cycle organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   GET ALL COMPENSATION REVIEW CYCLES
   GET /api/comp-review-cycles
========================================================= */

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("*")
      .eq(
        "organization_id",
        req.organization.id,
      )
      .order("review_year", {
        ascending: false,
      })
      .order("start_date", {
        ascending: false,
      });

    if (error) {
      console.error(
        "Load comp review cycles error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load compensation review cycles",
        detail: error.message,
      });
    }

    const cycles = (data || []).map((cycle) => ({
      ...cycle,
      employee_count: 0,
    }));

    return res.json(cycles);
  } catch (error) {
    console.error(
      "Comp review cycles GET error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not load compensation review cycles",
    });
  }
});

/* =========================================================
   GET SINGLE COMPENSATION REVIEW CYCLE
   GET /api/comp-review-cycles/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("*")
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      )
      .maybeSingle();

    if (error) {
      console.error(
        "Load comp review cycle error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load compensation review cycle",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message:
          "Compensation review cycle not found",
      });
    }

    return res.json({
      ...data,
      employee_count: 0,
    });
  } catch (error) {
    console.error(
      "Comp review cycle GET by ID error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not load compensation review cycle",
    });
  }
});

/* =========================================================
   CREATE COMPENSATION REVIEW CYCLE
   POST /api/comp-review-cycles
========================================================= */

router.post("/", async (req, res) => {
  try {
    const {
      name,
      review_year,
      start_date,
      end_date,
      effective_date,
      status,
      description,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Cycle name is required",
      });
    }

    const year = Number(review_year);

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return res.status(400).json({
        message:
          "Review year must be a valid year",
      });
    }

    if (!start_date) {
      return res.status(400).json({
        message: "Start date is required",
      });
    }

    if (!end_date) {
      return res.status(400).json({
        message: "End date is required",
      });
    }

    if (end_date < start_date) {
      return res.status(400).json({
        message:
          "End date must be on or after the start date",
      });
    }

    if (
      effective_date &&
      effective_date < end_date
    ) {
      return res.status(400).json({
        message:
          "Effective date should be on or after the review end date",
      });
    }

    const allowedStatuses = [
      "draft",
      "active",
      "completed",
      "cancelled",
    ];

    const normalizedStatus =
      status || "draft";

    if (
      !allowedStatuses.includes(
        normalizedStatus,
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid compensation review cycle status",
      });
    }

    /* -----------------------------------------------------
       PREVENT DUPLICATE CYCLE NAMES
       WITHIN THE SAME ORGANIZATION
    ----------------------------------------------------- */

    const {
      data: existingCycle,
      error: existingError,
    } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("id")
      .eq(
        "organization_id",
        req.organization.id,
      )
      .ilike(
        "name",
        name.trim(),
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Check duplicate comp review cycle error:",
        existingError,
      );

      return res.status(500).json({
        message:
          "Could not validate compensation review cycle",
        detail: existingError.message,
      });
    }

    if (existingCycle) {
      return res.status(409).json({
        message:
          "A compensation review cycle with this name already exists",
      });
    }

    /* -----------------------------------------------------
       CREATE
    ----------------------------------------------------- */

    const { data, error } = await supabaseAdmin
      .from("comp_review_cycles")
      .insert({
        organization_id:
          req.organization.id,

        name:
          name.trim(),

        review_year:
          year,

        start_date,

        end_date,

        effective_date:
          effective_date || null,

        status:
          normalizedStatus,

        description:
          description?.trim() || null,

        created_by:
          req.user.id,
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "Create comp review cycle error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create compensation review cycle",
        detail: error.message,
      });
    }

    return res.status(201).json({
      ...data,
      employee_count: 0,
    });
  } catch (error) {
    console.error(
      "Comp review cycle POST error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not create compensation review cycle",
    });
  }
});

/* =========================================================
   UPDATE COMPENSATION REVIEW CYCLE
   PUT /api/comp-review-cycles/:id
========================================================= */

router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      review_year,
      start_date,
      end_date,
      effective_date,
      status,
      description,
    } = req.body;

    /* -----------------------------------------------------
       VALIDATION
    ----------------------------------------------------- */

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Cycle name is required",
      });
    }

    const year = Number(review_year);

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return res.status(400).json({
        message:
          "Review year must be a valid year",
      });
    }

    if (!start_date || !end_date) {
      return res.status(400).json({
        message:
          "Start date and end date are required",
      });
    }

    if (end_date < start_date) {
      return res.status(400).json({
        message:
          "End date must be on or after the start date",
      });
    }

    if (
      effective_date &&
      effective_date < end_date
    ) {
      return res.status(400).json({
        message:
          "Effective date should be on or after the review end date",
      });
    }

    const allowedStatuses = [
      "draft",
      "active",
      "completed",
      "cancelled",
    ];

    const normalizedStatus =
      status || "draft";

    if (
      !allowedStatuses.includes(
        normalizedStatus,
      )
    ) {
      return res.status(400).json({
        message:
          "Invalid compensation review cycle status",
      });
    }

    /* -----------------------------------------------------
       VERIFY CYCLE EXISTS IN USER ORGANIZATION
    ----------------------------------------------------- */

    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("id")
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Find comp review cycle error:",
        existingError,
      );

      return res.status(500).json({
        message:
          "Could not find compensation review cycle",
        detail: existingError.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        message:
          "Compensation review cycle not found",
      });
    }

    /* -----------------------------------------------------
       PREVENT DUPLICATE NAMES
    ----------------------------------------------------- */

    const {
      data: duplicate,
      error: duplicateError,
    } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("id")
      .eq(
        "organization_id",
        req.organization.id,
      )
      .ilike(
        "name",
        name.trim(),
      )
      .neq("id", req.params.id)
      .maybeSingle();

    if (duplicateError) {
      console.error(
        "Check duplicate comp review cycle update error:",
        duplicateError,
      );

      return res.status(500).json({
        message:
          "Could not validate compensation review cycle",
        detail: duplicateError.message,
      });
    }

    if (duplicate) {
      return res.status(409).json({
        message:
          "Another compensation review cycle with this name already exists",
      });
    }

    /* -----------------------------------------------------
       UPDATE
    ----------------------------------------------------- */

    const { data, error } = await supabaseAdmin
      .from("comp_review_cycles")
      .update({
        name:
          name.trim(),

        review_year:
          year,

        start_date,

        end_date,

        effective_date:
          effective_date || null,

        status:
          normalizedStatus,

        description:
          description?.trim() || null,

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "Update comp review cycle error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not update compensation review cycle",
        detail: error.message,
      });
    }

    return res.json({
      ...data,
      employee_count: 0,
    });
  } catch (error) {
    console.error(
      "Comp review cycle PUT error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not update compensation review cycle",
    });
  }
});

/* =========================================================
   UPDATE CYCLE STATUS
   PATCH /api/comp-review-cycles/:id/status
========================================================= */

router.patch(
  "/:id/status",
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "draft",
        "active",
        "completed",
        "cancelled",
      ];

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          message:
            "Invalid compensation review cycle status",
        });
      }

      const {
        data: existing,
        error: existingError,
      } = await supabaseAdmin
        .from("comp_review_cycles")
        .select("id, status")
        .eq("id", req.params.id)
        .eq(
          "organization_id",
          req.organization.id,
        )
        .maybeSingle();

      if (existingError) {
        console.error(
          "Find cycle for status update error:",
          existingError,
        );

        return res.status(500).json({
          message:
            "Could not find compensation review cycle",
          detail: existingError.message,
        });
      }

      if (!existing) {
        return res.status(404).json({
          message:
            "Compensation review cycle not found",
        });
      }

      /* ---------------------------------------------------
         STATUS TRANSITION RULES
      --------------------------------------------------- */

      const validTransitions = {
        draft: [
          "draft",
          "active",
          "cancelled",
        ],
        active: [
          "active",
          "completed",
          "cancelled",
        ],
        completed: [
          "completed",
        ],
        cancelled: [
          "cancelled",
        ],
      };

      if (
        !validTransitions[
          existing.status
        ]?.includes(status)
      ) {
        return res.status(400).json({
          message:
            `Cannot change cycle status from ${existing.status} to ${status}`,
        });
      }

      const { data, error } =
        await supabaseAdmin
          .from("comp_review_cycles")
          .update({
            status,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            req.params.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .select("*")
          .single();

      if (error) {
        console.error(
          "Update comp review cycle status error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not update compensation review cycle status",
          detail: error.message,
        });
      }

      return res.json({
        ...data,
        employee_count: 0,
      });
    } catch (error) {
      console.error(
        "Comp review cycle PATCH status error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not update compensation review cycle status",
      });
    }
  },
);

/* =========================================================
   DELETE COMPENSATION REVIEW CYCLE
   DELETE /api/comp-review-cycles/:id
========================================================= */

router.delete("/:id", async (req, res) => {
  try {
    const {
      data: existing,
      error: existingError,
    } = await supabaseAdmin
      .from("comp_review_cycles")
      .select("id, status")
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      )
      .maybeSingle();

    if (existingError) {
      console.error(
        "Find cycle for deletion error:",
        existingError,
      );

      return res.status(500).json({
        message:
          "Could not find compensation review cycle",
        detail: existingError.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        message:
          "Compensation review cycle not found",
      });
    }

    if (
      existing.status === "active" ||
      existing.status === "completed"
    ) {
      return res.status(409).json({
        message:
          "Active or completed compensation review cycles cannot be deleted. Cancel the cycle instead.",
      });
    }

    const { error } = await supabaseAdmin
      .from("comp_review_cycles")
      .delete()
      .eq("id", req.params.id)
      .eq(
        "organization_id",
        req.organization.id,
      );

    if (error) {
      console.error(
        "Delete comp review cycle error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not delete compensation review cycle",
        detail: error.message,
      });
    }

    return res.json({
      message:
        "Compensation review cycle deleted successfully",
    });
  } catch (error) {
    console.error(
      "Comp review cycle DELETE error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not delete compensation review cycle",
    });
  }
});

export default router;