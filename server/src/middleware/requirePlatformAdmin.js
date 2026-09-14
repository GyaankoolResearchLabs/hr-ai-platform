import { isPlatformAdmin } from "../services/platformAdminService.js";

/*
|--------------------------------------------------------------------------
| REQUIRE PLATFORM ADMIN
|--------------------------------------------------------------------------
|
| Gates the operator-only monitoring system (/api/platform-admin/*). This
| is a second, independent trust check layered on top of normal
| authentication — it has nothing to do with organization_role:
|
|   1. requireAuthWithoutOrg (middleware/auth.js) verifies the caller's
|      Supabase JWT is real and current. Must run BEFORE this middleware.
|   2. This middleware then checks the caller's verified email against
|      the platform_admins table (services/platformAdminService.js) — a
|      completely separate list from organization_members.role. Whether
|      the caller is an 'owner', 'admin', or 'employee' in any
|      organization is irrelevant here and never consulted.
|
| REJECTION IS 404, NOT 403:
|
| A 403 confirms "this route exists, you're just not allowed" — that
| alone would tell a curious customer HR/owner account that a
| platform-admin system exists to go looking for. 404 is indistinguishable
| from a route that was never there, matching this app's real 404 handler
| (index.js) exactly. Never change this to 403.
|--------------------------------------------------------------------------
*/

function notFound(res) {
  return res.status(404).json({
    message: "API route not found",
  });
}

export async function requirePlatformAdmin(req, res, next) {
  try {
    const email = req.user?.email;

    if (!email) {
      return notFound(res);
    }

    const allowed = await isPlatformAdmin(email);

    if (!allowed) {
      return notFound(res);
    }

    return next();
  } catch (error) {
    console.error(
      "[PlatformAdmin] requirePlatformAdmin check failed:",
      error
    );

    // Fail closed on any unexpected error — never let an exception here
    // fall through to the route.
    return notFound(res);
  }
}

export default requirePlatformAdmin;
