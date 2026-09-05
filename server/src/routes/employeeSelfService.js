import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

const EMPLOYEE_EDITABLE_STATUSES = [
  "submitted",
  "open",
];

const PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
];

function clean(value) {
  return String(value ?? "").trim();
}

function normalizePriority(value) {
  const priority = clean(value).toLowerCase();

  return PRIORITIES.includes(priority)
    ? priority
    : "normal";
}

function normalizeEmployeeRequest(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    request_type: row.category || "general",
    requestType: row.category || "general",
    subject: row.title || "",
    requester_id: row.requested_by,
    ticket_number:
      row.ticket_number ||
      (row.id
        ? `REQ-${String(row.id).slice(0, 8).toUpperCase()}`
        : null),
    hr_notes: row.resolution_note || null,
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/employee-self-service
|--------------------------------------------------------------------------
| Returns requests created by the currently authenticated employee.
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("hr_requests")
      .select("*")
      .eq("organization_id", organization.id)
      .eq("requested_by", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("[EmployeeSelfService] GET error:", error);

      return res.status(500).json({
        message: "Failed to load employee requests.",
        detail: error.message,
      });
    }

    return res.json((data || []).map(normalizeEmployeeRequest));
  } catch (error) {
    console.error("[EmployeeSelfService] GET exception:", error);

    return res.status(500).json({
      message:
        error.message || "Failed to load employee requests.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee-self-service
|--------------------------------------------------------------------------
| Creates a new employee HR request.
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    const {
      requestType,
      subject,
      description,
      priority,
    } = req.body || {};

    /*
    |--------------------------------------------------------------------------
    | Validate request
    |--------------------------------------------------------------------------
    */

    if (!requestType?.trim()) {
      return res.status(400).json({
        message: "Request type is required.",
      });
    }

    if (!subject?.trim()) {
      return res.status(400).json({
        message: "Subject is required.",
      });
    }

    if (!description?.trim()) {
      return res.status(400).json({
        message: "Description is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Create request
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | requested_by = authenticated Supabase user
    | status       = submitted
    |
    | This uses the same hr_requests table consumed by the
    | HR Employee Request Tracker.
    |--------------------------------------------------------------------------
    */

    const { data, error } = await supabaseAdmin
      .from("hr_requests")
      .insert({
        organization_id: organization.id,
        requested_by: userId,
        category: requestType.trim().toLowerCase(),
        title: subject.trim(),
        description: description.trim(),
        priority: normalizePriority(priority),
        status: "submitted",
      })
      .select()
      .single();

    if (error) {
      console.error(
        "[EmployeeSelfService] POST error:",
        error
      );

      return res.status(500).json({
        message: "Failed to submit HR request.",
        detail: error.message,
      });
    }

    console.log(
      "[EmployeeSelfService] Request created:",
      data.id
    );

    return res.status(201).json(normalizeEmployeeRequest(data));
  } catch (error) {
    console.error(
      "[EmployeeSelfService] POST exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to submit HR request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee-self-service/:id
|--------------------------------------------------------------------------
| Returns one request belonging to the authenticated employee.
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("hr_requests")
      .select("*")
      .eq("id", req.params.id)
      .eq("organization_id", organization.id)
      .eq("requested_by", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[EmployeeSelfService] GET/:id error:",
        error
      );

      return res.status(500).json({
        message: "Failed to load request.",
        detail: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({
        message: "Request not found.",
      });
    }

    return res.json(normalizeEmployeeRequest(data));
  } catch (error) {
    console.error(
      "[EmployeeSelfService] GET/:id exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to load request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| PATCH /api/employee-self-service/:id
|--------------------------------------------------------------------------
| Employee can update an open request.
|--------------------------------------------------------------------------
*/

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    const {
      subject,
      description,
      priority,
    } = req.body || {};

    const updates = {
      updated_at: new Date().toISOString(),
    };

    if (subject !== undefined) {
      if (!subject?.trim()) {
        return res.status(400).json({
          message: "Subject cannot be empty.",
        });
      }

      updates.subject = subject.trim();
    }

    if (description !== undefined) {
      if (!description?.trim()) {
        return res.status(400).json({
          message: "Description cannot be empty.",
        });
      }

      updates.description = description.trim();
    }

    if (priority !== undefined) {
      updates.priority = normalizePriority(priority);
    }

    const { data, error } = await supabaseAdmin
      .from("hr_requests")
      .update(updates)
      .eq("id", req.params.id)
      .eq("organization_id", organization.id)
      .eq("requested_by", userId)
      .in("status", EMPLOYEE_EDITABLE_STATUSES)
      .select()
      .single();

    if (error) {
      console.error(
        "[EmployeeSelfService] PATCH error:",
        error
      );

      return res.status(500).json({
        message: "Failed to update request.",
        detail: error.message,
      });
    }

    return res.json(normalizeEmployeeRequest(data));
  } catch (error) {
    console.error(
      "[EmployeeSelfService] PATCH exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to update request.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE /api/employee-self-service/:id
|--------------------------------------------------------------------------
| Employee can delete an open request.
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organization = await getOrganizationForUser(userId);

    if (!organization) {
      return res.status(404).json({
        message: "Organization not found.",
      });
    }

    const { error } = await supabaseAdmin
      .from("hr_requests")
      .delete()
      .eq("id", req.params.id)
      .eq("organization_id", organization.id)
      .eq("requested_by", userId)
      .in("status", EMPLOYEE_EDITABLE_STATUSES);

    if (error) {
      console.error(
        "[EmployeeSelfService] DELETE error:",
        error
      );

      return res.status(500).json({
        message: "Failed to delete request.",
        detail: error.message,
      });
    }

    return res.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[EmployeeSelfService] DELETE exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to delete request.",
    });
  }
});

export default router;
