import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

import {
  getOrgChart,
  updateEmployeeManager,
} from "../services/orgChartService.js";

const router = Router();

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(
  req,
  res,
  next,
) {
  try {
    const organization =
      await getOrganizationForUser(
        req.user.id,
      );

    if (!organization) {
      return res.status(403).json({
        message:
          "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[Org Chart] Organization lookup failed:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   GET ORG CHART
   GET /api/org-chart
========================================================= */

router.get("/", async (req, res) => {
  try {
    const result = await getOrgChart(
      req.organization.id,
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "[Org Chart] GET failed:",
      error,
    );

    return res
      .status(error?.statusCode || 500)
      .json({
        message:
          error?.message ||
          "Failed to load organization chart.",
      });
  }
});

/* =========================================================
   UPDATE REPORTING MANAGER
   PATCH /api/org-chart/:employeeId/manager
========================================================= */

router.patch(
  "/:employeeId/manager",
  async (req, res) => {
    try {
      const {
        manager_id,
        managerId,
      } = req.body || {};

      const manager =
        manager_id ??
        managerId ??
        null;

      const employee =
        await updateEmployeeManager(
          req.organization.id,
          req.params.employeeId,
          manager,
        );

      return res.status(200).json({
        message:
          "Reporting manager updated successfully.",
        employee,
      });
    } catch (error) {
      console.error(
        "[Org Chart] UPDATE MANAGER failed:",
        error,
      );

      return res
        .status(error?.statusCode || 500)
        .json({
          message:
            error?.message ||
            "Failed to update reporting manager.",
        });
    }
  },
);

export default router;