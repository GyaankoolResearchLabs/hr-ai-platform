import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createServiceError(
  message,
  statusCode = 500,
) {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
}

function normalizeProgress(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, number),
  );
}

/* =========================================================
   GET ALL GOALS / OKRS
========================================================= */

export async function getGoalsAndOkrs(
  organizationId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("performance_goals")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "[GoalOKR Service] GET ALL:",
      error,
    );

    throw error;
  }

  return data || [];
}

/* =========================================================
   GET SINGLE GOAL / OKR
========================================================= */

export async function getGoalOrOkr(
  organizationId,
  goalId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!goalId) {
    throw createServiceError(
      "Goal ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("performance_goals")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", goalId)
    .maybeSingle();

  if (error) {
    console.error(
      "[GoalOKR Service] GET SINGLE:",
      error,
    );

    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Goal or OKR not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   CREATE GOAL / OKR
========================================================= */

export async function createGoalOrOkr({
  organizationId,
  employeeId,
  title,
  description,
  type,
  category,
  startDate,
  dueDate,
  targetValue,
  unit,
  progress,
  status,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!employeeId) {
    throw createServiceError(
      "Employee is required.",
      400,
    );
  }

  if (!title?.trim()) {
    throw createServiceError(
      "Goal title is required.",
      400,
    );
  }

  /* -------------------------------------------------------
     VERIFY EMPLOYEE BELONGS TO ORGANIZATION
  ------------------------------------------------------- */

  const {
    data: employee,
    error: employeeError,
  } = await supabaseAdmin
    .from("employees")
    .select("id")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", employeeId)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "[GoalOKR Service] Employee lookup:",
      employeeError,
    );

    throw employeeError;
  }

  if (!employee) {
    throw createServiceError(
      "Selected employee does not belong to this organization.",
      400,
    );
  }

  /* -------------------------------------------------------
     NORMALIZE VALUES
  ------------------------------------------------------- */

  const finalProgress =
    normalizeProgress(progress);

  let finalStatus =
    status || "not_started";

  if (finalProgress === 100) {
    finalStatus = "completed";
  } else if (
    finalProgress > 0 &&
    finalStatus === "not_started"
  ) {
    finalStatus = "in_progress";
  }

  let finalTargetValue = null;

  if (
    targetValue !== null &&
    targetValue !== undefined &&
    targetValue !== ""
  ) {
    const number =
      Number(targetValue);

    if (
      !Number.isFinite(number)
    ) {
      throw createServiceError(
        "Target value must be a valid number.",
        400,
      );
    }

    finalTargetValue =
      number;
  }

  /* -------------------------------------------------------
     CREATE
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("performance_goals")
    .insert({
      organization_id:
        organizationId,

      employee_id:
        employeeId,

      title:
        title.trim(),

      description:
        description || null,

      type:
        type || "goal",

      category:
        category || null,

      start_date:
        startDate || null,

      due_date:
        dueDate || null,

      target_value:
        finalTargetValue,

      unit:
        unit || null,

      progress:
        finalProgress,

      status:
        finalStatus,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "[GoalOKR Service] CREATE:",
      error,
    );

    throw error;
  }

  return data;
}

/* =========================================================
   UPDATE GOAL / OKR
========================================================= */

export async function updateGoalOrOkr(
  organizationId,
  goalId,
  updates,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!goalId) {
    throw createServiceError(
      "Goal ID is required.",
      400,
    );
  }

  /* -------------------------------------------------------
     VERIFY GOAL BELONGS TO ORGANIZATION
  ------------------------------------------------------- */

  const {
    data: existingGoal,
    error: existingError,
  } = await supabaseAdmin
    .from("performance_goals")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", goalId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[GoalOKR Service] Existing goal lookup:",
      existingError,
    );

    throw existingError;
  }

  if (!existingGoal) {
    throw createServiceError(
      "Goal or OKR not found.",
      404,
    );
  }

  /* -------------------------------------------------------
     ALLOWED FIELDS
  ------------------------------------------------------- */

  const allowedFields = [
    "employee_id",
    "title",
    "description",
    "type",
    "category",
    "start_date",
    "due_date",
    "target_value",
    "unit",
    "progress",
    "status",
  ];

  const cleanUpdates = {};

  for (
    const field of allowedFields
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field,
      )
    ) {
      cleanUpdates[field] =
        updates[field];
    }
  }

  if (
    Object.keys(cleanUpdates)
      .length === 0
  ) {
    throw createServiceError(
      "No valid goal updates were provided.",
      400,
    );
  }

  /* -------------------------------------------------------
     VERIFY NEW EMPLOYEE
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "employee_id",
    )
  ) {
    const {
      data: employee,
      error: employeeError,
    } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        cleanUpdates.employee_id,
      )
      .maybeSingle();

    if (employeeError) {
      throw employeeError;
    }

    if (!employee) {
      throw createServiceError(
        "Selected employee does not belong to this organization.",
        400,
      );
    }
  }

  /* -------------------------------------------------------
     NORMALIZE PROGRESS
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "progress",
    )
  ) {
    cleanUpdates.progress =
      normalizeProgress(
        cleanUpdates.progress,
      );

    if (
      cleanUpdates.progress ===
      100
    ) {
      cleanUpdates.status =
        "completed";
    } else if (
      cleanUpdates.progress > 0 &&
      !cleanUpdates.status
    ) {
      cleanUpdates.status =
        "in_progress";
    }
  }

  /* -------------------------------------------------------
     NORMALIZE TARGET VALUE
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "target_value",
    )
  ) {
    if (
      cleanUpdates.target_value ===
        null ||
      cleanUpdates.target_value ===
        ""
    ) {
      cleanUpdates.target_value =
        null;
    } else {
      const number =
        Number(
          cleanUpdates.target_value,
        );

      if (
        !Number.isFinite(number)
      ) {
        throw createServiceError(
          "Target value must be a valid number.",
          400,
        );
      }

      cleanUpdates.target_value =
        number;
    }
  }

  /* -------------------------------------------------------
     UPDATE
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("performance_goals")
    .update(cleanUpdates)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", goalId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "[GoalOKR Service] UPDATE:",
      error,
    );

    throw error;
  }

  return data;
}

/* =========================================================
   DELETE GOAL / OKR
========================================================= */

export async function deleteGoalOrOkr(
  organizationId,
  goalId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!goalId) {
    throw createServiceError(
      "Goal ID is required.",
      400,
    );
  }

  /* -------------------------------------------------------
     DELETE ONLY WITHIN USER'S ORGANIZATION
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("performance_goals")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", goalId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "[GoalOKR Service] DELETE:",
      error,
    );

    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Goal or OKR not found.",
      404,
    );
  }

  return data;
}