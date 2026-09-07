import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Guards /app/employee/* routes.
 *
 * Only members whose organization role is 'employee' may render these
 * pages. Anyone else (owner, admin, or any other HR role) is redirected
 * to the main HR dashboard.
 *
 * Must render inside ProtectedRoute, which already guarantees
 * authentication and organization loading have finished before this
 * mounts.
 */
export default function RequireEmployeeRole() {
  const { organization } = useAuth();

  if (organization?.role !== "employee") {
    return (
      <Navigate
        to="/app/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}
