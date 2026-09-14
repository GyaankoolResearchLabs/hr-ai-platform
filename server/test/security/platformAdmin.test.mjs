import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { as, api } from "../helpers/apiClient.mjs";
import { mintSession, supabaseAdmin } from "../helpers/supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN ACCESS CONTROL
|--------------------------------------------------------------------------
| /api/platform-admin/* must be reachable ONLY by an email in
| platform_admins — completely independent of organization_role. This is
| the security-critical property of the whole monitoring system, so it
| gets its own dedicated suite (real HTTP, real Supabase, no mocking —
| same convention as every other file in test/security/).
|--------------------------------------------------------------------------
*/

let ctx;
let adminToken;

const SEEDED_ADMIN_EMAIL = "shettysusheen@gmail.com";

beforeAll(async () => {
  ctx = loadFixtureContext();

  // Real, Supabase-verified session for the seeded platform admin
  // (docs/migrations/003_platform_admin.sql) — not a synthetic token.
  const session = await mintSession(SEEDED_ADMIN_EMAIL);
  adminToken = session.access_token;
});

describe("GET /api/platform-admin/logs — access control", () => {
  it("404s with no Authorization header at all is not expected — this route still requires a real token like every other route (401)", async () => {
    const res = await api().get("/api/platform-admin/logs");
    expect(res.status).toBe(401);
  });

  it("404s for an HR/owner account that is not in platform_admins", async () => {
    const res = await as(ctx.hr.token).get("/api/platform-admin/logs");
    expect(res.status).toBe(404);
    // Same shape as the app's real "route not found" 404 — no hint that
    // this is actually a permission rejection.
    expect(res.body.message).toBe("API route not found");
  });

  it("404s for an employee-role account that is not in platform_admins", async () => {
    const res = await as(ctx.empA.token).get("/api/platform-admin/logs");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("API route not found");
  });

  it("200s for the seeded platform admin and returns real captured data", async () => {
    const res = await as(adminToken).get("/api/platform-admin/logs");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  it("filters endpoint also 404s for a non-admin and 200s for the admin", async () => {
    const rejected = await as(ctx.hr.token).get("/api/platform-admin/logs/filters");
    expect(rejected.status).toBe(404);

    const allowed = await as(adminToken).get("/api/platform-admin/logs/filters");
    expect(allowed.status).toBe(200);
    expect(allowed.body.success).toBe(true);
  });
});

describe("GET /api/platform-admin/logs/:id — detail view", () => {
  let logId;

  beforeAll(async () => {
    // Seed one row directly so this describe block doesn't depend on
    // capture-point tests having already run.
    const { data } = await supabaseAdmin
      .from("platform_error_logs")
      .insert({
        event_type: "unhandled_exception",
        route: "/api/test-fixture-route",
        method: "GET",
        message: "Fixture log for detail-view test.",
        stack: "Error: fixture\n    at test",
      })
      .select("id")
      .single();

    logId = data.id;
  });

  afterAll(async () => {
    if (logId) {
      await supabaseAdmin.from("platform_error_logs").delete().eq("id", logId);
    }
  });

  it("404s for a non-admin", async () => {
    const res = await as(ctx.hr.token).get(`/api/platform-admin/logs/${logId}`);
    expect(res.status).toBe(404);
  });

  it("returns full detail, including the stack trace, for the platform admin", async () => {
    const res = await as(adminToken).get(`/api/platform-admin/logs/${logId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(logId);
    expect(res.body.data.stack).toContain("fixture");
  });
});
