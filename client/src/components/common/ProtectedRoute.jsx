import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Guards authenticated application routes.
 *
 * Flow:
 *
 * 1. Authentication loading
 *      -> wait
 *
 * 2. Organization loading
 *      -> wait
 *
 * 3. Not authenticated
 *      -> /login
 *
 * 4. Authenticated but no organization
 *      -> /organization/setup
 *
 * 5. Authenticated + organization exists
 *      -> render requested route
 */
export default function ProtectedRoute() {
  const {
    authLoading,
    isAuthenticated,
    hasOrganization,
    organizationLoading,
  } = useAuth();

  const location = useLocation();

  /*
   * IMPORTANT:
   * Never redirect while authentication or organization state
   * is still being restored after a page refresh.
   */
  if (authLoading || organizationLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  /*
   * Authentication has finished loading and the user is
   * definitely not signed in.
   */
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  /*
   * User is authenticated but has not created an organization.
   *
   * Allow the setup page itself to render.
   */
  if (
    !hasOrganization &&
    location.pathname !== "/organization/setup"
  ) {
    return (
      <Navigate
        to="/organization/setup"
        replace
      />
    );
  }

  /*
   * Authentication and organization are both ready.
   * Render the originally requested page.
   */
  return <Outlet />;
}