import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RequireHRRole from "./RequireHRRole";

/*
|--------------------------------------------------------------------------
| REQUIRE HR ROLE
|--------------------------------------------------------------------------
|
| The mirror image of RequireEmployeeRole: guards the HR
| sidebar/tool-catalog routes. Only an employee-role organization must
| ever be redirected away (to /app/employee/dashboard) — every other
| role (owner, admin, or any other HR role) must render the guarded
| content.
|--------------------------------------------------------------------------
*/

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/app/dashboard"]}>
      <Routes>
        <Route element={<RequireHRRole />}>
          <Route path="/app/dashboard" element={<div>HR Dashboard</div>} />
        </Route>
        <Route
          path="/app/employee/dashboard"
          element={<div>Employee Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireHRRole", () => {
  it("redirects an employee-role organization to /app/employee/dashboard", () => {
    useAuth.mockReturnValue({ organization: { role: "employee" } });

    renderGuard();

    expect(screen.getByText("Employee Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("HR Dashboard")).not.toBeInTheDocument();
  });

  it("renders the guarded HR route for an owner-role organization", () => {
    useAuth.mockReturnValue({ organization: { role: "owner" } });

    renderGuard();

    expect(screen.getByText("HR Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Employee Dashboard")).not.toBeInTheDocument();
  });

  it("renders the guarded HR route for any other HR role (e.g. 'admin')", () => {
    useAuth.mockReturnValue({ organization: { role: "admin" } });

    renderGuard();

    expect(screen.getByText("HR Dashboard")).toBeInTheDocument();
  });
});
