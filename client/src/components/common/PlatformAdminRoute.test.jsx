import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PlatformAdminRoute from "./PlatformAdminRoute";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN ROUTE GUARD
|--------------------------------------------------------------------------
|
| Same shape as RequireHRRole.test.jsx / RequireEmployeeRole.test.jsx,
| but proving the property that matters here: with no session, this
| guard redirects to /platform-admin/login — specifically NOT to the
| main app's /login — independent of context/AuthContext (mocked out
| entirely; only services/authService is used).
|--------------------------------------------------------------------------
*/

vi.mock("../../services/authService", () => ({
  authService: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}));

import { authService } from "../../services/authService";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/platform-admin/logs"]}>
      <Routes>
        <Route element={<PlatformAdminRoute />}>
          <Route path="/platform-admin/logs" element={<div>Platform Logs</div>} />
        </Route>
        <Route path="/platform-admin/login" element={<div>Platform Admin Login</div>} />
        <Route path="/login" element={<div>Main App Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PlatformAdminRoute", () => {
  it("redirects to /platform-admin/login (never /login) when there is no session", async () => {
    authService.getSession.mockResolvedValue(null);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("Platform Admin Login")).toBeInTheDocument();
    });

    expect(screen.queryByText("Platform Logs")).not.toBeInTheDocument();
    expect(screen.queryByText("Main App Login")).not.toBeInTheDocument();
  });

  it("renders the guarded route when a session exists", async () => {
    authService.getSession.mockResolvedValue({
      access_token: "fixture-token",
      user: { id: "u1", email: "admin@example.test" },
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByText("Platform Logs")).toBeInTheDocument();
    });

    expect(screen.queryByText("Platform Admin Login")).not.toBeInTheDocument();
  });
});
