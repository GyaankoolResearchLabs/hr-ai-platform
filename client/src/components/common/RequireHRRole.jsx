import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Guards every HR-facing route (the main HR dashboard, the tool
 * catalog, category detail pages, the employee directory, settings).
 *
 * Only members whose organization role is NOT 'employee' (owner,
 * admin, or any other HR role) may render these pages. An
 * employee-role account hitting any of these routes directly is
 * redirected to their own Employee Dashboard instead — the mirror
 * image of what RequireEmployeeRole already does for /app/employee/*.
 *
 * Must render inside ProtectedRoute, which already guarantees
 * authentication and organization loading have finished before this
 * mounts.
 */
export default function RequireHRRole() {
  const { organization } = useAuth();

  if (organization?.role === "employee") {
    return (
      <Navigate
        to="/app/employee/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}
