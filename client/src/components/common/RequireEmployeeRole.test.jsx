import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import RequireEmployeeRole from "./RequireEmployeeRole";

/*
|--------------------------------------------------------------------------
| REQUIRE EMPLOYEE ROLE
|--------------------------------------------------------------------------
|
| Client-side half of the role-separation security model (the backend
| half — requireHRRole / resolveEmployee — is covered by the server
| test suite). This guard must:
|
| - Render the guarded /app/employee/* routes for an employee-role
|   organization.
| - Redirect anyone else (owner, HR, undefined/no-org-yet) to
|   /app/dashboard instead of ever rendering the guarded content.
|--------------------------------------------------------------------------
*/

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../../context/AuthContext";

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/app/employee/dashboard"]}>
      <Routes>
        <Route element={<RequireEmployeeRole />}>
          <Route
            path="/app/employee/dashboard"
            element={<div>Employee Dashboard</div>}
          />
        </Route>
        <Route path="/app/dashboard" element={<div>HR Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireEmployeeRole", () => {
  it("renders the guarded employee route when organization.role is 'employee'", () => {
    useAuth.mockReturnValue({ organization: { role: "employee" } });

    renderGuard();

    expect(screen.getByText("Employee Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("HR Dashboard")).not.toBeInTheDocument();
  });

  it("redirects an owner-role organization to /app/dashboard", () => {
    useAuth.mockReturnValue({ organization: { role: "owner" } });

    renderGuard();

    expect(screen.getByText("HR Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Employee Dashboard")).not.toBeInTheDocument();
  });

  it("redirects any other HR role (e.g. 'admin') to /app/dashboard", () => {
    useAuth.mockReturnValue({ organization: { role: "admin" } });

    renderGuard();

    expect(screen.getByText("HR Dashboard")).toBeInTheDocument();
  });

  it("redirects when organization is not yet loaded (undefined)", () => {
    useAuth.mockReturnValue({ organization: undefined });

    renderGuard();

    expect(screen.getByText("HR Dashboard")).toBeInTheDocument();
  });
});
