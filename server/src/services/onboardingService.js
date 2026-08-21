import { supabaseAdmin } from "../config/supabase.js";

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalizeOrganizationId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const id = String(value).trim();

  return id || null;
}

function normalizeId(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const id = String(value).trim();

  return id || null;
}

function serviceError(message, details = null) {
  const error = new Error(message);

  if (details) {
    error.details = details;
  }

  return error;
}

/*
|--------------------------------------------------------------------------
| JOURNEY STATUS
|--------------------------------------------------------------------------
*/

const JOURNEY_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "on_hold",
  "cancelled",
];

const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

/*
|--------------------------------------------------------------------------
| GET ALL ONBOARDING JOURNEYS
|--------------------------------------------------------------------------
*/

export async function getOnboardingJourneys(organizationId) {
  const orgId = normalizeOrganizationId(organizationId);

  if (!orgId) {
    throw serviceError("Organization ID is required.");
  }

  console.log(
    "[Onboarding Service] Loading journeys for organization:",
    orgId,
  );

  const {
    data: journeys,
    error: journeysError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", {
      ascending: false,
    });

  if (journeysError) {
    console.error(
      "[Onboarding Service] Failed to load journeys:",
      journeysError,
    );

    throw serviceError(
      journeysError.message ||
        "Failed to load onboarding journeys.",
      journeysError,
    );
  }

  if (!journeys || journeys.length === 0) {
    return [];
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD TASKS SEPARATELY
  |--------------------------------------------------------------------------
  |
  | This avoids depending on Supabase foreign-key relationship names.
  |
  */

  const journeyIds = journeys
    .map((journey) => journey.id)
    .filter(Boolean);

  let tasks = [];

  if (journeyIds.length > 0) {
    const {
      data: taskData,
      error: taskError,
    } = await supabaseAdmin
      .from("onboarding_journey_tasks")
      .select("*")
      .eq("organization_id", orgId)
      .in("journey_id", journeyIds)
      .order("created_at", {
        ascending: true,
      });

    if (taskError) {
      console.error(
        "[Onboarding Service] Failed to load journey tasks:",
        taskError,
      );

      throw serviceError(
        taskError.message ||
          "Failed to load onboarding tasks.",
        taskError,
      );
    }

    tasks = taskData || [];
  }

  /*
  |--------------------------------------------------------------------------
  | GROUP TASKS BY JOURNEY
  |--------------------------------------------------------------------------
  */

  const tasksByJourney = new Map();

  for (const task of tasks) {
    const journeyId = String(task.journey_id);

    if (!tasksByJourney.has(journeyId)) {
      tasksByJourney.set(journeyId, []);
    }

    tasksByJourney
      .get(journeyId)
      .push(task);
  }

  /*
  |--------------------------------------------------------------------------
  | RETURN JOURNEYS
  |--------------------------------------------------------------------------
  */

  return journeys.map((journey) => {
    const journeyTasks =
      tasksByJourney.get(String(journey.id)) || [];

    return {
      ...journey,

      onboarding_journey_tasks:
        journeyTasks,

      tasks:
        journeyTasks,

      task_count:
        journeyTasks.length,

      completed_task_count:
        journeyTasks.filter(
          (task) => task.status === "completed",
        ).length,
    };
  });
}

/*
|--------------------------------------------------------------------------
| GET SINGLE ONBOARDING JOURNEY
|--------------------------------------------------------------------------
*/

export async function getOnboardingJourney(
  organizationId,
  journeyId,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(journeyId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Journey ID is required.",
    );
  }

  console.log(
    "[Onboarding Service] Loading journey:",
    id,
    "organization:",
    orgId,
  );

  /*
  |--------------------------------------------------------------------------
  | LOAD JOURNEY
  |--------------------------------------------------------------------------
  */

  const {
    data: journey,
    error: journeyError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (journeyError) {
    console.error(
      "[Onboarding Service] Failed to load journey:",
      journeyError,
    );

    throw serviceError(
      journeyError.message ||
        "Failed to load onboarding journey.",
      journeyError,
    );
  }

  if (!journey) {
    throw serviceError(
      "Onboarding journey not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD TASKS
  |--------------------------------------------------------------------------
  */

  const {
    data: tasks,
    error: tasksError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .select("*")
    .eq("journey_id", id)
    .eq("organization_id", orgId)
    .order("created_at", {
      ascending: true,
    });

  if (tasksError) {
    console.error(
      "[Onboarding Service] Failed to load journey tasks:",
      tasksError,
    );

    throw serviceError(
      tasksError.message ||
        "Failed to load onboarding tasks.",
      tasksError,
    );
  }

  const journeyTasks = tasks || [];

  /*
  |--------------------------------------------------------------------------
  | PROGRESS
  |--------------------------------------------------------------------------
  */

  const total = journeyTasks.length;

  const completed = journeyTasks.filter(
    (task) => task.status === "completed",
  ).length;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (completed / total) * 100,
        );

  return {
    ...journey,

    onboarding_journey_tasks:
      journeyTasks,

    tasks:
      journeyTasks,

    task_count:
      total,

    completed_task_count:
      completed,

    progress:
      percentage,

    percentage,
  };
}

/*
|--------------------------------------------------------------------------
| CREATE ONBOARDING JOURNEY
|--------------------------------------------------------------------------
*/

export async function createOnboardingJourney({
  organizationId,
  employeeId,
  joiningDate,
  title,
}) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const employee = normalizeId(employeeId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!employee) {
    throw serviceError(
      "Employee is required.",
    );
  }

  if (!joiningDate) {
    throw serviceError(
      "Joining date is required.",
    );
  }

  console.log(
    "[Onboarding Service] Creating journey:",
    {
      organizationId: orgId,
      employeeId: employee,
      joiningDate,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | VERIFY EMPLOYEE
  |--------------------------------------------------------------------------
  */

  const {
    data: employeeRecord,
    error: employeeError,
  } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("id", employee)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "[Onboarding Service] Employee lookup failed:",
      employeeError,
    );

    throw serviceError(
      employeeError.message ||
        "Could not verify employee.",
      employeeError,
    );
  }

  if (!employeeRecord) {
    throw serviceError(
      "Employee not found in this organization.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE JOURNEY
  |--------------------------------------------------------------------------
  |
  | IMPORTANT:
  | We intentionally DO NOT check whether another completed journey exists.
  |
  | This allows:
  |
  | Employee A -> completed journey
  | Employee B -> new journey
  | Employee C -> new journey
  |
  */

  const journeyRecord = {
    organization_id: orgId,
    employee_id: employee,
    joining_date: joiningDate,
    status: "not_started",
  };

  /*
  |--------------------------------------------------------------------------
  | OPTIONAL TITLE
  |--------------------------------------------------------------------------
  |
  | Only include title when supplied.
  |
  */

  if (title && String(title).trim()) {
    journeyRecord.title =
      String(title).trim();
  }

  const {
    data: journey,
    error: journeyError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .insert(journeyRecord)
    .select("*")
    .single();

  if (journeyError) {
    console.error(
      "[Onboarding Service] Journey creation failed:",
      journeyError,
    );

    throw serviceError(
      journeyError.message ||
        "Failed to create onboarding journey.",
      journeyError,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DEFAULT TASKS
  |--------------------------------------------------------------------------
  */

  const defaultTasks = [
    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Collect required employee documents",
      description:
        "Collect identity, employment and other required documents.",
      category:
        "Documentation",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Prepare employment paperwork",
      description:
        "Prepare and verify employment-related paperwork.",
      category:
        "Documentation",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Set up employee access",
      description:
        "Prepare required systems, applications and account access.",
      category:
        "IT Setup",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Prepare workstation",
      description:
        "Ensure workstation and required equipment are ready.",
      category:
        "Equipment",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Schedule orientation",
      description:
        "Schedule the employee's orientation and introduction.",
      category:
        "Orientation",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Assign manager or buddy",
      description:
        "Assign the employee's reporting manager or onboarding buddy.",
      category:
        "People",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Complete HR orientation",
      description:
        "Complete HR policies, benefits and company orientation.",
      category:
        "Orientation",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Introduce employee to team",
      description:
        "Introduce the new employee to their team and key stakeholders.",
      category:
        "People",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Complete initial training",
      description:
        "Complete required initial role and company training.",
      category:
        "Training",
      status:
        "pending",
      due_date:
        joiningDate,
    },

    {
      organization_id: orgId,
      journey_id: journey.id,
      title:
        "Complete onboarding review",
      description:
        "Review onboarding progress and confirm all required activities are complete.",
      category:
        "Review",
      status:
        "pending",
      due_date:
        joiningDate,
    },
  ];

  /*
  |--------------------------------------------------------------------------
  | INSERT DEFAULT TASKS
  |--------------------------------------------------------------------------
  */

  const {
    data: tasks,
    error: tasksError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .insert(defaultTasks)
    .select("*");

  if (tasksError) {
    console.error(
      "[Onboarding Service] Default task creation failed:",
      tasksError,
    );

    /*
    |--------------------------------------------------------------------------
    | ROLLBACK JOURNEY
    |--------------------------------------------------------------------------
    */

    await supabaseAdmin
      .from("onboarding_journeys")
      .delete()
      .eq("id", journey.id)
      .eq("organization_id", orgId);

    throw serviceError(
      tasksError.message ||
        "Failed to create onboarding checklist.",
      tasksError,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RETURN COMPLETE JOURNEY
  |--------------------------------------------------------------------------
  */

  return {
    ...journey,

    employee:
      employeeRecord,

    onboarding_journey_tasks:
      tasks || [],

    tasks:
      tasks || [],

    task_count:
      (tasks || []).length,

    completed_task_count:
      0,

    progress:
      0,

    percentage:
      0,
  };
}

/*
|--------------------------------------------------------------------------
| DELETE ENTIRE ONBOARDING JOURNEY
|--------------------------------------------------------------------------
|
| Deletes:
|
| 1. All tasks belonging to the journey
| 2. The journey itself
|
| This is intentionally organization-scoped.
|
*/

export async function deleteOnboardingJourney(
  organizationId,
  journeyId,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(journeyId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Journey ID is required.",
    );
  }

  console.log(
    "[Onboarding Service] Deleting journey:",
    {
      organizationId: orgId,
      journeyId: id,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | VERIFY JOURNEY EXISTS
  |--------------------------------------------------------------------------
  */

  const {
    data: journey,
    error: journeyLookupError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .select("id, employee_id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (journeyLookupError) {
    console.error(
      "[Onboarding Service] Journey lookup failed:",
      journeyLookupError,
    );

    throw serviceError(
      journeyLookupError.message ||
        "Failed to find onboarding journey.",
      journeyLookupError,
    );
  }

  if (!journey) {
    throw serviceError(
      "Onboarding journey not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE TASKS FIRST
  |--------------------------------------------------------------------------
  |
  | This prevents foreign-key problems when journey_id
  | references onboarding_journeys.
  |
  */

  const {
    error: taskDeleteError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .delete()
    .eq("journey_id", id)
    .eq("organization_id", orgId);

  if (taskDeleteError) {
    console.error(
      "[Onboarding Service] Failed to delete journey tasks:",
      taskDeleteError,
    );

    throw serviceError(
      taskDeleteError.message ||
        "Failed to delete onboarding journey tasks.",
      taskDeleteError,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE JOURNEY
  |--------------------------------------------------------------------------
  */

  const {
    error: journeyDeleteError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (journeyDeleteError) {
    console.error(
      "[Onboarding Service] Failed to delete journey:",
      journeyDeleteError,
    );

    throw serviceError(
      journeyDeleteError.message ||
        "Failed to delete onboarding journey.",
      journeyDeleteError,
    );
  }

  console.log(
    "[Onboarding Service] Journey deleted successfully:",
    id,
  );

  return {
    success: true,
    journeyId: id,
    employeeId:
      journey.employee_id,
  };
}

/*
|--------------------------------------------------------------------------
| UPDATE JOURNEY STATUS
|--------------------------------------------------------------------------
*/

export async function updateOnboardingJourneyStatus(
  organizationId,
  journeyId,
  status,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(journeyId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Journey ID is required.",
    );
  }

  if (!status) {
    throw serviceError(
      "Status is required.",
    );
  }

  if (!JOURNEY_STATUSES.includes(status)) {
    throw serviceError(
      `Invalid journey status: ${status}`,
    );
  }

  const {
    data: journey,
    error,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .update({
      status,
    })
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error(
      "[Onboarding Service] Failed to update journey status:",
      error,
    );

    throw serviceError(
      error.message ||
        "Failed to update journey status.",
      error,
    );
  }

  if (!journey) {
    throw serviceError(
      "Onboarding journey not found.",
    );
  }

  return getOnboardingJourney(
    orgId,
    id,
  );
}

/*
|--------------------------------------------------------------------------
| CREATE ONBOARDING TASK
|--------------------------------------------------------------------------
*/

export async function createOnboardingTask({
  organizationId,
  journeyId,
  title,
  description = "",
  category = "General",
  dueDate = null,
}) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(journeyId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Journey ID is required.",
    );
  }

  if (!title?.trim()) {
    throw serviceError(
      "Task title is required.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY JOURNEY
  |--------------------------------------------------------------------------
  */

  const {
    data: journey,
    error: journeyError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .select("id, status")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (journeyError) {
    throw serviceError(
      journeyError.message ||
        "Could not verify onboarding journey.",
      journeyError,
    );
  }

  if (!journey) {
    throw serviceError(
      "Onboarding journey not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE TASK
  |--------------------------------------------------------------------------
  */

  const taskRecord = {
    organization_id: orgId,
    journey_id: id,
    title: title.trim(),
    description:
      description || "",
    category:
      category || "General",
    status:
      "pending",
    due_date:
      dueDate || null,
  };

  const {
    data: task,
    error: taskError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .insert(taskRecord)
    .select("*")
    .single();

  if (taskError) {
    console.error(
      "[Onboarding Service] Failed to create task:",
      taskError,
    );

    throw serviceError(
      taskError.message ||
        "Failed to create onboarding task.",
      taskError,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SYNC JOURNEY
  |--------------------------------------------------------------------------
  */

  try {
    await syncJourneyStatus(
      orgId,
      id,
    );
  } catch (syncError) {
    console.warn(
      "[Onboarding Service] Journey status sync failed:",
      syncError,
    );
  }

  return task;
}

/*
|--------------------------------------------------------------------------
| UPDATE ONBOARDING TASK
|--------------------------------------------------------------------------
*/

export async function updateOnboardingTask(
  organizationId,
  taskId,
  updates,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(taskId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Task ID is required.",
    );
  }

  if (
    !updates ||
    typeof updates !== "object"
  ) {
    throw serviceError(
      "Task updates are required.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ONLY ALLOW SAFE FIELDS
  |--------------------------------------------------------------------------
  */

  const allowedFields = [
    "title",
    "description",
    "category",
    "due_date",
    "status",
  ];

  const cleanUpdates = {};

  for (const field of allowedFields) {
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
    Object.keys(cleanUpdates).length === 0
  ) {
    throw serviceError(
      "No valid task updates were provided.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE TITLE
  |--------------------------------------------------------------------------
  */

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "title",
    )
  ) {
    if (
      !cleanUpdates.title?.trim()
    ) {
      throw serviceError(
        "Task title cannot be empty.",
      );
    }

    cleanUpdates.title =
      cleanUpdates.title.trim();
  }

  /*
  |--------------------------------------------------------------------------
  | VALIDATE STATUS
  |--------------------------------------------------------------------------
  */

  if (
    cleanUpdates.status &&
    !TASK_STATUSES.includes(
      cleanUpdates.status,
    )
  ) {
    throw serviceError(
      `Invalid task status: ${cleanUpdates.status}`,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE TASK
  |--------------------------------------------------------------------------
  */

  const {
    data: task,
    error,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .update(cleanUpdates)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error(
      "[Onboarding Service] Failed to update task:",
      error,
    );

    throw serviceError(
      error.message ||
        "Failed to update onboarding task.",
      error,
    );
  }

  if (!task) {
    throw serviceError(
      "Onboarding task not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | AUTOMATIC JOURNEY STATUS
  |--------------------------------------------------------------------------
  */

  try {
    await syncJourneyStatus(
      orgId,
      task.journey_id,
    );
  } catch (syncError) {
    console.warn(
      "[Onboarding Service] Journey status sync failed:",
      syncError,
    );
  }

  return task;
}

/*
|--------------------------------------------------------------------------
| DELETE ONBOARDING TASK
|--------------------------------------------------------------------------
*/

export async function deleteOnboardingTask(
  organizationId,
  taskId,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(taskId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Task ID is required.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FIND TASK
  |--------------------------------------------------------------------------
  */

  const {
    data: existingTask,
    error: lookupError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .select(
      "id, journey_id",
    )
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (lookupError) {
    throw serviceError(
      lookupError.message ||
        "Failed to find onboarding task.",
      lookupError,
    );
  }

  if (!existingTask) {
    throw serviceError(
      "Onboarding task not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE TASK
  |--------------------------------------------------------------------------
  */

  const {
    error: deleteError,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);

  if (deleteError) {
    console.error(
      "[Onboarding Service] Failed to delete task:",
      deleteError,
    );

    throw serviceError(
      deleteError.message ||
        "Failed to delete onboarding task.",
      deleteError,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE JOURNEY STATUS
  |--------------------------------------------------------------------------
  */

  try {
    await syncJourneyStatus(
      orgId,
      existingTask.journey_id,
    );
  } catch (syncError) {
    console.warn(
      "[Onboarding Service] Journey status sync failed:",
      syncError,
    );
  }

  return {
    success: true,
    taskId: id,
  };
}

/*
|--------------------------------------------------------------------------
| GET JOURNEY PROGRESS
|--------------------------------------------------------------------------
*/

export async function getOnboardingJourneyProgress(
  organizationId,
  journeyId,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(journeyId);

  if (!orgId) {
    throw serviceError(
      "Organization ID is required.",
    );
  }

  if (!id) {
    throw serviceError(
      "Journey ID is required.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | VERIFY JOURNEY
  |--------------------------------------------------------------------------
  */

  const {
    data: journey,
    error: journeyError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .select("id")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  if (journeyError) {
    throw serviceError(
      journeyError.message ||
        "Failed to find onboarding journey.",
      journeyError,
    );
  }

  if (!journey) {
    throw serviceError(
      "Onboarding journey not found.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD TASKS
  |--------------------------------------------------------------------------
  */

  const {
    data: tasks,
    error,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .select(
      "id, status",
    )
    .eq("journey_id", id)
    .eq("organization_id", orgId);

  if (error) {
    console.error(
      "[Onboarding Service] Failed to calculate progress:",
      error,
    );

    throw serviceError(
      error.message ||
        "Failed to calculate onboarding progress.",
      error,
    );
  }

  const allTasks =
    tasks || [];

  const total =
    allTasks.length;

  const completed =
    allTasks.filter(
      (task) =>
        task.status ===
        "completed",
    ).length;

  const pending =
    allTasks.filter(
      (task) =>
        task.status ===
          "pending" ||
        task.status ===
          "in_progress",
    ).length;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (completed / total) *
            100,
        );

  return {
    total,
    completed,
    pending,
    percentage,
    progress:
      percentage,
  };
}

/*
|--------------------------------------------------------------------------
| INTERNAL: SYNC JOURNEY STATUS
|--------------------------------------------------------------------------
*/

async function syncJourneyStatus(
  organizationId,
  journeyId,
) {
  const orgId = normalizeOrganizationId(
    organizationId,
  );

  const id = normalizeId(
    journeyId,
  );

  if (!orgId || !id) {
    return;
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD TASKS
  |--------------------------------------------------------------------------
  */

  const {
    data: tasks,
    error,
  } = await supabaseAdmin
    .from("onboarding_journey_tasks")
    .select("status")
    .eq("organization_id", orgId)
    .eq("journey_id", id);

  if (error) {
    throw error;
  }

  const allTasks =
    tasks || [];

  /*
  |--------------------------------------------------------------------------
  | DETERMINE JOURNEY STATUS
  |--------------------------------------------------------------------------
  */

  let status =
    "not_started";

  if (allTasks.length > 0) {
    const completedCount =
      allTasks.filter(
        (task) =>
          task.status ===
          "completed",
      ).length;

    const startedCount =
      allTasks.filter(
        (task) =>
          task.status ===
            "in_progress" ||
          task.status ===
            "completed",
      ).length;

    const cancelledCount =
      allTasks.filter(
        (task) =>
          task.status ===
          "cancelled",
      ).length;

    /*
    |--------------------------------------------------------------------------
    | ALL COMPLETED
    |--------------------------------------------------------------------------
    */

    if (
      completedCount ===
      allTasks.length
    ) {
      status =
        "completed";
    }

    /*
    |--------------------------------------------------------------------------
    | EVERYTHING CANCELLED
    |--------------------------------------------------------------------------
    */

    else if (
      cancelledCount ===
      allTasks.length
    ) {
      status =
        "cancelled";
    }

    /*
    |--------------------------------------------------------------------------
    | SOME TASK STARTED
    |--------------------------------------------------------------------------
    */

    else if (
      startedCount > 0
    ) {
      status =
        "in_progress";
    }

    /*
    |--------------------------------------------------------------------------
    | OTHERWISE NOT STARTED
    |--------------------------------------------------------------------------
    */

    else {
      status =
        "not_started";
    }
  }

  /*
  |--------------------------------------------------------------------------
  | UPDATE JOURNEY
  |--------------------------------------------------------------------------
  */

  const {
    error: updateError,
  } = await supabaseAdmin
    .from("onboarding_journeys")
    .update({
      status,
    })
    .eq("id", id)
    .eq("organization_id", orgId);

  if (updateError) {
    throw updateError;
  }

  console.log(
    "[Onboarding Service] Journey status synced:",
    {
      journeyId: id,
      status,
    },
  );
}