import { describe, it, expect } from "vitest";
import { errorHandler } from "../../src/middleware/errorHandler.js";
import { supabaseAdmin } from "../helpers/supabaseClients.mjs";

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER — real unhandled-exception capture
|--------------------------------------------------------------------------
| Invokes the actual production errorHandler middleware (not a mock, not
| a copy) with a synthetic error carrying a marker string, against the
| real platform_error_logs table (same DB as the rest of the suite) —
| exercising the real capture path end to end without needing to make a
| business route actually crash to trigger it.
|
| Verifies both halves of the contract in the same pass:
|   1. The CLIENT response never contains the raw error message or stack.
|   2. The SERVER-SIDE log row contains the full message and stack trace.
|--------------------------------------------------------------------------
*/

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

async function findLogByMarker(marker) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data } = await supabaseAdmin
      .from("platform_error_logs")
      .select("*")
      .eq("event_type", "unhandled_exception")
      .ilike("message", `%${marker}%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      return data[0];
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

describe("errorHandler — generic/unexpected error branch", () => {
  it("returns only the fixed generic message to the client, and logs full detail server-side", async () => {
    const marker = `TEST-MARKER-${Date.now()}`;
    const sensitiveDetail = `Connection to internal-db-host failed [${marker}]`;

    const error = new Error(sensitiveDetail);
    // Give it a real stack.

    const req = {
      originalUrl: "/api/test-fixture-route",
      method: "GET",
      user: { id: "00000000-0000-4000-8000-000000000000", email: "fixture@example.test" },
      headers: {},
      ip: "127.0.0.1",
      get: () => "vitest-fixture-agent",
    };

    const res = mockRes();

    errorHandler(error, req, res, () => {});

    // The HTTP response is synchronous and must never leak the raw error.
    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(res.body)).not.toContain(marker);
    expect(res.body.stack).toBeUndefined();

    // The log write is fire-and-forget — poll for it to land, then
    // verify the FULL detail made it server-side.
    const logRow = await findLogByMarker(marker);

    expect(logRow).not.toBeNull();
    expect(logRow.message).toContain(marker);
    expect(logRow.stack).toBeTruthy();
    expect(logRow.stack).toContain("Error");
    expect(logRow.route).toBe("/api/test-fixture-route");
    expect(logRow.user_email).toBe("fixture@example.test");

    await supabaseAdmin.from("platform_error_logs").delete().eq("id", logRow.id);
  });

  it("still returns the specific, safe CORS message unchanged (not the generic branch)", () => {
    const error = new Error("CORS blocked origin: https://evil.example.test");
    const req = { headers: {}, get: () => null };
    const res = mockRes();

    errorHandler(error, req, res, () => {});

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe(error.message);
  });
});
