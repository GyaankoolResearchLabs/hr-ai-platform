import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getContinuousFeedback,
  getContinuousFeedbackById,
  createContinuousFeedback,
  updateContinuousFeedback,
  archiveContinuousFeedback,
  deleteContinuousFeedback,
} from "../services/continuousFeedbackService.js";

const router = express.Router();

/* =========================================================
   ORGANIZATION
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

/* =========================================================
   GET ALL FEEDBACK

   GET /api/continuous-feedback
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

      const {
        status,
        employeeId,
        feedbackType,
      } = req.query;

      const feedback =
        await getContinuousFeedback({
          organizationId,
          status:
            status || "active",
          employeeId:
            employeeId || null,
          feedbackType:
            feedbackType || null,
        });

      return res.status(200).json({
        feedback,
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] GET failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load feedback.",
      });
    }
  },
);

/* =========================================================
   GET SINGLE FEEDBACK

   GET /api/continuous-feedback/:id
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

      const feedback =
        await getContinuousFeedbackById(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        feedback,
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] GET SINGLE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to load feedback.",
      });
    }
  },
);

/* =========================================================
   CREATE FEEDBACK

   POST /api/continuous-feedback
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
        employeeId,
        employee_id,
        feedbackType,
        feedback_type,
        category,
        title,
        feedback,
        visibility,
      } = req.body || {};

      const created =
        await createContinuousFeedback({
          organizationId,

          givenByUserId:
            req.user.id,

          employeeId:
            employeeId ||
            employee_id,

          feedbackType:
            feedbackType ||
            feedback_type,

          category,

          title,

          feedback,

          visibility,
        });

      return res.status(201).json({
        message:
          "Feedback created successfully.",
        feedback: created,
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] CREATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to create feedback.",
      });
    }
  },
);

/* =========================================================
   UPDATE FEEDBACK

   PATCH /api/continuous-feedback/:id
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

      const updated =
        await updateContinuousFeedback(
          organizationId,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Feedback updated successfully.",
        feedback: updated,
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] UPDATE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to update feedback.",
      });
    }
  },
);

/* =========================================================
   ARCHIVE FEEDBACK

   POST /api/continuous-feedback/:id/archive
========================================================= */

router.post(
  "/:id/archive",
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

      const archived =
        await archiveContinuousFeedback(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        message:
          "Feedback archived successfully.",
        feedback: archived,
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] ARCHIVE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to archive feedback.",
      });
    }
  },
);

/* =========================================================
   DELETE FEEDBACK

   DELETE /api/continuous-feedback/:id
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

      await deleteContinuousFeedback(
        organizationId,
        req.params.id,
      );

      return res.status(200).json({
        message:
          "Feedback deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[ContinuousFeedback] DELETE failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        message:
          error?.message ||
          "Failed to delete feedback.",
      });
    }
  },
);

export default router;