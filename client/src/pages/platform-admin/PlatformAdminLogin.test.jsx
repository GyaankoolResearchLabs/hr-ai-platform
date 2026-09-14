import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import PlatformAdminLogin from "./PlatformAdminLogin";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN LOGIN
|--------------------------------------------------------------------------
|
| Confirms the two behaviors that matter: a successful sign-in lands on
| /platform-admin/logs (not /app/dashboard, the main app's landing page),
| and it goes through services/authService.signIn — the exact same
| supabase.auth.signInWithPassword() call the main app's Login.jsx uses,
| just via this separate form. A failed sign-in shows the error and
| never navigates.
|--------------------------------------------------------------------------
*/

vi.mock("../../services/authService", () => ({
  authService: {
    signIn: vi.fn(),
  },
}));

import { authService } from "../../services/authService";

function renderPage(initialEntry = "/platform-admin/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
        <Route path="/platform-admin/logs" element={<div>Platform Logs</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PlatformAdminLogin", () => {
  it("signs in via authService.signIn and lands on /platform-admin/logs", async () => {
    authService.signIn.mockResolvedValue({
      session: { access_token: "t" },
      user: { email: "shettysusheen@gmail.com" },
    });

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("you@example.com"), "shettysusheen@gmail.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Platform Logs")).toBeInTheDocument();
    });

    expect(authService.signIn).toHaveBeenCalledWith({
      email: "shettysusheen@gmail.com",
      password: "correct-password",
    });
  });

  it("shows the error and stays on the login form when sign-in fails", async () => {
    authService.signIn.mockRejectedValue(new Error("Invalid login credentials"));

    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText("you@example.com"), "someone@example.test");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
    });

    expect(screen.queryByText("Platform Logs")).not.toBeInTheDocument();
  });
});
