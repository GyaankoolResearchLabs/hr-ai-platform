import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getRecognitionRewards,
  getRecognitionRewardById,
  getRecognitionEmployees,
  createRecognitionReward,
  archiveRecognitionReward,
  deleteRecognitionReward,
} from "../services/recognitionRewardsService.js";

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
   GET EMPLOYEES FOR RECOGNITION

   IMPORTANT:
   This MUST be before /:id
========================================================= */

router.get(
  "/employees",
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

      const employees =
        await getRecognitionEmployees(
          organizationId
        );

      return res.status(200).json({
        employees,
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] GET EMPLOYEES failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to load employees.",
      });
    }
  }
);

/* =========================================================
   GET RECOGNITION WALL

   GET /api/recognition-rewards
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
        category,
      } = req.query;

      const recognitions =
        await getRecognitionRewards({
          organizationId,
          status: status || "active",
          employeeId:
            employeeId || null,
          category:
            category || null,
        });

      return res.status(200).json({
        recognitions,
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] GET failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to load recognition wall.",
      });
    }
  }
);

/* =========================================================
   GET SINGLE RECOGNITION

   IMPORTANT:
   This comes AFTER /employees
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

      const recognition =
        await getRecognitionRewardById(
          organizationId,
          req.params.id
        );

      return res.status(200).json({
        recognition,
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] GET SINGLE failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to load recognition.",
      });
    }
  }
);

/* =========================================================
   CREATE RECOGNITION
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
        category,
        message,
        points,
      } = req.body || {};

      const recognition =
        await createRecognitionReward({
          organizationId,
          givenByUserId:
            req.user.id,
          employeeId:
            employeeId ||
            employee_id,
          category:
            category || "teamwork",
          message,
          points:
            points ?? 0,
        });

      return res.status(201).json({
        message:
          "Recognition created successfully.",
        recognition,
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] CREATE failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to create recognition.",
      });
    }
  }
);

/* =========================================================
   ARCHIVE
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

      const recognition =
        await archiveRecognitionReward(
          organizationId,
          req.params.id
        );

      return res.status(200).json({
        message:
          "Recognition archived successfully.",
        recognition,
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] ARCHIVE failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to archive recognition.",
      });
    }
  }
);

/* =========================================================
   DELETE
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

      await deleteRecognitionReward(
        organizationId,
        req.params.id
      );

      return res.status(200).json({
        message:
          "Recognition deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[RecognitionRewards] DELETE failed:",
        error
      );

      return res.status(
        error?.statusCode || 500
      ).json({
        message:
          error?.message ||
          "Failed to delete recognition.",
      });
    }
  }
);

export default router;