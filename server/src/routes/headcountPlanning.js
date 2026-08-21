import express from "express";
import { requireAuth } from "../middleware/auth.js";

import {
  getHeadcountPlans,
  getHeadcountPlan,
  createHeadcountPlan,
  updateHeadcountPlan,
  deleteHeadcountPlan,
} from "../services/headcountPlanningService.js";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   GET ALL HEADCOUNT PLANS
   GET /api/headcount-planning
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const plans =
      await getHeadcountPlans(
        organizationId,
      );

    return res.status(200).json({
      plans: plans || [],
    });
  } catch (error) {
    console.error(
      "[HeadcountPlanning] GET failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to load headcount plans.",
      });
  }
});

/* =========================================================
   GET SINGLE HEADCOUNT PLAN
   GET /api/headcount-planning/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const plan =
      await getHeadcountPlan(
        organizationId,
        req.params.id,
      );

    return res.status(200).json({
      plan,
    });
  } catch (error) {
    console.error(
      "[HeadcountPlanning] GET SINGLE failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to load headcount plan.",
      });
  }
});

/* =========================================================
   CREATE HEADCOUNT PLAN
   POST /api/headcount-planning
========================================================= */

router.post("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const {
      department,
      planning_period,
      planningPeriod,
      target_headcount,
      targetHeadcount,
      status,
      notes,
    } = req.body || {};

    const plan =
      await createHeadcountPlan({
        organizationId,

        department,

        planningPeriod:
          planning_period ??
          planningPeriod,

        targetHeadcount:
          target_headcount ??
          targetHeadcount,

        status,

        notes,
      });

    return res.status(201).json({
      message:
        "Headcount plan created successfully.",

      plan,
    });
  } catch (error) {
    console.error(
      "[HeadcountPlanning] CREATE failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to create headcount plan.",
      });
  }
});

/* =========================================================
   UPDATE HEADCOUNT PLAN
   PATCH /api/headcount-planning/:id
========================================================= */

router.patch(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "User is not associated with an organization.",
        });
      }

      const plan =
        await updateHeadcountPlan(
          organizationId,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Headcount plan updated successfully.",

        plan,
      });
    } catch (error) {
      console.error(
        "[HeadcountPlanning] UPDATE failed:",
        error,
      );

      return res
        .status(error?.statusCode || 500)
        .json({
          message:
            error?.message ||
            "Failed to update headcount plan.",
        });
    }
  },
);

/* =========================================================
   DELETE HEADCOUNT PLAN
   DELETE /api/headcount-planning/:id
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      if (!organizationId) {
        return res.status(403).json({
          message:
            "User is not associated with an organization.",
        });
      }

      await deleteHeadcountPlan(
        organizationId,
        req.params.id,
      );

      return res.status(200).json({
        message:
          "Headcount plan deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[HeadcountPlanning] DELETE failed:",
        error,
      );

      return res
        .status(error?.statusCode || 500)
        .json({
          message:
            error?.message ||
            "Failed to delete headcount plan.",
        });
    }
  },
);

export default router;