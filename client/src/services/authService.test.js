import { describe, expect, it, vi, beforeEach } from "vitest";

/*
|--------------------------------------------------------------------------
| authService.signIn() — login-failure reporting
|--------------------------------------------------------------------------
|
| The real login-failure capture point (see the note at the top of
| server/src/routes/auth.js for why it isn't POST /api/auth/login):
| when supabase.auth.signInWithPassword() fails, signIn() must report it
| via clientErrorReportService with eventType "login_failure" and the
| attempted email — and never with the password anywhere in that call —
| before rethrowing. A successful sign-in must never report anything.
|--------------------------------------------------------------------------
*/

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
    },
  },
}));

vi.mock("./clientErrorReportService", () => ({
  reportClientError: vi.fn(),
}));

const { supabase } = await import("../lib/supabaseClient");
const { reportClientError } = await import("./clientErrorReportService");
const { authService } = await import("./authService");

beforeEach(() => {
  supabase.auth.signInWithPassword.mockReset();
  reportClientError.mockReset();
});

describe("authService.signIn — failure reporting", () => {
  it("reports a login_failure with the attempted email and never the password when Supabase rejects the credentials", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: "Invalid login credentials" },
    });

    await expect(
      authService.signIn({
        email: "someone@example.test",
        password: "correct-horse-battery-staple",
      })
    ).rejects.toThrow("Invalid login credentials");

    expect(reportClientError).toHaveBeenCalledTimes(1);

    const call = reportClientError.mock.calls[0][0];

    expect(call.eventType).toBe("login_failure");
    expect(call.user).toEqual({ email: "someone@example.test" });
    expect(call.error.message).toBe("Invalid login credentials");
    expect(JSON.stringify(call)).not.toContain("correct-horse-battery-staple");
  });

  it("does not report anything on a successful sign-in", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { access_token: "t", user: { id: "u1" } },
        user: { id: "u1", email: "someone@example.test" },
      },
      error: null,
    });

    const result = await authService.signIn({
      email: "someone@example.test",
      password: "correct-horse-battery-staple",
    });

    expect(result.session.access_token).toBe("t");
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it("does not report a client-side validation error (empty password) — never entered the Supabase call at all", async () => {
    await expect(
      authService.signIn({ email: "someone@example.test", password: "" })
    ).rejects.toThrow("Password is required.");

    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
