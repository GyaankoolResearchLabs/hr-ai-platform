import { supabaseAdmin } from "../config/supabase.js";

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/* =========================================================
   GET ORGANIZATION ORG CHART
========================================================= */

export async function getOrgChart(organizationId) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select(`
      id,
      organization_id,
      full_name,
      email,
      department,
      title,
      employee_code,
      employment_status,
      manager_id,
      created_at
    `)
    .eq("organization_id", organizationId)
    .order("full_name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "[Org Chart Service] GET:",
      error,
    );

    throw error;
  }

  const employees = data || [];

  const employeeMap = new Map(
    employees.map((employee) => [
      employee.id,
      {
        ...employee,
        children: [],
      },
    ]),
  );

  const roots = [];

  for (const employee of employees) {
    const currentEmployee = employeeMap.get(
      employee.id,
    );

    if (
      employee.manager_id &&
      employee.manager_id !== employee.id &&
      employeeMap.has(employee.manager_id)
    ) {
      employeeMap
        .get(employee.manager_id)
        .children.push(currentEmployee);
    } else {
      roots.push(currentEmployee);
    }
  }

  return {
    employees,
    roots,
    totalEmployees: employees.length,
    totalRoots: roots.length,
  };
}

/* =========================================================
   UPDATE EMPLOYEE MANAGER
========================================================= */

export async function updateEmployeeManager(
  organizationId,
  employeeId,
  managerId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!employeeId) {
    throw createServiceError(
      "Employee ID is required.",
      400,
    );
  }

  if (managerId === employeeId) {
    throw createServiceError(
      "An employee cannot report to themselves.",
      400,
    );
  }

  /* -------------------------------------------------------
     VERIFY EMPLOYEE
  ------------------------------------------------------- */

  const {
    data: employee,
    error: employeeError,
  } = await supabaseAdmin
    .from("employees")
    .select(`
      id,
      organization_id,
      full_name,
      manager_id
    `)
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (employeeError) {
    console.error(
      "[Org Chart Service] Employee lookup:",
      employeeError,
    );

    throw employeeError;
  }

  if (!employee) {
    throw createServiceError(
      "Employee not found.",
      404,
    );
  }

  /* -------------------------------------------------------
     REMOVE MANAGER
  ------------------------------------------------------- */

  if (!managerId) {
    const {
      data,
      error,
    } = await supabaseAdmin
      .from("employees")
      .update({
        manager_id: null,
      })
      .eq("id", employeeId)
      .eq("organization_id", organizationId)
      .select(`
        id,
        organization_id,
        full_name,
        email,
        department,
        title,
        employee_code,
        employment_status,
        manager_id,
        created_at
      `)
      .single();

    if (error) {
      console.error(
        "[Org Chart Service] Remove manager:",
        error,
      );

      throw error;
    }

    return data;
  }

  /* -------------------------------------------------------
     VERIFY MANAGER BELONGS TO SAME ORGANIZATION
  ------------------------------------------------------- */

  const {
    data: manager,
    error: managerError,
  } = await supabaseAdmin
    .from("employees")
    .select(`
      id,
      organization_id,
      full_name
    `)
    .eq("id", managerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (managerError) {
    console.error(
      "[Org Chart Service] Manager lookup:",
      managerError,
    );

    throw managerError;
  }

  if (!manager) {
    throw createServiceError(
      "Selected manager does not belong to this organization.",
      400,
    );
  }

  /* -------------------------------------------------------
     PREVENT REPORTING CYCLES
  ------------------------------------------------------- */

  const {
    data: allEmployees,
    error: allEmployeesError,
  } = await supabaseAdmin
    .from("employees")
    .select("id, manager_id")
    .eq("organization_id", organizationId);

  if (allEmployeesError) {
    throw allEmployeesError;
  }

  const managerMap = new Map(
    (allEmployees || []).map((item) => [
      item.id,
      item.manager_id,
    ]),
  );

  let currentId = managerId;
  const visited = new Set();

  while (currentId) {
    if (visited.has(currentId)) {
      throw createServiceError(
        "This reporting relationship would create a circular hierarchy.",
        400,
      );
    }

    visited.add(currentId);

    if (currentId === employeeId) {
      throw createServiceError(
        "This reporting relationship would create a circular hierarchy.",
        400,
      );
    }

    currentId = managerMap.get(currentId) || null;
  }

  /* -------------------------------------------------------
     UPDATE MANAGER
  ------------------------------------------------------- */

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .update({
      manager_id: managerId,
    })
    .eq("id", employeeId)
    .eq("organization_id", organizationId)
    .select(`
      id,
      organization_id,
      full_name,
      email,
      department,
      title,
      employee_code,
      employment_status,
      manager_id,
      created_at
    `)
    .single();

  if (error) {
    console.error(
      "[Org Chart Service] Update manager:",
      error,
    );

    throw error;
  }

  return data;
}