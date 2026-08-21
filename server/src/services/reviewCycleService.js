import { supabase } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeReviewType(value) {
  return value || "annual";
}

function normalizeEmployeeIds(employeeIds) {
  if (!Array.isArray(employeeIds)) {
    return [];
  }

  return [
    ...new Set(
      employeeIds
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  ];
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  return value;
}

function normalizeCycleStatus(value) {
  const status = String(value || "draft")
    .trim()
    .toLowerCase();

  const allowed = [
    "draft",
    "active",
    "completed",
  ];

  if (!allowed.includes(status)) {
    throw createServiceError(
      `Invalid review cycle status: ${status}`,
      400,
    );
  }

  return status;
}

function normalizeReviewStatus(value) {
  const status = String(value || "")
    .trim()
    .toLowerCase();

  const allowed = [
    "pending",
    "in_progress",
    "submitted",
    "acknowledged",
    "completed",
  ];

  if (!allowed.includes(status)) {
    throw createServiceError(
      `Invalid employee review status: ${status}`,
      400,
    );
  }

  return status;
}

/* =========================================================
   LOAD EMPLOYEES FOR REVIEWS
========================================================= */

async function getEmployeesForReviews(
  organizationId,
  reviews,
) {
  const employeeIds = [
    ...new Set(
      (reviews || [])
        .map((review) => review.employee_id)
        .filter(Boolean),
    ),
  ];

  if (!employeeIds.length) {
    return new Map();
  }

  const {
    data: employees,
    error,
  } = await supabase
    .from("employees")
    .select("*")
    .eq("organization_id", organizationId)
    .in("id", employeeIds);

  if (error) {
    console.error(
      "[ReviewCycles] Employee lookup failed:",
      error,
    );

    throw error;
  }

  return new Map(
    (employees || []).map((employee) => [
      String(employee.id),
      employee,
    ]),
  );
}

/* =========================================================
   BUILD CYCLE RESPONSE

   IMPORTANT:
   The frontend expects:
   - review_count
   - employee_count
   - completion_percent
   - pending_count
   - in_progress_count
   - submitted_count
   - acknowledged_count

   We provide ALL of them here.
========================================================= */

function buildCycleResponse(
  cycle,
  reviews,
  employeeMap = new Map(),
) {
  const safeReviews = Array.isArray(reviews)
    ? reviews
    : [];

  const enrichedReviews = safeReviews.map(
    (review) => ({
      ...review,
      employee:
        employeeMap.get(
          String(review.employee_id),
        ) || null,
    }),
  );

  const total = enrichedReviews.length;

  const pending = enrichedReviews.filter(
    (review) =>
      review.status === "pending",
  ).length;

  const inProgress =
    enrichedReviews.filter(
      (review) =>
        review.status === "in_progress",
    ).length;

  const submitted =
    enrichedReviews.filter(
      (review) =>
        review.status === "submitted",
    ).length;

  /*
   * Submitted is NOT acknowledged.
   *
   * This is important because a review must go:
   *
   * Pending
   * -> In progress
   * -> Submitted
   * -> Acknowledged
   *
   * Only acknowledged/completed reviews
   * count toward cycle completion.
   */
  const acknowledged =
    enrichedReviews.filter(
      (review) =>
        review.status === "acknowledged" ||
        review.status === "completed",
    ).length;

  const completed =
    enrichedReviews.filter(
      (review) =>
        review.status === "completed",
    ).length;

  const completionPercent =
    total === 0
      ? 0
      : Math.round(
          (acknowledged / total) * 100,
        );

  return {
    ...cycle,

    reviews: enrichedReviews,

    /*
     * Primary fields.
     */
    employee_count: total,
    review_count: total,
    total_reviews: total,

    /*
     * Progress counters.
     */
    pending_count: pending,
    in_progress_count: inProgress,
    submitted_count: submitted,
    acknowledged_count: acknowledged,
    completed_count: completed,

    /*
     * Compatibility fields.
     */
    completion_percent:
      completionPercent,

    completion_percentage:
      completionPercent,

    progress:
      completionPercent,
  };
}

/* =========================================================
   GET ALL REVIEW CYCLES
========================================================= */

export async function getReviewCycles(
  organizationId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  const {
    data: cycles,
    error: cycleError,
  } = await supabase
    .from("performance_review_cycles")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .order("created_at", {
      ascending: false,
    });

  if (cycleError) {
    console.error(
      "[ReviewCycles] Failed to load cycles:",
      cycleError,
    );

    throw cycleError;
  }

  if (!cycles?.length) {
    return [];
  }

  const cycleIds =
    cycles.map((cycle) => cycle.id);

  const {
    data: reviews,
    error: reviewError,
  } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .in("cycle_id", cycleIds)
    .order("created_at", {
      ascending: true,
    });

  if (reviewError) {
    console.error(
      "[ReviewCycles] Failed to load reviews:",
      reviewError,
    );

    throw reviewError;
  }

  const employeeMap =
    await getEmployeesForReviews(
      organizationId,
      reviews || [],
    );

  const reviewsByCycle = new Map();

  for (const review of reviews || []) {
    if (
      !reviewsByCycle.has(
        review.cycle_id,
      )
    ) {
      reviewsByCycle.set(
        review.cycle_id,
        [],
      );
    }

    reviewsByCycle
      .get(review.cycle_id)
      .push(review);
  }

  return cycles.map((cycle) =>
    buildCycleResponse(
      cycle,
      reviewsByCycle.get(cycle.id) ||
        [],
      employeeMap,
    ),
  );
}

/* =========================================================
   GET SINGLE REVIEW CYCLE
========================================================= */

export async function getReviewCycle(
  organizationId,
  cycleId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (!cycleId) {
    throw createServiceError(
      "Review cycle ID is required.",
      400,
    );
  }

  const {
    data: cycle,
    error: cycleError,
  } = await supabase
    .from("performance_review_cycles")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", cycleId)
    .single();

  if (cycleError) {
    if (
      cycleError.code === "PGRST116"
    ) {
      throw createServiceError(
        "Review cycle not found.",
        404,
      );
    }

    console.error(
      "[ReviewCycles] Failed to load cycle:",
      cycleError,
    );

    throw cycleError;
  }

  const {
    data: reviews,
    error: reviewError,
  } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("cycle_id", cycleId)
    .order("created_at", {
      ascending: true,
    });

  if (reviewError) {
    console.error(
      "[ReviewCycles] Failed to load cycle reviews:",
      reviewError,
    );

    throw reviewError;
  }

  const employeeMap =
    await getEmployeesForReviews(
      organizationId,
      reviews || [],
    );

  return buildCycleResponse(
    cycle,
    reviews || [],
    employeeMap,
  );
}

/* =========================================================
   CREATE REVIEW CYCLE
========================================================= */

export async function createReviewCycle({
  organizationId,
  title,
  description,
  reviewType,
  startDate,
  dueDate,
  employeeIds,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (
    !title ||
    !String(title).trim()
  ) {
    throw createServiceError(
      "Review cycle title is required.",
      400,
    );
  }

  const normalizedEmployeeIds =
    normalizeEmployeeIds(employeeIds);

  if (!normalizedEmployeeIds.length) {
    throw createServiceError(
      "At least one employee must be selected.",
      400,
    );
  }

  if (
    startDate &&
    dueDate &&
    String(dueDate) <
      String(startDate)
  ) {
    throw createServiceError(
      "Due date cannot be before the start date.",
      400,
    );
  }

  /* ---------------------------------------------------------
     VERIFY EMPLOYEES
  --------------------------------------------------------- */

  const {
    data: employees,
    error: employeeError,
  } = await supabase
    .from("employees")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .in(
      "id",
      normalizedEmployeeIds,
    );

  if (employeeError) {
    console.error(
      "[ReviewCycles] Employee lookup failed:",
      employeeError,
    );

    throw employeeError;
  }

  if (
    !employees ||
    employees.length !==
      normalizedEmployeeIds.length
  ) {
    throw createServiceError(
      "One or more selected employees do not belong to this organization.",
      400,
    );
  }

  /* ---------------------------------------------------------
     CREATE CYCLE

     ALWAYS starts as draft.
  --------------------------------------------------------- */

  const {
    data: cycle,
    error: cycleError,
  } = await supabase
    .from("performance_review_cycles")
    .insert({
      organization_id:
        organizationId,

      title:
        String(title).trim(),

      description:
        description
          ? String(description).trim()
          : null,

      review_type:
        normalizeReviewType(
          reviewType,
        ),

      start_date:
        normalizeDate(startDate),

      due_date:
        normalizeDate(dueDate),

      status: "draft",
    })
    .select("*")
    .single();

  if (cycleError) {
    console.error(
      "[ReviewCycles] Cycle creation failed:",
      cycleError,
    );

    throw cycleError;
  }

  /* ---------------------------------------------------------
     CREATE EMPLOYEE REVIEW RECORDS

     Every employee starts as pending.
  --------------------------------------------------------- */

  const reviewRows =
    normalizedEmployeeIds.map(
      (employeeId) => ({
        organization_id:
          organizationId,

        cycle_id:
          cycle.id,

        employee_id:
          employeeId,

        status:
          "pending",

        rating:
          null,

        comments:
          null,

        submitted_at:
          null,
      }),
    );

  const {
    data: reviews,
    error: reviewError,
  } = await supabase
    .from("performance_reviews")
    .insert(reviewRows)
    .select("*");

  if (reviewError) {
    console.error(
      "[ReviewCycles] Review creation failed:",
      reviewError,
    );

    /*
     * Roll back the cycle.
     */
    await supabase
      .from("performance_review_cycles")
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        cycle.id,
      );

    throw reviewError;
  }

  const employeeMap =
    new Map(
      employees.map(
        (employee) => [
          String(employee.id),
          employee,
        ],
      ),
    );

  return buildCycleResponse(
    cycle,
    reviews || [],
    employeeMap,
  );
}

/* =========================================================
   UPDATE REVIEW CYCLE
========================================================= */

export async function updateReviewCycle(
  organizationId,
  cycleId,
  updates = {},
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (!cycleId) {
    throw createServiceError(
      "Review cycle ID is required.",
      400,
    );
  }

  const {
    data: existingCycle,
    error: existingError,
  } = await supabase
    .from("performance_review_cycles")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", cycleId)
    .single();

  if (existingError) {
    if (
      existingError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Review cycle not found.",
        404,
      );
    }

    throw existingError;
  }

  const cleanUpdates = {};

  /* ---------------------------------------------------------
     TITLE
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "title",
    )
  ) {
    if (
      !updates.title ||
      !String(updates.title).trim()
    ) {
      throw createServiceError(
        "Review cycle title is required.",
        400,
      );
    }

    cleanUpdates.title =
      String(updates.title).trim();
  }

  /* ---------------------------------------------------------
     DESCRIPTION
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "description",
    )
  ) {
    cleanUpdates.description =
      updates.description
        ? String(
            updates.description,
          ).trim()
        : null;
  }

  /* ---------------------------------------------------------
     REVIEW TYPE
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "review_type",
    )
  ) {
    cleanUpdates.review_type =
      normalizeReviewType(
        updates.review_type,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "reviewType",
    )
  ) {
    cleanUpdates.review_type =
      normalizeReviewType(
        updates.reviewType,
      );
  }

  /* ---------------------------------------------------------
     START DATE
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "start_date",
    )
  ) {
    cleanUpdates.start_date =
      normalizeDate(
        updates.start_date,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "startDate",
    )
  ) {
    cleanUpdates.start_date =
      normalizeDate(
        updates.startDate,
      );
  }

  /* ---------------------------------------------------------
     DUE DATE
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "due_date",
    )
  ) {
    cleanUpdates.due_date =
      normalizeDate(
        updates.due_date,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "dueDate",
    )
  ) {
    cleanUpdates.due_date =
      normalizeDate(
        updates.dueDate,
      );
  }

  /* ---------------------------------------------------------
     DATE VALIDATION
  --------------------------------------------------------- */

  const effectiveStartDate =
    cleanUpdates.start_date ??
    existingCycle.start_date;

  const effectiveDueDate =
    cleanUpdates.due_date ??
    existingCycle.due_date;

  if (
    effectiveStartDate &&
    effectiveDueDate &&
    String(effectiveDueDate) <
      String(effectiveStartDate)
  ) {
    throw createServiceError(
      "Due date cannot be before the start date.",
      400,
    );
  }

  /* ---------------------------------------------------------
     STATUS

     IMPORTANT:

     completed MUST go through
     completeReviewCycle().

     This prevents the frontend from
     accidentally completing a cycle.
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "status",
    )
  ) {
    const requestedStatus =
      normalizeCycleStatus(
        updates.status,
      );

    /*
     * A completed cycle can never
     * be restarted.
     */
    if (
      existingCycle.status ===
        "completed" &&
      requestedStatus !==
        "completed"
    ) {
      throw createServiceError(
        "A completed review cycle cannot be restarted.",
        400,
      );
    }

    /*
     * COMPLETION MUST BE VALIDATED.
     */
    if (
      requestedStatus ===
      "completed"
    ) {
      return completeReviewCycle(
        organizationId,
        cycleId,
      );
    }

    /*
     * Only draft -> active is a
     * meaningful start transition.
     */
    if (
      requestedStatus ===
        "active" &&
      existingCycle.status ===
        "completed"
    ) {
      throw createServiceError(
        "A completed review cycle cannot be restarted.",
        400,
      );
    }

    cleanUpdates.status =
      requestedStatus;
  }

  /* ---------------------------------------------------------
     SAVE
  --------------------------------------------------------- */

  if (
    Object.keys(cleanUpdates)
      .length > 0
  ) {
    const {
      error: updateError,
    } = await supabase
      .from(
        "performance_review_cycles",
      )
      .update(cleanUpdates)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("id", cycleId);

    if (updateError) {
      console.error(
        "[ReviewCycles] Cycle update failed:",
        updateError,
      );

      throw updateError;
    }
  }

  return getReviewCycle(
    organizationId,
    cycleId,
  );
}

/* =========================================================
   UPDATE EMPLOYEE REVIEW
========================================================= */

export async function updateEmployeeReview(
  organizationId,
  cycleId,
  reviewId,
  updates = {},
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (!cycleId) {
    throw createServiceError(
      "Review cycle ID is required.",
      400,
    );
  }

  if (!reviewId) {
    throw createServiceError(
      "Review ID is required.",
      400,
    );
  }

  /* ---------------------------------------------------------
     LOAD CYCLE
  --------------------------------------------------------- */

  const {
    data: cycle,
    error: cycleError,
  } = await supabase
    .from(
      "performance_review_cycles",
    )
    .select(
      "id, status",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      cycleId,
    )
    .single();

  if (cycleError) {
    if (
      cycleError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Review cycle not found.",
        404,
      );
    }

    throw cycleError;
  }

  if (
    cycle.status ===
    "draft"
  ) {
    throw createServiceError(
      "This review cycle has not been started yet.",
      400,
    );
  }

  if (
    cycle.status ===
    "completed"
  ) {
    throw createServiceError(
      "This review cycle is already completed.",
      400,
    );
  }

  /* ---------------------------------------------------------
     LOAD REVIEW
  --------------------------------------------------------- */

  const {
    data: existingReview,
    error: reviewLookupError,
  } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "cycle_id",
      cycleId,
    )
    .eq(
      "id",
      reviewId,
    )
    .single();

  if (reviewLookupError) {
    if (
      reviewLookupError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Employee review not found.",
        404,
      );
    }

    throw reviewLookupError;
  }

  const cleanUpdates = {};

  /* ---------------------------------------------------------
     RATING
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "rating",
    )
  ) {
    if (
      updates.rating ===
        null ||
      updates.rating === ""
    ) {
      cleanUpdates.rating =
        null;
    } else {
      const rating =
        Number(
          updates.rating,
        );

      if (
        Number.isNaN(rating) ||
        rating < 0 ||
        rating > 5
      ) {
        throw createServiceError(
          "Rating must be between 0 and 5.",
          400,
        );
      }

      cleanUpdates.rating =
        rating;
    }
  }

  /* ---------------------------------------------------------
     COMMENTS
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "comments",
    )
  ) {
    cleanUpdates.comments =
      updates.comments
        ? String(
            updates.comments,
          )
        : null;
  }

  /* ---------------------------------------------------------
     STATUS
  --------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "status",
    )
  ) {
    const requestedStatus =
      normalizeReviewStatus(
        updates.status,
      );

    const currentStatus =
      existingReview.status;

    /*
     * Enforce the workflow.
     */
    const validTransition =
      (
        currentStatus ===
          requestedStatus
      ) ||
      (
        currentStatus ===
          "pending" &&
        requestedStatus ===
          "in_progress"
      ) ||
      (
        currentStatus ===
          "in_progress" &&
        requestedStatus ===
          "submitted"
      ) ||
      (
        currentStatus ===
          "submitted" &&
        requestedStatus ===
          "acknowledged"
      ) ||
      (
        currentStatus ===
          "acknowledged" &&
        requestedStatus ===
          "completed"
      );

    if (!validTransition) {
      throw createServiceError(
        `Invalid review status transition: ${currentStatus} -> ${requestedStatus}`,
        400,
      );
    }

    /*
     * Submission requires actual review content.
     */
    if (
      requestedStatus ===
      "submitted"
    ) {
      const rating =
        Object.prototype.hasOwnProperty.call(
          cleanUpdates,
          "rating",
        )
          ? cleanUpdates.rating
          : existingReview.rating;

      const comments =
        Object.prototype.hasOwnProperty.call(
          cleanUpdates,
          "comments",
        )
          ? cleanUpdates.comments
          : existingReview.comments;

      if (
        rating === null ||
        rating === undefined
      ) {
        throw createServiceError(
          "A rating is required before submitting the review.",
          400,
        );
      }

      if (
        !comments ||
        !String(comments).trim()
      ) {
        throw createServiceError(
          "Comments are required before submitting the review.",
          400,
        );
      }

      cleanUpdates.submitted_at =
        new Date().toISOString();
    }

    if (
      requestedStatus ===
      "pending"
    ) {
      cleanUpdates.submitted_at =
        null;
    }

    cleanUpdates.status =
      requestedStatus;
  }

  /* ---------------------------------------------------------
     AUTO MOVE PENDING -> IN PROGRESS

     Entering rating/comments while a
     review is pending means work has begun.
  --------------------------------------------------------- */

  const hasReviewContent =
    Object.prototype.hasOwnProperty.call(
      updates,
      "rating",
    ) ||
    Object.prototype.hasOwnProperty.call(
      updates,
      "comments",
    );

  if (
    hasReviewContent &&
    !Object.prototype.hasOwnProperty.call(
      updates,
      "status",
    ) &&
    existingReview.status ===
      "pending"
  ) {
    cleanUpdates.status =
      "in_progress";
  }

  if (
    Object.keys(cleanUpdates)
      .length === 0
  ) {
    throw createServiceError(
      "No valid review updates were provided.",
      400,
    );
  }

  /* ---------------------------------------------------------
     SAVE REVIEW
  --------------------------------------------------------- */

  const {
    data: updatedReview,
    error: updateError,
  } = await supabase
    .from("performance_reviews")
    .update(cleanUpdates)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "cycle_id",
      cycleId,
    )
    .eq(
      "id",
      reviewId,
    )
    .select("*")
    .single();

  if (updateError) {
    console.error(
      "[ReviewCycles] Employee review update failed:",
      updateError,
    );

    throw updateError;
  }

  /*
   * IMPORTANT:
   *
   * Updating an employee review NEVER
   * automatically completes the cycle.
   */
  return updatedReview;
}

/* =========================================================
   COMPLETE REVIEW CYCLE
========================================================= */

export async function completeReviewCycle(
  organizationId,
  cycleId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (!cycleId) {
    throw createServiceError(
      "Review cycle ID is required.",
      400,
    );
  }

  const {
    data: cycle,
    error: cycleError,
  } = await supabase
    .from(
      "performance_review_cycles",
    )
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      cycleId,
    )
    .single();

  if (cycleError) {
    if (
      cycleError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Review cycle not found.",
        404,
      );
    }

    throw cycleError;
  }

  if (
    cycle.status ===
    "draft"
  ) {
    throw createServiceError(
      "Review cycle must be started before it can be completed.",
      400,
    );
  }

  if (
    cycle.status ===
    "completed"
  ) {
    return getReviewCycle(
      organizationId,
      cycleId,
    );
  }

  if (
    cycle.status !==
    "active"
  ) {
    throw createServiceError(
      "Only an active review cycle can be completed.",
      400,
    );
  }

  /* ---------------------------------------------------------
     LOAD REVIEWS
  --------------------------------------------------------- */

  const {
    data: reviews,
    error: reviewError,
  } = await supabase
    .from("performance_reviews")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "cycle_id",
      cycleId,
    );

  if (reviewError) {
    throw reviewError;
  }

  if (!reviews?.length) {
    throw createServiceError(
      "Cannot complete a review cycle with no employee reviews.",
      400,
    );
  }

  /* ---------------------------------------------------------
     CHECK COMPLETION
  --------------------------------------------------------- */

  const incompleteReviews =
    reviews.filter(
      (review) =>
        ![
          "acknowledged",
          "completed",
        ].includes(
          review.status,
        ),
    );

  if (
    incompleteReviews.length >
    0
  ) {
    throw createServiceError(
      `Cannot complete the review cycle. ${incompleteReviews.length} employee review(s) are still pending.`,
      400,
    );
  }

  /* ---------------------------------------------------------
     COMPLETE CYCLE
  --------------------------------------------------------- */

  const {
    data: updatedCycle,
    error: updateError,
  } = await supabase
    .from(
      "performance_review_cycles",
    )
    .update({
      status: "completed",
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      cycleId,
    )
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return getReviewCycle(
    organizationId,
    updatedCycle.id,
  );
}

/* =========================================================
   DELETE REVIEW CYCLE
========================================================= */

export async function deleteReviewCycle(
  organizationId,
  cycleId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  if (!cycleId) {
    throw createServiceError(
      "Review cycle ID is required.",
      400,
    );
  }

  /*
   * Delete reviews first.
   */
  const {
    error: reviewDeleteError,
  } = await supabase
    .from("performance_reviews")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "cycle_id",
      cycleId,
    );

  if (reviewDeleteError) {
    console.error(
      "[ReviewCycles] Failed to delete employee reviews:",
      reviewDeleteError,
    );

    throw reviewDeleteError;
  }

  /*
   * Delete cycle.
   */
  const {
    data,
    error: cycleDeleteError,
  } = await supabase
    .from(
      "performance_review_cycles",
    )
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      cycleId,
    )
    .select("id")
    .single();

  if (cycleDeleteError) {
    if (
      cycleDeleteError.code ===
      "PGRST116"
    ) {
      throw createServiceError(
        "Review cycle not found.",
        404,
      );
    }

    throw cycleDeleteError;
  }

  return data;
}