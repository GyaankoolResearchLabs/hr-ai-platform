import { describe, it, expect, beforeAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { api } from "../helpers/apiClient.mjs";
import { supabaseAdmin } from "../helpers/supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| LOGIN FAILURE CAPTURE
|--------------------------------------------------------------------------
| A real failed POST /api/auth/login must:
|   1. Still return only a generic "invalid credentials"-shaped message
|      to the client (never leak Supabase internals).
|   2. Be captured server-side in platform_error_logs with the attempted
|      email + timestamp + reason — never the password.
|--------------------------------------------------------------------------
*/

let ctx;

beforeAll(() => {
  ctx = loadFixtureContext();
});

async function findLatestLoginFailureFor(email, sinceIso) {
  // Poll briefly — the log write is fire-and-forget (never blocks the
  // login response), so it can land a moment after the HTTP response.
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabaseAdmin
      .from("platform_error_logs")
      .select("*")
      .eq("event_type", "login_failure")
      .ilike("user_email", email)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0];
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

describe("POST /api/auth/login — wrong password", () => {
  it("returns a generic invalid-credentials message and never the raw Supabase error shape", async () => {
    const since = new Date(Date.now() - 5000).toISOString();

    const res = await api().post("/api/auth/login").send({
      email: ctx.hr.email,
      password: "definitely-the-wrong-password-123!",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(typeof res.body.message).toBe("string");
    // The response body must never carry a stack, and never echo the
    // password back in any form.
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("definitely-the-wrong-password-123!");

    // This attempt is also captured — clean up the row this test's own
    // login attempt created, same as the capture test below.
    const logRow = await findLatestLoginFailureFor(ctx.hr.email, since);
    if (logRow) {
      await supabaseAdmin.from("platform_error_logs").delete().eq("id", logRow.id);
    }
  });

  it("is captured in platform_error_logs with the attempted email, a reason, and no password", async () => {
    const since = new Date(Date.now() - 5000).toISOString();

    await api().post("/api/auth/login").send({
      email: ctx.hr.email,
      password: "another-wrong-password-456!",
    });

    const logRow = await findLatestLoginFailureFor(ctx.hr.email, since);

    expect(logRow).not.toBeNull();
    expect(logRow.user_email).toBe(ctx.hr.email);
    expect(logRow.route).toBe("/api/auth/login");
    expect(typeof logRow.message).toBe("string");
    expect(logRow.message.length).toBeGreaterThan(0);
    expect(JSON.stringify(logRow)).not.toContain("another-wrong-password-456!");

    // Cleanup — this suite's own noise shouldn't linger in the table.
    await supabaseAdmin.from("platform_error_logs").delete().eq("id", logRow.id);
  });
});
