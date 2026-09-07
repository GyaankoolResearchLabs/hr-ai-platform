import {
  resolveEmployeeForUser,
} from "../services/employeeIdentityService.js";

import {
  getOrganizationIdFromRequest,
  getUserIdFromRequest,
} from "../utils/requestContext.js";

/*
|--------------------------------------------------------------------------
| RESOLVE EMPLOYEE
|--------------------------------------------------------------------------
|
| Resolves the authenticated Supabase user to their own row in the
| employees table and attaches it to the request.
|
| SECURITY:
|
| The employee is ALWAYS derived from the verified JWT (req.user), never
| from req.body / req.params / req.query. A client can send any employee
| id it likes — routes behind this middleware must ignore it and read
| req.employee / req.employeeId instead.
|
| Resolution order (see services/employeeIdentityService.js):
|
| 1. employees.user_id === authenticated user id   <- the account link
| 2. employees.email  === verified JWT email       <- pre-link fallback
|
| Step 2 exists so employees who have not accepted their invitation yet
| are not locked out. Once POST /api/employee-invitations/accept has run,
| step 1 is the path that matches.
|
| Must run AFTER requireAuth.
|--------------------------------------------------------------------------
*/

export async function resolveEmployee(req, res, next) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user not found.",
      });
    }

    const organizationId =
      getOrganizationIdFromRequest(req);

    if (!organizationId) {
      return res.status(400).json({
        message: "Organization context is required.",
      });
    }

    const employee = await resolveEmployeeForUser({
      organizationId,
      userId,
      email: req.user?.email || null,
    });

    if (!employee) {
      return res.status(403).json({
        message:
          "This user is not linked to an employee record.",
      });
    }

    req.employee = employee;
    req.employeeId = employee.id;

    console.log(
      "[ResolveEmployee] User linked to employee:",
      {
        userId,
        employeeId: employee.id,
        organizationId,
      }
    );

    return next();
  } catch (error) {
    const status =
      error?.status ||
      error?.statusCode ||
      500;

    console.error(
      "[ResolveEmployee] Employee resolution failed:",
      error
    );

    return res.status(status).json({
      message:
        error?.message ||
        "Failed to resolve employee record.",
    });
  }
}

export default resolveEmployee;
