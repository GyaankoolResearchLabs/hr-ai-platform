import express from "express";
import {
  queryWorkforceData,
} from "../services/workforceQueryService.js";

const router = express.Router();

function getBearerToken(req) {
  const authorization =
    req.headers.authorization || "";

  if (
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  return authorization.substring(7);
}

router.post("/", async (req, res) => {
  try {
    const {
      question,
      organizationId,
    } = req.body || {};

    if (
      !question ||
      !String(question).trim()
    ) {
      return res.status(400).json({
        message:
          "Please provide a workforce question.",
      });
    }

    /*
     * The frontend already sends the Supabase
     * access token through the Axios interceptor.
     *
     * We preserve it here for compatibility with
     * the application's existing authentication flow.
     */
    const token =
      getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        message:
          "Authentication required.",
      });
    }

    const result =
      await queryWorkforceData({
        question,
        organizationId:
          organizationId || null,
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