import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

router.use(requireAuth);

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(req.user.id);

    if (!organization?.id) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;
    next();
  } catch (error) {
    console.error(
      "[TrainingCompliance] Organization lookup failed:",
      error
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

function cleanId(value) {
  return value ? String(value).trim() : "";
}

function extractDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/*
|--------------------------------------------------------------------------
| GET /api/training-compliance
|--------------------------------------------------------------------------
| Loads everything required by the compliance tracker.
|
| IMPORTANT:
| The browser does NOT directly query learning_course_assignments.
| Everything goes through the protected backend.
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  const organizationId = req.organization.id;

  try {
    const [
      employeesResult,
      coursesResult,
      assignmentsResult,
      progressResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("employees")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("learning_courses")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("learning_course_assignments")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("learning_employee_course_progress")
        .select("*")
        .eq("organization_id", organizationId)
        .order("updated_at", {
          ascending: false,
        }),
    ]);

    const firstError =
      employeesResult.error ||
      coursesResult.error ||
      assignmentsResult.error ||
      progressResult.error;

    if (firstError) {
      console.error(
        "[TrainingCompliance] Data load failed:",
        firstError
      );

      return res.status(500).json({
        message:
          firstError.message ||
          "Could not load training compliance data.",
        code: firstError.code || null,
        details: firstError.details || null,
      });
    }

    return res.json({
      organizationId,

      employees: employeesResult.data || [],

      courses: coursesResult.data || [],

      assignments: assignmentsResult.data || [],

      progress: progressResult.data || [],
    });
  } catch (error) {
    console.error(
      "[TrainingCompliance] Unexpected load error:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Could not load training compliance data.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/training-compliance/assignments
|--------------------------------------------------------------------------
|
| Creates an assignment.
|
| IMPORTANT:
| We intentionally DO NOT insert:
|
| - is_mandatory
| - status
| - assigned_by_user_id
|
| because your current database schema does not reliably contain all
| of those columns.
|
| The compliance tracker treats every assignment as mandatory.
|
|--------------------------------------------------------------------------
*/

router.post("/assignments", async (req, res) => {
  const organizationId = req.organization.id;

  try {
    const employeeId = cleanId(
      req.body?.employee_id ||
        req.body?.employeeId
    );

    const courseId = cleanId(
      req.body?.course_id ||
        req.body?.courseId
    );

    const dueDate = extractDate(
      req.body?.due_date ||
        req.body?.dueDate
    );

    if (!employeeId) {
      return res.status(400).json({
        message: "Employee is required.",
      });
    }

    if (!courseId) {
      return res.status(400).json({
        message: "Training course is required.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify employee
    |--------------------------------------------------------------------------
    */

    const employeeResult = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", employeeId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (employeeResult.error) {
      console.error(
        "[TrainingCompliance] Employee lookup failed:",
        employeeResult.error
      );

      return res.status(500).json({
        message:
          employeeResult.error.message ||
          "Could not verify employee.",
      });
    }

    if (!employeeResult.data) {
      return res.status(404).json({
        message:
          "Employee not found in your organization.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Verify course
    |--------------------------------------------------------------------------
    */

    const courseResult = await supabaseAdmin
      .from("learning_courses")
      .select("*")
      .eq("id", courseId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (courseResult.error) {
      console.error(
        "[TrainingCompliance] Course lookup failed:",
        courseResult.error
      );

      return res.status(500).json({
        message:
          courseResult.error.message ||
          "Could not verify training course.",
      });
    }

    if (!courseResult.data) {
      return res.status(404).json({
        message:
          "Training course not found in your organization.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Duplicate check
    |--------------------------------------------------------------------------
    */

    const existingResult = await supabaseAdmin
      .from("learning_course_assignments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("employee_id", employeeId)
      .eq("course_id", courseId)
      .limit(1);

    if (existingResult.error) {
      console.error(
        "[TrainingCompliance] Duplicate check failed:",
        existingResult.error
      );

      return res.status(500).json({
        message:
          existingResult.error.message ||
          "Could not check existing assignment.",
      });
    }

    const existing =
      existingResult.data?.[0] || null;

    if (existing) {
      return res.status(409).json({
        message:
          "This course is already assigned to this employee.",
        assignment: {
          ...existing,
          employee: employeeResult.data,
          course: courseResult.data,
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | INSERT
    |--------------------------------------------------------------------------
    |
    | ONLY use the columns that are known to exist.
    |
    */

    const insertPayload = {
      organization_id: organizationId,
      employee_id: employeeId,
      course_id: courseId,
    };

    const insertResult = await supabaseAdmin
      .from("learning_course_assignments")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insertResult.error) {
      console.error(
        "[TrainingCompliance] Assignment insert failed:",
        insertResult.error
      );

      return res.status(500).json({
        message:
          insertResult.error.message ||
          "Could not create the training assignment.",

        code:
          insertResult.error.code || null,

        details:
          insertResult.error.details || null,

        hint:
          insertResult.error.hint || null,
      });
    }

    let assignment = insertResult.data;

    /*
    |--------------------------------------------------------------------------
    | OPTIONAL DUE DATE
    |--------------------------------------------------------------------------
    |
    | Your current schema may or may not contain due_date.
    |
    | We attempt to save it if supplied.
    |
    | If the column doesn't exist, the assignment itself remains valid.
    |
    */

    if (dueDate && assignment?.id) {
      const dueDateUpdate = await supabaseAdmin
        .from("learning_course_assignments")
        .update({
          due_date: dueDate,
        })
        .eq("id", assignment.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();

      if (!dueDateUpdate.error) {
        assignment = dueDateUpdate.data;
      } else {
        console.warn(
          "[TrainingCompliance] due_date could not be saved:",
          dueDateUpdate.error.message
        );
      }
    }

    return res.status(201).json({
      message:
        "Training assigned successfully.",

      assignment: {
        ...assignment,

        employee:
          employeeResult.data,

        course:
          courseResult.data,

        /*
         * Every assignment in this tool is treated as mandatory.
         * This is application logic, not a database column.
         */
        is_mandatory: true,
      },
    });
  } catch (error) {
    console.error(
      "[TrainingCompliance] Assignment creation failed:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Could not create the training assignment.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE /api/training-compliance/assignments/:id
|--------------------------------------------------------------------------
*/

router.delete(
  "/assignments/:id",
  async (req, res) => {
    const organizationId =
      req.organization.id;

    const assignmentId =
      cleanId(req.params.id);

    if (!assignmentId) {
      return res.status(400).json({
        message: "Assignment ID is required.",
      });
    }

    try {
      const findResult =
        await supabaseAdmin
          .from("learning_course_assignments")
          .select("id")
          .eq("id", assignmentId)
          .eq(
            "organization_id",
            organizationId
          )
          .maybeSingle();

      if (findResult.error) {
        throw findResult.error;
      }

      if (!findResult.data) {
        return res.status(404).json({
          message:
            "Training assignment not found.",
        });
      }

      const deleteResult =
        await supabaseAdmin
          .from("learning_course_assignments")
          .delete()
          .eq("id", assignmentId)
          .eq(
            "organization_id",
            organizationId
          );

      if (deleteResult.error) {
        throw deleteResult.error;
      }

      return res.json({
        message:
          "Training assignment removed successfully.",
      });
    } catch (error) {
      console.error(
        "[TrainingCompliance] Assignment deletion failed:",
        error
      );

      return res.status(500).json({
        message:
          error?.message ||
          "Could not remove the training assignment.",
      });
    }
  }
);

export default router;