import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireHRRole } from "../middleware/requireHRRole.js";
import { generateCourse } from "../controllers/learningCourseController.js";

const router = express.Router();

// POST /api/learning/courses/generate
// Requires authentication - organizationId comes from req.user set by requireAuth
// NOTE: currently shadowed by routes/learning.js, which is mounted at the
// same "/api/learning" prefix and registered first in index.js - kept
// gated anyway in case that mount order ever changes.
router.post(
  "/courses/generate",
  requireAuth,
  requireHRRole,
  generateCourse,
);

export default router;