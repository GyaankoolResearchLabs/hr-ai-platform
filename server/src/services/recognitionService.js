import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeRecognition(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,

    giver: row.giver
      ? {
          id: row.giver.id,
          name: row.giver.full_name,
          email: row.giver.email,
          department: row.giver.department,
          title: row.giver.title,
        }
      : null,

    receiver: row.receiver
      ? {
          id: row.receiver.id,
          name: row.receiver.full_name,
          email: row.receiver.email,
          department: row.receiver.department,
          title: row.receiver.title,
        }
      : null,

    recognitionType: row.recognition_type,
    category: row.category,
    title: row.title,
    message: row.message,
    rewardPoints: row.reward_points,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* =========================================================
   EMPLOYEE VALIDATION
========================================================= */

async function getEmployee(
  organizationId,
  employeeId,
) {
  if (!employeeId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select(
      "id, organization_id, full_name, email, department, title",
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Recognition] Employee lookup failed:",
      error,
    );

    throw createError(
      "Failed to verify employee.",
      500,
    );
  }

  return data;
}

/* =========================================================
   GET RECOGNITION WALL
========================================================= */

export async function getRecognitionWall({
  organizationId,
  status = "active",
  category = null,
  recognitionType = null,
  employeeId = null,
}) {
  let query = supabaseAdmin
    .from("recognition_wall")
    .select(
      `
      id,
      organization_id,
      giver_employee_id,
      receiver_employee_id,
      recognition_type,
      category,
      title,
      message,
      reward_points,
      visibility,
      status,
      created_at,
      updated_at,
      giver:employees!recognition_wall_giver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      ),
      receiver:employees!recognition_wall_receiver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      )
      `,
    )
    .eq("organization_id", organizationId)
    .eq("status", status)
    .order("created_at", {
      ascending: false,
    });

  if (category) {
    query = query.eq("category", category);
  }

  if (recognitionType) {
    query = query.eq(
      "recognition_type",
      recognitionType,
    );
  }

  if (employeeId) {
    query = query.or(
      `giver_employee_id.eq.${employeeId},receiver_employee_id.eq.${employeeId}`,
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error(
      "[Recognition] GET wall failed:",
      error,
    );

    throw createError(
      error.message ||
        "Failed to load recognition wall.",
      500,
    );
  }

  return (data || []).map(normalizeRecognition);
}

/* =========================================================
   GET SINGLE RECOGNITION
========================================================= */

export async function getRecognitionById(
  organizationId,
  recognitionId,
) {
  const { data, error } = await supabaseAdmin
    .from("recognition_wall")
    .select(
      `
      id,
      organization_id,
      giver_employee_id,
      receiver_employee_id,
      recognition_type,
      category,
      title,
      message,
      reward_points,
      visibility,
      status,
      created_at,
      updated_at,
      giver:employees!recognition_wall_giver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      ),
      receiver:employees!recognition_wall_receiver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      )
      `,
    )
    .eq("id", recognitionId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Recognition] GET single failed:",
      error,
    );

    throw createError(
      error.message ||
        "Failed to load recognition.",
      500,
    );
  }

  if (!data) {
    throw createError(
      "Recognition not found.",
      404,
    );
  }

  return normalizeRecognition(data);
}

/* =========================================================
   CREATE RECOGNITION
========================================================= */

export async function createRecognition({
  organizationId,
  giverEmployeeId,
  receiverEmployeeId,
  recognitionType = "peer",
  category = "general",
  title = null,
  message,
  rewardPoints = 0,
  visibility = "organization",
}) {
  if (!receiverEmployeeId) {
    throw createError(
      "A recipient employee is required.",
    );
  }

  if (!message || !String(message).trim()) {
    throw createError(
      "Recognition message is required.",
    );
  }

  const receiver = await getEmployee(
    organizationId,
    receiverEmployeeId,
  );

  if (!receiver) {
    throw createError(
      "Recipient employee was not found in this organization.",
      404,
    );
  }

  let giver = null;

  if (giverEmployeeId) {
    giver = await getEmployee(
      organizationId,
      giverEmployeeId,
    );

    if (!giver) {
      throw createError(
        "Giving employee was not found in this organization.",
        404,
      );
    }
  }

  const validTypes = [
    "peer",
    "manager",
    "team",
    "milestone",
  ];

  if (!validTypes.includes(recognitionType)) {
    throw createError(
      "Invalid recognition type.",
    );
  }

  const validVisibility = [
    "organization",
    "private",
  ];

  if (!validVisibility.includes(visibility)) {
    throw createError(
      "Invalid recognition visibility.",
    );
  }

  const points = Number(rewardPoints);

  if (!Number.isInteger(points) || points < 0) {
    throw createError(
      "Reward points must be a non-negative integer.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("recognition_wall")
    .insert({
      organization_id: organizationId,
      giver_employee_id:
        giverEmployeeId || null,
      receiver_employee_id:
        receiverEmployeeId,
      recognition_type:
        recognitionType,
      category,
      title:
        title?.trim() || null,
      message: String(message).trim(),
      reward_points: points,
      visibility,
      status: "active",
    })
    .select(
      `
      id,
      organization_id,
      giver_employee_id,
      receiver_employee_id,
      recognition_type,
      category,
      title,
      message,
      reward_points,
      visibility,
      status,
      created_at,
      updated_at,
      giver:employees!recognition_wall_giver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      ),
      receiver:employees!recognition_wall_receiver_employee_id_fkey(
        id,
        full_name,
        email,
        department,
        title
      )
      `,
    )
    .single();

  if (error) {
    console.error(
      "[Recognition] CREATE failed:",
      error,
    );

    throw createError(
      error.message ||
        "Failed to create recognition.",
      500,
    );
  }

  return normalizeRecognition(data);
}

/* =========================================================
   UPDATE RECOGNITION
========================================================= */

export async function updateRecognition(
  organizationId,
  recognitionId,
  updates,
) {
  const existing =
    await getRecognitionById(
      organizationId,
      recognitionId,
    );

  const allowed = {};

  if (
    updates.message !== undefined
  ) {
    if (
      !String(updates.message).trim()
    ) {
      throw createError(
        "Recognition message cannot be empty.",
      );
    }

    allowed.message =
      String(updates.message).trim();
  }

  if (
    updates.title !== undefined
  ) {
    allowed.title =
      updates.title
        ? String(updates.title).trim()
        : null;
  }

  if (
    updates.category !== undefined
  ) {
    allowed.category =
      String(updates.category).trim();
  }

  if (
    updates.rewardPoints !== undefined ||
    updates.reward_points !== undefined
  ) {
    const points = Number(
      updates.rewardPoints ??
        updates.reward_points,
    );

    if (
      !Number.isInteger(points) ||
      points < 0
    ) {
      throw createError(
        "Reward points must be a non-negative integer.",
      );
    }

    allowed.reward_points = points;
  }

  if (
    updates.visibility !== undefined
  ) {
    if (
      !["organization", "private"].includes(
        updates.visibility,
      )
    ) {
      throw createError(
        "Invalid recognition visibility.",
      );
    }

    allowed.visibility =
      updates.visibility;
  }

  if (Object.keys(allowed).length === 0) {
    return existing;
  }

  allowed.updated_at =
    new Date().toISOString();

  const { data, error } =
    await supabaseAdmin
      .from("recognition_wall")
      .update(allowed)
      .eq("id", recognitionId)
      .eq("organization_id", organizationId)
      .select(
        `
        id,
        organization_id,
        giver_employee_id,
        receiver_employee_id,
        recognition_type,
        category,
        title,
        message,
        reward_points,
        visibility,
        status,
        created_at,
        updated_at,
        giver:employees!recognition_wall_giver_employee_id_fkey(
          id,
          full_name,
          email,
          department,
          title
        ),
        receiver:employees!recognition_wall_receiver_employee_id_fkey(
          id,
          full_name,
          email,
          department,
          title
        )
        `,
      )
      .single();

  if (error) {
    console.error(
      "[Recognition] UPDATE failed:",
      error,
    );

    throw createError(
      error.message ||
        "Failed to update recognition.",
      500,
    );
  }

  return normalizeRecognition(data);
}

/* =========================================================
   ARCHIVE
========================================================= */

export async function archiveRecognition(
  organizationId,
  recognitionId,
) {
  await getRecognitionById(
    organizationId,
    recognitionId,
  );

  const { data, error } =
    await supabaseAdmin
      .from("recognition_wall")
      .update({
        status: "archived",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", recognitionId)
      .eq("organization_id", organizationId)
      .select(
        `
        id,
        organization_id,
        giver_employee_id,
        receiver_employee_id,
        recognition_type,
        category,
        title,
        message,
        reward_points,
        visibility,
        status,
        created_at,
        updated_at
        `,
      )
      .single();

  if (error) {
    console.error(
      "[Recognition] ARCHIVE failed:",
      error,
    );

    throw createError(
      "Failed to archive recognition.",
      500,
    );
  }

  return normalizeRecognition(data);
}

/* =========================================================
   DELETE
========================================================= */

export async function deleteRecognition(
  organizationId,
  recognitionId,
) {
  await getRecognitionById(
    organizationId,
    recognitionId,
  );

  const { error } =
    await supabaseAdmin
      .from("recognition_wall")
      .delete()
      .eq("id", recognitionId)
      .eq("organization_id", organizationId);

  if (error) {
    console.error(
      "[Recognition] DELETE failed:",
      error,
    );

    throw createError(
      "Failed to delete recognition.",
      500,
    );
  }
}