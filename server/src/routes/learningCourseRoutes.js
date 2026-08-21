import express from "express";
import { generateCourse } from "../controllers/learningCourseController.js";

const router = express.Router();

router.post("/courses/generate", generateCourse);

export default router;