import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

router.use(requireAuth);

function getOrganizationId(req) {
  return req.user?.organization_id;
}

/*
 * GET /api/hr-cases
 */
router.get("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization not found.",
      });
    }

    const { data, error } =
      await supabaseAdmin
        .from("hr_cases")
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
        "[HR Cases] GET error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load HR cases.",
        error: error.message,
      });
    }

    return res.json(data || []);
  } catch (error) {
    console.error(
      "[HR Cases] GET exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to load HR cases.",
    });
  }
});

/*
 * POST /api/hr-cases
 */
router.post("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization not found.",
      });
    }

    const {
      title,
      description,
      employeeName,
      employeeEmail,
      category,
      priority,
      assignedTo,
      dueDate,
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Case title is required.",
      });
    }

    if (!employeeName?.trim()) {
      return res.status(400).json({
        message:
          "Employee name is required.",
      });
    }

    const ticketNumber =
      `HR-${Date.now().toString().slice(-8)}`;

    const { data, error } =
      await supabaseAdmin
        .from("hr_cases")
        .insert({
          organization_id:
            organizationId,

          ticket_number:
            ticketNumber,

          title: title.trim(),

          description:
            description?.trim() || null,

          employee_name:
            employeeName.trim(),

          employee_email:
            employeeEmail?.trim() || null,

          category:
            category || "Other",

          priority:
            priority || "medium",

          status: "open",

          assigned_to:
            assignedTo?.trim() || null,

          due_date:
            dueDate || null,

          created_by:
            req.user?.id || null,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "[HR Cases] POST error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to create HR case.",
        error: error.message,
      });
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "[HR Cases] POST exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to create HR case.",
    });
  }
});

/*
 * PATCH /api/hr-cases/:id
 */
router.patch("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization not found.",
      });
    }

    const updates = {};

    if (req.body.status !== undefined) {
      updates.status =
        req.body.status;
    }

    if (
      req.body.priority !== undefined
    ) {
      updates.priority =
        req.body.priority;
    }

    if (
      req.body.assignedTo !== undefined
    ) {
      updates.assigned_to =
        req.body.assignedTo?.trim() ||
        null;
    }

    if (
      req.body.dueDate !== undefined
    ) {
      updates.due_date =
        req.body.dueDate || null;
    }

    if (
      req.body.description !== undefined
    ) {
      updates.description =
        req.body.description?.trim() ||
        null;
    }

    const { data, error } =
      await supabaseAdmin
        .from("hr_cases")
        .update(updates)
        .eq("id", req.params.id)
        .eq(
          "organization_id",
          organizationId
        )
        .select()
        .single();

    if (error) {
      console.error(
        "[HR Cases] PATCH error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to update HR case.",
        error: error.message,
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(
      "[HR Cases] PATCH exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to update HR case.",
    });
  }
});

/*
 * DELETE /api/hr-cases/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization not found.",
      });
    }

    const { error } =
      await supabaseAdmin
        .from("hr_cases")
        .delete()
        .eq("id", req.params.id)
        .eq(
          "organization_id",
          organizationId
        );

    if (error) {
      console.error(
        "[HR Cases] DELETE error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to delete HR case.",
        error: error.message,
      });
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[HR Cases] DELETE exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Failed to delete HR case.",
    });
  }
});

export default router;