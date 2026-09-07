import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getCourse } from "../services/learningService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE LEARNING
|--------------------------------------------------------------------------
|
| GET  /api/employee/learning
| GET  /api/employee/learning/:id
| POST /api/employee/learning/:id/progress
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| Course content comes from services/learningService.js's getCourse(),
| the same function routes/learning.js already uses — nothing here
| re-implements course/module/lesson assembly.
|
| Assignment + progress tracking itself (learning_course_assignments,
| learning_employee_course_progress) has no existing write path
| anywhere in the codebase to reuse: the HR-side training compliance
| routes only create and delete assignments, never update status or
| progress, and learning_employee_course_progress is read-only
| everywhere it currently appears. The status derivation below
| (completed / overdue / in_progress / not_started) mirrors exactly
| the logic TrainingComplianceTracker.jsx already uses client-side
| (normalizeStatus / getProgressValue / getCompletedAt), so an
| employee's progress here shows up identically on the HR side.
|--------------------------------------------------------------------------
*/

const STATUS_PRIORITY = {
  overdue: 0,
  in_progress: 1,
  not_started: 2,
  completed: 3,
};

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeeLearning]", error);

  return res.status(error?.statusCode || error?.status || 500).json({
    message: error?.message || fallbackMessage,
  });
}

function getProgressValue(progress) {
  const value = Number(progress?.progress_percentage ?? 0);

  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

function isPastDue(dueDate) {
  if (!dueDate) {
    return false;
  }

  const date = new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  date.setHours(23, 59, 59, 999);

  return date < new Date();
}

/*
 * Mirrors TrainingComplianceTracker.jsx's normalizeStatus() exactly,
 * so an employee's status here always agrees with what HR sees.
 */
function computeStatus(assignment, progress) {
  const progressValue = getProgressValue(progress);

  const completedAt =
    progress?.completed_at || assignment?.completed_at || null;

  if (progressValue >= 100 || completedAt) {
    return "completed";
  }

  if (isPastDue(assignment?.due_date)) {
    return "overdue";
  }

  if (progressValue > 0) {
    return "in_progress";
  }

  return "not_started";
}

function serializeListItem(assignment, course, progress) {
  const status = computeStatus(assignment, progress);

  return {
    id: assignment.id,
    course_id: assignment.course_id,
    title: course?.title || "Untitled Course",
    difficulty: course?.difficulty || null,
    estimated_duration_minutes:
      course?.estimated_duration_minutes || null,
    due_date: assignment.due_date,
    mandatory: assignment.mandatory ?? null,
    status,
    progress_percentage: getProgressValue(progress),
    assigned_at: assignment.assigned_at || assignment.created_at,
    started_at: progress?.started_at || assignment.started_at || null,
    completed_at: progress?.completed_at || assignment.completed_at || null,
  };
}

function belongsToEmployee(assignment, employeeId) {
  return assignment && assignment.employee_id === employeeId;
}

async function loadProgress(organizationId, employeeId, courseId) {
  const { data, error } = await supabaseAdmin
    .from("learning_employee_course_progress")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/learning
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const { data: assignments, error: assignmentsError } =
      await supabaseAdmin
        .from("learning_course_assignments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("employee_id", employee.id)
        .order("created_at", { ascending: false });

    if (assignmentsError) {
      throw assignmentsError;
    }

    if (!assignments || assignments.length === 0) {
      return res.json({ assignments: [] });
    }

    const courseIds = [
      ...new Set(assignments.map((a) => a.course_id)),
    ];

    const [{ data: courses, error: coursesError }, progressRows] =
      await Promise.all([
        supabaseAdmin
          .from("learning_courses")
          .select(
            "id, title, description, difficulty, estimated_duration_minutes"
          )
          .eq("organization_id", organizationId)
          .in("id", courseIds),

        supabaseAdmin
          .from("learning_employee_course_progress")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("employee_id", employee.id)
          .in("course_id", courseIds),
      ]);

    if (coursesError) {
      throw coursesError;
    }

    if (progressRows.error) {
      throw progressRows.error;
    }

    const courseMap = new Map(
      (courses || []).map((course) => [course.id, course])
    );

    const progressMap = new Map(
      (progressRows.data || []).map((progress) => [
        progress.course_id,
        progress,
      ])
    );

    const list = assignments
      .map((assignment) =>
        serializeListItem(
          assignment,
          courseMap.get(assignment.course_id) || null,
          progressMap.get(assignment.course_id) || null
        )
      )
      .sort((a, b) => {
        const priorityDiff =
          STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        if (a.due_date && b.due_date) {
          return new Date(a.due_date) - new Date(b.due_date);
        }

        if (a.due_date) {
          return -1;
        }

        if (b.due_date) {
          return 1;
        }

        return new Date(b.assigned_at) - new Date(a.assigned_at);
      });

    return res.json({ assignments: list });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load assigned courses."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/learning/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const { data: assignment, error: assignmentError } =
      await supabaseAdmin
        .from("learning_course_assignments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", req.params.id)
        .maybeSingle();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!belongsToEmployee(assignment, employee.id)) {
      return res.status(404).json({
        message: "Assigned course not found.",
      });
    }

    const course = await getCourse(
      organizationId,
      assignment.course_id
    );

    const progress = await loadProgress(
      organizationId,
      employee.id,
      assignment.course_id
    );

    return res.json({
      assignment: {
        id: assignment.id,
        due_date: assignment.due_date,
        mandatory: assignment.mandatory ?? null,
        assigned_at: assignment.assigned_at || assignment.created_at,
      },
      course,
      progress: {
        progress_percentage: getProgressValue(progress),
        started_at: progress?.started_at || assignment.started_at || null,
        completed_at:
          progress?.completed_at || assignment.completed_at || null,
      },
      status: computeStatus(assignment, progress),
    });
  } catch (error) {
    if (error?.statusCode === 404 || error?.status === 404) {
      return res.status(404).json({
        message: "Assigned course not found.",
      });
    }

    return handleRouteError(
      res,
      error,
      "Could not load assigned course."
    );
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/learning/:id/progress
|--------------------------------------------------------------------------
| Body: { progress_percentage } (0-100), or { mark_complete: true } as
| a shortcut for progress_percentage: 100.
|--------------------------------------------------------------------------
*/

router.post("/:id/progress", async (req, res) => {
  try {
    const employee = req.employee;
    const organizationId = employee.organization_id;

    const { data: assignment, error: assignmentError } =
      await supabaseAdmin
        .from("learning_course_assignments")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", req.params.id)
        .maybeSingle();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!belongsToEmployee(assignment, employee.id)) {
      return res.status(404).json({
        message: "Assigned course not found.",
      });
    }

    const body = req.body || {};

    const rawPercentage = body.mark_complete
      ? 100
      : Number(body.progress_percentage);

    if (!Number.isFinite(rawPercentage)) {
      return res.status(400).json({
        message: "A valid progress_percentage (0-100) is required.",
      });
    }

    const progressPercentage = Math.min(
      100,
      Math.max(0, Math.round(rawPercentage))
    );

    const existingProgress = await loadProgress(
      organizationId,
      employee.id,
      assignment.course_id
    );

    const now = new Date().toISOString();

    const startedAt =
      existingProgress?.started_at ||
      assignment.started_at ||
      (progressPercentage > 0 ? now : null);

    const completedAt =
      progressPercentage >= 100
        ? existingProgress?.completed_at || now
        : null;

    const progressPayload = {
      organization_id: organizationId,
      employee_id: employee.id,
      course_id: assignment.course_id,
      assignment_id: assignment.id,
      progress_percentage: progressPercentage,
      started_at: startedAt,
      completed_at: completedAt,
      updated_at: now,
    };

    let progress;

    if (existingProgress) {
      const { data, error } = await supabaseAdmin
        .from("learning_employee_course_progress")
        .update(progressPayload)
        .eq("organization_id", organizationId)
        .eq("id", existingProgress.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      progress = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("learning_employee_course_progress")
        .insert(progressPayload)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      progress = data;
    }

    /*
     * Keep learning_course_assignments in sync too (status,
     * started_at, completed_at) — not read by the status
     * derivation above (which prefers the progress record), but
     * it's a real column other consumers may read directly.
     */

    const assignmentStatus =
      progressPercentage >= 100
        ? "completed"
        : progressPercentage > 0
          ? "in_progress"
          : assignment.status || "assigned";

    const { data: updatedAssignment, error: updateError } =
      await supabaseAdmin
        .from("learning_course_assignments")
        .update({
          status: assignmentStatus,
          started_at: startedAt,
          completed_at: completedAt,
          updated_at: now,
        })
        .eq("organization_id", organizationId)
        .eq("id", assignment.id)
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    console.log(
      "[EmployeeLearning] Progress updated:",
      {
        employeeId: employee.id,
        assignmentId: assignment.id,
        progressPercentage,
      }
    );

    return res.json({
      assignment: {
        id: updatedAssignment.id,
        due_date: updatedAssignment.due_date,
        mandatory: updatedAssignment.mandatory ?? null,
        assigned_at:
          updatedAssignment.assigned_at || updatedAssignment.created_at,
      },
      progress: {
        progress_percentage: getProgressValue(progress),
        started_at: progress.started_at,
        completed_at: progress.completed_at,
      },
      status: computeStatus(updatedAssignment, progress),
    });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not update course progress."
    );
  }
});

export default router;
