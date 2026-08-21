import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "Escalation organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

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
  return (
    SLA_HOURS[
      cleanString(priority).toLowerCase()
    ] ?? SLA_HOURS.normal
  );
}

function getDueAt(request) {
  if (!request?.created_at) {
    return null;
  }

  const createdAt =
    new Date(request.created_at);

  if (
    Number.isNaN(
      createdAt.getTime(),
    )
  ) {
    return null;
  }

  const slaHours =
    getSlaHours(
      request.priority,
    );

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

  const now =
    Date.now();

  const overdueMilliseconds =
    now -
    dueAt.getTime();

  if (
    overdueMilliseconds <= 0
  ) {
    return {
      overdue: false,
      dueAt:
        dueAt.toISOString(),
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
   FIND ORGANIZATION OWNER
========================================================= */

async function getOrganizationOwner(
  organizationId,
) {
  if (!organizationId) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "organization_members",
      )
      .select(
        "user_id, role",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "role",
        "owner",
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/* =========================================================
   GET OVERDUE APPROVALS

   GET
   /api/escalations/overdue
========================================================= */

router.get(
  "/overdue",
  async (req, res) => {
    try {
      const {
        data: requests,
        error,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "status",
            "pending",
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          );

      if (error) {
        console.error(
          "Load overdue approval requests error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load approval requests",

          detail:
            error.message,
        });
      }

      const overdueRequests =
        (
          requests || []
        )
          .map(
            (request) => {
              const overdueInfo =
                getOverdueInfo(
                  request,
                );

              return {
                ...request,

                sla_hours:
                  getSlaHours(
                    request.priority,
                  ),

                due_at:
                  overdueInfo.dueAt,

                overdue:
                  overdueInfo.overdue,

                overdue_hours:
                  overdueInfo.overdueHours,
              };
            },
          )
          .filter(
            (request) =>
              request.overdue ===
              true,
          );

      return res.json({
        count:
          overdueRequests.length,

        requests:
          overdueRequests,
      });
    } catch (error) {
      console.error(
        "Unexpected overdue approvals error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not determine overdue approvals",
      });
    }
  },
);

/* =========================================================
   GET ALL ESCALATIONS

   GET
   /api/escalations
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const {
        data,
        error,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

      if (error) {
        console.error(
          "Load escalations error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load escalations",

          detail:
            error.message,
        });
      }

      return res.json(
        data || [],
      );
    } catch (error) {
      console.error(
        "Unexpected escalation list error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load escalations",
      });
    }
  },
);

/* =========================================================
   ESCALATE APPROVAL REQUEST

   POST
   /api/escalations/:requestId/escalate
========================================================= */

router.post(
  "/:requestId/escalate",
  async (req, res) => {
    try {
      const requestId =
        cleanString(
          req.params.requestId,
        );

      if (!requestId) {
        return res.status(400).json({
          message:
            "Approval request ID is required",
        });
      }

      const {
        data: request,
        error: requestError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .select("*")
          .eq(
            "id",
            requestId,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .maybeSingle();

      if (requestError) {
        console.error(
          "Load approval request for escalation error:",
          requestError,
        );

        return res.status(500).json({
          message:
            "Could not load approval request",

          detail:
            requestError.message,
        });
      }

      if (!request) {
        return res.status(404).json({
          message:
            "Approval request not found",
        });
      }

      /* -----------------------------------------------------
         REQUEST MUST STILL BE PENDING
      ----------------------------------------------------- */

      if (
        request.status !==
        "pending"
      ) {
        return res.status(409).json({
          message:
            `Approval request is already ${request.status}`,
        });
      }

      /* -----------------------------------------------------
         CHECK SLA
      ----------------------------------------------------- */

      const overdueInfo =
        getOverdueInfo(
          request,
        );

      if (
        !overdueInfo.overdue
      ) {
        return res.status(409).json({
          message:
            "This approval request is not overdue yet",

          due_at:
            overdueInfo.dueAt,

          sla_hours:
            getSlaHours(
              request.priority,
            ),
        });
      }

      /* -----------------------------------------------------
         FIND OWNER
      ----------------------------------------------------- */

      const owner =
        await getOrganizationOwner(
          req.organization.id,
        );

      if (!owner) {
        return res.status(422).json({
          message:
            "No organization owner is available for escalation",
        });
      }

      /* -----------------------------------------------------
         CHECK EXISTING ESCALATION
      ----------------------------------------------------- */

      const {
        data: existingEscalation,
        error: existingError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "approval_request_id",
            request.id,
          )
          .in(
            "status",
            [
              "open",
              "acknowledged",
            ],
          )
          .limit(1)
          .maybeSingle();

      if (existingError) {
        console.error(
          "Check existing escalation error:",
          existingError,
        );

        return res.status(500).json({
          message:
            "Could not check existing escalation",

          detail:
            existingError.message,
        });
      }

      if (
        existingEscalation
      ) {
        return res.status(409).json({
          message:
            "This approval request is already escalated",

          escalation:
            existingEscalation,
        });
      }

      /* -----------------------------------------------------
         REASON
      ----------------------------------------------------- */

      const reason =
        cleanString(
          req.body?.reason,
        ) ||
        `Approval request exceeded its ${getSlaHours(
          request.priority,
        )}-hour SLA.`;

      /* -----------------------------------------------------
         METADATA
      ----------------------------------------------------- */

      const metadata = {
        priority:
          request.priority,

        sla_hours:
          getSlaHours(
            request.priority,
          ),

        due_at:
          overdueInfo.dueAt,

        overdue_hours:
          overdueInfo.overdueHours,

        assigned_approver_id:
          request.assigned_approver_id,

        request_type:
          request.request_type,

        automatic:
          false,
      };

      /* -----------------------------------------------------
         CREATE ESCALATION
      ----------------------------------------------------- */

      const {
        data: escalation,
        error: escalationError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .insert({
            organization_id:
              req.organization.id,

            approval_request_id:
              request.id,

            escalated_from_user_id:
              request.assigned_approver_id,

            escalated_to_user_id:
              owner.user_id,

            escalation_level:
              1,

            reason,

            status:
              "open",

            metadata,
          })
          .select("*")
          .single();

      if (escalationError) {
        console.error(
          "Create escalation error:",
          escalationError,
        );

        return res.status(500).json({
          message:
            "Could not create escalation",

          detail:
            escalationError.message,
        });
      }

      return res.status(201).json({
        message:
          "Approval request escalated successfully",

        escalation,
      });
    } catch (error) {
      console.error(
        "Unexpected escalation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not escalate approval request",

        detail:
          error?.message ||
          null,
      });
    }
  },
);

/* =========================================================
   ACKNOWLEDGE ESCALATION

   POST
   /api/escalations/:id/acknowledge
========================================================= */

router.post(
  "/:id/acknowledge",
  async (req, res) => {
    try {
      const {
        data: escalation,
        error,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .select("*")
          .eq(
            "id",
            req.params.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .maybeSingle();

      if (error) {
        return res.status(500).json({
          message:
            "Could not load escalation",

          detail:
            error.message,
        });
      }

      if (!escalation) {
        return res.status(404).json({
          message:
            "Escalation not found",
        });
      }

      if (
        escalation.escalated_to_user_id !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            "Only the escalation recipient can acknowledge it",
        });
      }

      if (
        escalation.status !==
        "open"
      ) {
        return res.status(409).json({
          message:
            `Escalation is already ${escalation.status}`,
        });
      }

      const {
        data: updated,
        error: updateError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .update({
            status:
              "acknowledged",

            acknowledged_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            escalation.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .select("*")
          .single();

      if (updateError) {
        return res.status(500).json({
          message:
            "Could not acknowledge escalation",

          detail:
            updateError.message,
        });
      }

      return res.json({
        message:
          "Escalation acknowledged",

        escalation:
          updated,
      });
    } catch (error) {
      console.error(
        "Acknowledge escalation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not acknowledge escalation",
      });
    }
  },
);

/* =========================================================
   RESOLVE ESCALATION

   POST
   /api/escalations/:id/resolve
========================================================= */

router.post(
  "/:id/resolve",
  async (req, res) => {
    try {
      const {
        data: escalation,
        error,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .select("*")
          .eq(
            "id",
            req.params.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .maybeSingle();

      if (error) {
        return res.status(500).json({
          message:
            "Could not load escalation",

          detail:
            error.message,
        });
      }

      if (!escalation) {
        return res.status(404).json({
          message:
            "Escalation not found",
        });
      }

      if (
        escalation.escalated_to_user_id !==
        req.user.id
      ) {
        return res.status(403).json({
          message:
            "Only the escalation recipient can resolve it",
        });
      }

      if (
        escalation.status ===
        "resolved"
      ) {
        return res.status(409).json({
          message:
            "Escalation is already resolved",
        });
      }

      const resolutionNote =
        cleanString(
          req.body?.resolution_note,
        ) || null;

      const {
        data: updated,
        error: updateError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .update({
            status:
              "resolved",

            resolved_at:
              new Date().toISOString(),

            metadata: {
              ...(escalation.metadata ||
                {}),

              resolution_note:
                resolutionNote,
            },
          })
          .eq(
            "id",
            escalation.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .select("*")
          .single();

      if (updateError) {
        return res.status(500).json({
          message:
            "Could not resolve escalation",

          detail:
            updateError.message,
        });
      }

      return res.json({
        message:
          "Escalation resolved",

        escalation:
          updated,
      });
    } catch (error) {
      console.error(
        "Resolve escalation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not resolve escalation",
      });
    }
  },
);

/* =========================================================
   DELETE APPROVAL REQUEST

   DELETE
   /api/escalations/request/:requestId

   Deletes:
   1. All escalations belonging to the request
   2. The approval request itself

   This removes the request from:
   - Overdue HR actions
   - Approval request lists
   - Automatic escalation processing
   - Escalation history
========================================================= */

router.delete(
  "/request/:requestId",
  async (req, res) => {
    try {
      const requestId =
        cleanString(
          req.params.requestId,
        );

      if (!requestId) {
        return res.status(400).json({
          message:
            "Approval request ID is required",
        });
      }

      /* -----------------------------------------------------
         LOAD APPROVAL REQUEST
      ----------------------------------------------------- */

      const {
        data: request,
        error: requestError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .select(
            "id, title, status, organization_id",
          )
          .eq(
            "id",
            requestId,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .maybeSingle();

      if (requestError) {
        console.error(
          "Load approval request for deletion error:",
          requestError,
        );

        return res.status(500).json({
          message:
            "Could not load approval request",

          detail:
            requestError.message,
        });
      }

      if (!request) {
        return res.status(404).json({
          message:
            "Approval request not found",
        });
      }

      /* -----------------------------------------------------
         DELETE RELATED ESCALATIONS FIRST
      ----------------------------------------------------- */

      const {
        error: escalationDeleteError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .delete()
          .eq(
            "approval_request_id",
            request.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          );

      if (escalationDeleteError) {
        console.error(
          "Delete related escalations error:",
          escalationDeleteError,
        );

        return res.status(500).json({
          message:
            "Could not delete escalation history",

          detail:
            escalationDeleteError.message,
        });
      }

      /* -----------------------------------------------------
         DELETE APPROVAL REQUEST
      ----------------------------------------------------- */

      const {
        error: requestDeleteError,
      } =
        await supabaseAdmin
          .from(
            "hr_approval_requests",
          )
          .delete()
          .eq(
            "id",
            request.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          );

      if (requestDeleteError) {
        console.error(
          "Delete approval request error:",
          requestDeleteError,
        );

        return res.status(500).json({
          message:
            "Could not delete approval request",

          detail:
            requestDeleteError.message,
        });
      }

      console.log(
        `[Escalation] Deleted approval request ${request.id}`,
      );

      return res.json({
        message:
          "Approval request deleted successfully",

        deleted_request_id:
          request.id,

        deleted_title:
          request.title,
      });
    } catch (error) {
      console.error(
        "Unexpected approval request deletion error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not delete approval request",

        detail:
          error?.message ||
          null,
      });
    }
  },
);

/* =========================================================
   DELETE SINGLE ESCALATION

   DELETE
   /api/escalations/:id

   TEST/ADMIN CLEANUP ONLY

   This deletes the escalation record only.
   It does NOT delete the approval request.
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const testMode =
        String(
          process.env
            .ESCALATION_TEST_MODE ??
            "",
        )
          .trim()
          .toLowerCase() ===
        "true";

      if (!testMode) {
        return res.status(403).json({
          message:
            "Escalation deletion is available only in test mode.",
        });
      }

      const escalationId =
        cleanString(
          req.params.id,
        );

      if (!escalationId) {
        return res.status(400).json({
          message:
            "Escalation ID is required",
        });
      }

      const {
        data: escalation,
        error: loadError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .select(
            `
              id,
              organization_id,
              approval_request_id,
              status
            `,
          )
          .eq(
            "id",
            escalationId,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .maybeSingle();

      if (loadError) {
        console.error(
          "Load escalation for deletion error:",
          loadError,
        );

        return res.status(500).json({
          message:
            "Could not load escalation",

          detail:
            loadError.message,
        });
      }

      if (!escalation) {
        return res.status(404).json({
          message:
            "Escalation not found",
        });
      }

      const {
        error: deleteError,
      } =
        await supabaseAdmin
          .from(
            "hr_escalations",
          )
          .delete()
          .eq(
            "id",
            escalation.id,
          )
          .eq(
            "organization_id",
            req.organization.id,
          );

      if (deleteError) {
        console.error(
          "Delete escalation error:",
          deleteError,
        );

        return res.status(500).json({
          message:
            "Could not delete escalation",

          detail:
            deleteError.message,
        });
      }

      return res.json({
        message:
          "Test escalation deleted successfully",

        deleted_escalation_id:
          escalation.id,

        approval_request_id:
          escalation.approval_request_id,
      });
    } catch (error) {
      console.error(
        "Unexpected escalation deletion error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not delete escalation",
      });
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;