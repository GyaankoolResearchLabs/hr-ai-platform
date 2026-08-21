import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getAttritionForecast,
} from "../services/attritionForecastingService.js";

const router = express.Router();

router.use(requireAuth);

/* =========================================================
   GET ATTRITION & DEMAND FORECAST
   GET /api/attrition-forecasting
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      req.user.organization_id;

    if (!organizationId) {
      return res.status(403).json({
        message:
          "User is not associated with an organization.",
      });
    }

    const forecastMonths =
      req.query.months || 3;

    const forecast =
      await getAttritionForecast(
        organizationId,
        forecastMonths,
      );

    return res.status(200).json(
      forecast,
    );
  } catch (error) {
    console.error(
      "[AttritionForecasting] GET failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to generate attrition forecast.",
      });
  }
});

export default router;