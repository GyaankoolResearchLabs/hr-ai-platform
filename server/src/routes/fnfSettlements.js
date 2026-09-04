import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

import {
  getEmployeeForSettlement,
  getEligibleEmployees,
  createSettlement,
  recalculateSettlement,
  getSettlement,
  listSettlements,
  submitSettlementForReview,
  approveSettlement,
  processSettlement,
  cancelSettlement,
  deleteDraftSettlement,
  getSettlementEvents,
  getSettlementItems,
  getSettlementSummary,
  previewSettlement,
  validateSettlement,
} from "../services/fnfSettlementService.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization =
      await getOrganizationForUser(req.user.id);

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[F&F] Organization lookup error:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPERS
========================================================= */

function getUserId(req) {
  return (
    req.user?.id ||
    req.user?.user_id ||
    null
  );
}

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    null
  );
}

function sendError(
  res,
  error,
  fallbackMessage,
) {
  console.error(
    "[F&F] Request failed:",
    error,
  );

  const message =
    error?.message ||
    fallbackMessage;

  const lower =
    String(message).toLowerCase();

  if (
    lower.includes("not found")
  ) {
    return res.status(404).json({
      message,
    });
  }

  if (
    lower.includes("required") ||
    lower.includes("invalid") ||
    lower.includes("cannot") ||
    lower.includes("only ")
  ) {
    return res.status(400).json({
      message,
    });
  }

  return res.status(500).json({
    message,
  });
}

/* =========================================================
   EMPLOYEES
========================================================= */

router.get(
  "/employees",
  async (req, res) => {
    try {
      const employees =
        await getEligibleEmployees(
          getOrganizationId(req),
        );

      return res.json({
        employees,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load employees",
      );
    }
  },
);

router.get(
  "/employees/:employeeId",
  async (req, res) => {
    try {
      const employee =
        await getEmployeeForSettlement(
          getOrganizationId(req),
          req.params.employeeId,
        );

      return res.json({
        employee,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load employee",
      );
    }
  },
);

/* =========================================================
   SUMMARY
========================================================= */

router.get(
  "/summary",
  async (req, res) => {
    try {
      const summary =
        await getSettlementSummary(
          getOrganizationId(req),
        );

      return res.json({
        summary,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load settlement summary",
      );
    }
  },
);

/* =========================================================
   LIST SETTLEMENTS
========================================================= */

router.get(
  "/",
  async (req, res) => {
    try {
      const settlements =
        await listSettlements(
          getOrganizationId(req),
          {
            status:
              req.query.status ||
              null,

            employeeId:
              req.query.employeeId ||
              req.query.employee_id ||
              null,

            fromDate:
              req.query.fromDate ||
              req.query.from_date ||
              null,

            toDate:
              req.query.toDate ||
              req.query.to_date ||
              null,
          },
        );

      return res.json({
        settlements,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load settlements",
      );
    }
  },
);

/* =========================================================
   PREVIEW
========================================================= */

router.post(
  "/preview",
  async (req, res) => {
    try {
      const employeeId =
        req.body?.employeeId ||
        req.body?.employee_id;

      if (!employeeId) {
        return res.status(400).json({
          message: "Employee is required",
        });
      }

      const preview =
        await previewSettlement(
          getOrganizationId(req),
          employeeId,
          req.body || {},
        );

      return res.json({
        preview,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not calculate settlement preview",
      );
    }
  },
);

/* =========================================================
   CREATE
========================================================= */

router.post(
  "/",
  async (req, res) => {
    try {
      const settlement =
        await createSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.body || {},
        );

      return res.status(201).json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not create settlement",
      );
    }
  },
);

/* =========================================================
   SINGLE SETTLEMENT
========================================================= */

router.get(
  "/:settlementId",
  async (req, res) => {
    try {
      const settlement =
        await getSettlement(
          getOrganizationId(req),
          req.params.settlementId,
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load settlement",
      );
    }
  },
);

/* =========================================================
   ITEMS
========================================================= */

router.get(
  "/:settlementId/items",
  async (req, res) => {
    try {
      const items =
        await getSettlementItems(
          getOrganizationId(req),
          req.params.settlementId,
        );

      return res.json({
        items,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load settlement items",
      );
    }
  },
);

/* =========================================================
   EVENTS
========================================================= */

router.get(
  "/:settlementId/events",
  async (req, res) => {
    try {
      const events =
        await getSettlementEvents(
          getOrganizationId(req),
          req.params.settlementId,
        );

      return res.json({
        events,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not load settlement events",
      );
    }
  },
);

/* =========================================================
   VALIDATE
========================================================= */

router.get(
  "/:settlementId/validate",
  async (req, res) => {
    try {
      const validation =
        await validateSettlement(
          getOrganizationId(req),
          req.params.settlementId,
        );

      return res.json({
        validation,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not validate settlement",
      );
    }
  },
);

/* =========================================================
   RECALCULATE
========================================================= */

router.post(
  "/:settlementId/recalculate",
  async (req, res) => {
    try {
      const settlement =
        await recalculateSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
          req.body || {},
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not recalculate settlement",
      );
    }
  },
);

/* =========================================================
   SUBMIT FOR REVIEW
========================================================= */

router.post(
  "/:settlementId/submit",
  async (req, res) => {
    try {
      const settlement =
        await submitSettlementForReview(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not submit settlement for review",
      );
    }
  },
);

/* =========================================================
   APPROVE
========================================================= */

router.post(
  "/:settlementId/approve",
  async (req, res) => {
    try {
      const settlement =
        await approveSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
          req.body?.notes ||
            null,
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not approve settlement",
      );
    }
  },
);

/* =========================================================
   PROCESS PAYMENT
========================================================= */

router.post(
  "/:settlementId/process",
  async (req, res) => {
    try {
      const paymentReference =
        req.body?.paymentReference ||
        req.body?.payment_reference ||
        null;

      const settlement =
        await processSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
          paymentReference,
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not process settlement",
      );
    }
  },
);

/* =========================================================
   CANCEL
========================================================= */

router.post(
  "/:settlementId/cancel",
  async (req, res) => {
    try {
      const reason =
        req.body?.reason ||
        req.body?.cancellationReason ||
        req.body?.cancellation_reason ||
        null;

      const settlement =
        await cancelSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
          reason,
        );

      return res.json({
        settlement,
      });
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not cancel settlement",
      );
    }
  },
);

/* =========================================================
   DELETE DRAFT
========================================================= */

router.delete(
  "/:settlementId",
  async (req, res) => {
    try {
      const result =
        await deleteDraftSettlement(
          getOrganizationId(req),
          getUserId(req),
          req.params.settlementId,
        );

      return res.json(
        result,
      );
    } catch (error) {
      return sendError(
        res,
        error,
        "Could not delete settlement",
      );
    }
  },
);

export default router;