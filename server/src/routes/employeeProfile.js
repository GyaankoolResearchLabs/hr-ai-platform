import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE PROFILE
|--------------------------------------------------------------------------
|
| GET /api/employee/profile
|
| Returns the fields of the authenticated employee's own employees row
| that are safe for the employee themselves to see.
|
| req.employee is set by resolveEmployee and is ALREADY scoped to the
| authenticated user — never trust a client-supplied employee id here.
|
| Deliberately excluded: user_id (internal auth mapping) and anything
| HR-only. The employees table has no salary/compensation columns —
| that data lives in payroll_runs / payslips / comp_review_cycles, which
| this route does not touch.
|--------------------------------------------------------------------------
*/

async function resolveManager(managerId, organizationId) {
  if (!managerId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, title")
    .eq("id", managerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error(
      "[EmployeeProfile] Manager lookup failed:",
      error
    );

    return null;
  }

  return data || null;
}

function serializeProfile(employee, manager) {
  return {
    id: employee.id,
    employee_code: employee.employee_code || null,
    full_name: employee.full_name,
    email: employee.email,
    department: employee.department || null,
    title: employee.title || null,
    designation: employee.title || null,
    employment_status: employee.employment_status || null,
    joining_date: employee.joining_date || null,
    last_working_date: employee.last_working_date || null,
    location: employee.location || null,
    address: employee.address || null,
    manager: manager
      ? {
          id: manager.id,
          full_name: manager.full_name,
          title: manager.title || null,
        }
      : null,
    organization_id: employee.organization_id,
  };
}

router.get("/", async (req, res) => {
  try {
    const employee = req.employee;

    const manager = await resolveManager(
      employee.manager_id,
      employee.organization_id
    );

    console.log(
      "[EmployeeProfile] Profile viewed:",
      employee.id
    );

    return res.json(
      serializeProfile(employee, manager)
    );
  } catch (error) {
    console.error(
      "[EmployeeProfile] GET exception:",
      error
    );

    return res.status(500).json({
      message:
        error.message || "Failed to load profile.",
    });
  }
});

export default router;
