import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   SLA CONFIGURATION
========================================================= */

const SLA_HOURS = {
  low: 72,
  normal: 48,
  high: 24,
  urgent: 8,
};

/* =========================================================
   HELPERS
========================================================= */

function cleanString(value) {
  return String(value ?? "").trim();
}

function getSlaHours(priority) {
  const normalizedPriority =
    cleanString(priority).toLowerCase();

  return (
    SLA_HOURS[normalizedPriority] ??
    SLA_HOURS.normal
  );
}

function getDueAt(request) {
  if (!request?.created_at) {
    return null;
  }

  const createdAt =
    new Date(request.created_at);

  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }

  const slaHours =
    getSlaHours(request.priority);

  return new Date(
    createdAt.getTime() +
      slaHours *
        60 *
        60 *
        1000,
  );
}

function getOverdueInfo(request) {
  const dueAt =
    getDueAt(request);

  if (!dueAt) {
    return {
      overdue: false,
      dueAt: null,
      overdueHours: 0,
    };
  }

  const overdueMilliseconds =
    Date.now() -
    dueAt.getTime();

  if (overdueMilliseconds <= 0) {
    return {
      overdue: false,
      dueAt: dueAt.toISOString(),
      overdueHours: 0,
    };
  }

  return {
    overdue: true,

    dueAt:
      dueAt.toISOString(),

    overdueHours:
      Math.round(
        (
          overdueMilliseconds /
          (60 * 60 * 1000)
        ) * 10,
      ) / 10,
  };
}

/* =========================================================
   ORGANIZATION OWNER
========================================================= */

async function getOrganizationOwner(
  organizationId,
) {
  if (!organizationId) {
    console.warn(
      "[Escalation] Request has no organization_id.",
    );

    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("organization_members")
      .select("user_id, role")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/* =========================================================
   ESCALATE SINGLE REQUEST
========================================================= */

async function escalateRequest(
  organizationId,
  request,
) {
  const overdueInfo =
    getOverdueInfo(request);

  /* -------------------------------------------------------
     NOT OVERDUE
  ------------------------------------------------------- */

  if (!overdueInfo.overdue) {
    console.log(
      `[Escalation] Request ${request.id} is not overdue yet.`,
    );

    console.log(
      `[Escalation] Created: ${request.created_at}`,
    );

    console.log(
      `[Escalation] Due: ${overdueInfo.dueAt}`,
    );

    return {
      escalated: false,
      reason: "not-overdue",
    };
  }

  /* -------------------------------------------------------
     FIND ORGANIZATION OWNER
  ------------------------------------------------------- */

  const owner =
    await getOrganizationOwner(
      organizationId,
    );

  if (!owner) {
    console.warn(
      `[Escalation] No organization owner found for organization ${organizationId}.`,
    );

    return {
      escalated: false,
      reason: "no-owner",
    };
  }

  console.log(
    `[Escalation] Organization owner found: ${owner.user_id}`,
  );

  /* -------------------------------------------------------
     CHECK EXISTING ESCALATION
  ------------------------------------------------------- */

  const {
    data: existing,
    error: existingError,
  } =
    await supabaseAdmin
      .from("hr_escalations")
      .select("id, status")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "approval_request_id",
        request.id,
      )
      .in("status", [
        "open",
        "acknowledged",
      ])
      .limit(1)
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    console.log(
      `[Escalation] Request ${request.id} already has an active escalation.`,
    );

    return {
      escalated: false,
      reason: "already-escalated",
      escalationId: existing.id,
    };
  }

  /* -------------------------------------------------------
     SLA INFORMATION
  ------------------------------------------------------- */

  const slaHours =
    getSlaHours(request.priority);

  const reason =
    `Approval request exceeded its ${slaHours}-hour SLA.`;

  const metadata = {
    priority:
      request.priority,

    sla_hours:
      slaHours,

    due_at:
      overdueInfo.dueAt,

    overdue_hours:
      overdueInfo.overdueHours,

    assigned_approver_id:
      request.assigned_approver_id,

    request_type:
      request.request_type,

    automatic: true,
  };

  /* -------------------------------------------------------
     CREATE ESCALATION
  ------------------------------------------------------- */

  console.log(
    `[Escalation] Creating escalation for request ${request.id}...`,
  );

  const {
    data: escalation,
    error: escalationError,
  } =
    await supabaseAdmin
      .from("hr_escalations")
      .insert({
        organization_id:
          organizationId,

        approval_request_id:
          request.id,

        escalated_from_user_id:
          request.assigned_approver_id,

        escalated_to_user_id:
          owner.user_id,

        escalation_level: 1,

        reason,

        status: "open",

        metadata,
      })
      .select("*")
      .single();

  if (escalationError) {
    console.error(
      `[Escalation] Failed to create escalation for ${request.id}:`,
      escalationError,
    );

    throw escalationError;
  }

  console.log(
    `[Escalation] Successfully created escalation ${escalation.id}`,
  );

  return {
    escalated: true,
    escalation,
  };
}

/* =========================================================
   AUTOMATIC ESCALATION PROCESSOR
========================================================= */

export async function processAutomaticEscalations() {
  console.log(
    "[Escalation] Checking overdue approval requests...",
  );

  const {
    data: requests,
    error,
  } =
    await supabaseAdmin
      .from("hr_approval_requests")
      .select("*")
      .eq("status", "pending");

  if (error) {
    console.error(
      "[Escalation] Could not load pending requests:",
      error,
    );

    return;
  }

  console.log(
    `[Escalation] Found ${requests?.length ?? 0} pending request(s).`,
  );

  let escalatedCount = 0;

  for (
    const request of requests || []
  ) {
    try {
      console.log(
        "--------------------------------------------------",
      );

      console.log(
        `[Escalation] Processing request: ${request.id}`,
      );

      console.log(
        `[Escalation] Title: ${request.title}`,
      );

      console.log(
        `[Escalation] Priority: ${request.priority}`,
      );

      console.log(
        `[Escalation] Created at: ${request.created_at}`,
      );

      const dueAt =
        getDueAt(request);

      console.log(
        `[Escalation] Calculated due at: ${
          dueAt
            ? dueAt.toISOString()
            : "unknown"
        }`,
      );

      const result =
        await escalateRequest(
          request.organization_id,
          request,
        );

      if (result.escalated) {
        escalatedCount += 1;

        console.log(
          `[Escalation] Automatically escalated request ${request.id}`,
        );
      } else {
        console.log(
          `[Escalation] Request ${request.id} skipped. Reason: ${result.reason}`,
        );
      }
    } catch (error) {
      console.error(
        `[Escalation] Failed for request ${request.id}:`,
        error,
      );
    }
  }

  console.log(
    "--------------------------------------------------",
  );

  console.log(
    `[Escalation] Check complete. ${escalatedCount} request(s) escalated.`,
  );
}