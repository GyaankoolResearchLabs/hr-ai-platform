import express from "express";

import {
  requireAuth,
} from "../middleware/auth.js";

import {
  getOrganizationIdFromRequest,
  getUserIdFromRequest,
} from "../utils/requestContext.js";

import {
  resolveEmployeeForUser,
} from "../services/employeeIdentityService.js";

import {
  generatePayslipsForPayrollRun,
  regeneratePayslip,
  getPayslips,
  getPayslipById,
  getEmployeePayslips,
  publishPayslip,
  publishPayslips,
  voidPayslip,
  markPayslipViewed,
  markPayslipDownloaded,
  updatePayslipPdfMetadata,
  getPayslipSummary,
  deletePayslip,
  getPayrollRunPayslipStatus,
} from "../services/payslipService.js";

const router =
  express.Router();

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(
  req,
) {
  const organizationId =
    getOrganizationIdFromRequest(
      req,
    );

  if (!organizationId) {
    const error =
      new Error(
        "Organization context is required.",
      );

    error.status = 400;

    throw error;
  }

  return organizationId;
}

function getUserId(
  req,
) {
  return (
    getUserIdFromRequest(
      req,
    ) || null
  );
}

function handleRouteError(
  res,
  error,
) {
  console.error(
    "[PAYSLIPS]",
    error,
  );

  const status =
    Number(error?.status) ||
    500;

  return res.status(
    status,
  ).json({
    success: false,

    message:
      error?.message ||
      "An unexpected error occurred.",
  });
}

function parseInteger(
  value,
  fallback,
) {
  const parsed =
    Number.parseInt(
      value,
      10,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return fallback;
  }

  return parsed;
}

async function getCurrentEmployee(
  req,
) {
  return resolveEmployeeForUser({
    organizationId:
      getOrganizationId(
        req,
      ),

    userId:
      getUserId(
        req,
      ),

    email:
      req.user?.email,
  });
}

/* =========================================================
   GENERATE PAYSLIPS FOR PAYROLL RUN
========================================================= */

router.post(
  "/payroll-runs/:payrollRunId/generate",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const userId =
        getUserId(
          req,
        );

      const result =
        await generatePayslipsForPayrollRun({
          organizationId,

          payrollRunId:
            req.params
              .payrollRunId,

          userId,

          employeeId:
            req.body
              ?.employeeId ||
            req.body
              ?.employee_id ||
            null,
        });

      return res.json({
        success: true,

        message:
          "Payslips generated successfully.",

        ...result,
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
   PAYROLL RUN PAYSLIP STATUS
========================================================= */

router.get(
  "/payroll-runs/:payrollRunId/status",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await getPayrollRunPayslipStatus({
          organizationId,

          payrollRunId:
            req.params
              .payrollRunId,
        });

      return res.json({
        success: true,

        ...result,
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
   PAYROLL RUN SUMMARY
========================================================= */

router.get(
  "/payroll-runs/:payrollRunId/summary",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await getPayslipSummary({
          organizationId,

          payrollRunId:
            req.params
              .payrollRunId,
        });

      return res.json({
        success: true,

        ...result,
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
   LIST PAYSLIPS
========================================================= */

router.get(
  "/",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await getPayslips({
          organizationId,

          payrollRunId:
            req.query
              ?.payrollRunId ||
            req.query
              ?.payroll_run_id ||
            null,

          employeeId:
            req.query
              ?.employeeId ||
            req.query
              ?.employee_id ||
            null,

          status:
            req.query
              ?.status ||
            null,

          search:
            req.query
              ?.search ||
            null,

          limit:
            parseInteger(
              req.query
                ?.limit,
              50,
            ),

          offset:
            parseInteger(
              req.query
                ?.offset,
              0,
            ),
        });

      return res.json({
        success: true,

        ...result,
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
   CURRENT EMPLOYEE PAYSLIP HISTORY
========================================================= */

router.get(
  "/me",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const employee =
        await getCurrentEmployee(
          req,
        );

      const result =
        await getEmployeePayslips({
          organizationId,

          employeeId:
            employee.id,

          status:
            "published",

          limit:
            parseInteger(
              req.query
                ?.limit,
              50,
            ),

          offset:
            parseInteger(
              req.query
                ?.offset,
              0,
            ),
        });

      return res.json({
        success: true,

        employee,

        ...result,
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
   CURRENT EMPLOYEE SINGLE PAYSLIP
========================================================= */

router.get(
  "/me/:payslipId",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const employee =
        await getCurrentEmployee(
          req,
        );

      const payslip =
        await getPayslipById({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      if (
        payslip.employee_id !==
          employee.id ||
        payslip.status !==
          "published"
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Payslip not found.",
        });
      }

      return res.json({
        success: true,
        data:
          payslip,
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
   EMPLOYEE PAYSLIP HISTORY
========================================================= */

router.get(
  "/employee/:employeeId",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await getEmployeePayslips({
          organizationId,

          employeeId:
            req.params
              .employeeId,

          status:
            req.query
              ?.status ||
            null,

          limit:
            parseInteger(
              req.query
                ?.limit,
              50,
            ),

          offset:
            parseInteger(
              req.query
                ?.offset,
              0,
            ),
        });

      return res.json({
        success: true,

        ...result,
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
   GET SINGLE PAYSLIP
========================================================= */

router.get(
  "/:payslipId",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await getPayslipById({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      return res.json({
        success: true,

        data:
          result,
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
   REGENERATE PAYSLIP
========================================================= */

router.post(
  "/:payslipId/regenerate",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const userId =
        getUserId(
          req,
        );

      const result =
        await regeneratePayslip({
          organizationId,

          payslipId:
            req.params
              .payslipId,

          userId,
        });

      return res.json({
        success: true,

        message:
          "Payslip regenerated successfully.",

        data:
          result,
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
   PUBLISH PAYSLIP
========================================================= */

router.post(
  "/:payslipId/publish",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const userId =
        getUserId(
          req,
        );

      const result =
        await publishPayslip({
          organizationId,

          payslipId:
            req.params
              .payslipId,

          userId,
        });

      return res.json({
        success: true,

        message:
          "Payslip published successfully.",

        data:
          result,
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
   BULK PUBLISH PAYSLIPS
========================================================= */

router.post(
  "/publish",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const userId =
        getUserId(
          req,
        );

      const payslipIds =
        Array.isArray(
          req.body
            ?.payslipIds,
        )
          ? req.body
              .payslipIds
          : Array.isArray(
                req.body
                  ?.payslip_ids,
              )
            ? req.body
                .payslip_ids
            : [];

      const result =
        await publishPayslips({
          organizationId,

          payslipIds,

          userId,
        });

      return res.json({
        success: true,

        message:
          "Payslips published successfully.",

        ...result,
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
   VOID PAYSLIP
========================================================= */

router.post(
  "/:payslipId/void",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await voidPayslip({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      return res.json({
        success: true,

        message:
          "Payslip voided successfully.",

        data:
          result,
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
   MARK PAYSLIP VIEWED
========================================================= */

router.post(
  "/:payslipId/view",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await markPayslipViewed({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      return res.json({
        success: true,

        data:
          result,
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
   MARK PAYSLIP DOWNLOADED
========================================================= */

router.post(
  "/:payslipId/download",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await markPayslipDownloaded({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      return res.json({
        success: true,

        data:
          result,
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
   UPDATE PDF METADATA
========================================================= */

router.patch(
  "/:payslipId/pdf",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const pdfFilePath =
        req.body
          ?.pdfFilePath ||
        req.body
          ?.pdf_file_path;

      const pdfGeneratedAt =
        req.body
          ?.pdfGeneratedAt ||
        req.body
          ?.pdf_generated_at ||
        null;

      const result =
        await updatePayslipPdfMetadata({
          organizationId,

          payslipId:
            req.params
              .payslipId,

          pdfFilePath,

          pdfGeneratedAt,
        });

      return res.json({
        success: true,

        message:
          "Payslip PDF metadata updated successfully.",

        data:
          result,
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
   DELETE PAYSLIP
========================================================= */

router.delete(
  "/:payslipId",
  requireAuth,
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(
          req,
        );

      const result =
        await deletePayslip({
          organizationId,

          payslipId:
            req.params
              .payslipId,
        });

      return res.json({
        success: true,

        message:
          "Payslip deleted successfully.",

        ...result,
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
