import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";
import { supabaseAdmin } from "../config/supabase.js";

import {
  getEmployeeAttendance,
  getEmployeeLeaveBalances,
  getEmployeeLeaveRequests,
  createEmployeeLeaveRequest,
} from "../services/attendanceLeaveService.js";

const router = Router();

router.use(requireAuth);
router.use(requireEmployee);

/*
|--------------------------------------------------------------------------
| EMPLOYEE ATTENDANCE & LEAVE
|--------------------------------------------------------------------------
|
| GET  /api/employee/attendance
| POST /api/employee/attendance/clock-in
| POST /api/employee/attendance/clock-out
| GET  /api/employee/leave-balance
| GET  /api/employee/leave-requests
| POST /api/employee/leave-requests
|
| req.employee is set by requireEmployee and is ALREADY scoped to the
| authenticated user — every query below uses req.employee.id, never a
| client-supplied employee id.
|
| All query/validation logic is shared with the pre-existing
| /api/attendance-leave/me/* routes via services/attendanceLeaveService.js
| — see that file rather than re-implementing here.
|
| clock-in/clock-out write directly to attendance_records — the exact
| same table (and unique(employee_id, attendance_date) upsert shape)
| routes/attendanceLeave.js's HR-only POST /attendance writes to, so a
| self-marked day is the identical row HR sees in the Attendance &
| Leave Tracker, never a parallel record. Unlike that HR endpoint,
| there is no client-supplied employee_id or status here at all —
| the employee, the date, and the time are always derived server-side.
|--------------------------------------------------------------------------
*/

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeString() {
  return new Date().toTimeString().slice(0, 8);
}

/*
|--------------------------------------------------------------------------
| GET /api/employee/attendance
|--------------------------------------------------------------------------
*/

router.get("/attendance", async (req, res) => {
  try {
    const employee = req.employee;

    const attendance = await getEmployeeAttendance({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      fromDate: req.query.from_date || null,
      toDate: req.query.to_date || null,
    });

    const today = todayDateString();

    const todayRecord =
      attendance.find(
        (record) => record.attendance_date === today
      ) || null;

    return res.json({ attendance, today: todayRecord });
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] GET /attendance error:",
      error
    );

    return res.status(error.status || 500).json({
      message:
        error.message ||
        "Could not load attendance records.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/attendance/clock-in
|--------------------------------------------------------------------------
*/

router.post("/attendance/clock-in", async (req, res) => {
  try {
    const employee = req.employee;
    const today = todayDateString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("organization_id", employee.organization_id)
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return res.status(409).json({
        message:
          "Attendance for today has already been marked. You cannot clock in again.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        organization_id: employee.organization_id,
        employee_id: employee.id,
        attendance_date: today,
        status: "Present",
        check_in: currentTimeString(),
        check_out: null,
        notes: null,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    console.log(
      "[EmployeeAttendanceLeave] Clocked in:",
      { employeeId: employee.id, date: today, checkIn: data.check_in }
    );

    return res.status(201).json({ attendance: data });
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] POST /attendance/clock-in error:",
      error
    );

    return res.status(error.status || 500).json({
      message: error.message || "Could not clock in.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/attendance/clock-out
|--------------------------------------------------------------------------
*/

router.post("/attendance/clock-out", async (req, res) => {
  try {
    const employee = req.employee;
    const today = todayDateString();

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("organization_id", employee.organization_id)
      .eq("employee_id", employee.id)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing || !existing.check_in) {
      return res.status(400).json({
        message: "You have not clocked in today yet.",
      });
    }

    if (existing.check_out) {
      return res.status(409).json({
        message: "You have already clocked out today.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .update({
        check_out: currentTimeString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", employee.organization_id)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    console.log(
      "[EmployeeAttendanceLeave] Clocked out:",
      { employeeId: employee.id, date: today, checkOut: data.check_out }
    );

    return res.json({ attendance: data });
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] POST /attendance/clock-out error:",
      error
    );

    return res.status(error.status || 500).json({
      message: error.message || "Could not clock out.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/leave-balance
|--------------------------------------------------------------------------
*/

router.get("/leave-balance", async (req, res) => {
  try {
    const employee = req.employee;

    const balances = await getEmployeeLeaveBalances({
      organizationId: employee.organization_id,
      employeeId: employee.id,
    });

    return res.json({ balances });
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] GET /leave-balance error:",
      error
    );

    return res.status(error.status || 500).json({
      message:
        error.message ||
        "Could not load leave balances.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/employee/leave-requests
|--------------------------------------------------------------------------
*/

router.get("/leave-requests", async (req, res) => {
  try {
    const employee = req.employee;

    const requests = await getEmployeeLeaveRequests({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      status: req.query.status || null,
    });

    return res.json({ requests });
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] GET /leave-requests error:",
      error
    );

    return res.status(error.status || 500).json({
      message:
        error.message ||
        "Could not load leave requests.",
    });
  }
});

/*
|--------------------------------------------------------------------------
| POST /api/employee/leave-requests
|--------------------------------------------------------------------------
*/

router.post("/leave-requests", async (req, res) => {
  try {
    const employee = req.employee;

    const {
      leave_type,
      start_date,
      end_date,
      reason,
    } = req.body || {};

    const data = await createEmployeeLeaveRequest({
      organizationId: employee.organization_id,
      employeeId: employee.id,
      leaveType: leave_type,
      startDate: start_date,
      endDate: end_date,
      reason,
    });

    console.log(
      "[EmployeeAttendanceLeave] Leave request created:",
      { employeeId: employee.id, requestId: data.id }
    );

    return res.status(201).json(data);
  } catch (error) {
    console.error(
      "[EmployeeAttendanceLeave] POST /leave-requests error:",
      error
    );

    return res.status(error.status || 500).json({
      message:
        error.message ||
        "Could not create leave request.",

      ...(error.requests
        ? { requests: error.requests }
        : {}),

      ...(error.available !== undefined
        ? { available: error.available, requested: error.requested }
        : {}),
    });
  }
});

export default router;
