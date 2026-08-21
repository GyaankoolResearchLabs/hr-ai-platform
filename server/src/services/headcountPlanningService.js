import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDepartment(value) {
  const department = String(value ?? "").trim();

  if (!department) {
    throw createServiceError(
      "Department/team is required.",
      400,
    );
  }

  return department;
}

function normalizePlanningPeriod(value) {
  const period = String(value ?? "").trim();

  if (!period) {
    throw createServiceError(
      "Planning period is required.",
      400,
    );
  }

  return period;
}

function normalizeTargetHeadcount(value) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    throw createServiceError(
      "Target headcount must be a non-negative whole number.",
      400,
    );
  }

  return number;
}

function normalizeStatus(value) {
  const status = String(
    value ?? "Planned",
  ).trim();

  const allowedStatuses = [
    "Planned",
    "Active",
    "Completed",
    "Cancelled",
  ];

  if (!allowedStatuses.includes(status)) {
    throw createServiceError(
      `Invalid status. Use: ${allowedStatuses.join(", ")}.`,
      400,
    );
  }

  return status;
}

/* =========================================================
   GET CURRENT HEADCOUNT BY DEPARTMENT
========================================================= */

async function getCurrentHeadcountByDepartment(
  organizationId,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select("department")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "employment_status",
      "Active",
    );

  if (error) {
    console.error(
      "[Headcount Planning Service] Employee headcount lookup:",
      error,
    );

    throw error;
  }

  const counts = {};

  for (const employee of data || []) {
    const department = String(
      employee.department ?? "",
    ).trim();

    if (!department) {
      continue;
    }

    counts[department] =
      (counts[department] || 0) + 1;
  }

  return counts;
}

/* =========================================================
   GET ALL HEADCOUNT PLANS
========================================================= */

export async function getHeadcountPlans(
  organizationId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const [
    { data: plans, error: plansError },
    currentHeadcount,
  ] = await Promise.all([
    supabaseAdmin
      .from("headcount_plans")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order("created_at", {
        ascending: false,
      }),

    getCurrentHeadcountByDepartment(
      organizationId,
    ),
  ]);

  if (plansError) {
    console.error(
      "[Headcount Planning Service] GET ALL:",
      plansError,
    );

    throw plansError;
  }

  return (plans || []).map((plan) => {
    const current =
      currentHeadcount[
        String(plan.department).trim()
      ] || 0;

    const target =
      Number(plan.target_headcount) || 0;

    return {
      ...plan,
      current_headcount: current,
      hiring_gap: Math.max(
        target - current,
        0,
      ),
      surplus: Math.max(
        current - target,
        0,
      ),
    };
  });
}

/* =========================================================
   GET SINGLE HEADCOUNT PLAN
========================================================= */

export async function getHeadcountPlan(
  organizationId,
  planId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!planId) {
    throw createServiceError(
      "Headcount plan ID is required.",
      400,
    );
  }

  const {
    data: plan,
    error,
  } = await supabaseAdmin
    .from("headcount_plans")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", planId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Headcount Planning Service] GET SINGLE:",
      error,
    );

    throw error;
  }

  if (!plan) {
    throw createServiceError(
      "Headcount plan not found.",
      404,
    );
  }

  const currentHeadcount =
    await getCurrentHeadcountByDepartment(
      organizationId,
    );

  const current =
    currentHeadcount[
      String(plan.department).trim()
    ] || 0;

  const target =
    Number(plan.target_headcount) || 0;

  return {
    ...plan,
    current_headcount: current,
    hiring_gap: Math.max(
      target - current,
      0,
    ),
    surplus: Math.max(
      current - target,
      0,
    ),
  };
}

/* =========================================================
   CREATE HEADCOUNT PLAN
========================================================= */

export async function createHeadcountPlan({
  organizationId,
  department,
  planningPeriod,
  targetHeadcount,
  status,
  notes,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const cleanDepartment =
    normalizeDepartment(department);

  const cleanPlanningPeriod =
    normalizePlanningPeriod(
      planningPeriod,
    );

  const cleanTargetHeadcount =
    normalizeTargetHeadcount(
      targetHeadcount,
    );

  const cleanStatus =
    normalizeStatus(status);

  const cleanNotes =
    notes
      ? String(notes).trim()
      : null;

  /* -------------------------------------------------------
     CHECK DUPLICATE PLAN
  ------------------------------------------------------- */

  const {
    data: existingPlan,
    error: existingError,
  } = await supabaseAdmin
    .from("headcount_plans")
    .select("id")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "department",
      cleanDepartment,
    )
    .eq(
      "planning_period",
      cleanPlanningPeriod,
    )
    .maybeSingle();

  if (existingError) {
    console.error(
      "[Headcount Planning Service] Duplicate lookup:",
      existingError,
    );

    throw existingError;
  }

  if (existingPlan) {
    throw createServiceError(
      "A headcount plan already exists for this team and planning period.",
      409,
    );
  }

  /* -------------------------------------------------------
     CREATE
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("headcount_plans")
    .insert({
      organization_id:
        organizationId,

      department:
        cleanDepartment,

      planning_period:
        cleanPlanningPeriod,

      target_headcount:
        cleanTargetHeadcount,

      status:
        cleanStatus,

      notes:
        cleanNotes,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Headcount Planning Service] CREATE:",
      error,
    );

    throw error;
  }

  return getHeadcountPlan(
    organizationId,
    data.id,
  );
}

/* =========================================================
   UPDATE HEADCOUNT PLAN
========================================================= */

export async function updateHeadcountPlan(
  organizationId,
  planId,
  updates,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!planId) {
    throw createServiceError(
      "Headcount plan ID is required.",
      400,
    );
  }

  /* -------------------------------------------------------
     VERIFY EXISTING PLAN
  ------------------------------------------------------- */

  const {
    data: existingPlan,
    error: existingError,
  } = await supabaseAdmin
    .from("headcount_plans")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", planId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[Headcount Planning Service] Existing plan lookup:",
      existingError,
    );

    throw existingError;
  }

  if (!existingPlan) {
    throw createServiceError(
      "Headcount plan not found.",
      404,
    );
  }

  /* -------------------------------------------------------
     ALLOWED FIELDS
  ------------------------------------------------------- */

  const cleanUpdates = {};

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "department",
    )
  ) {
    cleanUpdates.department =
      normalizeDepartment(
        updates.department,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "planning_period",
    )
  ) {
    cleanUpdates.planning_period =
      normalizePlanningPeriod(
        updates.planning_period,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "planningPeriod",
    )
  ) {
    cleanUpdates.planning_period =
      normalizePlanningPeriod(
        updates.planningPeriod,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "target_headcount",
    )
  ) {
    cleanUpdates.target_headcount =
      normalizeTargetHeadcount(
        updates.target_headcount,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "targetHeadcount",
    )
  ) {
    cleanUpdates.target_headcount =
      normalizeTargetHeadcount(
        updates.targetHeadcount,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "status",
    )
  ) {
    cleanUpdates.status =
      normalizeStatus(
        updates.status,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "notes",
    )
  ) {
    cleanUpdates.notes =
      updates.notes
        ? String(
            updates.notes,
          ).trim()
        : null;
  }

  if (
    Object.keys(cleanUpdates).length === 0
  ) {
    throw createServiceError(
      "No valid headcount plan updates were provided.",
      400,
    );
  }

  /* -------------------------------------------------------
     CHECK UNIQUE TEAM/PERIOD
  ------------------------------------------------------- */

  const nextDepartment =
    cleanUpdates.department ??
    existingPlan.department;

  const nextPeriod =
    cleanUpdates.planning_period ??
    existingPlan.planning_period;

  const {
    data: duplicatePlan,
    error: duplicateError,
  } = await supabaseAdmin
    .from("headcount_plans")
    .select("id")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "department",
      nextDepartment,
    )
    .eq(
      "planning_period",
      nextPeriod,
    )
    .neq("id", planId)
    .maybeSingle();

  if (duplicateError) {
    console.error(
      "[Headcount Planning Service] Duplicate update lookup:",
      duplicateError,
    );

    throw duplicateError;
  }

  if (duplicatePlan) {
    throw createServiceError(
      "A headcount plan already exists for this team and planning period.",
      409,
    );
  }

  /* -------------------------------------------------------
     UPDATE
  ------------------------------------------------------- */

  cleanUpdates.updated_at =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("headcount_plans")
    .update(cleanUpdates)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", planId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Headcount Planning Service] UPDATE:",
      error,
    );

    throw error;
  }

  return getHeadcountPlan(
    organizationId,
    data.id,
  );
}

/* =========================================================
   DELETE HEADCOUNT PLAN
========================================================= */

export async function deleteHeadcountPlan(
  organizationId,
  planId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!planId) {
    throw createServiceError(
      "Headcount plan ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("headcount_plans")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", planId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[Headcount Planning Service] DELETE:",
      error,
    );

    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Headcount plan not found.",
      404,
    );
  }

  return data;
}