import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import PayrollCostAnalytics from "./PayrollCostAnalytics";

/*
|--------------------------------------------------------------------------
| STALE-RESPONSE RACE REGRESSION TEST
|--------------------------------------------------------------------------
|
| This is the bug class that hit AttendanceLeaveTracker.jsx,
| TrainingComplianceTracker.jsx, InvestigationTracker.jsx and this
| page: a filter-driven load re-fires on every filter change, and
| with no guard, an earlier (slower) response can resolve AFTER a
| later (faster) one and silently overwrite the correct, newer data.
|
| Reproduces the exact technique used to verify the live fix: the
| FIRST filter-triggered request is delayed and returns a
| distinguishable ("STALE", employee_count 999) payload; a SECOND
| request fired immediately after resolves fast with a different
| ("FRESH", employee_count 42) payload. If loadRequestIdRef is
| working, the final render must show 42 - never 999, regardless of
| the 999 response arriving last.
|--------------------------------------------------------------------------
*/

vi.mock("../../services/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "../../services/api";

const FILTERS_RESPONSE = {
  data: {
    months: ["2026-02-01", "2026-01-01"],
    statuses: [],
    departments: [],
    locations: [],
    roles: [],
  },
};

function summaryResponse(employeeCount) {
  return {
    data: {
      summary: {
        total_cost: 100000,
        gross_pay: 90000,
        net_pay: 80000,
        employee_count: employeeCount,
        total_deductions: 10000,
        deduction_rate: 10,
        total_reimbursements: 0,
        reimbursement_rate: 0,
        employer_contributions: 0,
        employer_contribution_rate: 0,
        average_cost_per_employee: 1000,
      },
      breakdowns: { department: [], location: [], role: [] },
      employees: [],
    },
  };
}

function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

describe("PayrollCostAnalytics — stale-response race guard", () => {
  it("never lets a slow, earlier filter response overwrite a fast, later one", async () => {
    let analyticsCallCount = 0;

    api.get.mockImplementation((url) => {
      if (url === "/payroll-cost-analytics/filters") {
        return Promise.resolve(FILTERS_RESPONSE);
      }

      if (url.startsWith("/payroll-cost-analytics/trend")) {
        return Promise.resolve({ data: [] });
      }

      if (url.startsWith("/payroll-cost-analytics")) {
        analyticsCallCount += 1;
        const isFirstFilterCall = analyticsCallCount === 2; // #1 is the initial no-filter mount load

        if (isFirstFilterCall) {
          // The SLOW, EARLIER response — must never win.
          return delay(150, summaryResponse(999));
        }

        if (analyticsCallCount === 3) {
          // The FAST, LATER response — must win.
          return Promise.resolve(summaryResponse(42));
        }

        return Promise.resolve(summaryResponse(0));
      }

      return Promise.resolve({ data: {} });
    });

    render(
      <MemoryRouter>
        <PayrollCostAnalytics />
      </MemoryRouter>
    );

    // Wait for the initial (unfiltered) load to finish.
    await screen.findByText("Payroll Month");

    const monthSelect = screen.getByLabelText
      ? null
      : null; // FilterSelect has no aria-label; select by DOM position instead.

    const selects = document.querySelectorAll("select");
    const monthSelectEl = selects[0];

    // Fire the SLOW request (selecting the first month option).
    monthSelectEl.value = "2026-01-01";
    monthSelectEl.dispatchEvent(new Event("change", { bubbles: true }));

    // Immediately fire the FAST request (selecting the second month),
    // well before the slow one's 150ms delay elapses.
    await new Promise((r) => setTimeout(r, 20));
    monthSelectEl.value = "2026-02-01";
    monthSelectEl.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait long enough for BOTH requests to settle.
    await waitFor(
      () => {
        expect(analyticsCallCount).toBeGreaterThanOrEqual(3);
      },
      { timeout: 1000 }
    );

    await new Promise((r) => setTimeout(r, 250)); // let the slow one's late resolution land

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    // The stale value must never have been rendered.
    expect(screen.queryByText("999")).not.toBeInTheDocument();
  });
});
