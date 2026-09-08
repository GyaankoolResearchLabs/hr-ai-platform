import { describe, it, expect, beforeAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { as } from "../helpers/apiClient.mjs";

/*
|--------------------------------------------------------------------------
| OWNERSHIP ISOLATION — employee A must never reach employee B's data
|--------------------------------------------------------------------------
| Every employee/* (and employee-facing /me) route that accepts a
| resource id in the URL. Employee A, authenticated with their own real
| token, requests employee B's resource by id. Every one of these must
| return 404 — not 403 (which would leak "this exists, you're just not
| allowed"), not 200.
|--------------------------------------------------------------------------
*/

let ctx;

beforeAll(() => {
  ctx = loadFixtureContext();
});

describe("ownership isolation (employee A vs employee B's data)", () => {
  it.each([
    ["GET", "document", () => `/api/employee/documents/${ctx.resources.documentId}`],
    [
      "POST",
      "notification mark-read",
      () => `/api/employee/notifications/${ctx.resources.notificationId}/read`,
    ],
    [
      "GET",
      "learning assignment detail",
      () => `/api/employee/learning/${ctx.resources.learningAssignmentId}`,
    ],
    [
      "POST",
      "learning assignment progress",
      () => `/api/employee/learning/${ctx.resources.learningAssignmentId}/progress`,
      { progress_percentage: 50 },
    ],
    ["GET", "payslip detail", () => `/api/payslips/me/${ctx.resources.payslipId}`],
    [
      "GET",
      "expense claim detail",
      () => `/api/expense-claims/me/${ctx.resources.expenseClaimId}`,
    ],
    [
      "POST",
      "expense claim submit",
      () => `/api/expense-claims/me/${ctx.resources.expenseClaimId}/submit`,
    ],
    ["GET", "F&F settlement detail", () => `/api/employee/fnf/${ctx.resources.fnfId}`],
    [
      "POST",
      "performance goal progress",
      () => `/api/employee/performance/goals/${ctx.resources.goalId}/progress`,
      { progress: 50 },
    ],
    [
      "POST",
      "performance review acknowledge",
      () => `/api/employee/performance/reviews/${ctx.resources.reviewId}/acknowledge`,
    ],
  ])("%s %s -> 404 for a non-owning employee", async (method, _label, urlFn, body) => {
    const url = urlFn();
    const client = as(ctx.empA.token);

    const res =
      method === "GET" ? await client.get(url) : await client.post(url, body);

    expect(res.status).toBe(404);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(200);
  });

  /* -------------------------------------------------------
     CONTROL: the owning employee CAN reach their own resource
     — proves the 404s above are ownership checks, not the
     routes simply being broken.
  ------------------------------------------------------- */

  it("the owning employee can read their own document", async () => {
    const res = await as(ctx.empB.token).get(
      `/api/employee/documents/${ctx.resources.documentId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.document.id).toBe(ctx.resources.documentId);
  });

  it("the owning employee can read their own payslip", async () => {
    const res = await as(ctx.empB.token).get(
      `/api/payslips/me/${ctx.resources.payslipId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ctx.resources.payslipId);
  });

  it("employee A's own resource lists never contain employee B's rows", async () => {
    const [documents, learning, fnf] = await Promise.all([
      as(ctx.empA.token).get("/api/employee/documents"),
      as(ctx.empA.token).get("/api/employee/learning"),
      as(ctx.empA.token).get("/api/employee/fnf"),
    ]);

    expect(documents.body.documents.map((d) => d.id)).not.toContain(
      ctx.resources.documentId
    );
    expect(learning.body.assignments.map((a) => a.id)).not.toContain(
      ctx.resources.learningAssignmentId
    );
    expect(fnf.body.settlements.map((s) => s.id)).not.toContain(ctx.resources.fnfId);
  });
});
