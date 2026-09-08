import { describe, it, expect, vi, beforeEach } from "vitest";

/*
|--------------------------------------------------------------------------
| resolveEmployee MIDDLEWARE — UNIT TESTS
|--------------------------------------------------------------------------
| Pure control-flow tests: resolveEmployeeForUser() (the actual DB call)
| is mocked so these run instantly and deterministically, independent of
| the integration suite. What's being verified is the middleware's own
| logic — what it does with req.user, and how it reacts to each outcome
| of the resolver — not the DB query itself (that's covered by the
| integration suite's real 403 "not linked" case).
|--------------------------------------------------------------------------
*/

vi.mock("../../src/services/employeeIdentityService.js", () => ({
  resolveEmployeeForUser: vi.fn(),
}));

const { resolveEmployeeForUser } = await import(
  "../../src/services/employeeIdentityService.js"
);
const { resolveEmployee } = await import("../../src/middleware/resolveEmployee.js");

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  resolveEmployeeForUser.mockReset();
});

describe("resolveEmployee middleware", () => {
  it("401s when there is no authenticated user id", async () => {
    const req = { user: { organization_id: "org-1" } };
    const res = mockRes();
    const next = vi.fn();

    await resolveEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(resolveEmployeeForUser).not.toHaveBeenCalled();
  });

  it("400s when there is no organization context", async () => {
    const req = { user: { id: "user-1" } };
    const res = mockRes();
    const next = vi.fn();

    await resolveEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("resolves req.employee/req.employeeId from the JWT-derived user/org, never from req.body", async () => {
    const employee = { id: "employee-1", organization_id: "org-1" };
    resolveEmployeeForUser.mockResolvedValue(employee);

    const req = {
      user: { id: "user-1", organization_id: "org-1", email: "a@example.test" },
      // A malicious/irrelevant client-supplied employee id — must be
      // ignored entirely.
      body: { employee_id: "someone-elses-employee-id" },
    };
    const res = mockRes();
    const next = vi.fn();

    await resolveEmployee(req, res, next);

    expect(resolveEmployeeForUser).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "user-1",
      email: "a@example.test",
    });
    expect(req.employee).toEqual(employee);
    expect(req.employeeId).toBe("employee-1");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403s when the user has no linked employee record", async () => {
    resolveEmployeeForUser.mockResolvedValue(null);

    const req = { user: { id: "user-1", organization_id: "org-1" } };
    const res = mockRes();
    const next = vi.fn();

    await resolveEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("propagates the resolver's error status instead of always 500ing", async () => {
    const error = new Error("boom");
    error.status = 418;
    resolveEmployeeForUser.mockRejectedValue(error);

    const req = { user: { id: "user-1", organization_id: "org-1" } };
    const res = mockRes();
    const next = vi.fn();

    await resolveEmployee(req, res, next);

    expect(res.status).toHaveBeenCalledWith(418);
    expect(next).not.toHaveBeenCalled();
  });
});
