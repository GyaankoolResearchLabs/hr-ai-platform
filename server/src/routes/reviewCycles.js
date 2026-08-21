import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getReviewCycles,
  getReviewCycle,
  createReviewCycle,
  updateReviewCycle,
  updateEmployeeReview,
  deleteReviewCycle,
} from "../services/reviewCycleService.js";

const router = express.Router();

/* =========================================================
   ORGANIZATION
   ALWAYS comes from authenticated user.
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET ALL REVIEW CYCLES

   GET /api/review-cycles
========================================================= */

router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const cycles =
        await getReviewCycles(
          organizationId,
        );

      return res.status(200).json({
        cycles,
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] GET failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load review cycles.",
      });
    }
  },
);

/* =========================================================
   GET SINGLE REVIEW CYCLE

   GET /api/review-cycles/:id
========================================================= */

router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const cycle =
        await getReviewCycle(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        cycle,
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] GET single failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load review cycle.",
      });
    }
  },
);

/* =========================================================
   CREATE REVIEW CYCLE

   POST /api/review-cycles
========================================================= */

router.post(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        title,
        description,
        reviewType,
        review_type,
        startDate,
        start_date,
        dueDate,
        due_date,
        employeeIds,
        employee_ids,
      } = req.body || {};

      const cycle =
        await createReviewCycle({
          organizationId,

          title,

          description,

          reviewType:
            reviewType ||
            review_type,

          startDate:
            startDate ||
            start_date,

          dueDate:
            dueDate ||
            due_date,

          employeeIds:
            employeeIds ||
            employee_ids,
        });

      return res.status(201).json({
        message:
          "Review cycle created successfully.",
        cycle,
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] CREATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to create review cycle.",
      });
    }
  },
);

/* =========================================================
   UPDATE REVIEW CYCLE

   PATCH /api/review-cycles/:id
========================================================= */

router.patch(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const cycle =
        await updateReviewCycle(
          organizationId,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Review cycle updated successfully.",
        cycle,
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] UPDATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to update review cycle.",
      });
    }
  },
);

/* =========================================================
   UPDATE EMPLOYEE REVIEW

   PATCH
   /api/review-cycles/:cycleId/reviews/:reviewId
========================================================= */

router.patch(
  "/:cycleId/reviews/:reviewId",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const review =
        await updateEmployeeReview(
          organizationId,
          req.params.cycleId,
          req.params.reviewId,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Employee review updated successfully.",
        review,
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] REVIEW UPDATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to update employee review.",
      });
    }
  },
);

/* =========================================================
   DELETE REVIEW CYCLE

   DELETE /api/review-cycles/:id
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      await deleteReviewCycle(
        organizationId,
        req.params.id,
      );

      return res.status(200).json({
        message:
          "Review cycle deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[ReviewCycles] DELETE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to delete review cycle.",
      });
    }
  },
);

export default router;