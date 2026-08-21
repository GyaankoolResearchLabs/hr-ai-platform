import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  queryWorkforceData,
} from "../services/workforceQueryService.js";

const router = express.Router();

// POST /api/workforce-query
// Requires authentication - uses req.user.organization_id set by requireAuth middleware
router.post("/", requireAuth, async (req, res) => {
  try {
    const { question } = req.body || {};

    if (
      !question ||
      !String(question).trim()
    ) {
      return res.status(400).json({
        message:
          "Please provide a workforce question.",
      });
    }

    // Organization ID comes from the authenticated session via requireAuth middleware
    // Never trust organizationId from the request body
    const organizationId = req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "No organization found for authenticated user.",
      });
    }

    const result =
      await queryWorkforceData({
        question,
        organizationId,
      });

    return res.json(result);
  } catch (error) {
    console.error(
      "[Workforce Query] Error:",
      error
    );

    return res.status(500).json({
      message:
        error.message ||
        "Unable to process workforce question.",
    });
  }
});

export default router;