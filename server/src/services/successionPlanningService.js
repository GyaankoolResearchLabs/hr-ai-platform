import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   ERROR / NORMALIZATION HELPERS
========================================================= */

function createServiceError(
  message,
  statusCode = 500,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function normalizeRequiredText(
  value,
  fieldName,
) {
  const text = String(
    value ?? "",
  ).trim();

  if (!text) {
    throw createServiceError(
      `${fieldName} is required.`,
      400,
    );
  }

  return text;
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

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw createServiceError(
      "Date must use YYYY-MM-DD format.",
      400,
    );
  }

  const parsed = new Date(
    `${date}T00:00:00Z`,
  );

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    throw createServiceError(
      "Invalid date.",
      400,
    );
  }

  return date;
}

function normalizeCriticality(value) {
  const criticality = String(
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

  if (
    !allowed.includes(
      criticality,
    )
  ) {
    throw createServiceError(
      `Invalid criticality. Use: ${allowed.join(", ")}.`,
      400,
    );
  }

  return criticality;
}

function normalizePlanStatus(value) {
  const status = String(
    value ?? "planned",
  )
    .trim()
    .toLowerCase();

  const allowed = [
    "planned",
    "developing",
    "ready",
    "at_risk",
    "completed",
  ];

  if (
    !allowed.includes(status)
  ) {
    throw createServiceError(
      `Invalid succession status. Use: ${allowed.join(", ")}.`,
      400,
    );
  }

  return status;
}

function normalizeReadiness(value) {
  const readiness = String(
    value ?? "developing",
  )
    .trim()
    .toLowerCase();

  const allowed = [
    "ready_now",
    "ready_1_2_years",
    "ready_3_plus_years",
    "developing",
    "not_ready",
  ];

  if (
    !allowed.includes(readiness)
  ) {
    throw createServiceError(
      `Invalid readiness. Use: ${allowed.join(", ")}.`,
      400,
    );
  }

  return readiness;
}

function normalizeScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const score = Number(value);

  if (!Number.isFinite(score)) {
    throw createServiceError(
      "Readiness score must be a valid number.",
      400,
    );
  }

  if (
    score < 0 ||
    score > 100
  ) {
    throw createServiceError(
      "Readiness score must be between 0 and 100.",
      400,
    );
  }

  return Math.round(score);
}

function normalizeBoolean(value) {
  if (
    value === true ||
    value === false
  ) {
    return value;
  }

  if (
    value === "true" ||
    value === 1 ||
    value === "1"
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   EMPLOYEE VERIFICATION
========================================================= */

async function verifyEmployee(
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
      "id, full_name, email, department, title, employment_status",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      employeeId,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[Succession Planning Service] Employee lookup failed:",
      error,
    );

    throw error;
  }

  if (!employee) {
    throw createServiceError(
      "Selected employee does not belong to this organization.",
      400,
    );
  }

  return employee;
}

/* =========================================================
   CURRENT HOLDER ENRICHMENT
========================================================= */

async function enrichCurrentHolders(
  organizationId,
  plans,
) {
  if (
    !Array.isArray(plans) ||
    plans.length === 0
  ) {
    return [];
  }

  const holderIds = [
    ...new Set(
      plans
        .map(
          (plan) =>
            plan?.current_holder_id,
        )
        .filter(Boolean),
    ),
  ];

  if (
    holderIds.length === 0
  ) {
    return plans.map(
      (plan) => ({
        ...plan,
        current_holder: null,
      }),
    );
  }

  const {
    data: holders,
    error,
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
      holderIds,
    );

  if (error) {
    console.error(
      "[Succession Planning Service] Current holder enrichment failed:",
      error,
    );

    throw error;
  }

  const holderMap = new Map(
    (holders || []).map(
      (employee) => [
        String(employee.id),
        employee,
      ],
    ),
  );

  return plans.map(
    (plan) => ({
      ...plan,

      current_holder:
        holderMap.get(
          String(
            plan.current_holder_id,
          ),
        ) || null,
    }),
  );
}

/* =========================================================
   CANDIDATE ENRICHMENT
========================================================= */

async function enrichCandidates(
  organizationId,
  candidates,
) {
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0
  ) {
    return [];
  }

  const employeeIds = [
    ...new Set(
      candidates
        .map(
          (candidate) =>
            candidate?.employee_id,
        )
        .filter(Boolean),
    ),
  ];

  if (
    employeeIds.length === 0
  ) {
    return candidates.map(
      (candidate) => ({
        ...candidate,
        employee: null,
      }),
    );
  }

  const {
    data: employees,
    error,
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

  if (error) {
    console.error(
      "[Succession Planning Service] Candidate enrichment failed:",
      error,
    );

    throw error;
  }

  const employeeMap = new Map(
    (employees || []).map(
      (employee) => [
        String(employee.id),
        employee,
      ],
    ),
  );

  return candidates.map(
    (candidate) => ({
      ...candidate,

      employee:
        employeeMap.get(
          String(
            candidate.employee_id,
          ),
        ) || null,
    }),
  );
}

/* =========================================================
   GET CANDIDATES FOR PLANS
========================================================= */

async function getCandidatesForPlans(
  organizationId,
  planIds,
) {
  if (
    !Array.isArray(planIds) ||
    planIds.length === 0
  ) {
    return new Map();
  }

  const {
    data: candidates,
    error,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .select("*")
    .in(
      "succession_plan_id",
      planIds,
    )
    .order(
      "is_primary",
      {
        ascending: false,
      },
    )
    .order(
      "readiness_score",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "[Succession Planning Service] Candidate lookup failed:",
      error,
    );

    throw error;
  }

  const enriched =
    await enrichCandidates(
      organizationId,
      candidates || [],
    );

  const candidateMap =
    new Map();

  for (
    const candidate of enriched
  ) {
    const planId =
      String(
        candidate.succession_plan_id,
      );

    if (
      !candidateMap.has(planId)
    ) {
      candidateMap.set(
        planId,
        [],
      );
    }

    candidateMap
      .get(planId)
      .push(candidate);
  }

  return candidateMap;
}

/* =========================================================
   GET ALL SUCCESSION PLANS
========================================================= */

export async function getSuccessionPlans(
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
    .from("succession_plans")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (error) {
    console.error(
      "[Succession Planning Service] GET ALL:",
      error,
    );

    throw error;
  }

  const plans =
    await enrichCurrentHolders(
      organizationId,
      data || [],
    );

  const planIds =
    plans.map(
      (plan) => plan.id,
    );

  const candidateMap =
    await getCandidatesForPlans(
      organizationId,
      planIds,
    );

  return plans.map(
    (plan) => {
      const candidates =
        candidateMap.get(
          String(plan.id),
        ) || [];

      const primarySuccessor =
        candidates.find(
          (candidate) =>
            candidate?.is_primary === true,
        );

      return {
        ...plan,

        candidates,

        primary_successor_employee_id:
          primarySuccessor?.employee_id ??
          null,
      };
    },
  );
}

/* =========================================================
   GET SINGLE SUCCESSION PLAN
========================================================= */

export async function getSuccessionPlan(
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
      "Succession plan ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("succession_plans")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      planId,
    )
    .maybeSingle();

  if (error) {
    console.error(
      "[Succession Planning Service] GET SINGLE:",
      error,
    );

    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Succession plan not found.",
      404,
    );
  }

  const [
    enrichedPlans,
    candidateMap,
  ] = await Promise.all([
    enrichCurrentHolders(
      organizationId,
      [data],
    ),

    getCandidatesForPlans(
      organizationId,
      [data.id],
    ),
  ]);

  const candidates =
    candidateMap.get(
      String(data.id),
    ) || [];

  const primarySuccessor =
    candidates.find(
      (candidate) =>
        candidate?.is_primary === true,
    );

  return {
    ...enrichedPlans[0],

    candidates,

    primary_successor_employee_id:
      primarySuccessor?.employee_id ??
      null,
  };
}

/* =========================================================
   CREATE SUCCESSION PLAN
========================================================= */

export async function createSuccessionPlan({
  organizationId,
  userId,
  roleTitle,
  department,
  currentHolderId,
  criticality,
  readinessScore,
  status,
  targetTransitionDate,
  businessImpact,
  notes,
  candidates = [],
  primarySuccessorEmployeeId,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const finalRoleTitle =
    normalizeRequiredText(
      roleTitle,
      "Role title",
    );

  const finalDepartment =
    normalizeText(
      department,
    );

  const finalHolderId =
    normalizeText(
      currentHolderId,
    );

  /* IMPORTANT:
     Plan-level readiness score */
  const finalReadinessScore =
    normalizeScore(
      readinessScore,
    );

  const finalCriticality =
    normalizeCriticality(
      criticality,
    );

  const finalStatus =
    normalizePlanStatus(
      status,
    );

  const finalTransitionDate =
    normalizeDate(
      targetTransitionDate,
    );

  const finalBusinessImpact =
    normalizeText(
      businessImpact,
    );

  const finalNotes =
    normalizeText(
      notes,
    );

  const primarySuccessorId =
    normalizeText(
      primarySuccessorEmployeeId,
    );

  if (finalHolderId) {
    await verifyEmployee(
      organizationId,
      finalHolderId,
    );
  }

  if (primarySuccessorId) {
    if (
      finalHolderId &&
      String(
        primarySuccessorId,
      ) ===
        String(
          finalHolderId,
        )
    ) {
      throw createServiceError(
        "The current role holder cannot also be the primary successor.",
        400,
      );
    }

    await verifyEmployee(
      organizationId,
      primarySuccessorId,
    );
  }

  /* =======================================================
     CREATE PLAN
  ======================================================= */

  const {
    data: plan,
    error: planError,
  } = await supabaseAdmin
    .from("succession_plans")
    .insert({
      organization_id:
        organizationId,

      role_title:
        finalRoleTitle,

      department:
        finalDepartment,

      current_holder_id:
        finalHolderId,

      /* FIXED */
      readiness_score:
        finalReadinessScore,

      criticality:
        finalCriticality,

      status:
        finalStatus,

      target_transition_date:
        finalTransitionDate,

      business_impact:
        finalBusinessImpact,

      notes:
        finalNotes,

      created_by:
        userId || null,
    })
    .select("*")
    .single();

  if (planError) {
    console.error(
      "[Succession Planning Service] CREATE PLAN:",
      planError,
    );

    throw planError;
  }

  /* =======================================================
     NORMALIZE CANDIDATES
  ======================================================= */

  const normalizedCandidates =
    Array.isArray(candidates)
      ? [...candidates]
      : [];

  /*
   * If the frontend only sends
   * primary_successor_employee_id,
   * automatically create a candidate.
   */

  if (primarySuccessorId) {
    const primaryIndex =
      normalizedCandidates.findIndex(
        (candidate) =>
          String(
            candidate?.employeeId ??
              candidate?.employee_id ??
              "",
          ) ===
          String(
            primarySuccessorId,
          ),
      );

    if (primaryIndex >= 0) {
      normalizedCandidates[
        primaryIndex
      ] = {
        ...normalizedCandidates[
          primaryIndex
        ],

        isPrimary: true,
      };
    } else {
      normalizedCandidates.push({
        employeeId:
          primarySuccessorId,

        readiness:
          "developing",

        readinessScore:
          0,

        isPrimary:
          true,
      });
    }
  }

  const candidatePayloads =
    [];

  const seenEmployees =
    new Set();

  for (
    const candidate of normalizedCandidates
  ) {
    const employeeId =
      normalizeText(
        candidate?.employeeId ??
          candidate?.employee_id,
      );

    if (!employeeId) {
      continue;
    }

    if (
      seenEmployees.has(
        employeeId,
      )
    ) {
      continue;
    }

    seenEmployees.add(
      employeeId,
    );

    if (
      finalHolderId &&
      String(employeeId) ===
        String(finalHolderId)
    ) {
      throw createServiceError(
        "The current role holder cannot also be a succession candidate.",
        400,
      );
    }

    await verifyEmployee(
      organizationId,
      employeeId,
    );

    candidatePayloads.push({
      succession_plan_id:
        plan.id,

      employee_id:
        employeeId,

      readiness:
        normalizeReadiness(
          candidate?.readiness,
        ),

      readiness_score:
        normalizeScore(
          candidate?.readinessScore ??
            candidate?.readiness_score,
        ),

      strengths:
        normalizeText(
          candidate?.strengths,
        ),

      development_gaps:
        normalizeText(
          candidate?.developmentGaps ??
            candidate?.development_gaps,
        ),

      development_actions:
        normalizeText(
          candidate?.developmentActions ??
            candidate?.development_actions,
        ),

      target_ready_date:
        normalizeDate(
          candidate?.targetReadyDate ??
            candidate?.target_ready_date,
        ),

      is_primary:
        normalizeBoolean(
          candidate?.isPrimary ??
            candidate?.is_primary,
        ),
    });
  }

  /* =======================================================
     ONLY ONE PRIMARY CANDIDATE
  ======================================================= */

  let primaryFound = false;

  for (
    const candidate of candidatePayloads
  ) {
    if (candidate.is_primary) {
      if (primaryFound) {
        candidate.is_primary =
          false;
      } else {
        primaryFound = true;
      }
    }
  }

  /* =======================================================
     INSERT CANDIDATES
  ======================================================= */

  let insertedCandidates =
    [];

  if (
    candidatePayloads.length > 0
  ) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .insert(
        candidatePayloads,
      )
      .select("*");

    if (error) {
      console.error(
        "[Succession Planning Service] CREATE CANDIDATES:",
        error,
      );

      await supabaseAdmin
        .from(
          "succession_plans",
        )
        .delete()
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "id",
          plan.id,
        );

      throw error;
    }

    insertedCandidates =
      data || [];
  }

  const enrichedPlans =
    await enrichCurrentHolders(
      organizationId,
      [plan],
    );

  const enrichedCandidates =
    await enrichCandidates(
      organizationId,
      insertedCandidates,
    );

  const primarySuccessor =
    enrichedCandidates.find(
      (candidate) =>
        candidate?.is_primary === true,
    );

  return {
    ...enrichedPlans[0],

    candidates:
      enrichedCandidates,

    primary_successor_employee_id:
      primarySuccessor?.employee_id ??
      null,
  };
}

/* =========================================================
   UPDATE SUCCESSION PLAN
========================================================= */

export async function updateSuccessionPlan(
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
      "Succession plan ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from("succession_plans")
    .select("*")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      planId,
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Succession plan not found.",
      404,
    );
  }

  const body =
    updates &&
    typeof updates === "object"
      ? updates
      : {};

  const payload = {};

  /* =======================================================
     ROLE TITLE
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "roleTitle",
    )
  ) {
    payload.role_title =
      normalizeRequiredText(
        body.roleTitle,
        "Role title",
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "role_title",
    )
  ) {
    payload.role_title =
      normalizeRequiredText(
        body.role_title,
        "Role title",
      );
  }

  /* =======================================================
     DEPARTMENT
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "department",
    )
  ) {
    payload.department =
      normalizeText(
        body.department,
      );
  }

  /* =======================================================
     CURRENT HOLDER
  ======================================================= */

  const hasCurrentHolder =
    Object.prototype.hasOwnProperty.call(
      body,
      "currentHolderId",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "current_holder_id",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "current_holder_employee_id",
    );

  if (hasCurrentHolder) {
    const holderId =
      normalizeText(
        body.currentHolderId ??
          body.current_holder_id ??
          body.current_holder_employee_id,
      );

    if (holderId) {
      await verifyEmployee(
        organizationId,
        holderId,
      );
    }

    payload.current_holder_id =
      holderId;
  }

  /* =======================================================
     READINESS SCORE
     THIS IS THE MAIN FIX
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "readinessScore",
    )
  ) {
    payload.readiness_score =
      normalizeScore(
        body.readinessScore,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "readiness_score",
    )
  ) {
    payload.readiness_score =
      normalizeScore(
        body.readiness_score,
      );
  }

  /* =======================================================
     CRITICALITY
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "criticality",
    )
  ) {
    payload.criticality =
      normalizeCriticality(
        body.criticality,
      );
  }

  /* =======================================================
     STATUS
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "status",
    )
  ) {
    payload.status =
      normalizePlanStatus(
        body.status,
      );
  }

  /* =======================================================
     TARGET TRANSITION DATE
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "targetTransitionDate",
    )
  ) {
    payload.target_transition_date =
      normalizeDate(
        body.targetTransitionDate,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "target_transition_date",
    )
  ) {
    payload.target_transition_date =
      normalizeDate(
        body.target_transition_date,
      );
  }

  /* =======================================================
     BUSINESS IMPACT
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "businessImpact",
    )
  ) {
    payload.business_impact =
      normalizeText(
        body.businessImpact,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "business_impact",
    )
  ) {
    payload.business_impact =
      normalizeText(
        body.business_impact,
      );
  }

  /* =======================================================
     NOTES
  ======================================================= */

  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "notes",
    )
  ) {
    payload.notes =
      normalizeText(
        body.notes,
      );
  }

  /* =======================================================
     PRIMARY SUCCESSOR
  ======================================================= */

  const hasPrimarySuccessor =
    Object.prototype.hasOwnProperty.call(
      body,
      "primarySuccessorEmployeeId",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "primary_successor_employee_id",
    );

  const primarySuccessorId =
    hasPrimarySuccessor
      ? normalizeText(
          body.primarySuccessorEmployeeId ??
            body.primary_successor_employee_id,
        )
      : null;

  const effectiveHolderId =
    payload.current_holder_id !==
    undefined
      ? payload.current_holder_id
      : existing.current_holder_id;

  if (
    primarySuccessorId &&
    effectiveHolderId &&
    String(
      primarySuccessorId,
    ) ===
      String(
        effectiveHolderId,
      )
  ) {
    throw createServiceError(
      "The current role holder cannot also be the primary successor.",
      400,
    );
  }

  if (primarySuccessorId) {
    await verifyEmployee(
      organizationId,
      primarySuccessorId,
    );
  }

  payload.updated_at =
    new Date().toISOString();

  /* =======================================================
     UPDATE PLAN
  ======================================================= */

  const {
    data: updated,
    error,
  } = await supabaseAdmin
    .from("succession_plans")
    .update(payload)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      planId,
    )
    .select("*")
    .single();

  if (error) {
    console.error(
      "[Succession Planning Service] UPDATE PLAN:",
      error,
    );

    throw error;
  }

  /* =======================================================
     REPLACE CANDIDATES IF SENT
  ======================================================= */

  if (
    Array.isArray(
      body.candidates,
    )
  ) {
    const normalizedCandidates =
      [...body.candidates];

    if (primarySuccessorId) {
      const primaryIndex =
        normalizedCandidates.findIndex(
          (candidate) =>
            String(
              candidate?.employeeId ??
                candidate?.employee_id ??
                "",
            ) ===
            String(
              primarySuccessorId,
            ),
        );

      if (primaryIndex >= 0) {
        normalizedCandidates[
          primaryIndex
        ] = {
          ...normalizedCandidates[
            primaryIndex
          ],

          isPrimary: true,
        };
      } else {
        normalizedCandidates.push({
          employeeId:
            primarySuccessorId,

          readiness:
            "developing",

          readinessScore:
            0,

          isPrimary:
            true,
        });
      }
    }

    const candidatePayloads =
      [];

    const seenEmployees =
      new Set();

    for (
      const candidate of normalizedCandidates
    ) {
      const employeeId =
        normalizeText(
          candidate?.employeeId ??
            candidate?.employee_id,
        );

      if (!employeeId) {
        continue;
      }

      if (
        seenEmployees.has(
          employeeId,
        )
      ) {
        continue;
      }

      seenEmployees.add(
        employeeId,
      );

      const currentHolderId =
        payload.current_holder_id !==
        undefined
          ? payload.current_holder_id
          : existing.current_holder_id;

      if (
        currentHolderId &&
        String(employeeId) ===
          String(currentHolderId)
      ) {
        throw createServiceError(
          "The current role holder cannot also be a succession candidate.",
          400,
        );
      }

      await verifyEmployee(
        organizationId,
        employeeId,
      );

      candidatePayloads.push({
        succession_plan_id:
          planId,

        employee_id:
          employeeId,

        readiness:
          normalizeReadiness(
            candidate?.readiness,
          ),

        readiness_score:
          normalizeScore(
            candidate?.readinessScore ??
              candidate?.readiness_score,
          ),

        strengths:
          normalizeText(
            candidate?.strengths,
          ),

        development_gaps:
          normalizeText(
            candidate?.developmentGaps ??
              candidate?.development_gaps,
          ),

        development_actions:
          normalizeText(
            candidate?.developmentActions ??
              candidate?.development_actions,
          ),

        target_ready_date:
          normalizeDate(
            candidate?.targetReadyDate ??
              candidate?.target_ready_date,
          ),

        is_primary:
          normalizeBoolean(
            candidate?.isPrimary ??
              candidate?.is_primary,
          ),
      });
    }

    /* Only one primary */
    let primaryFound = false;

    for (
      const candidate of candidatePayloads
    ) {
      if (candidate.is_primary) {
        if (primaryFound) {
          candidate.is_primary =
            false;
        } else {
          primaryFound = true;
        }
      }
    }

    const {
      error: deleteError,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .delete()
      .eq(
        "succession_plan_id",
        planId,
      );

    if (deleteError) {
      throw deleteError;
    }

    if (
      candidatePayloads.length > 0
    ) {
      const {
        error: insertError,
      } = await supabaseAdmin
        .from(
          "succession_candidates",
        )
        .insert(
          candidatePayloads,
        );

      if (insertError) {
        throw insertError;
      }
    }
  }

  /* =======================================================
     UPDATE PRIMARY SUCCESSOR ONLY
     WITHOUT REMOVING OTHER CANDIDATES
  ======================================================= */

  if (
    hasPrimarySuccessor &&
    !Array.isArray(
      body.candidates,
    )
  ) {
    const {
      data: existingCandidates,
      error:
        candidateLookupError,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .select("*")
      .eq(
        "succession_plan_id",
        planId,
      );

    if (candidateLookupError) {
      throw candidateLookupError;
    }

    /* Clear current primary */
    const {
      error:
        clearPrimaryError,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .update({
        is_primary: false,
      })
      .eq(
        "succession_plan_id",
        planId,
      );

    if (clearPrimaryError) {
      throw clearPrimaryError;
    }

    /* If primary successor selected */
    if (primarySuccessorId) {
      const existingCandidate =
        (
          existingCandidates ||
          []
        ).find(
          (candidate) =>
            String(
              candidate.employee_id,
            ) ===
            String(
              primarySuccessorId,
            ),
        );

      if (existingCandidate) {
        const {
          error:
            updatePrimaryError,
        } = await supabaseAdmin
          .from(
            "succession_candidates",
          )
          .update({
            is_primary: true,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingCandidate.id,
          );

        if (updatePrimaryError) {
          throw updatePrimaryError;
        }
      } else {
        const {
          error:
            insertPrimaryError,
        } = await supabaseAdmin
          .from(
            "succession_candidates",
          )
          .insert({
            succession_plan_id:
              planId,

            employee_id:
              primarySuccessorId,

            readiness:
              "developing",

            readiness_score:
              0,

            strengths:
              null,

            development_gaps:
              null,

            development_actions:
              null,

            target_ready_date:
              null,

            is_primary:
              true,
          });

        if (insertPrimaryError) {
          throw insertPrimaryError;
        }
      }
    }
  }

  return getSuccessionPlan(
    organizationId,
    planId,
  );
}

/* =========================================================
   DELETE SUCCESSION PLAN
========================================================= */

export async function deleteSuccessionPlan(
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
      "Succession plan ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from("succession_plans")
    .select(
      "id, role_title",
    )
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      planId,
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Succession plan not found.",
      404,
    );
  }

  const {
    error,
  } = await supabaseAdmin
    .from("succession_plans")
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      planId,
    );

  if (error) {
    console.error(
      "[Succession Planning Service] DELETE:",
      error,
    );

    throw error;
  }

  return {
    id: existing.id,

    role_title:
      existing.role_title,
  };
}

/* =========================================================
   ADD SUCCESSION CANDIDATE
========================================================= */

export async function addSuccessionCandidate(
  organizationId,
  planId,
  candidate,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const plan =
    await getSuccessionPlan(
      organizationId,
      planId,
    );

  const employeeId =
    normalizeText(
      candidate?.employeeId ??
        candidate?.employee_id,
    );

  if (!employeeId) {
    throw createServiceError(
      "Employee is required.",
      400,
    );
  }

  if (
    String(
      plan.current_holder_id,
    ) ===
    String(employeeId)
  ) {
    throw createServiceError(
      "The current role holder cannot be a succession candidate.",
      400,
    );
  }

  await verifyEmployee(
    organizationId,
    employeeId,
  );

  const duplicate =
    (plan.candidates || []).find(
      (entry) =>
        String(
          entry.employee_id,
        ) ===
        String(employeeId),
    );

  if (duplicate) {
    throw createServiceError(
      "This employee is already a succession candidate.",
      409,
    );
  }

  const isPrimary =
    normalizeBoolean(
      candidate?.isPrimary ??
        candidate?.is_primary,
    );

  if (isPrimary) {
    const {
      error:
        clearPrimaryError,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .update({
        is_primary: false,
      })
      .eq(
        "succession_plan_id",
        planId,
      );

    if (clearPrimaryError) {
      throw clearPrimaryError;
    }
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .insert({
      succession_plan_id:
        planId,

      employee_id:
        employeeId,

      readiness:
        normalizeReadiness(
          candidate?.readiness,
        ),

      readiness_score:
        normalizeScore(
          candidate?.readinessScore ??
            candidate?.readiness_score,
        ),

      strengths:
        normalizeText(
          candidate?.strengths,
        ),

      development_gaps:
        normalizeText(
          candidate?.developmentGaps ??
            candidate?.development_gaps,
        ),

      development_actions:
        normalizeText(
          candidate?.developmentActions ??
            candidate?.development_actions,
        ),

      target_ready_date:
        normalizeDate(
          candidate?.targetReadyDate ??
            candidate?.target_ready_date,
        ),

      is_primary:
        isPrimary,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const enriched =
    await enrichCandidates(
      organizationId,
      [data],
    );

  return enriched[0];
}

/* =========================================================
   UPDATE SUCCESSION CANDIDATE
========================================================= */

export async function updateSuccessionCandidate(
  organizationId,
  candidateId,
  updates,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .select("*")
    .eq(
      "id",
      candidateId,
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Succession candidate not found.",
      404,
    );
  }

  const plan =
    await getSuccessionPlan(
      organizationId,
      existing.succession_plan_id,
    );

  const body =
    updates &&
    typeof updates === "object"
      ? updates
      : {};

  const payload = {};

  /* Employee */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "employeeId",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "employee_id",
    )
  ) {
    const employeeId =
      normalizeText(
        body.employeeId ??
          body.employee_id,
      );

    await verifyEmployee(
      organizationId,
      employeeId,
    );

    if (
      String(
        plan.current_holder_id,
      ) ===
      String(employeeId)
    ) {
      throw createServiceError(
        "The current role holder cannot be a succession candidate.",
        400,
      );
    }

    payload.employee_id =
      employeeId;
  }

  /* Readiness */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "readiness",
    )
  ) {
    payload.readiness =
      normalizeReadiness(
        body.readiness,
      );
  }

  /* Candidate readiness score */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "readinessScore",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "readiness_score",
    )
  ) {
    payload.readiness_score =
      normalizeScore(
        body.readinessScore ??
          body.readiness_score,
      );
  }

  /* Strengths */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "strengths",
    )
  ) {
    payload.strengths =
      normalizeText(
        body.strengths,
      );
  }

  /* Development gaps */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "developmentGaps",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "development_gaps",
    )
  ) {
    payload.development_gaps =
      normalizeText(
        body.developmentGaps ??
          body.development_gaps,
      );
  }

  /* Development actions */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "developmentActions",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "development_actions",
    )
  ) {
    payload.development_actions =
      normalizeText(
        body.developmentActions ??
          body.development_actions,
      );
  }

  /* Target ready date */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "targetReadyDate",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "target_ready_date",
    )
  ) {
    payload.target_ready_date =
      normalizeDate(
        body.targetReadyDate ??
          body.target_ready_date,
      );
  }

  /* Primary */
  if (
    Object.prototype.hasOwnProperty.call(
      body,
      "isPrimary",
    ) ||
    Object.prototype.hasOwnProperty.call(
      body,
      "is_primary",
    )
  ) {
    payload.is_primary =
      normalizeBoolean(
        body.isPrimary ??
          body.is_primary,
      );
  }

  payload.updated_at =
    new Date().toISOString();

  /* =======================================================
     PRIMARY CANDIDATE RULE
  ======================================================= */

  if (payload.is_primary) {
    const {
      error:
        clearPrimaryError,
    } = await supabaseAdmin
      .from(
        "succession_candidates",
      )
      .update({
        is_primary: false,
      })
      .eq(
        "succession_plan_id",
        existing.succession_plan_id,
      )
      .neq(
        "id",
        candidateId,
      );

    if (clearPrimaryError) {
      throw clearPrimaryError;
    }
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .update(payload)
    .eq(
      "id",
      candidateId,
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const enriched =
    await enrichCandidates(
      organizationId,
      [data],
    );

  return enriched[0];
}

/* =========================================================
   DELETE SUCCESSION CANDIDATE
========================================================= */

export async function deleteSuccessionCandidate(
  organizationId,
  candidateId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!candidateId) {
    throw createServiceError(
      "Succession candidate ID is required.",
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .select(
      "id, employee_id, succession_plan_id",
    )
    .eq(
      "id",
      candidateId,
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    throw createServiceError(
      "Succession candidate not found.",
      404,
    );
  }

  /* Verify the plan belongs to this organization */
  await getSuccessionPlan(
    organizationId,
    existing.succession_plan_id,
  );

  const {
    error,
  } = await supabaseAdmin
    .from(
      "succession_candidates",
    )
    .delete()
    .eq(
      "id",
      candidateId,
    );

  if (error) {
    throw error;
  }

  return {
    id: existing.id,

    employee_id:
      existing.employee_id,

    succession_plan_id:
      existing.succession_plan_id,
  };
}