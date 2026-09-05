import express from "express";

import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import {
  resolveEmployeeForUser,
} from "../services/employeeIdentityService.js";

import {
  createPayrollRun,
  getPayrollRuns,
  getPayrollRun,
  updatePayrollItem,
  submitPayrollForReview,
  returnPayrollToDraft,
  approvePayroll,
  processPayroll,
  deletePayrollRun,
} from "../services/payrollRunService.js";

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

function handleError(res, error, fallbackMessage) {
  console.error(
    `[Payroll Runs] ${fallbackMessage}:`,
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

async function getCurrentEmployee(req) {
  return resolveEmployeeForUser({
    organizationId:
      getOrganizationId(req),

    userId:
      getUserId(req),

    email:
      req.user?.email,
  });
}

/* =========================================================
   GET ALL PAYROLL RUNS
   GET /api/payroll-runs
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message:
          "Organization is required.",
      });
    }

    const runs =
      await getPayrollRuns(
        organizationId,
      );

    return res.json({
      data: runs,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Could not load payroll runs.",
    );
  }
});

/* =========================================================
   CURRENT EMPLOYEE PAYROLL
   GET /api/payroll-runs/me
========================================================= */

router.get("/me", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message:
          "Organization is required.",
      });
    }

    const employee =
      await getCurrentEmployee(req);

    const limit =
      Math.min(
        Math.max(
          Number(req.query.limit) || 12,
          1,
        ),
        36,
      );

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("payroll_run_items")
        .select(`
          *,
          payroll_runs (
            id,
            payroll_month,
            status,
            processed_at,
            approved_at,
            notes
          )
        `)
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "employee_id",
          employee.id,
        )
        .eq(
          "payroll_runs.status",
          "processed",
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(limit);

    if (error) {
      throw error;
    }

    const payroll =
      (data || []).filter(
        (item) =>
          item.payroll_runs,
      );

    return res.json({
      employee,
      data:
        payroll,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Could not load employee payroll.",
    );
  }
});

/* =========================================================
   GET SINGLE PAYROLL RUN
   GET /api/payroll-runs/:id
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const organizationId =
      getOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        message:
          "Organization is required.",
      });
    }

    const run =
      await getPayrollRun(
        organizationId,
        req.params.id,
      );

    return res.json({
      data: run,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Could not load payroll run.",
    );
  }
});

/* =========================================================
   CREATE PAYROLL RUN
   POST /api/payroll-runs
========================================================= */

router.post("/", async (req, res) => {
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

    const body =
      req.body || {};

    const payrollMonth =
      body.payrollMonth ??
      body.payroll_month ??
      body.month;

    const notes =
      body.notes ?? null;

    const run =
      await createPayrollRun({
        organizationId,
        userId,
        payrollMonth,
        notes,
      });

    try {
      await createAuditLog({
        organizationId,
        userId,
        action:
          "payroll.create",
        resourceType:
          "payroll_run",
        resourceId:
          run.id,
        status:
          "success",
        metadata: {
          payroll_month:
            run.payroll_month,
          employee_count:
            run.employee_count,
        },
      });
    } catch (auditError) {
      console.warn(
        "[Payroll Runs] Audit log failed:",
        auditError?.message ||
          auditError,
      );
    }

    return res.status(201).json({
      message:
        "Payroll run created successfully.",
      data: run,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Could not create payroll run.",
    );
  }
});

/* =========================================================
   UPDATE PAYROLL ITEM
   PATCH /api/payroll-runs/:runId/items/:itemId
========================================================= */

router.patch(
  "/:runId/items/:itemId",
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

      const item =
        await updatePayrollItem({
          organizationId,
          runId:
            req.params.runId,
          itemId:
            req.params.itemId,
          updates:
            req.body || {},
        });

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.item_update",
          resourceType:
            "payroll_run_item",
          resourceId:
            item.id,
          status:
            "success",
          metadata: {
            payroll_run_id:
              req.params.runId,
            employee_id:
              item.employee_id,
          },
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json({
        message:
          "Payroll item updated successfully.",
        data: item,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not update payroll item.",
      );
    }
  },
);

/* =========================================================
   SUBMIT PAYROLL FOR REVIEW
   POST /api/payroll-runs/:id/submit
========================================================= */

router.post(
  "/:id/submit",
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

      const run =
        await submitPayrollForReview({
          organizationId,
          runId:
            req.params.id,
          userId,
        });

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.submit_review",
          resourceType:
            "payroll_run",
          resourceId:
            run.id,
          status:
            "success",
          metadata: {
            status:
              run.status,
          },
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json({
        message:
          "Payroll submitted for review.",
        data: run,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not submit payroll for review.",
      );
    }
  },
);

/* =========================================================
   RETURN PAYROLL TO DRAFT
   POST /api/payroll-runs/:id/draft
========================================================= */

router.post(
  "/:id/draft",
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

      const run =
        await returnPayrollToDraft({
          organizationId,
          runId:
            req.params.id,
          userId,
        });

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.return_draft",
          resourceType:
            "payroll_run",
          resourceId:
            run.id,
          status:
            "success",
          metadata: {
            status:
              run.status,
          },
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json({
        message:
          "Payroll returned to draft.",
        data: run,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not return payroll to draft.",
      );
    }
  },
);

/* =========================================================
   APPROVE PAYROLL
   POST /api/payroll-runs/:id/approve
========================================================= */

router.post(
  "/:id/approve",
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

      const run =
        await approvePayroll({
          organizationId,
          runId:
            req.params.id,
          userId,
        });

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.approve",
          resourceType:
            "payroll_run",
          resourceId:
            run.id,
          status:
            "success",
          metadata: {
            status:
              run.status,
            approved_by:
              userId,
          },
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json({
        message:
          "Payroll approved successfully.",
        data: run,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not approve payroll.",
      );
    }
  },
);

/* =========================================================
   PROCESS PAYROLL
   POST /api/payroll-runs/:id/process
========================================================= */

router.post(
  "/:id/process",
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

      const run =
        await processPayroll({
          organizationId,
          runId:
            req.params.id,
          userId,
        });

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.process",
          resourceType:
            "payroll_run",
          resourceId:
            run.id,
          status:
            "success",
          metadata: {
            status:
              run.status,
            processed_by:
              userId,
            net_pay:
              run.net_pay,
          },
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json({
        message:
          "Payroll processed successfully.",
        data: run,
      });
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not process payroll.",
      );
    }
  },
);

/* =========================================================
   DELETE PAYROLL RUN
   DELETE /api/payroll-runs/:id
========================================================= */

router.delete(
  "/:id",
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
       await deletePayrollRun({
  organizationId,
  runId: req.params.id,
});

      try {
        await createAuditLog({
          organizationId,
          userId,
          action:
            "payroll.delete",
          resourceType:
            "payroll_run",
          resourceId:
            req.params.id,
          status:
            "success",
        });
      } catch (auditError) {
        console.warn(
          "[Payroll Runs] Audit log failed:",
          auditError?.message ||
            auditError,
        );
      }

      return res.json(
        result,
      );
    } catch (error) {
      return handleError(
        res,
        error,
        "Could not delete payroll run.",
      );
    }
  },
);

export default router;
