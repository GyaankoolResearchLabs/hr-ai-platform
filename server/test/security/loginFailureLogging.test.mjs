import { describe, it, expect, beforeAll } from "vitest";
import { loadFixtureContext } from "../helpers/loadContext.mjs";
import { api } from "../helpers/apiClient.mjs";
import { supabaseAdmin } from "../helpers/supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| LOGIN FAILURE CAPTURE
|--------------------------------------------------------------------------
| The real capture path is POST /api/client-error-report with
| eventType: "login_failure" — this is what
| client/src/services/authService.js's signIn() calls when Supabase's
| signInWithPassword() fails, since the frontend's real login flow
| authenticates directly against Supabase and never calls
| POST /api/auth/login (see the comment at the top of routes/auth.js).
| That route's own login-failure logging was dead code (never reached
| by real traffic) and has been removed — the second describe block
| below proves it, so that route continuing to work does not silently
| resurrect a second, inconsistent logging path.
|--------------------------------------------------------------------------
*/

let ctx;

beforeAll(() => {
  ctx = loadFixtureContext();
});

async function findLatestLoginFailureFor(email, sinceIso) {
  // Poll briefly — the log write is fire-and-forget, so it can land a
  // moment after the HTTP response.
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

describe("POST /api/client-error-report — the real login-failure capture path", () => {
  it("writes a login_failure row with the attempted email, a reason, and no password — via the same logPlatformError() path as every other capture point", async () => {
    const since = new Date(Date.now() - 5000).toISOString();
    const attemptedEmail = ctx.hr.email;

    const res = await api().post("/api/client-error-report").send({
      eventType: "login_failure",
      message: "Invalid login credentials",
      route: "/login",
      userEmail: attemptedEmail,
      // A real caller (authService.js) never sends anything password-shaped
      // here — this suite doesn't either, on purpose.
    });

    // Fire-and-forget beacon: 204 regardless of what happened server-side.
    expect(res.status).toBe(204);

    const logRow = await findLatestLoginFailureFor(attemptedEmail, since);

    expect(logRow).not.toBeNull();
    expect(logRow.event_type).toBe("login_failure");
    expect(logRow.user_email).toBe(attemptedEmail);
    expect(logRow.route).toBe("/login");
    expect(logRow.message).toBe("Invalid login credentials");
    expect(JSON.stringify(logRow)).not.toMatch(/password/i);

    await supabaseAdmin.from("platform_error_logs").delete().eq("id", logRow.id);
  });

  it("falls back to event_type 'client_error' for an unrecognized/missing eventType — the allow-list, not the caller, decides the taxonomy", async () => {
    const since = new Date(Date.now() - 5000).toISOString();

    const res = await api().post("/api/client-error-report").send({
      eventType: "some_made_up_type_a_caller_should_not_be_able_to_set",
      message: "Taxonomy allow-list regression check.",
    });

    expect(res.status).toBe(204);

    let logRow = null;
    for (let attempt = 0; attempt < 10 && !logRow; attempt++) {
      const { data } = await supabaseAdmin
        .from("platform_error_logs")
        .select("*")
        .eq("event_type", "client_error")
        .eq("message", "Taxonomy allow-list regression check.")
        .gte("created_at", since)
        .limit(1);

      logRow = data?.[0] || null;

      if (!logRow) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    expect(logRow).not.toBeNull();

    await supabaseAdmin.from("platform_error_logs").delete().eq("id", logRow.id);
  });
});

describe("POST /api/auth/login — wrong password", () => {
  it("still returns only a generic invalid-credentials-shaped message (route behavior is otherwise untouched)", async () => {
    const res = await api().post("/api/auth/login").send({
      email: ctx.hr.email,
      password: "definitely-the-wrong-password-123!",
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(typeof res.body.message).toBe("string");
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("definitely-the-wrong-password-123!");
  });

  it("no longer writes anything to platform_error_logs — this route's own capture point was dead code and has been removed", async () => {
    const since = new Date(Date.now() - 5000).toISOString();

    await api().post("/api/auth/login").send({
      email: ctx.hr.email,
      password: "yet-another-wrong-password-789!",
    });

    // Give a would-be fire-and-forget write a moment to land, then
    // confirm nothing did.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { data } = await supabaseAdmin
      .from("platform_error_logs")
      .select("id")
      .eq("event_type", "login_failure")
      .ilike("user_email", ctx.hr.email)
      .gte("created_at", since);

    expect(data || []).toHaveLength(0);
  });
});
