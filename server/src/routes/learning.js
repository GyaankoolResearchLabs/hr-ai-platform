import express from "express";

import {
  generateCourse,
  getCourses,
  getCourse,
} from "../services/learningService.js";

const router = express.Router();

/* =========================================================
   ORGANIZATION ID HELPER
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.user?.organizationId ||
    req.body?.organization_id ||
    req.body?.organizationId ||
    req.query?.organization_id ||
    req.query?.organizationId ||
    null
  );
}

/* =========================================================
   GENERATE COURSE
   POST /api/learning/courses/generate
========================================================= */

router.post(
  "/courses/generate",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message: "Organization ID is required.",
        });
      }

      const {
        sourceTitle,
        sourceContent,
        courseTitle,
        courseDescription,
        difficulty,
        estimatedDurationMinutes,
      } = req.body || {};

      if (!sourceContent?.trim()) {
        return res.status(400).json({
          message: "Source content is required.",
        });
      }

      if (!courseTitle?.trim()) {
        return res.status(400).json({
          message: "Course title is required.",
        });
      }

      console.log(
        "[Learning] Generating course:",
        {
          organizationId,
          courseTitle,
          difficulty,
        },
      );

      const course =
        await generateCourse({
          organizationId,
          generatedByUserId:
            req.user?.id || null,
          sourceTitle,
          sourceContent,
          courseTitle,
          courseDescription,
          difficulty,
          estimatedDurationMinutes,
        });

      return res.status(201).json({
        success: true,
        course,
      });
    } catch (error) {
      console.error(
        "[Learning] Course generation failed:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        success: false,
        message:
          error?.message ||
          "Course generation failed.",
      });
    }
  },
);

/* =========================================================
   GET COURSES
   GET /api/learning/courses
========================================================= */

router.get(
  "/courses",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message: "Organization ID is required.",
        });
      }

      const courses =
        await getCourses(organizationId);

      return res.status(200).json({
        success: true,
        courses: courses || [],
      });
    } catch (error) {
      console.error(
        "[Learning] Failed to load courses:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load courses.",
      });
    }
  },
);

/* =========================================================
   GET SINGLE COURSE
   GET /api/learning/courses/:id
========================================================= */

router.get(
  "/courses/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message: "Organization ID is required.",
        });
      }

      const course =
        await getCourse(
          organizationId,
          req.params.id,
        );

      return res.status(200).json({
        success: true,
        course,
      });
    } catch (error) {
      console.error(
        "[Learning] Failed to load course:",
        error,
      );

      return res.status(
        error?.statusCode || 500,
      ).json({
        success: false,
        message:
          error?.message ||
          "Failed to load course.",
      });
    }
  },
);

export default router;