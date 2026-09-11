/*
|--------------------------------------------------------------------------
| REQUIRE HR ROLE
|--------------------------------------------------------------------------
|
| Rejects with 403 unless the authenticated user's organization role is
| something other than 'employee' (owner, admin, or any other HR role) —
| the same convention already used by routes/attendanceLeave.js's
| isHrUser() and routes/employeeInvitations.js's isHrUser(). This
| middleware exists so that convention doesn't have to be re-implemented
| per file; new HR-only routes should use this instead of a local copy.
|
| SECURITY:
|
| req.user.organization_role is set by middleware/auth.js's requireAuth
| from the caller's verified JWT + organization_members row — never from
| anything client-supplied. This must run AFTER requireAuth.
|
| Apply via router.use() for a route file that is entirely HR-only.
| For a file that mixes HR-only writes with genuinely employee-facing
| routes (e.g. a real self-service /me endpoint scoped by
| middleware/resolveEmployee.js), apply this per-route instead — never
| router.use() a file like that, or the legitimate employee routes in
| it would be locked out too.
|--------------------------------------------------------------------------
*/

export function requireHRRole(req, res, next) {
  const role = String(req.user?.organization_role ?? "")
    .trim()
    .toLowerCase();

  if (role === "employee") {
    return res.status(403).json({
      message: "This action requires an HR role.",
    });
  }

  return next();
}

export default requireHRRole;
