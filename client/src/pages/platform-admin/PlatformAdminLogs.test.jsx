import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PlatformAdminLogs from "./PlatformAdminLogs";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN LOGS
|--------------------------------------------------------------------------
|
| Two properties matter here: a 404 from the API (a logged-in session
| that isn't in platform_admins) renders a plain "not found" state —
| never a crash, never a misleading "access denied" — and signing out
| calls the real authService.signOut() and lands back on
| /platform-admin/login (never the main app's /login).
|--------------------------------------------------------------------------
*/

vi.mock("../../services/platformAdminService", () => ({
  platformAdminService: {
    getLogs: vi.fn(),
    getLog: vi.fn(),
    getFilters: vi.fn(),
  },
}));

vi.mock("../../services/authService", () => ({
  authService: {
    signOut: vi.fn(),
  },
}));

import { platformAdminService } from "../../services/platformAdminService";
import { authService } from "../../services/authService";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/platform-admin/logs"]}>
      <Routes>
        <Route path="/platform-admin/logs" element={<PlatformAdminLogs />} />
        <Route path="/platform-admin/login" element={<div>Platform Admin Login</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PlatformAdminLogs", () => {
  it("renders real captured data on a successful load", async () => {
    platformAdminService.getLogs.mockResolvedValue({
      success: true,
      data: [
        {
          id: "log-1",
          created_at: "2026-01-01T00:00:00Z",
          event_type: "login_failure",
          route: "/api/auth/login",
          user_email: "someone@example.test",
          message: "Invalid login credentials",
        },
      ],
      pagination: { page: 1, limit: 25, total: 1, total_pages: 1, has_next_page: false, has_previous_page: false },
    });
    platformAdminService.getFilters.mockResolvedValue({ data: { event_types: [] } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("login_failure")).toBeInTheDocument();
    });

    expect(screen.getByText("someone@example.test")).toBeInTheDocument();
    expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
  });

  it("renders a plain 'not found' state, not a crash, when the API 404s", async () => {
    const notFoundError = new Error("Not Found");
    notFoundError.response = { status: 404 };

    platformAdminService.getLogs.mockRejectedValue(notFoundError);
    platformAdminService.getFilters.mockRejectedValue(notFoundError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page not found")).toBeInTheDocument();
    });
  });

  it("signs out and returns to /platform-admin/login, never /login", async () => {
    platformAdminService.getLogs.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 25, total: 0, total_pages: 0, has_next_page: false, has_previous_page: false },
    });
    platformAdminService.getFilters.mockResolvedValue({ data: { event_types: [] } });
    authService.signOut.mockResolvedValue();

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Platform Error Logs")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(screen.getByText("Platform Admin Login")).toBeInTheDocument();
    });

    expect(authService.signOut).toHaveBeenCalled();
  });
});
