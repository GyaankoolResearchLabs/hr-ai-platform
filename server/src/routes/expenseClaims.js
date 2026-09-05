import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";
import {
  resolveEmployeeForUser,
} from "../services/employeeIdentityService.js";

import {
  getExpenseEmployee,
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,

  getExpenseClaims,
  getExpenseClaim,
  createExpenseClaim,
  updateExpenseClaim,
  deleteExpenseClaim,

  addExpenseClaimItem,
  updateExpenseClaimItem,
  deleteExpenseClaimItem,

  submitExpenseClaim,
  reviewExpenseClaim,
  approveExpenseClaim,
  rejectExpenseClaim,

  markExpenseClaimPaid,
  reconcileExpenseClaim,

  getClaimReceipts,
  addExpenseReceipt,
  deleteExpenseReceipt,

  getClaimEvents,

  cancelExpenseClaim,

  getExpenseSummary,
  getExpenseStatistics,

  getEmployeeExpenseClaims,
  getPayrollReconciliationQueue,
} from "../services/expenseClaimService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION RESOLUTION
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
        success: false,
        message:
          "Complete organization setup first.",
      });
    }

    req.organization =
      organization;

    next();
  } catch (error) {
    console.error(
      "[ExpenseClaims] Organization lookup error:",
      error,
    );

    return res.status(500).json({
      success: false,
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

function getUserId(req) {
  return (
    req.user?.id ||
    null
  );
}

function clean(value) {
  return String(
    value ?? "",
  ).trim();
}

function optional(value) {
  const cleaned =
    clean(value);

  return cleaned || null;
}

function parseBoolean(
  value,
  fallback = false,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  if (
    typeof value ===
    "boolean"
  ) {
    return value;
  }

  return (
    String(value)
      .trim()
      .toLowerCase() ===
    "true"
  );
}

function parseNumber(
  value,
  fallback = null,
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number,
  )
    ? number
    : fallback;
}

function parsePage(
  value,
  fallback = 1,
) {
  const page =
    Number.parseInt(
      value,
      10,
    );

  if (
    Number.isNaN(page) ||
    page < 1
  ) {
    return fallback;
  }

  return page;
}

function parsePageSize(
  value,
  fallback = 20,
) {
  const pageSize =
    Number.parseInt(
      value,
      10,
    );

  if (
    Number.isNaN(pageSize) ||
    pageSize < 1
  ) {
    return fallback;
  }

  return Math.min(
    100,
    pageSize,
  );
}

function handleRouteError(
  res,
  error,
  context,
) {
  console.error(
    `[ExpenseClaims] ${context}:`,
    error,
  );

  const statusCode =
    Number(
      error?.statusCode,
    ) || 500;

  return res
    .status(statusCode)
    .json({
      success: false,

      message:
        error?.message ||
        `Unexpected error while ${context}.`,
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
   GET EMPLOYEES
   Used by claim creation UI.
========================================================= */

router.get(
  "/employees",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          success: false,
          message:
            "Organization could not be determined.",
        });
      }

      const search =
        clean(
          req.query.search,
        );

      let query =
        req.supabase ||
        null;

      /*
       * Use the admin client through the employee service
       * path indirectly where possible. The employee lookup
       * service validates organization ownership.
       *
       * For the employee selector we query the employees
       * table directly using the same organization boundary.
       */
      const {
        supabaseAdmin,
      } = await import(
        "../config/supabase.js"
      );

      let employeeQuery =
        supabaseAdmin
          .from("employees")
          .select(`
            id,
            full_name,
            email,
            department,
            title,
            employee_code,
            employment_status
          `)
          .eq(
            "organization_id",
            organizationId,
          )
          .order(
            "full_name",
            {
              ascending: true,
            },
          )
          .limit(100);

      if (search) {
        employeeQuery =
          employeeQuery.or(
            `full_name.ilike.%${search}%,email.ilike.%${search}%,employee_code.ilike.%${search}%,department.ilike.%${search}%`,
          );
      }

      const {
        data,
        error,
      } =
        await employeeQuery;

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,

        employees:
          Array.isArray(data)
            ? data
            : [],
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading employees",
      );
    }
  },
);

/* =========================================================
   GET SINGLE EMPLOYEE
========================================================= */

router.get(
  "/employees/:employeeId",
  async (req, res) => {
    try {
      const employee =
        await getExpenseEmployee({
          organizationId:
            getOrganizationId(req),

          employeeId:
            req.params.employeeId,
        });

      return res.status(200).json({
        success: true,
        employee,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading employee",
      );
    }
  },
);

/* =========================================================
   EXPENSE CATEGORIES
========================================================= */

/*
 * GET /api/expense-claims/categories
 */

router.get(
  "/categories",
  async (req, res) => {
    try {
      const categories =
        await getExpenseCategories({
          organizationId:
            getOrganizationId(req),

          includeInactive:
            parseBoolean(
              req.query.includeInactive,
              false,
            ),
        });

      return res.status(200).json({
        success: true,
        categories,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense categories",
      );
    }
  },
);

/*
 * POST /api/expense-claims/categories
 */

router.post(
  "/categories",
  async (req, res) => {
    try {
      const category =
        await createExpenseCategory({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          name:
            req.body?.name,

          description:
            req.body?.description,
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense category created successfully.",

        category,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "creating expense category",
      );
    }
  },
);

/*
 * PATCH /api/expense-claims/categories/:categoryId
 */

router.patch(
  "/categories/:categoryId",
  async (req, res) => {
    try {
      const category =
        await updateExpenseCategory({
          organizationId:
            getOrganizationId(req),

          categoryId:
            req.params.categoryId,

          name:
            req.body?.name,

          description:
            req.body?.description,

          isActive:
            req.body?.isActive ??
            req.body?.is_active,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense category updated successfully.",

        category,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "updating expense category",
      );
    }
  },
);

/* =========================================================
   CLAIM LIST
========================================================= */

/*
 * GET /api/expense-claims
 */

router.get(
  "/",
  async (req, res) => {
    try {
      const result =
        await getExpenseClaims({
          organizationId:
            getOrganizationId(req),

          employeeId:
            optional(
              req.query.employeeId ||
                req.query.employee_id,
            ),

          status:
            optional(
              req.query.status,
            ),

          search:
            clean(
              req.query.search,
            ),

          fromDate:
            optional(
              req.query.fromDate ||
                req.query.from_date,
            ),

          toDate:
            optional(
              req.query.toDate ||
                req.query.to_date,
            ),

          page:
            parsePage(
              req.query.page,
            ),

          pageSize:
            parsePageSize(
              req.query.pageSize ||
                req.query.page_size,
            ),
        });

      return res.status(200).json({
        success: true,

        claims:
          result.claims,

        pagination:
          result.pagination,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense claims",
      );
    }
  },
);

/* =========================================================
   SUMMARY
========================================================= */

/*
 * GET /api/expense-claims/summary
 */

router.get(
  "/summary",
  async (req, res) => {
    try {
      const summary =
        await getExpenseSummary({
          organizationId:
            getOrganizationId(req),

          fromDate:
            optional(
              req.query.fromDate ||
                req.query.from_date,
            ),

          toDate:
            optional(
              req.query.toDate ||
                req.query.to_date,
            ),
        });

      return res.status(200).json({
        success: true,
        summary,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense summary",
      );
    }
  },
);

/* =========================================================
   STATISTICS
========================================================= */

/*
 * GET /api/expense-claims/statistics
 */

router.get(
  "/statistics",
  async (req, res) => {
    try {
      const statistics =
        await getExpenseStatistics({
          organizationId:
            getOrganizationId(req),
        });

      return res.status(200).json({
        success: true,
        statistics,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense statistics",
      );
    }
  },
);

/* =========================================================
   PAYROLL RECONCILIATION QUEUE
========================================================= */

/*
 * GET /api/expense-claims/reconciliation
 */

router.get(
  "/reconciliation",
  async (req, res) => {
    try {
      const claims =
        await getPayrollReconciliationQueue({
          organizationId:
            getOrganizationId(req),

          payrollRunId:
            optional(
              req.query.payrollRunId ||
                req.query.payroll_run_id,
            ),
        });

      return res.status(200).json({
        success: true,

        claims,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading payroll reconciliation queue",
      );
    }
  },
);

/* =========================================================
   EMPLOYEE SELF-SERVICE
========================================================= */

/*
 * GET /api/expense-claims/employee/:employeeId
 */

router.get(
  "/employee/:employeeId",
  async (req, res) => {
    try {
      const result =
        await getEmployeeExpenseClaims({
          organizationId:
            getOrganizationId(req),

          employeeId:
            req.params.employeeId,

          status:
            optional(
              req.query.status,
            ),

          page:
            parsePage(
              req.query.page,
            ),

          pageSize:
            parsePageSize(
              req.query.pageSize,
            ),
        });

      return res.status(200).json({
        success: true,

        claims:
          result.claims,

        pagination:
          result.pagination,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading employee expense claims",
      );
    }
  },
);

/* =========================================================
   CURRENT EMPLOYEE CLAIMS
========================================================= */

/*
 * GET /api/expense-claims/me
 */

router.get(
  "/me",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const result =
        await getEmployeeExpenseClaims({
          organizationId:
            getOrganizationId(req),

          employeeId:
            employee.id,

          status:
            optional(
              req.query.status,
            ),

          page:
            parsePage(
              req.query.page,
            ),

          pageSize:
            parsePageSize(
              req.query.pageSize,
            ),
        });

      return res.status(200).json({
        success: true,

        employee,

        claims:
          result.claims,

        pagination:
          result.pagination,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading current employee expense claims",
      );
    }
  },
);

/*
 * POST /api/expense-claims/me
 */

router.post(
  "/me",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const body =
        req.body || {};

      const claim =
        await createExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          employeeId:
            employee.id,

          title:
            body.title,

          description:
            body.description,

          claimDate:
            body.claimDate ||
            body.claim_date,

          currencyCode:
            body.currencyCode ||
            body.currency_code ||
            "INR",

          notes:
            body.notes,

          items:
            Array.isArray(
              body.items,
            )
              ? body.items
              : [],
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense claim created successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "creating current employee expense claim",
      );
    }
  },
);

/*
 * GET /api/expense-claims/me/:claimId
 */

router.get(
  "/me/:claimId",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const claim =
        await getExpenseClaim({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      if (
        claim.employee_id !==
        employee.id
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Expense claim not found.",
        });
      }

      return res.status(200).json({
        success: true,
        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading current employee expense claim",
      );
    }
  },
);

/*
 * POST /api/expense-claims/me/:claimId/submit
 */

router.post(
  "/me/:claimId/submit",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const existingClaim =
        await getExpenseClaim({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      if (
        existingClaim.employee_id !==
        employee.id
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Expense claim not found.",
        });
      }

      const claim =
        await submitExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim submitted successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "submitting current employee expense claim",
      );
    }
  },
);

/* =========================================================
   CREATE CLAIM
========================================================= */

/*
 * POST /api/expense-claims
 */

router.post(
  "/",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await createExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          employeeId:
            body.employeeId ||
            body.employee_id,

          title:
            body.title,

          description:
            body.description,

          claimDate:
            body.claimDate ||
            body.claim_date,

          currencyCode:
            body.currencyCode ||
            body.currency_code ||
            "INR",

          notes:
            body.notes,

          items:
            Array.isArray(
              body.items,
            )
              ? body.items
              : [],
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense claim created successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "creating expense claim",
      );
    }
  },
);

/* =========================================================
   SINGLE CLAIM
========================================================= */

/*
 * GET /api/expense-claims/:claimId
 */

router.get(
  "/:claimId",
  async (req, res) => {
    try {
      const claim =
        await getExpenseClaim({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,
        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense claim",
      );
    }
  },
);

/* =========================================================
   UPDATE CLAIM
========================================================= */

/*
 * PATCH /api/expense-claims/:claimId
 */

router.patch(
  "/:claimId",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await updateExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          title:
            body.title,

          description:
            body.description,

          claimDate:
            body.claimDate ||
            body.claim_date,

          currencyCode:
            body.currencyCode ||
            body.currency_code,

          notes:
            body.notes,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim updated successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "updating expense claim",
      );
    }
  },
);

/* =========================================================
   ADD CLAIM ITEM
========================================================= */

/*
 * POST /api/expense-claims/:claimId/items
 */

router.post(
  "/:claimId/items",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const item =
        await addExpenseClaimItem({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,

          categoryId:
            body.categoryId ||
            body.category_id,

          expenseDate:
            body.expenseDate ||
            body.expense_date,

          merchantName:
            body.merchantName ||
            body.merchant_name,

          description:
            body.description,

          amount:
            parseNumber(
              body.amount,
              0,
            ),

          currencyCode:
            body.currencyCode ||
            body.currency_code ||
            "INR",

          approvedAmount:
            body.approvedAmount ??
            body.approved_amount,

          receiptRequired:
            parseBoolean(
              body.receiptRequired ??
                body.receipt_required,
              false,
            ),

          receiptAttached:
            parseBoolean(
              body.receiptAttached ??
                body.receipt_attached,
              false,
            ),
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense item added successfully.",

        item,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "adding expense item",
      );
    }
  },
);

/* =========================================================
   UPDATE CLAIM ITEM
========================================================= */

/*
 * PATCH /api/expense-claims/items/:claimItemId
 */

router.patch(
  "/items/:claimItemId",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const item =
        await updateExpenseClaimItem({
          organizationId:
            getOrganizationId(req),

          claimItemId:
            req.params.claimItemId,

          categoryId:
            body.categoryId ??
            body.category_id,

          expenseDate:
            body.expenseDate ??
            body.expense_date,

          merchantName:
            body.merchantName ??
            body.merchant_name,

          description:
            body.description,

          amount:
            body.amount !==
            undefined
              ? parseNumber(
                  body.amount,
                  null,
                )
              : undefined,

          currencyCode:
            body.currencyCode ??
            body.currency_code,

          approvedAmount:
            body.approvedAmount ??
            body.approved_amount,

          receiptRequired:
            body.receiptRequired ??
            body.receipt_required,

          receiptAttached:
            body.receiptAttached ??
            body.receipt_attached,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense item updated successfully.",

        item,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "updating expense item",
      );
    }
  },
);

/* =========================================================
   DELETE CLAIM ITEM
========================================================= */

/*
 * DELETE /api/expense-claims/items/:claimItemId
 */

router.delete(
  "/items/:claimItemId",
  async (req, res) => {
    try {
      const result =
        await deleteExpenseClaimItem({
          organizationId:
            getOrganizationId(req),

          claimItemId:
            req.params.claimItemId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense item deleted successfully.",

        ...result,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "deleting expense item",
      );
    }
  },
);

/* =========================================================
   SUBMIT CLAIM
========================================================= */

/*
 * POST /api/expense-claims/:claimId/submit
 */

router.post(
  "/:claimId/submit",
  async (req, res) => {
    try {
      const claim =
        await submitExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim submitted successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "submitting expense claim",
      );
    }
  },
);

/* =========================================================
   MOVE TO UNDER REVIEW
========================================================= */

/*
 * POST /api/expense-claims/:claimId/review
 */

router.post(
  "/:claimId/review",
  async (req, res) => {
    try {
      const claim =
        await reviewExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim moved under review.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "moving expense claim under review",
      );
    }
  },
);

/* =========================================================
   APPROVE CLAIM
========================================================= */

/*
 * POST /api/expense-claims/:claimId/approve
 */

router.post(
  "/:claimId/approve",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await approveExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          approvedAmount:
            body.approvedAmount ??
            body.approved_amount ??
            null,

          comments:
            body.comments,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim approved successfully.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "approving expense claim",
      );
    }
  },
);

/* =========================================================
   REJECT CLAIM
========================================================= */

/*
 * POST /api/expense-claims/:claimId/reject
 */

router.post(
  "/:claimId/reject",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await rejectExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          reason:
            body.reason ||
            body.rejectionReason ||
            body.rejection_reason,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim rejected.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "rejecting expense claim",
      );
    }
  },
);

/* =========================================================
   MARK CLAIM PAID
========================================================= */

/*
 * POST /api/expense-claims/:claimId/pay
 */

router.post(
  "/:claimId/pay",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await markExpenseClaimPaid({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          paymentReference:
            body.paymentReference ||
            body.payment_reference,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim marked as paid.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "marking expense claim as paid",
      );
    }
  },
);

/* =========================================================
   PAYROLL RECONCILIATION
========================================================= */

/*
 * POST /api/expense-claims/:claimId/reconcile
 */

router.post(
  "/:claimId/reconcile",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const claim =
        await reconcileExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          payrollRunId:
            body.payrollRunId ||
            body.payroll_run_id,

          payrollRunItemId:
            body.payrollRunItemId ||
            body.payroll_run_item_id ||
            null,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim reconciled against payroll.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "reconciling expense claim",
      );
    }
  },
);

/* =========================================================
   RECEIPTS
========================================================= */

/*
 * GET /api/expense-claims/:claimId/receipts
 */

router.get(
  "/:claimId/receipts",
  async (req, res) => {
    try {
      const receipts =
        await getClaimReceipts({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        receipts,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense receipts",
      );
    }
  },
);

/*
 * POST /api/expense-claims/:claimId/receipts
 *
 * The actual file-storage upload can be connected
 * separately. This endpoint persists the receipt
 * metadata after a file has been stored.
 */

router.post(
  "/:claimId/receipts",
  async (req, res) => {
    try {
      const body =
        req.body || {};

      const receipt =
        await addExpenseReceipt({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,

          claimItemId:
            body.claimItemId ||
            body.claim_item_id ||
            null,

          fileName:
            body.fileName ||
            body.file_name,

          filePath:
            body.filePath ||
            body.file_path,

          fileType:
            body.fileType ||
            body.file_type ||
            null,

          fileSize:
            body.fileSize ||
            body.file_size ||
            null,
        });

      return res.status(201).json({
        success: true,

        message:
          "Expense receipt added successfully.",

        receipt,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "adding expense receipt",
      );
    }
  },
);

/*
 * DELETE /api/expense-claims/receipts/:receiptId
 */

router.delete(
  "/receipts/:receiptId",
  async (req, res) => {
    try {
      const result =
        await deleteExpenseReceipt({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          receiptId:
            req.params.receiptId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense receipt deleted successfully.",

        ...result,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "deleting expense receipt",
      );
    }
  },
);

/* =========================================================
   CLAIM EVENTS / AUDIT TRAIL
========================================================= */

/*
 * GET /api/expense-claims/:claimId/events
 */

router.get(
  "/:claimId/events",
  async (req, res) => {
    try {
      const events =
        await getClaimEvents({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        events,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "loading expense claim events",
      );
    }
  },
);

/* =========================================================
   CANCEL CLAIM
========================================================= */

/*
 * POST /api/expense-claims/:claimId/cancel
 */

router.post(
  "/:claimId/cancel",
  async (req, res) => {
    try {
      const claim =
        await cancelExpenseClaim({
          organizationId:
            getOrganizationId(req),

          userId:
            getUserId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Expense claim cancelled.",

        claim,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "cancelling expense claim",
      );
    }
  },
);

/* =========================================================
   DELETE DRAFT CLAIM
========================================================= */

/*
 * DELETE /api/expense-claims/:claimId
 */

router.delete(
  "/:claimId",
  async (req, res) => {
    try {
      const result =
        await deleteExpenseClaim({
          organizationId:
            getOrganizationId(req),

          claimId:
            req.params.claimId,
        });

      return res.status(200).json({
        success: true,

        message:
          "Draft expense claim deleted successfully.",

        ...result,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "deleting expense claim",
      );
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
