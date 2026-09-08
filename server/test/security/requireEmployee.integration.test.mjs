import { describe, it, expect, beforeAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { api, as } from "../helpers/apiClient.mjs";

/*
|--------------------------------------------------------------------------
| requireEmployee — INTEGRATION (real JWTs, real HTTP)
|--------------------------------------------------------------------------
| Complements the mocked unit tests: these hit a real employee route
| (GET /api/employee/profile) with real Supabase-issued tokens, proving
| the whole chain — JWT verification, organization membership lookup,
| and employee resolution — actually works end to end, not just that
| the middleware's own logic is internally consistent.
|--------------------------------------------------------------------------
*/

let ctx;

beforeAll(() => {
  ctx = loadFixtureContext();
});

describe("requireEmployee (integration)", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await api().get("/api/employee/profile");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage/invalid bearer token", async () => {
    const res = await as("not-a-real-jwt-at-all").get("/api/employee/profile");
    expect(res.status).toBe(401);
  });

  it("rejects a real, validly-signed session for a user with no linked employee record", async () => {
    const res = await as(ctx.orphan.token).get("/api/employee/profile");
    expect(res.status).toBe(403);
  });

  it("resolves a real employee from a valid JWT and returns their own profile", async () => {
    const res = await as(ctx.empA.token).get("/api/employee/profile");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ctx.empA.employeeId);
    expect(res.body.email).toBe(ctx.empA.email);
  });
});
