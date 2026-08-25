import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function normalizeStatus(value, fallback = "draft") {
  const allowed = [
    "draft",
    "published",
    "archived",
  ];

  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!allowed.includes(normalized)) {
    throw createError(
      `Invalid policy status. Allowed values: ${allowed.join(", ")}.`,
      400,
    );
  }

  return normalized;
}

function normalizeVersionStatus(
  value,
  fallback = "draft",
) {
  const allowed = [
    "draft",
    "published",
    "archived",
  ];

  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!allowed.includes(normalized)) {
    throw createError(
      `Invalid version status. Allowed values: ${allowed.join(", ")}.`,
      400,
    );
  }

  return normalized;
}

function normalizeAssignmentStatus(
  value,
  fallback = "pending",
) {
  const allowed = [
    "pending",
    "acknowledged",
    "overdue",
  ];

  const normalized = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!allowed.includes(normalized)) {
    throw createError(
      `Invalid assignment status. Allowed values: ${allowed.join(", ")}.`,
      400,
    );
  }

  return normalized;
}

function normalizePolicy(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    policyCode: row.policy_code,
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestVersion: row.latestVersion || null,
    acknowledgmentSummary:
      row.acknowledgmentSummary || {
        total: 0,
        acknowledged: 0,
        pending: 0,
        overdue: 0,
      },
  };
}

/* =========================================================
   EMPLOYEE VALIDATION
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
      "id, organization_id, full_name, email, department, title, employment_status",
    )
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[Policy] Employee lookup failed:",
      error,
    );

    throw createError(
      "Failed to verify employee.",
      500,
    );
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
   POLICY VALIDATION
========================================================= */

async function getPolicyForOrganization(
  organizationId,
  policyId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  if (!policyId) {
    throw createError(
      "Policy ID is required.",
      400,
    );
  }

  const {
    data: policy,
    error,
  } = await supabaseAdmin
    .from("policies")
    .select("*")
    .eq("id", policyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!policy) {
    throw createError(
      "Policy not found.",
      404,
    );
  }

  return policy;
}

/* =========================================================
   VERSION VALIDATION
========================================================= */

async function getPolicyVersionForOrganization(
  organizationId,
  policyId,
  versionId,
) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  if (!policyId || !versionId) {
    throw createError(
      "Policy and version are required.",
      400,
    );
  }

  const {
    data: version,
    error,
  } = await supabaseAdmin
    .from("policy_versions")
    .select("*")
    .eq("id", versionId)
    .eq("policy_id", policyId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!version) {
    throw createError(
      "Policy version not found.",
      404,
    );
  }

  return version;
}

/* =========================================================
   GET POLICIES
========================================================= */

export async function getPolicies({
  organizationId,
  status = "all",
  search = "",
  category = "",
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  let query = supabaseAdmin
    .from("policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", {
      ascending: false,
    });

  if (
    status &&
    status !== "all"
  ) {
    query = query.eq(
      "status",
      normalizeStatus(status),
    );
  }

  if (category) {
    query = query.eq(
      "category",
      String(category).trim(),
    );
  }

  if (search) {
    const searchValue =
      String(search).trim();

    if (searchValue) {
      query = query.or(
        `title.ilike.%${searchValue}%,policy_code.ilike.%${searchValue}%,description.ilike.%${searchValue}%`,
      );
    }
  }

  const {
    data: policies,
    error: policiesError,
  } = await query;

  if (policiesError) {
    throw policiesError;
  }

  const policyRows = policies || [];

  if (policyRows.length === 0) {
    return [];
  }

  const policyIds =
    policyRows.map(
      (policy) => policy.id,
    );

  const {
    data: versions,
    error: versionsError,
  } = await supabaseAdmin
    .from("policy_versions")
    .select("*")
    .eq("organization_id", organizationId)
    .in("policy_id", policyIds)
    .order("version_number", {
      ascending: false,
    });

  if (versionsError) {
    throw versionsError;
  }

  const versionRows =
    versions || [];

  const latestVersionMap =
    new Map();

  for (const version of versionRows) {
    if (
      !latestVersionMap.has(
        version.policy_id,
      )
    ) {
      latestVersionMap.set(
        version.policy_id,
        version,
      );
    }
  }

  const {
    data: assignments,
    error: assignmentsError,
  } = await supabaseAdmin
    .from("policy_assignments")
    .select(
      "id, policy_id, status",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .in("policy_id", policyIds);

  if (assignmentsError) {
    throw assignmentsError;
  }

  const summaryMap =
    new Map();

  for (const assignment of
    assignments || []) {
    if (
      !summaryMap.has(
        assignment.policy_id,
      )
    ) {
      summaryMap.set(
        assignment.policy_id,
        {
          total: 0,
          acknowledged: 0,
          pending: 0,
          overdue: 0,
        },
      );
    }

    const summary =
      summaryMap.get(
        assignment.policy_id,
      );

    summary.total += 1;

    if (
      assignment.status ===
      "acknowledged"
    ) {
      summary.acknowledged += 1;
    }

    if (
      assignment.status ===
      "pending"
    ) {
      summary.pending += 1;
    }

    if (
      assignment.status ===
      "overdue"
    ) {
      summary.overdue += 1;
    }
  }

  return policyRows.map(
    (policy) =>
      normalizePolicy({
        ...policy,

        latestVersion:
          latestVersionMap.get(
            policy.id,
          ) || null,

        acknowledgmentSummary:
          summaryMap.get(
            policy.id,
          ) || {
            total: 0,
            acknowledged: 0,
            pending: 0,
            overdue: 0,
          },
      }),
  );
}

/* =========================================================
   GET SINGLE POLICY
========================================================= */

export async function getPolicyById(
  organizationId,
  policyId,
) {
  const policy =
    await getPolicyForOrganization(
      organizationId,
      policyId,
    );

  const {
    data: versions,
    error: versionsError,
  } = await supabaseAdmin
    .from("policy_versions")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .order("version_number", {
      ascending: false,
    });

  if (versionsError) {
    throw versionsError;
  }

  const {
    data: assignments,
    error: assignmentsError,
  } = await supabaseAdmin
    .from("policy_assignments")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .order("assigned_at", {
      ascending: false,
    });

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignmentRows =
    assignments || [];

  const employeeIds = [
    ...new Set(
      assignmentRows
        .map(
          (assignment) =>
            assignment.employee_id,
        )
        .filter(Boolean),
    ),
  ];

  let employees = [];

  if (employeeIds.length > 0) {
    const {
      data: employeeRows,
      error: employeesError,
    } = await supabaseAdmin
      .from("employees")
      .select(
        "id, full_name, email, department, title, employment_status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .in(
        "id",
        employeeIds,
      );

    if (employeesError) {
      throw employeesError;
    }

    employees =
      employeeRows || [];
  }

  const employeeMap =
    new Map(
      employees.map(
        (employee) => [
          employee.id,
          employee,
        ],
      ),
    );

  const {
    data: events,
    error: eventsError,
  } = await supabaseAdmin
    .from("policy_events")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .order("event_at", {
      ascending: false,
    });

  if (eventsError) {
    throw eventsError;
  }

  const latestVersion =
    (versions || [])[0] ||
    null;

  const summary = {
    total: assignmentRows.length,
    acknowledged:
      assignmentRows.filter(
        (item) =>
          item.status ===
          "acknowledged",
      ).length,
    pending:
      assignmentRows.filter(
        (item) =>
          item.status ===
          "pending",
      ).length,
    overdue:
      assignmentRows.filter(
        (item) =>
          item.status ===
          "overdue",
      ).length,
  };

  return {
    ...normalizePolicy({
      ...policy,

      latestVersion,

      acknowledgmentSummary:
        summary,
    }),

    versions:
      versions || [],

    assignments:
      assignmentRows.map(
        (assignment) => ({
          ...assignment,
          employee:
            employeeMap.get(
              assignment.employee_id,
            ) || null,
        }),
      ),

    events:
      events || [],
  };
}

/* =========================================================
   CREATE POLICY
========================================================= */

export async function createPolicy({
  organizationId,
  createdBy,
  policyCode,
  title,
  category,
  description,
  content,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  const normalizedCode =
    normalizeString(policyCode);

  const normalizedTitle =
    normalizeString(title);

  if (!normalizedCode) {
    throw createError(
      "Policy code is required.",
      400,
    );
  }

  if (!normalizedTitle) {
    throw createError(
      "Policy title is required.",
      400,
    );
  }

  const normalizedContent =
    normalizeString(content);

  if (!normalizedContent) {
    throw createError(
      "Policy content is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from("policies")
      .select("id")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "policy_code",
        normalizedCode,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw createError(
      "A policy with this policy code already exists.",
      409,
    );
  }

  const {
    data: policy,
    error: policyError,
  } =
    await supabaseAdmin
      .from("policies")
      .insert({
        organization_id:
          organizationId,
        policy_code:
          normalizedCode,
        title:
          normalizedTitle,
        category:
          normalizeString(category),
        description:
          normalizeString(
            description,
          ),
        status: "draft",
        created_by:
          createdBy || null,
      })
      .select("*")
      .single();

  if (policyError) {
    throw policyError;
  }

  const {
    data: version,
    error: versionError,
  } =
    await supabaseAdmin
      .from("policy_versions")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          policy.id,
        version_number: 1,
        content:
          normalizedContent,
        status: "draft",
        created_by:
          createdBy || null,
      })
      .select("*")
      .single();

  if (versionError) {
    await supabaseAdmin
      .from("policies")
      .delete()
      .eq("id", policy.id)
      .eq(
        "organization_id",
        organizationId,
      );

    throw versionError;
  }

  const {
    error: eventError,
  } =
    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          policy.id,
        policy_version_id:
          version.id,
        event_type:
          "policy_created",
        description:
          `Policy ${normalizedCode} was created.`,
        performed_by:
          createdBy || null,
      });

  if (eventError) {
    console.error(
      "[Policy] Policy creation event failed:",
      eventError,
    );
  }

  return getPolicyById(
    organizationId,
    policy.id,
  );
}

/* =========================================================
   UPDATE POLICY
========================================================= */

export async function updatePolicy(
  organizationId,
  policyId,
  updates,
) {
  const existing =
    await getPolicyForOrganization(
      organizationId,
      policyId,
    );

  const allowedFields = [
    "title",
    "category",
    "description",
    "status",
  ];

  const cleanUpdates = {};

  for (const field of
    allowedFields) {
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
    Object.keys(cleanUpdates).length ===
    0
  ) {
    throw createError(
      "No valid policy updates were provided.",
      400,
    );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "title",
    )
  ) {
    cleanUpdates.title =
      normalizeString(
        cleanUpdates.title,
      );

    if (!cleanUpdates.title) {
      throw createError(
        "Policy title is required.",
        400,
      );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "category",
    )
  ) {
    cleanUpdates.category =
      normalizeString(
        cleanUpdates.category,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "description",
    )
  ) {
    cleanUpdates.description =
      normalizeString(
        cleanUpdates.description,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      cleanUpdates,
      "status",
    )
  ) {
    cleanUpdates.status =
      normalizeStatus(
        cleanUpdates.status,
      );
  }

  const {
    data: updated,
    error,
  } = await supabaseAdmin
    .from("policies")
    .update(cleanUpdates)
    .eq("id", policyId)
    .eq(
      "organization_id",
      organizationId,
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (
    existing.status !==
      updated.status &&
    updated.status === "archived"
  ) {
    const {
      error: eventError,
    } =
      await supabaseAdmin
        .from("policy_events")
        .insert({
          organization_id:
            organizationId,
          policy_id:
            policyId,
          event_type:
            "policy_archived",
          description:
            `Policy ${updated.policy_code} was archived.`,
        });

    if (eventError) {
      console.error(
        "[Policy] Archive event failed:",
        eventError,
      );
    }
  }

  return getPolicyById(
    organizationId,
    policyId,
  );
}

/* =========================================================
   CREATE POLICY VERSION
========================================================= */

export async function createPolicyVersion({
  organizationId,
  policyId,
  createdBy,
  content,
  sourceUrl,
  effectiveDate,
}) {
  await getPolicyForOrganization(
    organizationId,
    policyId,
  );

  const normalizedContent =
    normalizeString(content);

  if (!normalizedContent) {
    throw createError(
      "Policy content is required.",
      400,
    );
  }

  const {
    data: versions,
    error: versionsError,
  } =
    await supabaseAdmin
      .from("policy_versions")
      .select(
        "version_number",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "policy_id",
        policyId,
      )
      .order(
        "version_number",
        {
          ascending: false,
        },
      )
      .limit(1);

  if (versionsError) {
    throw versionsError;
  }

  const latestVersionNumber =
    versions?.[0]
      ?.version_number || 0;

  const nextVersionNumber =
    latestVersionNumber + 1;

  const {
    data: version,
    error: versionError,
  } =
    await supabaseAdmin
      .from("policy_versions")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          policyId,
        version_number:
          nextVersionNumber,
        content:
          normalizedContent,
        source_url:
          normalizeString(
            sourceUrl,
          ),
        status: "draft",
        effective_date:
          effectiveDate || null,
        created_by:
          createdBy || null,
      })
      .select("*")
      .single();

  if (versionError) {
    throw versionError;
  }

  const {
    error: eventError,
  } =
    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          policyId,
        policy_version_id:
          version.id,
        event_type:
          "version_created",
        description:
          `Version ${nextVersionNumber} was created.`,
        performed_by:
          createdBy || null,
      });

  if (eventError) {
    console.error(
      "[Policy] Version creation event failed:",
      eventError,
    );
  }

  return getPolicyById(
    organizationId,
    policyId,
  );
}

/* =========================================================
   PUBLISH VERSION
========================================================= */

export async function publishPolicyVersion({
  organizationId,
  policyId,
  versionId,
  publishedBy,
}) {
  const policy =
    await getPolicyForOrganization(
      organizationId,
      policyId,
    );

  const version =
    await getPolicyVersionForOrganization(
      organizationId,
      policyId,
      versionId,
    );

  if (
    version.status ===
    "published"
  ) {
    throw createError(
      "This policy version is already published.",
      400,
    );
  }

  if (
    version.status ===
    "archived"
  ) {
    throw createError(
      "An archived policy version cannot be published.",
      400,
    );
  }

  const {
    data: publishedVersion,
    error: versionError,
  } =
    await supabaseAdmin
      .from("policy_versions")
      .update({
        status: "published",
        published_at:
          new Date().toISOString(),
        published_by:
          publishedBy || null,
      })
      .eq("id", versionId)
      .eq(
        "policy_id",
        policyId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .select("*")
      .single();

  if (versionError) {
    throw versionError;
  }

  /*
   * Archive any previously published version.
   */
  const {
    error: archiveError,
  } = await supabaseAdmin
    .from("policy_versions")
    .update({
      status: "archived",
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .eq(
      "status",
      "published",
    )
    .neq(
      "id",
      versionId,
    );

  if (archiveError) {
    throw archiveError;
  }

  /*
   * The policy master record reflects the currently
   * published version.
   */
  const {
    error: policyError,
  } = await supabaseAdmin
    .from("policies")
    .update({
      status: "published",
    })
    .eq("id", policyId)
    .eq(
      "organization_id",
      organizationId,
    );

  if (policyError) {
    throw policyError;
  }

  const {
    error: eventError,
  } = await supabaseAdmin
    .from("policy_events")
    .insert({
      organization_id:
        organizationId,
      policy_id:
        policyId,
      policy_version_id:
        versionId,
      event_type:
        "version_published",
      description:
        `Version ${publishedVersion.version_number} of ${policy.policy_code} was published.`,
      performed_by:
        publishedBy || null,
    });

  if (eventError) {
    console.error(
      "[Policy] Publish event failed:",
      eventError,
    );
  }

  return getPolicyById(
    organizationId,
    policyId,
  );
}

/* =========================================================
   ARCHIVE VERSION
========================================================= */

export async function archivePolicyVersion({
  organizationId,
  policyId,
  versionId,
  performedBy,
}) {
  const version =
    await getPolicyVersionForOrganization(
      organizationId,
      policyId,
      versionId,
    );

  if (
    version.status ===
    "archived"
  ) {
    throw createError(
      "This policy version is already archived.",
      400,
    );
  }

  const {
    data: updatedVersion,
    error,
  } = await supabaseAdmin
    .from("policy_versions")
    .update({
      status: "archived",
    })
    .eq("id", versionId)
    .eq(
      "policy_id",
      policyId,
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const {
    error: eventError,
  } = await supabaseAdmin
    .from("policy_events")
    .insert({
      organization_id:
        organizationId,
      policy_id:
        policyId,
      policy_version_id:
        versionId,
      event_type:
        "version_archived",
      description:
        `Version ${updatedVersion.version_number} was archived.`,
      performed_by:
        performedBy || null,
    });

  if (eventError) {
    console.error(
      "[Policy] Archive version event failed:",
      eventError,
    );
  }

  return getPolicyById(
    organizationId,
    policyId,
  );
}

/* =========================================================
   GET ASSIGNMENTS
========================================================= */

export async function getPolicyAssignments({
  organizationId,
  policyId,
  status = "all",
  employeeId = null,
}) {
  await getPolicyForOrganization(
    organizationId,
    policyId,
  );

  let query = supabaseAdmin
    .from("policy_assignments")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .order("assigned_at", {
      ascending: false,
    });

  if (
    status &&
    status !== "all"
  ) {
    query = query.eq(
      "status",
      normalizeAssignmentStatus(
        status,
      ),
    );
  }

  if (employeeId) {
    query = query.eq(
      "employee_id",
      employeeId,
    );
  }

  const {
    data: assignments,
    error,
  } = await query;

  if (error) {
    throw error;
  }

  const rows =
    assignments || [];

  if (rows.length === 0) {
    return [];
  }

  const employeeIds = [
    ...new Set(
      rows.map(
        (row) =>
          row.employee_id,
      ),
    ),
  ];

  const {
    data: employees,
    error: employeesError,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, full_name, email, department, title, employment_status",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .in(
      "id",
      employeeIds,
    );

  if (employeesError) {
    throw employeesError;
  }

  const employeeMap =
    new Map(
      (employees || []).map(
        (employee) => [
          employee.id,
          employee,
        ],
      ),
    );

  return rows.map(
    (assignment) => ({
      ...assignment,
      employee:
        employeeMap.get(
          assignment.employee_id,
        ) || null,
    }),
  );
}

/* =========================================================
   ASSIGN POLICY
========================================================= */

export async function assignPolicy({
  organizationId,
  policyId,
  policyVersionId,
  employeeId,
  dueDate,
  performedBy,
}) {
  await getPolicyForOrganization(
    organizationId,
    policyId,
  );

  const version =
    await getPolicyVersionForOrganization(
      organizationId,
      policyId,
      policyVersionId,
    );

  if (
    version.status !==
    "published"
  ) {
    throw createError(
      "Only a published policy version can be assigned.",
      400,
    );
  }

  await verifyEmployeeBelongsToOrganization(
    organizationId,
    employeeId,
  );

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from("policy_assignments")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "policy_version_id",
        policyVersionId,
      )
      .eq(
        "employee_id",
        employeeId,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw createError(
      "This policy version is already assigned to the selected employee.",
      409,
    );
  }

  const {
    data: assignment,
    error,
  } = await supabaseAdmin
    .from("policy_assignments")
    .insert({
      organization_id:
        organizationId,
      policy_id:
        policyId,
      policy_version_id:
        policyVersionId,
      employee_id:
        employeeId,
      due_date:
        dueDate || null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const {
    error: eventError,
  } =
    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          policyId,
        policy_version_id:
          policyVersionId,
        assignment_id:
          assignment.id,
        event_type:
          "employee_assigned",
        description:
          "Policy assigned to employee.",
        performed_by:
          performedBy || null,
      });

  if (eventError) {
    console.error(
      "[Policy] Assignment event failed:",
      eventError,
    );
  }

  return assignment;
}

/* =========================================================
   ACKNOWLEDGE POLICY
========================================================= */

export async function acknowledgePolicyAssignment({
  organizationId,
  assignmentId,
  acknowledgedBy,
  acknowledgmentNote,
}) {
  if (!organizationId) {
    throw createError(
      "Organization ID is required.",
      400,
    );
  }

  const {
    data: assignment,
    error: assignmentError,
  } =
    await supabaseAdmin
      .from("policy_assignments")
      .select("*")
      .eq(
        "id",
        assignmentId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .maybeSingle();

  if (assignmentError) {
    throw assignmentError;
  }

  if (!assignment) {
    throw createError(
      "Policy assignment not found.",
      404,
    );
  }

  if (
    assignment.status ===
    "acknowledged"
  ) {
    return assignment;
  }

  const {
    data: updated,
    error: updateError,
  } =
    await supabaseAdmin
      .from("policy_assignments")
      .update({
        status:
          "acknowledged",
        acknowledged_at:
          new Date().toISOString(),
        acknowledged_by:
          acknowledgedBy || null,
        acknowledgment_note:
          normalizeString(
            acknowledgmentNote,
          ),
      })
      .eq(
        "id",
        assignmentId,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .select("*")
      .single();

  if (updateError) {
    throw updateError;
  }

  const {
    error: eventError,
  } =
    await supabaseAdmin
      .from("policy_events")
      .insert({
        organization_id:
          organizationId,
        policy_id:
          assignment.policy_id,
        policy_version_id:
          assignment.policy_version_id,
        assignment_id:
          assignment.id,
        event_type:
          "acknowledgment_recorded",
        description:
          "Employee acknowledgment was recorded.",
        performed_by:
          acknowledgedBy || null,
      });

  if (eventError) {
    console.error(
      "[Policy] Acknowledgment event failed:",
      eventError,
    );
  }

  return updated;
}

/* =========================================================
   GET POLICY EVENTS
========================================================= */

export async function getPolicyEvents(
  organizationId,
  policyId,
) {
  await getPolicyForOrganization(
    organizationId,
    policyId,
  );

  const {
    data: events,
    error,
  } = await supabaseAdmin
    .from("policy_events")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "policy_id",
      policyId,
    )
    .order("event_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return events || [];
}