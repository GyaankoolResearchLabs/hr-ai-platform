import { supabaseAdmin } from "../config/supabase.js";

/*
|--------------------------------------------------------------------------
| ATTENDANCE & LEAVE SERVICE
|--------------------------------------------------------------------------
|
| Shared query/validation logic for attendance records, leave balances,
| and leave requests.
|
| Used by:
|
| - routes/attendanceLeave.js        (HR-side + the original /me/* routes)
| - routes/employeeAttendanceLeave.js (employee portal /api/employee/*)
|
| Extracted here so both surfaces run the exact same logic instead of
| two copies drifting apart.
|--------------------------------------------------------------------------
*/

const EMPLOYEE_SELECT_COLUMNS = `
  *,
  employees (
    id,
    full_name,
    email,
    department,
    title,
    employee_code
  )
`;

/* =========================================================
   HELPERS
========================================================= */

export function cleanString(value) {
  return String(value ?? "").trim();
}

export function cleanOptionalString(value) {
  const cleaned = cleanString(value);

  return cleaned || null;
}

export function isValidDate(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

export function calculateLeaveDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return 0;
  }

  const difference = end.getTime() - start.getTime();

  return (
    Math.floor(difference / (1000 * 60 * 60 * 24)) + 1
  );
}

function createServiceError(message, status = 400) {
  const error = new Error(message);
  error.status = status;

  return error;
}

/* =========================================================
   ATTENDANCE
========================================================= */

export async function getEmployeeAttendance({
  organizationId,
  employeeId,
  fromDate = null,
  toDate = null,
}) {
  let query = supabaseAdmin
    .from("attendance_records")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .order("attendance_date", { ascending: false });

  if (fromDate) {
    query = query.gte("attendance_date", fromDate);
  }

  if (toDate) {
    query = query.lte("attendance_date", toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/* =========================================================
   LEAVE BALANCES
========================================================= */

export async function getEmployeeLeaveBalances({
  organizationId,
  employeeId,
}) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .order("leave_type", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function getEmployeeLeaveBalanceForType({
  organizationId,
  employeeId,
  leaveType,
}) {
  const { data, error } = await supabaseAdmin
    .from("leave_balances")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("leave_type", leaveType)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

/* =========================================================
   LEAVE REQUESTS
========================================================= */

export async function getEmployeeLeaveRequests({
  organizationId,
  employeeId,
  status = null,
}) {
  let query = supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function findOverlappingLeaveRequests({
  organizationId,
  employeeId,
  startDate,
  endDate,
}) {
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("id, start_date, end_date, status")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .in("status", ["Pending", "Approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (error) {
    throw error;
  }

  return data || [];
}

/*
 * CREATE LEAVE REQUEST
 *
 * Validates dates, checks for overlapping active requests, and — new —
 * checks the request against the employee's actual leave balance for
 * that leave type.
 *
 * IMPORTANT: neither the HR-side POST /api/attendance-leave/requests nor
 * the original POST /api/attendance-leave/me/leave/requests validated
 * against the balance before this; they only debited/credited "used" on
 * approval/cancellation. That gap is closed here for self-service
 * submission, so an employee can no longer submit a request for more
 * days than they have available.
 */
export async function createEmployeeLeaveRequest({
  organizationId,
  employeeId,
  leaveType,
  startDate,
  endDate,
  reason,
}) {
  const cleanType = cleanString(leaveType);

  if (!cleanType) {
    throw createServiceError("Leave type is required");
  }

  if (!startDate) {
    throw createServiceError("Start date is required");
  }

  if (!endDate) {
    throw createServiceError("End date is required");
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    throw createServiceError("Invalid leave dates");
  }

  if (new Date(startDate) > new Date(endDate)) {
    throw createServiceError(
      "End date cannot be before start date"
    );
  }

  const totalDays = calculateLeaveDays(startDate, endDate);

  if (totalDays <= 0) {
    throw createServiceError(
      "Leave duration must be at least one day"
    );
  }

  const overlapping = await findOverlappingLeaveRequests({
    organizationId,
    employeeId,
    startDate,
    endDate,
  });

  if (overlapping.length > 0) {
    const error = createServiceError(
      "You already have an overlapping leave request",
      409
    );

    error.requests = overlapping;

    throw error;
  }

  const balance = await getEmployeeLeaveBalanceForType({
    organizationId,
    employeeId,
    leaveType: cleanType,
  });

  const allocated = Number(balance?.allocated || 0);
  const carriedForward = Number(balance?.carried_forward || 0);
  const used = Number(balance?.used || 0);
  const available = Math.max(
    0,
    allocated + carriedForward - used
  );

  if (totalDays > available) {
    const error = createServiceError(
      `Insufficient ${cleanType} balance: ${available} day(s) available, ${totalDays} requested.`,
      409
    );

    error.available = available;
    error.requested = totalDays;

    throw error;
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({
      organization_id: organizationId,
      employee_id: employeeId,
      leave_type: cleanType,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      reason: cleanOptionalString(reason),
      status: "Pending",
    })
    .select(EMPLOYEE_SELECT_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return data;
}
