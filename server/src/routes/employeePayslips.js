import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";

import {
  getEmployeePayslips,
  getPayslipById,
  markPayslipDownloaded,
} from "../services/payslipService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE PAYSLIPS
|--------------------------------------------------------------------------
|
| GET /api/employee/payslips
| GET /api/employee/payslips/:id
| GET /api/employee/payslips/:id/download
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| Only published payslips are visible here, matching the existing
| GET /api/payslips/me convention in routes/payslips.js — a payslip
| that is still 'generated' (not yet published by HR) is not shown.
|
| All data assembly comes from services/payslipService.js, the same
| service the HR-side routes/payslips.js uses — nothing here
| re-implements payslip generation or the earnings/deductions math.
|--------------------------------------------------------------------------
*/

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeePayslips]", error);

  return res.status(error?.status || 500).json({
    message: error?.message || fallbackMessage,
  });
}

function serializeListItem(payslip) {
  return {
    id: payslip.id,
    payslip_number: payslip.payslip_number,
    payroll_month: payslip.payroll_month,
    period_start: payslip.period_start,
    period_end: payslip.period_end,
    gross_pay: payslip.gross_pay,
    net_pay: payslip.net_pay,
    total_deductions: payslip.total_deductions,
    status: payslip.status,
    published_at: payslip.published_at,
  };
}

/*
 * A payslip only belongs to this employee if BOTH the employee id
 * matches AND it has been published — a 'generated' (draft) payslip
 * for this same employee is not visible to them either.
 */
function belongsToEmployee(payslip, employeeId) {
  return (
    payslip &&
    payslip.employee_id === employeeId &&
    payslip.status === "published"
  );
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/payslips
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;

    const result = await getEmployeePayslips({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      status: "published",
      limit: 100,
      offset: 0,
    });

    return res.json({
      payslips: (result.data || []).map(serializeListItem),
      total: result.total,
    });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load payslips."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/payslips/:id
|--------------------------------------------------------------------------
| 404 (not 403) when the payslip belongs to someone else — this must
| not confirm to a caller that a given payslip id exists at all.
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const employee = req.employee;

    const payslip = await getPayslipById({
      organizationId: employee.organization_id,
      payslipId: req.params.id,
    });

    if (!belongsToEmployee(payslip, employee.id)) {
      return res.status(404).json({
        message: "Payslip not found.",
      });
    }

    return res.json({ payslip });
  } catch (error) {
    if (error?.status === 404) {
      return res.status(404).json({
        message: "Payslip not found.",
      });
    }

    return handleRouteError(
      res,
      error,
      "Could not load payslip."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/payslips/:id/download
|--------------------------------------------------------------------------
|
| The existing system has no server-side PDF binary generation — the
| HR-side "Save PDF" action (routes/payslips.js POST /:id/download,
| PayslipGeneratorPortal.jsx) marks the payslip downloaded via
| markPayslipDownloaded() and then renders a print-styled view that
| the browser turns into a PDF via window.print(). This route reuses
| that exact same tracking call rather than inventing a new PDF
| pipeline, and returns the full payslip so the client can render the
| equivalent print view.
|--------------------------------------------------------------------------
*/

router.get("/:id/download", async (req, res) => {
  try {
    const employee = req.employee;

    const existing = await getPayslipById({
      organizationId: employee.organization_id,
      payslipId: req.params.id,
    });

    if (!belongsToEmployee(existing, employee.id)) {
      return res.status(404).json({
        message: "Payslip not found.",
      });
    }

    const payslip = await markPayslipDownloaded({
      organizationId: employee.organization_id,
      payslipId: req.params.id,
    });

    return res.json({ payslip });
  } catch (error) {
    if (error?.status === 404) {
      return res.status(404).json({
        message: "Payslip not found.",
      });
    }

    return handleRouteError(
      res,
      error,
      "Could not download payslip."
    );
  }
});

export default router;
