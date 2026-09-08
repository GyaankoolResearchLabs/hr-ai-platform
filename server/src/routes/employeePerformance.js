import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
  updateEmployeeReview,
} from "../services/reviewCycleService.js";
import {
  updateGoalOrOkr,
} from "../services/goalOkrService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE PERFORMANCE
|--------------------------------------------------------------------------
|
| GET  /api/employee/performance/goals
| POST /api/employee/performance/goals/:id/progress
| GET  /api/employee/performance/reviews
| POST /api/employee/performance/reviews/:id/acknowledge
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| Nothing here duplicates existing performance logic:
|
| - Goals live in performance_goals (services/goalOkrService.js), the
|   same table + update() function routes/goalOkr.js (HR-side) uses.
|   updateGoalOrOkr() already normalizes progress/status; this route
|   only adds the employee-ownership check in front of it, mirroring
|   routes/employeeLearning.js's progress endpoint.
|
| - Reviews live in performance_review_cycles + performance_reviews
|   (services/reviewCycleService.js), the same tables + updateEmployeeReview()
|   function routes/reviewCycles.js (HR-side) uses for the pending ->
|   in_progress -> submitted -> acknowledged -> completed workflow.
|
| NOTE ON SELF-ASSESSMENT: the schema has a single rating/comments pair
| per review, filled in entirely by the manager/HR side (ReviewCycleManager.jsx)
| — there is no separate employee-authored assessment field to expose here.
| What IS employee-facing in that workflow is acknowledging a submitted
| review (submitted -> acknowledged), which updateEmployeeReview() already
| validates as a legal transition, so that's what POST .../acknowledge reuses.
| Rating/comments are only surfaced once a review reaches "submitted" or
| later, matching what ReviewCycleManager.jsx already reveals at that point.
|--------------------------------------------------------------------------
*/

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeePerformance]", error);

  return res.status(error?.statusCode || error?.status || 500).json({
    message: error?.message || fallbackMessage,
  });
}

const REVIEW_VISIBLE_STATUSES = ["submitted", "acknowledged", "completed"];

function serializeReview(review, cycle) {
  const isVisible = REVIEW_VISIBLE_STATUSES.includes(review.status);

  return {
    id: review.id,
    cycle_id: review.cycle_id,
    cycle_title: cycle?.title || null,
    cycle_review_type: cycle?.review_type || null,
    cycle_start_date: cycle?.start_date || null,
    cycle_due_date: cycle?.due_date || null,
    cycle_status: cycle?.status || null,
    status: review.status,
    rating: isVisible ? review.rating : null,
    comments: isVisible ? review.comments : null,
    submitted_at: review.submitted_at,
    created_at: review.created_at,
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/performance/goals
|--------------------------------------------------------------------------
*/

router.get("/goals", async (req, res) => {
  try {
    const employee = req.employee;

    const { data, error } = await supabaseAdmin
      .from("performance_goals")
      .select("*")
      .eq("organization_id", employee.organization_id)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ goals: data || [] });
  } catch (error) {
    return handleRouteError(res, error, "Could not load your goals.");
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/performance/goals/:id/progress
|--------------------------------------------------------------------------
| Body: { progress } (0-100)
|--------------------------------------------------------------------------
*/

router.post("/goals/:id/progress", async (req, res) => {
  try {
    const employee = req.employee;

    const { data: goal, error: goalError } = await supabaseAdmin
      .from("performance_goals")
      .select("id, employee_id")
      .eq("organization_id", employee.organization_id)
      .eq("id", req.params.id)
      .maybeSingle();

    if (goalError) {
      throw goalError;
    }

    if (!goal || goal.employee_id !== employee.id) {
      return res.status(404).json({
        message: "Goal not found.",
      });
    }

    const progress = Number(req.body?.progress);

    if (!Number.isFinite(progress)) {
      return res.status(400).json({
        message: "A valid progress value (0-100) is required.",
      });
    }

    const updated = await updateGoalOrOkr(
      employee.organization_id,
      goal.id,
      { progress }
    );

    return res.json({ goal: updated });
  } catch (error) {
    return handleRouteError(res, error, "Could not update goal progress.");
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/performance/reviews
|--------------------------------------------------------------------------
*/

router.get("/reviews", async (req, res) => {
  try {
    const employee = req.employee;

    const { data: reviews, error: reviewsError } = await supabaseAdmin
      .from("performance_reviews")
      .select("*")
      .eq("organization_id", employee.organization_id)
      .eq("employee_id", employee.id)
      .order("created_at", { ascending: false });

    if (reviewsError) {
      throw reviewsError;
    }

    if (!reviews || reviews.length === 0) {
      return res.json({ reviews: [] });
    }

    const cycleIds = [...new Set(reviews.map((review) => review.cycle_id))];

    const { data: cycles, error: cyclesError } = await supabaseAdmin
      .from("performance_review_cycles")
      .select("id, title, review_type, start_date, due_date, status")
      .eq("organization_id", employee.organization_id)
      .in("id", cycleIds);

    if (cyclesError) {
      throw cyclesError;
    }

    const cycleMap = new Map(
      (cycles || []).map((cycle) => [cycle.id, cycle])
    );

    const list = reviews.map((review) =>
      serializeReview(review, cycleMap.get(review.cycle_id) || null)
    );

    return res.json({ reviews: list });
  } catch (error) {
    return handleRouteError(res, error, "Could not load your reviews.");
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/performance/reviews/:id/acknowledge
|--------------------------------------------------------------------------
*/

router.post("/reviews/:id/acknowledge", async (req, res) => {
  try {
    const employee = req.employee;

    const { data: review, error: reviewError } = await supabaseAdmin
      .from("performance_reviews")
      .select("id, employee_id, cycle_id, status")
      .eq("organization_id", employee.organization_id)
      .eq("id", req.params.id)
      .maybeSingle();

    if (reviewError) {
      throw reviewError;
    }

    if (!review || review.employee_id !== employee.id) {
      return res.status(404).json({
        message: "Review not found.",
      });
    }

    if (review.status !== "submitted") {
      return res.status(400).json({
        message:
          "This review cannot be acknowledged in its current state.",
      });
    }

    const updated = await updateEmployeeReview(
      employee.organization_id,
      review.cycle_id,
      review.id,
      { status: "acknowledged" }
    );

    const { data: cycle } = await supabaseAdmin
      .from("performance_review_cycles")
      .select("id, title, review_type, start_date, due_date, status")
      .eq("organization_id", employee.organization_id)
      .eq("id", review.cycle_id)
      .maybeSingle();

    return res.json({ review: serializeReview(updated, cycle) });
  } catch (error) {
    return handleRouteError(res, error, "Could not acknowledge review.");
  }
});

export default router;
