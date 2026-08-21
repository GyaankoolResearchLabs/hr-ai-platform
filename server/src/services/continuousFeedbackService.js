    import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyEmployeeBelongsToOrganization(
  organizationId,
  employeeId,
) {
  if (!employeeId) {
    throw createError("Employee is required.");
  }

  const { data: employee, error } = await supabaseAdmin
    .from("employees")
    .select(
      "id, organization_id, full_name, email, department, title, employment_status",
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!employee) {
    throw createError(
      "Selected employee does not belong to this organization.",
      400,
    );
  }

  return employee;
}

/* =========================================================
   GET ALL FEEDBACK
========================================================= */

export async function getContinuousFeedback({
  organizationId,
  status = "active",
  employeeId = null,
  feedbackType = null,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  let query = supabaseAdmin
    .from("continuous_feedback")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  if (feedbackType && feedbackType !== "all") {
    query = query.eq("feedback_type", feedbackType);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const feedbackRows = data || [];

  if (feedbackRows.length === 0) {
    return [];
  }

  /* -------------------------------------------------------
     Load employee records separately.
     This avoids depending on Supabase relationship naming.
  ------------------------------------------------------- */

  const employeeIds = [
    ...new Set(
      feedbackRows.map(
        (item) => item.employee_id,
      ),
    ),
  ];

  const { data: employees, error: employeesError } =
    await supabaseAdmin
      .from("employees")
      .select(
        "id, full_name, email, department, title, employment_status",
      )
      .eq("organization_id", organizationId)
      .in("id", employeeIds);

  if (employeesError) {
    throw employeesError;
  }

  const employeeMap = new Map(
    (employees || []).map((employee) => [
      employee.id,
      employee,
    ]),
  );

  return feedbackRows.map((feedback) => ({
    ...feedback,
    employee:
      employeeMap.get(feedback.employee_id) || null,
  }));
}

/* =========================================================
   GET SINGLE FEEDBACK
========================================================= */

export async function getContinuousFeedbackById(
  organizationId,
  feedbackId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("continuous_feedback")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Feedback not found.",
      404,
    );
  }

  const { data: employee, error: employeeError } =
    await supabaseAdmin
      .from("employees")
      .select(
        "id, full_name, email, department, title, employment_status",
      )
      .eq("id", data.employee_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

  if (employeeError) {
    throw employeeError;
  }

  return {
    ...data,
    employee: employee || null,
  };
}

/* =========================================================
   CREATE FEEDBACK
========================================================= */

export async function createContinuousFeedback({
  organizationId,
  givenByUserId,
  employeeId,
  feedbackType,
  category,
  title,
  feedback,
  visibility,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  if (!givenByUserId) {
    throw createError(
      "Authenticated user is required.",
      401,
    );
  }

  if (!title || !title.trim()) {
    throw createError(
      "Feedback title is required.",
      400,
    );
  }

  if (!feedback || !feedback.trim()) {
    throw createError(
      "Feedback content is required.",
      400,
    );
  }

  await verifyEmployeeBelongsToOrganization(
    organizationId,
    employeeId,
  );

  const allowedTypes = [
    "general",
    "recognition",
    "developmental",
  ];

  const normalizedType =
    feedbackType || "general";

  if (!allowedTypes.includes(normalizedType)) {
    throw createError(
      "Invalid feedback type.",
      400,
    );
  }

  const allowedVisibility = [
    "shared",
    "private",
  ];

  const normalizedVisibility =
    visibility || "shared";

  if (
    !allowedVisibility.includes(
      normalizedVisibility,
    )
  ) {
    throw createError(
      "Invalid feedback visibility.",
      400,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("continuous_feedback")
    .insert({
      organization_id: organizationId,
      employee_id: employeeId,
      given_by_user_id: givenByUserId,
      feedback_type: normalizedType,
      category:
        category && category.trim()
          ? category.trim()
          : null,
      title: title.trim(),
      feedback: feedback.trim(),
      visibility: normalizedVisibility,
      status: "active",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return getContinuousFeedbackById(
    organizationId,
    data.id,
  );
}

/* =========================================================
   UPDATE FEEDBACK
========================================================= */

export async function updateContinuousFeedback(
  organizationId,
  feedbackId,
  updates,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  const { data: existing, error: existingError } =
    await supabaseAdmin
      .from("continuous_feedback")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", feedbackId)
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw createError(
      "Feedback not found.",
      404,
    );
  }

  const allowedFields = [
    "employee_id",
    "feedback_type",
    "category",
    "title",
    "feedback",
    "visibility",
    "status",
  ];

  const cleanUpdates = {};

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates || {},
        field,
      )
    ) {
      cleanUpdates[field] =
        updates[field];
    }
  }

  if (
    Object.keys(cleanUpdates).length === 0
  ) {
    throw createError(
      "No valid feedback updates were provided.",
      400,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "employee_id",
    )
  ) {
    await verifyEmployeeBelongsToOrganization(
      organizationId,
      cleanUpdates.employee_id,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "title",
    )
  ) {
    if (
      !cleanUpdates.title ||
      !cleanUpdates.title.trim()
    ) {
      throw createError(
        "Feedback title is required.",
        400,
      );
    }

    cleanUpdates.title =
      cleanUpdates.title.trim();
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "feedback",
    )
  ) {
    if (
      !cleanUpdates.feedback ||
      !cleanUpdates.feedback.trim()
    ) {
      throw createError(
        "Feedback content is required.",
        400,
      );
    }

    cleanUpdates.feedback =
      cleanUpdates.feedback.trim();
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "category",
    )
  ) {
    cleanUpdates.category =
      cleanUpdates.category?.trim() ||
      null;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "feedback_type",
    )
  ) {
    const allowedTypes = [
      "general",
      "recognition",
      "developmental",
    ];

    if (
      !allowedTypes.includes(
        cleanUpdates.feedback_type,
      )
    ) {
      throw createError(
        "Invalid feedback type.",
        400,
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "visibility",
    )
  ) {
    if (
      !["shared", "private"].includes(
        cleanUpdates.visibility,
      )
    ) {
      throw createError(
        "Invalid feedback visibility.",
        400,
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "status",
    )
  ) {
    if (
      !["active", "archived"].includes(
        cleanUpdates.status,
      )
    ) {
      throw createError(
        "Invalid feedback status.",
        400,
      );
    }
  }

  const { data, error } = await supabaseAdmin
    .from("continuous_feedback")
    .update(cleanUpdates)
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return getContinuousFeedbackById(
    organizationId,
    data.id,
  );
}

/* =========================================================
   ARCHIVE FEEDBACK
========================================================= */

export async function archiveContinuousFeedback(
  organizationId,
  feedbackId,
) {
  const { data, error } = await supabaseAdmin
    .from("continuous_feedback")
    .update({
      status: "archived",
    })
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Feedback not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   DELETE FEEDBACK
========================================================= */

export async function deleteContinuousFeedback(
  organizationId,
  feedbackId,
) {
  const { data, error } = await supabaseAdmin
    .from("continuous_feedback")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", feedbackId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Feedback not found.",
      404,
    );
  }

  return data;
}