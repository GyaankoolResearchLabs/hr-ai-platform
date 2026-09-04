import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

import {
  getPayrollCostAnalytics,
  getPayrollCostSummary,
  getPayrollCostByDepartment,
  getPayrollCostByLocation,
  getPayrollCostByRole,
  getPayrollCostTrend,
  getPayrollCostByEmployee,
  getPayrollCostFilters,
  getAnalyticsPayrollRuns,
} from "../services/payrollCostAnalyticsService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

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
    if (req.organization?.id) {
      return next();
    }

    const organization =
      await getOrganizationForUser(
        req.user.id,
      );

    if (!organization?.id) {
      return res.status(403).json({
        message:
          "Complete organization setup first.",
      });
    }

    req.organization =
      organization;

    next();
  } catch (error) {
    console.error(
      "[PayrollCostAnalytics] Organization lookup error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not determine organization.",
    });
  }
}

router.use(
  requireOrganization,
);

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

function cleanQuery(value) {
  const cleaned =
    String(value ?? "").trim();

  return cleaned || null;
}

function parseOptions(req) {
  return {
    organizationId:
      getOrganizationId(req),

    payrollRunId:
      cleanQuery(
        req.query.payrollRunId ??
          req.query.payroll_run_id,
      ),

    payrollMonth:
      cleanQuery(
        req.query.payrollMonth ??
          req.query.payroll_month,
      ),

    status:
      cleanQuery(
        req.query.status,
      ),

    department:
      cleanQuery(
        req.query.department,
      ),

    location:
      cleanQuery(
        req.query.location,
      ),

    role:
      cleanQuery(
        req.query.role,
      ),
  };
}

function handleRouteError(
  res,
  error,
) {
  console.error(
    "[PayrollCostAnalytics]",
    error,
  );

  return res.status(
    error?.statusCode || 500,
  ).json({
    message:
      error?.message ||
      "Failed to load payroll cost analytics.",
  });
}

/* =========================================================
   COMPLETE ANALYTICS DASHBOARD
========================================================= */

/*
  GET /api/payroll-cost-analytics

  Returns:

  summary
  department breakdown
  location breakdown
  role breakdown
  employee detail
*/

router.get(
  "/",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostAnalytics(
          parseOptions(req),
        );

      return res.json(data);
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   SUMMARY
========================================================= */

/*
  GET /api/payroll-cost-analytics/summary
*/

router.get(
  "/summary",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostSummary(
          parseOptions(req),
        );

      return res.json(data);
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   DEPARTMENT
========================================================= */

/*
  GET /api/payroll-cost-analytics/by-department
*/

router.get(
  "/by-department",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostByDepartment(
          parseOptions(req),
        );

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   LOCATION
========================================================= */

/*
  GET /api/payroll-cost-analytics/by-location
*/

router.get(
  "/by-location",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostByLocation(
          parseOptions(req),
        );

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   ROLE
========================================================= */

/*
  GET /api/payroll-cost-analytics/by-role
*/

router.get(
  "/by-role",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostByRole(
          parseOptions(req),
        );

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   MONTHLY TREND
========================================================= */

/*
  GET /api/payroll-cost-analytics/trend

  Optional query:

  ?startMonth=2026-01
  &endMonth=2026-12
  &status=processed
*/

router.get(
  "/trend",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostTrend({
          organizationId:
            getOrganizationId(
              req,
            ),

          startMonth:
            cleanQuery(
              req.query.startMonth ??
                req.query.start_month,
            ),

          endMonth:
            cleanQuery(
              req.query.endMonth ??
                req.query.end_month,
            ),

          status:
            cleanQuery(
              req.query.status,
            ),
        });

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   EMPLOYEE DETAIL
========================================================= */

/*
  GET /api/payroll-cost-analytics/employees
*/

router.get(
  "/employees",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostByEmployee(
          parseOptions(req),
        );

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   FILTER OPTIONS
========================================================= */

/*
  GET /api/payroll-cost-analytics/filters
*/

router.get(
  "/filters",
  async (req, res) => {
    try {
      const data =
        await getPayrollCostFilters(
          getOrganizationId(
            req,
          ),
        );

      return res.json(data);
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

/* =========================================================
   PAYROLL RUN SELECTOR DATA
========================================================= */

/*
  GET /api/payroll-cost-analytics/payroll-runs
*/

router.get(
  "/payroll-runs",
  async (req, res) => {
    try {
      const data =
        await getAnalyticsPayrollRuns(
          getOrganizationId(
            req,
          ),
        );

      return res.json({
        data,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
      );
    }
  },
);

export default router;