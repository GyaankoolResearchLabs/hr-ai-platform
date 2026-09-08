import { describe, it, expect, beforeAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { as } from "../helpers/apiClient.mjs";

/*
|--------------------------------------------------------------------------
| ROLE GATING — attendanceLeave.js's 4 previously-unprotected HR writes
|--------------------------------------------------------------------------
| Each of these must reject an employee-role caller with 403 (even when
| acting on their own employee_id — the point isn't ownership here, it's
| that an employee should never be able to write to these HR-only
| endpoints at all) while an HR/owner caller still succeeds normally.
|--------------------------------------------------------------------------
*/

let ctx;

beforeAll(() => {
  ctx = loadFixtureContext();
});

describe("attendanceLeave.js HR-only writes: employee-role callers are rejected", () => {
  it("POST /attendance -> 403 for an employee-role caller", async () => {
    const res = await as(ctx.empA.token).post("/api/attendance-leave/attendance", {
      employee_id: ctx.empA.employeeId,
      attendance_date: "2020-06-15",
      status: "Present",
    });

    expect(res.status).toBe(403);
  });

  it("POST /balances -> 403 for an employee-role caller", async () => {
    const res = await as(ctx.empA.token).post("/api/attendance-leave/balances", {
      employee_id: ctx.empA.employeeId,
      leave_type: "Role Gating Test Leave",
      allocated: 5,
    });

    expect(res.status).toBe(403);
  });

  it("POST /requests -> 403 for an employee-role caller", async () => {
    const res = await as(ctx.empA.token).post("/api/attendance-leave/requests", {
      employee_id: ctx.empA.employeeId,
      leave_type: "Annual Leave",
      start_date: "2098-02-01",
      end_date: "2098-02-01",
      reason: "Role gating test — should be rejected.",
    });

    expect(res.status).toBe(403);
  });

  it("PUT /requests/:id -> 403 for an employee-role caller", async () => {
    const res = await as(ctx.empA.token).put(
      `/api/attendance-leave/requests/${ctx.resources.pendingLeaveRequestId}`,
      { status: "Approved" }
    );

    expect(res.status).toBe(403);
  });
});

describe("attendanceLeave.js HR-only writes: HR/owner callers still succeed", () => {
  it("POST /attendance succeeds for HR", async () => {
    const res = await as(ctx.hr.token).post("/api/attendance-leave/attendance", {
      employee_id: ctx.empA.employeeId,
      attendance_date: "2020-06-15",
      status: "Present",
    });

    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(ctx.empA.employeeId);
    expect(res.body.status).toBe("Present");
  });

  it("POST /balances succeeds for HR", async () => {
    const res = await as(ctx.hr.token).post("/api/attendance-leave/balances", {
      employee_id: ctx.empA.employeeId,
      leave_type: "Role Gating Test Leave",
      allocated: 5,
    });

    expect(res.status).toBe(200);
    expect(res.body.employee_id).toBe(ctx.empA.employeeId);
  });

  it("POST /requests succeeds for HR", async () => {
    const res = await as(ctx.hr.token).post("/api/attendance-leave/requests", {
      employee_id: ctx.empA.employeeId,
      leave_type: "Annual Leave",
      start_date: "2098-03-01",
      end_date: "2098-03-01",
      reason: "Role gating test — HR-created.",
    });

    expect(res.status).toBe(201);
    expect(res.body.employee_id).toBe(ctx.empA.employeeId);
  });

  it("PUT /requests/:id succeeds for HR", async () => {
    const res = await as(ctx.hr.token).put(
      `/api/attendance-leave/requests/${ctx.resources.pendingLeaveRequestId}`,
      { status: "Approved" }
    );

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Approved");
  });
});
