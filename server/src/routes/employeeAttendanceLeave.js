import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";
import { resolveEmployee as requireEmployee } from "../middleware/resolveEmployee.js";

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
|--------------------------------------------------------------------------
*/

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
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
