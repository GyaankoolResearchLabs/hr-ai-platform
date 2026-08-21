import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/* =========================================================
   GET EMPLOYEES FOR RECOGNITION
========================================================= */

export async function getRecognitionEmployees(
  organizationId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  console.log(
    "[RecognitionRewards] Loading employees for organization:",
    organizationId,
  );

  const {
    data: employees,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, full_name, email, department, title",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .order("full_name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "[RecognitionRewards] Employee query failed:",
      error,
    );

    throw error;
  }

  console.log(
    "[RecognitionRewards] Employees found:",
    employees?.length || 0,
  );

  return employees || [];
}

/* =========================================================
   VERIFY EMPLOYEE
========================================================= */

async function verifyEmployeeBelongsToOrganization(
  organizationId,
  employeeId,
) {
  if (!employeeId) {
    throw createError(
      "Employee is required.",
      400,
    );
  }

  const {
    data: employee,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, organization_id, full_name, email, department, title",
    )
    .eq("id", employeeId)
    .eq(
      "organization_id",
      organizationId,
    )
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
   LOAD EMPLOYEES
========================================================= */

async function loadEmployees(
  organizationId,
  employeeIds,
) {
  if (!employeeIds.length) {
    return new Map();
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, full_name, email, department, title",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .in("id", employeeIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((employee) => [
      employee.id,
      employee,
    ]),
  );
}

/* =========================================================
   GET RECOGNITION WALL
========================================================= */

export async function getRecognitionRewards({
  organizationId,
  status = "active",
  employeeId = null,
  category = null,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  let query = supabaseAdmin
    .from("recognition_rewards")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .order("created_at", {
      ascending: false,
    });

  if (status && status !== "all") {
    query = query.eq(
      "status",
      status,
    );
  }

  if (employeeId) {
    query = query.eq(
      "employee_id",
      employeeId,
    );
  }

  if (
    category &&
    category !== "all"
  ) {
    query = query.eq(
      "category",
      category,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  const recognitions = data || [];

  if (!recognitions.length) {
    return [];
  }

  const employeeIds = [
    ...new Set(
      recognitions.map(
        (item) =>
          item.employee_id,
      ),
    ),
  ];

  const employeeMap =
    await loadEmployees(
      organizationId,
      employeeIds,
    );

  return recognitions.map(
    (recognition) => ({
      ...recognition,
      employee:
        employeeMap.get(
          recognition.employee_id,
        ) || null,
    }),
  );
}

/* =========================================================
   GET SINGLE RECOGNITION
========================================================= */

export async function getRecognitionRewardById(
  organizationId,
  recognitionId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("recognition_rewards")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", recognitionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Recognition not found.",
      404,
    );
  }

  const employeeMap =
    await loadEmployees(
      organizationId,
      [data.employee_id],
    );

  return {
    ...data,
    employee:
      employeeMap.get(
        data.employee_id,
      ) || null,
  };
}

/* =========================================================
   CREATE RECOGNITION
========================================================= */

export async function createRecognitionReward({
  organizationId,
  givenByUserId,
  employeeId,
  category,
  message,
  points = 0,
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

  const employee =
    await verifyEmployeeBelongsToOrganization(
      organizationId,
      employeeId,
    );

  if (
    !message ||
    !message.trim()
  ) {
    throw createError(
      "Recognition message is required.",
      400,
    );
  }

  const allowedCategories = [
    "teamwork",
    "leadership",
    "innovation",
    "customer-focus",
    "ownership",
    "performance",
    "other",
  ];

  if (
    !allowedCategories.includes(
      category,
    )
  ) {
    throw createError(
      "Invalid recognition category.",
      400,
    );
  }

  const numericPoints =
    Number(points);

  if (
    !Number.isInteger(
      numericPoints,
    ) ||
    numericPoints < 0
  ) {
    throw createError(
      "Recognition points must be a non-negative integer.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("recognition_rewards")
    .insert({
      organization_id:
        organizationId,

      given_by_user_id:
        givenByUserId,

      employee_id:
        employee.id,

      category,

      message:
        message.trim(),

      points:
        numericPoints,

      status:
        "active",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    employee,
  };
}

/* =========================================================
   ARCHIVE RECOGNITION
========================================================= */

export async function archiveRecognitionReward(
  organizationId,
  recognitionId,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("recognition_rewards")
    .update({
      status: "archived",
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", recognitionId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Recognition not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   DELETE RECOGNITION
========================================================= */

export async function deleteRecognitionReward(
  organizationId,
  recognitionId,
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("recognition_rewards")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", recognitionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createError(
      "Recognition not found.",
      404,
    );
  }

  return data;
}