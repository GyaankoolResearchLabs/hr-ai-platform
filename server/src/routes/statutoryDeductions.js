import express from "express";

import { requireAuth } from "../middleware/auth.js";

import {
  getStatutoryRules,
  getStatutoryRule,
  createStatutoryRule,
  updateStatutoryRule,
  deleteStatutoryRule,
  calculateStatutoryDeductionsForPayrollRun,
  getPayrollStatutoryDeductions,
  getStatutoryDeductionSummary,
  validateStatutoryRuleInput,
  previewStatutoryRule,
} from "../services/statutoryDeductionService.js";

import { createAuditLog } from "../services/auditLogService.js";

const router = express.Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(req) {
  return (
    req.user?.organization_id ||
    req.organization?.id ||
    req.organization_id ||
    null
  );
}

function getUserId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    null
  );
}

function handleError(
  res,
  error,
  fallbackMessage,
) {
  console.error(
    `[Statutory Deductions] ${fallbackMessage}:`,
    error,
  );

  return res.status(
    error?.status || 500,
  ).json({
    message:
      error?.message ||
      fallbackMessage,
  });
}

async function audit(
  req,
  {
    action,
    resourceType,
    resourceId = null,
    status = "success",
    metadata = {},
  },
) {
  try {
    await createAuditLog({
      organizationId:
        getOrganizationId(req),

      userId:
        getUserId(req),

      action,

      resourceType,

      resourceId,

      status,

      metadata,
    });
  } catch (error) {
    console.warn(
      "[Statutory Deductions] Audit log failed:",
      error?.message ||
        error,
    );
  }
}

/* =========================================================
   GET ALL STATUTORY RULES
   GET /api/statutory-deductions/rules
========================================================= */

router.get(
  "/rules",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const rules =
        await getStatutoryRules({
          organizationId,

          status:
            req.query.status ||
            null,

          countryCode:
            req.query.countryCode ||
            req.query.country_code ||
            null,

          regionCode:
            req.query.regionCode ||
            req.query.region_code ||
            null,
        });

      return res.json({
        data: rules,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not load statutory deduction rules.",
      );
    }
  },
);

/* =========================================================
   GET SINGLE STATUTORY RULE
   GET /api/statutory-deductions/rules/:id
========================================================= */

router.get(
  "/rules/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const rule =
        await getStatutoryRule({
          organizationId,

          ruleId:
            req.params.id,
        });

      return res.json({
        data: rule,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not load statutory deduction rule.",
      );
    }
  },
);

/* =========================================================
   CREATE STATUTORY RULE
   POST /api/statutory-deductions/rules
========================================================= */

router.post(
  "/rules",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const userId =
        getUserId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const rule =
        await createStatutoryRule({
          organizationId,

          userId,

          rule:
            req.body || {},
        });

      await audit(req, {
        action:
          "statutory_rule.create",

        resourceType:
          "statutory_deduction_rule",

        resourceId:
          rule.id,

        metadata: {
          code:
            rule.code,

          name:
            rule.name,

          status:
            rule.status,

          effective_from:
            rule.effective_from,
        },
      });

      return res.status(201).json({
        message:
          "Statutory deduction rule created successfully.",

        data: rule,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not create statutory deduction rule.",
      );
    }
  },
);

/* =========================================================
   UPDATE STATUTORY RULE
   PATCH /api/statutory-deductions/rules/:id
========================================================= */

router.patch(
  "/rules/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const userId =
        getUserId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const rule =
        await updateStatutoryRule({
          organizationId,

          userId,

          ruleId:
            req.params.id,

          rule:
            req.body || {},
        });

      await audit(req, {
        action:
          "statutory_rule.update",

        resourceType:
          "statutory_deduction_rule",

        resourceId:
          rule.id,

        metadata: {
          code:
            rule.code,

          name:
            rule.name,

          status:
            rule.status,

          effective_from:
            rule.effective_from,
        },
      });

      return res.json({
        message:
          "Statutory deduction rule updated successfully.",

        data: rule,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not update statutory deduction rule.",
      );
    }
  },
);

/* =========================================================
   DELETE STATUTORY RULE
   DELETE /api/statutory-deductions/rules/:id
========================================================= */

router.delete(
  "/rules/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const result =
        await deleteStatutoryRule({
          organizationId,

          ruleId:
            req.params.id,
        });

      await audit(req, {
        action:
          "statutory_rule.delete",

        resourceType:
          "statutory_deduction_rule",

        resourceId:
          req.params.id,

        metadata: {
          deleted: true,
        },
      });

      return res.json({
        message:
          "Statutory deduction rule deleted successfully.",

        data: result,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not delete statutory deduction rule.",
      );
    }
  },
);

/* =========================================================
   VALIDATE RULE
   POST /api/statutory-deductions/validate
========================================================= */

router.post(
  "/validate",
  async (req, res) => {
    try {
      const result =
        validateStatutoryRuleInput(
          req.body || {},
        );

      return res.json({
        data: result,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not validate statutory deduction rule.",
      );
    }
  },
);

/* =========================================================
   PREVIEW RULE CALCULATION
   POST /api/statutory-deductions/preview
========================================================= */

router.post(
  "/preview",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const rule =
        body.rule || body;

      const calculationBase =
        body.calculationBase ??
        body.calculation_base ??
        0;

      const result =
        previewStatutoryRule({
          rule,

          calculationBase,
        });

      return res.json({
        data: result,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not preview statutory deduction.",
      );
    }
  },
);

/* =========================================================
   CALCULATE PAYROLL RUN
   POST /api/statutory-deductions/payroll-runs/:id/calculate
========================================================= */

router.post(
  "/payroll-runs/:id/calculate",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      const userId =
        getUserId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const result =
        await calculateStatutoryDeductionsForPayrollRun({
          organizationId,

          payrollRunId:
            req.params.id,

          userId,
        });

      await audit(req, {
        action:
          "statutory_deduction.calculate",

        resourceType:
          "payroll_run",

        resourceId:
          req.params.id,

        metadata: {
          rules_applied:
            result.rules_applied,

          deductions_created:
            result.deductions_created,

          total_employee_deductions:
            result.total_employee_deductions,

          total_employer_contributions:
            result.total_employer_contributions,

          error_count:
            result.error_count,
        },
      });

      return res.json({
        message:
          "Statutory deductions calculated successfully.",

        data: result,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not calculate statutory deductions.",
      );
    }
  },
);

/* =========================================================
   GET PAYROLL STATUTORY BREAKDOWN
   GET /api/statutory-deductions/payroll-runs/:id
========================================================= */

router.get(
  "/payroll-runs/:id",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const data =
        await getPayrollStatutoryDeductions({
          organizationId,

          payrollRunId:
            req.params.id,

          employeeId:
            req.query.employeeId ||
            req.query.employee_id ||
            null,
        });

      return res.json({
        data,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not load payroll statutory deductions.",
      );
    }
  },
);

/* =========================================================
   GET PAYROLL STATUTORY SUMMARY
   GET /api/statutory-deductions/payroll-runs/:id/summary
========================================================= */

router.get(
  "/payroll-runs/:id/summary",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(400).json({
          message:
            "Organization is required.",
        });
      }

      const summary =
        await getStatutoryDeductionSummary({
          organizationId,

          payrollRunId:
            req.params.id,
        });

      return res.json({
        data: summary,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not load statutory deduction summary.",
      );
    }
  },
);

export default router;