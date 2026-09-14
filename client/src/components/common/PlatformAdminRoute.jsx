import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from "../../services/authService";

/*
|--------------------------------------------------------------------------
| PLATFORM ADMIN ROUTE GUARD
|--------------------------------------------------------------------------
|
| Guards /platform-admin/* pages. Deliberately independent of
| context/AuthContext.jsx (the main app's ProtectedRoute/useAuth) —
| checks the raw Supabase session directly via services/authService.js
| instead. Two reasons:
|
|   1. No-session redirects here to /platform-admin/login, never to the
|      main app's /login — this is meant to work as a standalone entry
|      point that never requires visiting the main app first.
|   2. AuthContext also loads/redirects on organization state (see
|      ProtectedRoute.jsx) — a platform admin is not necessarily a
|      member of any organization, and none of that is relevant here.
|
| This only proves "a real, current Supabase session exists" — it does
| NOT check platform_admins itself (there is intentionally no allow-list
| logic in the client at all). Whether that session's email is actually
| on the list is enforced server-side, per request, by
| middleware/requirePlatformAdmin.js — a logged-in non-admin still
| reaches the page, and every API call it makes 404s, which the page
| renders as a plain "not found" state (see PlatformAdminLogs.jsx).
|--------------------------------------------------------------------------
*/

export default function PlatformAdminRoute() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    authService.getSession().then((currentSession) => {
      if (mounted) {
        setSession(currentSession || null);
      }
    });

    const subscription = authService.onAuthStateChange((newSession) => {
      if (mounted) {
        setSession(newSession || null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0b0d12]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate to="/platform-admin/login" state={{ from: location }} replace />
    );
  }

  return <Outlet />;
}
