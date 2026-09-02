import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { createAuditLog } from "../services/auditLogService.js";

import {
  getSuccessionPlans,
  getSuccessionPlan,
  createSuccessionPlan,
  updateSuccessionPlan,
  deleteSuccessionPlan,
  addSuccessionCandidate,
  updateSuccessionCandidate,
  deleteSuccessionCandidate,
} from "../services/successionPlanningService.js";

const router = express.Router();

router.use(requireAuth);

async function audit(
  req,
  action,
  plan,
  description,
  status = "success",
  metadata = {},
) {
  try {
    await createAuditLog({
      organizationId: req.user.organization_id,
      userId: req.user.id,
      action,
      resourceType: "succession_plan",
      resourceId: plan?.id || null,
      resourceName: plan?.role_title || null,
      description,
      status,
      req,
      metadata,
    });
  } catch (error) {
    console.error(
      "[Succession Planning] Audit logging failed:",
      error,
    );
  }
}

function fail(res, error, fallback) {
  return res.status(
    error?.statusCode || 500,
  ).json({
    message:
      error?.message ||
      fallback,
  });
}

/* =========================================================
   GET ALL
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const plans =
        await getSuccessionPlans(
          organizationId,
        );

      await audit(
        req,
        "succession.list",
        null,
        `Viewed succession planning containing ${plans.length} key roles.`,
        "success",
        {
          role_count:
            plans.length,
        },
      );

      return res
        .status(200)
        .json({
          plans,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] GET ALL failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to load succession plans.",
      );
    }
  },
);

/* =========================================================
   GET SINGLE
========================================================= */

router.get(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const plan =
        await getSuccessionPlan(
          organizationId,
          req.params.id,
        );

      await audit(
        req,
        "succession.view",
        plan,
        `Viewed succession plan for "${plan.role_title}".`,
        "success",
        {
          candidate_count:
            (
              plan.candidates ||
              []
            ).length,
        },
      );

      return res
        .status(200)
        .json({
          plan,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] GET SINGLE failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to load succession plan.",
      );
    }
  },
);

/* =========================================================
   CREATE
========================================================= */

router.post(
  "/",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      const userId =
        req.user.id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const body =
        req.body || {};

      const plan =
        await createSuccessionPlan({
          organizationId,

          userId,

          roleTitle:
            body.roleTitle ??
            body.role_title,

          department:
            body.department,

          currentHolderId:
            body.currentHolderId ??
            body.current_holder_id ??
            body.current_holder_employee_id,

          criticality:
            body.criticality,

          readinessScore:
            body.readinessScore ??
            body.readiness_score,

          status:
            body.status,

          targetTransitionDate:
            body.targetTransitionDate ??
            body.target_transition_date,

          businessImpact:
            body.businessImpact ??
            body.business_impact,

          notes:
            body.notes,

          candidates:
            body.candidates,

          primarySuccessorEmployeeId:
            body.primarySuccessorEmployeeId ??
            body.primary_successor_employee_id,
        });

      await audit(
        req,
        "succession.create",
        plan,
        `Created succession plan for "${plan.role_title}".`,
        "success",
        {
          candidate_count:
            (
              plan.candidates ||
              []
            ).length,

          criticality:
            plan.criticality,

          readiness_score:
            plan.readiness_score,

          status:
            plan.status,
        },
      );

      return res
        .status(201)
        .json({
          message:
            "Succession plan created successfully.",

          plan,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] CREATE failed:",
        error,
      );

      await audit(
        req,
        "succession.create",
        null,
        "Failed to create succession plan.",
        "failed",
        {
          error:
            error?.message ||
            "Unknown error",
        },
      );

      return fail(
        res,
        error,
        "Failed to create succession plan.",
      );
    }
  },
);

/* =========================================================
   UPDATE
========================================================= */

router.patch(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const plan =
        await updateSuccessionPlan(
          organizationId,
          req.params.id,
          req.body || {},
        );

      await audit(
        req,
        "succession.update",
        plan,
        `Updated succession plan for "${plan.role_title}".`,
        "success",
        {
          candidate_count:
            (
              plan.candidates ||
              []
            ).length,

          criticality:
            plan.criticality,

          readiness_score:
            plan.readiness_score,

          status:
            plan.status,
        },
      );

      return res
        .status(200)
        .json({
          message:
            "Succession plan updated successfully.",

          plan,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] UPDATE failed:",
        error,
      );

      await audit(
        req,
        "succession.update",
        null,
        "Failed to update succession plan.",
        "failed",
        {
          error:
            error?.message ||
            "Unknown error",

          succession_plan_id:
            req.params.id,
        },
      );

      return fail(
        res,
        error,
        "Failed to update succession plan.",
      );
    }
  },
);

/* =========================================================
   DELETE
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const deleted =
        await deleteSuccessionPlan(
          organizationId,
          req.params.id,
        );

      await audit(
        req,
        "succession.delete",
        null,
        `Deleted succession plan for "${deleted.role_title}".`,
        "success",
        {
          deleted_id:
            deleted.id,

          deleted_role:
            deleted.role_title,
        },
      );

      return res
        .status(200)
        .json({
          message:
            "Succession plan deleted successfully.",

          deleted,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] DELETE failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to delete succession plan.",
      );
    }
  },
);

/* =========================================================
   ADD CANDIDATE
========================================================= */

router.post(
  "/:id/candidates",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const candidate =
        await addSuccessionCandidate(
          organizationId,
          req.params.id,
          req.body || {},
        );

      await audit(
        req,
        "succession.candidate_create",
        null,
        `Added "${candidate.employee?.full_name || "employee"}" as a succession candidate.`,
        "success",
        {
          succession_plan_id:
            req.params.id,

          employee_id:
            candidate.employee_id,

          readiness:
            candidate.readiness,

          readiness_score:
            candidate.readiness_score,

          is_primary:
            candidate.is_primary,
        },
      );

      return res
        .status(201)
        .json({
          message:
            "Succession candidate added successfully.",

          candidate,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] ADD CANDIDATE failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to add succession candidate.",
      );
    }
  },
);

/* =========================================================
   UPDATE CANDIDATE
========================================================= */

router.patch(
  "/candidates/:candidateId",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const candidate =
        await updateSuccessionCandidate(
          organizationId,
          req.params.candidateId,
          req.body || {},
        );

      await audit(
        req,
        "succession.candidate_update",
        null,
        `Updated succession candidate "${candidate.employee?.full_name || "employee"}".`,
        "success",
        {
          candidate_id:
            candidate.id,

          succession_plan_id:
            candidate.succession_plan_id,

          readiness:
            candidate.readiness,

          readiness_score:
            candidate.readiness_score,

          is_primary:
            candidate.is_primary,
        },
      );

      return res
        .status(200)
        .json({
          message:
            "Succession candidate updated successfully.",

          candidate,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] UPDATE CANDIDATE failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to update succession candidate.",
      );
    }
  },
);

/* =========================================================
   DELETE CANDIDATE
========================================================= */

router.delete(
  "/candidates/:candidateId",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res
          .status(403)
          .json({
            message:
              "User is not associated with an organization.",
          });
      }

      const deleted =
        await deleteSuccessionCandidate(
          organizationId,
          req.params.candidateId,
        );

      await audit(
        req,
        "succession.candidate_delete",
        null,
        "Deleted succession candidate.",
        "success",
        {
          candidate_id:
            deleted.id,

          employee_id:
            deleted.employee_id,

          succession_plan_id:
            deleted.succession_plan_id,
        },
      );

      return res
        .status(200)
        .json({
          message:
            "Succession candidate deleted successfully.",

          deleted,
        });
    } catch (error) {
      console.error(
        "[Succession Planning] DELETE CANDIDATE failed:",
        error,
      );

      return fail(
        res,
        error,
        "Failed to delete succession candidate.",
      );
    }
  },
);

export default router;