import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { generateCourse } from "../controllers/learningCourseController.js";

const router = express.Router();

// POST /api/learning/courses/generate
// Requires authentication - organizationId comes from req.user set by requireAuth
router.post("/courses/generate", requireAuth, generateCourse);

export default router;