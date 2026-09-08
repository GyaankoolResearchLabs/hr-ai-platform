import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getSettlement } from "../services/fnfSettlementService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE FULL & FINAL SETTLEMENT
|--------------------------------------------------------------------------
|
| GET /api/employee/fnf
| GET /api/employee/fnf/:id
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| Nothing here duplicates HR's F&F logic: the calculation engine, item
| breakdown, and status workflow (draft -> calculated -> under_review
| -> approved -> processed, or cancelled) all live in
| services/fnfSettlementService.js and routes/fnfSettlements.js — this
| route only reads fnf_settlements directly for the list (the same
| pattern routes/employeeMyDocuments.js and routes/employeeNotifications.js
| use) and reuses getSettlement() unchanged for the detail view.
|
| VISIBILITY: mirrors routes/payslips.js's "/me" published-only pattern.
| A settlement is only ever employee-visible once HR has finalized it —
| "approved" or "processed" — never while "draft", "calculated", or
| "under_review" (still being worked on/reviewed internally) and never
| "cancelled" (was never finalized).
|--------------------------------------------------------------------------
*/

const VISIBLE_STATUSES = ["approved", "processed"];

function handleRouteError(res, error, fallbackMessage) {
  console.error("[EmployeeFnf]", error);

  const message = error?.message || fallbackMessage;
  const lower = String(message).toLowerCase();

  if (lower.includes("not found")) {
    return res.status(404).json({ message });
  }

  return res.status(error?.statusCode || error?.status || 500).json({
    message,
  });
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/fnf
|--------------------------------------------------------------------------
*/

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;

    const { data, error } = await supabaseAdmin
      .from("fnf_settlements")
      .select(
        "id, settlement_number, settlement_status, resignation_date, last_working_date, settlement_date, currency_code, total_earnings, total_deductions, final_settlement_amount, approved_at, processed_at, created_at"
      )
      .eq("organization_id", employee.organization_id)
      .eq("employee_id", employee.id)
      .in("settlement_status", VISIBLE_STATUSES)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return res.json({ settlements: data || [] });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load your final settlement."
    );
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/fnf/:id
|--------------------------------------------------------------------------
*/

router.get("/:id", async (req, res) => {
  try {
    const employee = req.employee;

    const { data: row, error: lookupError } = await supabaseAdmin
      .from("fnf_settlements")
      .select("id, employee_id, settlement_status")
      .eq("organization_id", employee.organization_id)
      .eq("id", req.params.id)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (
      !row ||
      row.employee_id !== employee.id ||
      !VISIBLE_STATUSES.includes(row.settlement_status)
    ) {
      return res.status(404).json({
        message: "Settlement not found.",
      });
    }

    const settlement = await getSettlement(
      employee.organization_id,
      row.id
    );

    return res.json({ settlement });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "Could not load settlement detail."
    );
  }
});

export default router;
