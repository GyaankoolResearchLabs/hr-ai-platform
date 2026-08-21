import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getRecognitionWall,
  getRecognitionById,
  createRecognition,
  updateRecognition,
  archiveRecognition,
  deleteRecognition,
} from "../services/recognitionService.js";

const router = express.Router();

/* =========================================================
   GET RECOGNITION WALL
   GET /api/recognition
========================================================= */

router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        req.user.organization_id;

      const {
        status,
        category,
        recognitionType,
        employeeId,
      } = req.query;

      const recognition =
        await getRecognitionWall({
          organizationId,
          status: status || "active",
          category:
            category || null,
          recognitionType:
            recognitionType || null,
          employeeId:
            employeeId || null,
        });

      return res.status(200).json({
        recognition,
      });
    } catch (error) {
      console.error(
        "[Recognition] GET failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to load recognition wall.",
        });
    }
  },
);

/* =========================================================
   GET SINGLE
   GET /api/recognition/:id
========================================================= */

router.get(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const recognition =
        await getRecognitionById(
          req.user.organization_id,
          req.params.id,
        );

      return res.status(200).json({
        recognition,
      });
    } catch (error) {
      console.error(
        "[Recognition] GET SINGLE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to load recognition.",
        });
    }
  },
);

/* =========================================================
   CREATE
   POST /api/recognition
========================================================= */

router.post(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const {
        giverEmployeeId,
        giver_employee_id,
        receiverEmployeeId,
        receiver_employee_id,
        recognitionType,
        recognition_type,
        category,
        title,
        message,
        rewardPoints,
        reward_points,
        visibility,
      } = req.body || {};

      const recognition =
        await createRecognition({
          organizationId:
            req.user.organization_id,

          giverEmployeeId:
            giverEmployeeId ??
            giver_employee_id ??
            null,

          receiverEmployeeId:
            receiverEmployeeId ??
            receiver_employee_id,

          recognitionType:
            recognitionType ??
            recognition_type ??
            "peer",

          category:
            category || "general",

          title:
            title || null,

          message,

          rewardPoints:
            rewardPoints ??
            reward_points ??
            0,

          visibility:
            visibility ||
            "organization",
        });

      return res.status(201).json({
        message:
          "Recognition created successfully.",
        recognition,
      });
    } catch (error) {
      console.error(
        "[Recognition] CREATE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to create recognition.",
        });
    }
  },
);

/* =========================================================
   UPDATE
   PATCH /api/recognition/:id
========================================================= */

router.patch(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      const recognition =
        await updateRecognition(
          req.user.organization_id,
          req.params.id,
          req.body || {},
        );

      return res.status(200).json({
        message:
          "Recognition updated successfully.",
        recognition,
      });
    } catch (error) {
      console.error(
        "[Recognition] UPDATE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to update recognition.",
        });
    }
  },
);

/* =========================================================
   ARCHIVE
   POST /api/recognition/:id/archive
========================================================= */

router.post(
  "/:id/archive",
  requireAuth,
  async (req, res) => {
    try {
      const recognition =
        await archiveRecognition(
          req.user.organization_id,
          req.params.id,
        );

      return res.status(200).json({
        message:
          "Recognition archived successfully.",
        recognition,
      });
    } catch (error) {
      console.error(
        "[Recognition] ARCHIVE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to archive recognition.",
        });
    }
  },
);

/* =========================================================
   DELETE
   DELETE /api/recognition/:id
========================================================= */

router.delete(
  "/:id",
  requireAuth,
  async (req, res) => {
    try {
      await deleteRecognition(
        req.user.organization_id,
        req.params.id,
      );

      return res.status(200).json({
        message:
          "Recognition deleted successfully.",
      });
    } catch (error) {
      console.error(
        "[Recognition] DELETE failed:",
        error,
      );

      return res
        .status(
          error?.statusCode || 500,
        )
        .json({
          message:
            error?.message ||
            "Failed to delete recognition.",
        });
    }
  },
);

export default router;