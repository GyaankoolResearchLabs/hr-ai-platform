import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function normalizeRequiredText(value, fieldName) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw createServiceError(
      `${fieldName} is required.`,
      400,
    );
  }

  return text;
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
    throw createServiceError(
      "Progress must be a valid number.",
      400,
    );
  }

  return Math.min(
    100,
    Math.max(0, number),
  );
}

function normalizePriority(value) {
  const priority = String(
    value ?? "medium",
  )
    .trim()
    .toLowerCase();

  const allowed = [
    "low",
    "medium",
    "high",
    "critical",
  ];

  if (!allowed.includes(priority)) {
    throw createServiceError(
      `Invalid priority. Use: ${allowed.join(", ")}.`,
      400,
    );
  }

  return priority;
}

function normalizeStatus(value) {
  const status = String(
    value ?? "planned",
  )
    .trim()
    .toLowerCase();

  const allowed = [
    "planned",
    "in_progress",
    "on_track",
    "at_risk",
    "completed",
    "cancelled",
  ];

  if (!allowed.includes(status)) {
    throw createServiceError(
      `Invalid status. Use: ${allowed.join(", ")}.`,
      400,
    );
  }

  return status;
}

function normalizeDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const date = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createServiceError(
      "Date must use YYYY-MM-DD format.",
      400,
    );
  }

  const parsed = new Date(`${date}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw createServiceError(
      "Invalid date.",
      400,
    );
  }

  return date;
}

function normalizeNumericValue(
  value,
  fieldName,
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw createServiceError(
      `${fieldName} must be a valid number.`,
      400,
    );
  }

  return number;
}

/* =========================================================
   VERIFY OWNER EMPLOYEE
========================================================= */

async function verifyOwnerEmployee(
  organizationId,
  employeeId,
) {
  if (!employeeId) {
    return null;
  }

  const {
    data: employee,
    error,
  } = await supabaseAdmin
    .from("employees")
   .select(
  "id, full_name, department, title",
)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", employeeId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] Owner employee lookup failed:",
      error,
    );

    throw error;
  }

  if (!employee) {
    throw createServiceError(
      "Selected owner does not belong to this organization.",
      400,
    );
  }

  return employee;
}

/* =========================================================
   ENRICH ROADMAP ITEMS WITH OWNER
========================================================= */

async function enrichRoadmapItems(
  organizationId,
  items,
) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const ownerIds = [
    ...new Set(
      items
        .map(
          (item) =>
            item?.owner_employee_id,
        )
        .filter(Boolean),
    ),
  ];

  if (ownerIds.length === 0) {
    return items.map((item) => ({
      ...item,
      owner: null,
    }));
  }

  const {
    data: owners,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
  "id, full_name, department, title, email",
)
    .eq(
      "organization_id",
      organizationId,
    )
    .in("id", ownerIds);

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] Owner enrichment failed:",
      error,
    );

    throw error;
  }

  const ownerMap = new Map(
    (owners || []).map((owner) => [
      String(owner.id),
      owner,
    ]),
  );

  return items.map((item) => ({
    ...item,
    owner:
      ownerMap.get(
        String(
          item.owner_employee_id,
        ),
      ) || null,
  }));
}

/* =========================================================
   GET ALL ROADMAP ITEMS
========================================================= */

export async function getStrategicRoadmapItems(
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
    .from("strategic_hr_roadmap_items")
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
      "[Strategic HR Roadmap Service] GET ALL:",
      error,
    );

    throw error;
  }

  return enrichRoadmapItems(
    organizationId,
    data || [],
  );
}

/* =========================================================
   GET SINGLE ROADMAP ITEM
========================================================= */

export async function getStrategicRoadmapItem(
  organizationId,
  itemId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Roadmap item ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] GET SINGLE:",
      error,
    );

    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Strategic roadmap item not found.",
      404,
    );
  }

  const enriched =
    await enrichRoadmapItems(
      organizationId,
      [data],
    );

  return enriched[0];
}

/* =========================================================
   CREATE ROADMAP ITEM
========================================================= */

export async function createStrategicRoadmapItem({
  organizationId,
  userId,
  ownerEmployeeId,
  title,
  description,
  businessOutcome,
  kpiName,
  baselineValue,
  targetValue,
  unit,
  priority,
  status,
  progress,
  startDate,
  targetDate,
  notes,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const finalTitle =
    normalizeRequiredText(
      title,
      "Roadmap title",
    );

  const finalBusinessOutcome =
    normalizeRequiredText(
      businessOutcome,
      "Business outcome",
    );

  const finalKpiName =
    normalizeRequiredText(
      kpiName,
      "KPI name",
    );

  const finalDescription =
    normalizeText(description);

  const finalNotes =
    normalizeText(notes);

  const finalOwnerId =
    normalizeText(ownerEmployeeId);

  const finalPriority =
    normalizePriority(priority);

  let finalProgress =
    normalizeProgress(progress);

  let finalStatus =
    normalizeStatus(status);

  const finalStartDate =
    normalizeDate(startDate);

  const finalTargetDate =
    normalizeDate(targetDate);

  if (
    finalStartDate &&
    finalTargetDate &&
    finalTargetDate < finalStartDate
  ) {
    throw createServiceError(
      "Target date cannot be before the start date.",
      400,
    );
  }

  if (finalOwnerId) {
    await verifyOwnerEmployee(
      organizationId,
      finalOwnerId,
    );
  }

  const finalBaselineValue =
    normalizeNumericValue(
      baselineValue,
      "Baseline value",
    );

  const finalTargetValue =
    normalizeNumericValue(
      targetValue,
      "Target value",
    );

  const finalUnit =
    normalizeText(unit);

  /* -------------------------------------------------------
     STATUS / PROGRESS CONSISTENCY
  ------------------------------------------------------- */

  if (finalProgress === 100) {
    finalStatus = "completed";
  }

  if (
    finalStatus === "completed"
  ) {
    finalProgress = 100;
  }

  if (
    finalStatus === "cancelled"
  ) {
    finalProgress = Math.min(
      finalProgress,
      99,
    );
  }

  /* -------------------------------------------------------
     INSERT
  ------------------------------------------------------- */

  const payload = {
    organization_id:
      organizationId,

    owner_employee_id:
      finalOwnerId,

    title:
      finalTitle,

    description:
      finalDescription,

    business_outcome:
      finalBusinessOutcome,

    kpi_name:
      finalKpiName,

    baseline_value:
      finalBaselineValue,

    target_value:
      finalTargetValue,

    unit:
      finalUnit,

    priority:
      finalPriority,

    status:
      finalStatus,

    progress:
      finalProgress,

    start_date:
      finalStartDate,

    target_date:
      finalTargetDate,

    notes:
      finalNotes,

    created_by:
      userId || null,
  };

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] CREATE:",
      error,
    );

    throw error;
  }

  const enriched =
    await enrichRoadmapItems(
      organizationId,
      [data],
    );

  return enriched[0];
}

/* =========================================================
   UPDATE ROADMAP ITEM
========================================================= */

export async function updateStrategicRoadmapItem(
  organizationId,
  itemId,
  updates,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Roadmap item ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", itemId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[Strategic HR Roadmap Service] Existing item lookup:",
      existingError,
    );

    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Strategic roadmap item not found.",
      404,
    );
  }

  const body =
    updates && typeof updates === "object"
      ? updates
      : {};

  const payload = {};

  /* -------------------------------------------------------
     TEXT FIELDS
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "title",
    )
  ) {
    payload.title =
      normalizeRequiredText(
        body.title,
        "Roadmap title",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "description",
    )
  ) {
    payload.description =
      normalizeText(
        body.description,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "businessOutcome",
    )
  ) {
    payload.business_outcome =
      normalizeRequiredText(
        body.businessOutcome,
        "Business outcome",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "business_outcome",
    )
  ) {
    payload.business_outcome =
      normalizeRequiredText(
        body.business_outcome,
        "Business outcome",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "kpiName",
    )
  ) {
    payload.kpi_name =
      normalizeRequiredText(
        body.kpiName,
        "KPI name",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "kpi_name",
    )
  ) {
    payload.kpi_name =
      normalizeRequiredText(
        body.kpi_name,
        "KPI name",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "unit",
    )
  ) {
    payload.unit =
      normalizeText(body.unit);
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "notes",
    )
  ) {
    payload.notes =
      normalizeText(body.notes);
  }

  /* -------------------------------------------------------
     OWNER
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "ownerEmployeeId",
    )
  ) {
    const ownerId =
      normalizeText(
        body.ownerEmployeeId,
      );

    if (ownerId) {
      await verifyOwnerEmployee(
        organizationId,
        ownerId,
      );
    }

    payload.owner_employee_id =
      ownerId;
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "owner_employee_id",
    )
  ) {
    const ownerId =
      normalizeText(
        body.owner_employee_id,
      );

    if (ownerId) {
      await verifyOwnerEmployee(
        organizationId,
        ownerId,
      );
    }

    payload.owner_employee_id =
      ownerId;
  }

  /* -------------------------------------------------------
     NUMERIC FIELDS
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "baselineValue",
    )
  ) {
    payload.baseline_value =
      normalizeNumericValue(
        body.baselineValue,
        "Baseline value",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "baseline_value",
    )
  ) {
    payload.baseline_value =
      normalizeNumericValue(
        body.baseline_value,
        "Baseline value",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "targetValue",
    )
  ) {
    payload.target_value =
      normalizeNumericValue(
        body.targetValue,
        "Target value",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "target_value",
    )
  ) {
    payload.target_value =
      normalizeNumericValue(
        body.target_value,
        "Target value",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "progress",
    )
  ) {
    payload.progress =
      normalizeProgress(
        body.progress,
      );
  }

  /* -------------------------------------------------------
     PRIORITY / STATUS
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "priority",
    )
  ) {
    payload.priority =
      normalizePriority(
        body.priority,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "status",
    )
  ) {
    payload.status =
      normalizeStatus(
        body.status,
      );
  }

  /* -------------------------------------------------------
     DATES
  ------------------------------------------------------- */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "startDate",
    )
  ) {
    payload.start_date =
      normalizeDate(
        body.startDate,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "start_date",
    )
  ) {
    payload.start_date =
      normalizeDate(
        body.start_date,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "targetDate",
    )
  ) {
    payload.target_date =
      normalizeDate(
        body.targetDate,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "target_date",
    )
  ) {
    payload.target_date =
      normalizeDate(
        body.target_date,
      );
  }

  /* -------------------------------------------------------
     DATE VALIDATION
  ------------------------------------------------------- */

  const finalStartDate =
    payload.start_date !== undefined
      ? payload.start_date
      : existing.start_date;

  const finalTargetDate =
    payload.target_date !== undefined
      ? payload.target_date
      : existing.target_date;

  if (
    finalStartDate &&
    finalTargetDate &&
    finalTargetDate < finalStartDate
  ) {
    throw createServiceError(
      "Target date cannot be before the start date.",
      400,
    );
  }

  /* -------------------------------------------------------
     STATUS / PROGRESS CONSISTENCY
  ------------------------------------------------------- */

  let finalProgress =
    payload.progress !== undefined
      ? payload.progress
      : Number(existing.progress || 0);

  let finalStatus =
    payload.status !== undefined
      ? payload.status
      : existing.status;

  if (finalProgress === 100) {
    finalStatus = "completed";
  }

  if (
    finalStatus === "completed"
  ) {
    finalProgress = 100;
  }

  payload.progress =
    finalProgress;

  payload.status =
    finalStatus;

  /* -------------------------------------------------------
     UPDATED TIMESTAMP
  ------------------------------------------------------- */

  payload.updated_at =
    new Date().toISOString();

  /* -------------------------------------------------------
     UPDATE
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .update(payload)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] UPDATE:",
      error,
    );

    throw error;
  }

  const enriched =
    await enrichRoadmapItems(
      organizationId,
      [data],
    );

  return enriched[0];
}

/* =========================================================
   DELETE ROADMAP ITEM
========================================================= */

export async function deleteStrategicRoadmapItem(
  organizationId,
  itemId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Roadmap item ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .select("id, title")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", itemId)
    .maybeSingle();

  if (existingError) {
    console.error(
      "[Strategic HR Roadmap Service] DELETE lookup:",
      existingError,
    );

    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Strategic roadmap item not found.",
      404,
    );
  }

  const {
    error,
  } = await supabaseAdmin
    .from("strategic_hr_roadmap_items")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("id", itemId);

  if (error) {
    console.error(
      "[Strategic HR Roadmap Service] DELETE:",
      error,
    );

    throw error;
  }

  return {
    id: existing.id,
    title: existing.title,
  };
}