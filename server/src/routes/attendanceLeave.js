import { Router } from "express";

import { requireAuth } from "../middleware/auth.js";

import { supabaseAdmin } from "../config/supabase.js";

import { getOrganizationForUser } from "../services/organizationLookup.js";
import {
  resolveEmployeeForUser,
} from "../services/employeeIdentityService.js";
import {
  cleanString,
  cleanOptionalString,
  isValidDate,
  calculateLeaveDays,
  getEmployeeAttendance,
  getEmployeeLeaveBalances,
  getEmployeeLeaveRequests,
  createEmployeeLeaveRequest,
} from "../services/attendanceLeaveService.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();

/* =========================================================
   ROUTER AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION RESOLUTION
========================================================= */

async function requireOrganization(
  req,
  res,
  next,
) {
  try {
    const organization =
      await getOrganizationForUser(
        req.user.id,
      );

    if (!organization) {
      return res.status(403).json({
        message:
          "Complete organization setup first",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "Attendance & Leave organization lookup error:",
      error,
    );

    return res.status(500).json({
      message:
        "Could not determine organization",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   CONSTANTS
========================================================= */

const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "On Leave",
  "Holiday",
  "Work From Home",
];

const LEAVE_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Cancelled",
];

/* =========================================================
   HELPERS
========================================================= */

function isValidTime(value) {
  if (!value) {
    return true;
  }

  return /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/.test(
    value,
  );
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? ""),
  );
}

function formatLeaveDateRange(startDate, endDate) {
  const formatOne = (value) => {
    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (startDate === endDate) {
    return formatOne(startDate);
  }

  return `${formatOne(startDate)} - ${formatOne(endDate)}`;
}

/* =========================================================
   VERIFY EMPLOYEE BELONGS TO ORGANIZATION
========================================================= */

async function getOrganizationEmployee(
  organizationId,
  employeeId,
) {
  if (!isValidUUID(employeeId)) {
    return {
      employee: null,
      error: "Invalid employee ID",
    };
  }

  const {
    data: employee,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select(
      "id, organization_id, full_name, email, department, title, employee_code, employment_status",
    )
    .eq("id", employeeId)
    .eq(
      "organization_id",
      organizationId,
    )
    .maybeSingle();

  if (error) {
    return {
      employee: null,
      error: error.message,
    };
  }

  if (!employee) {
    return {
      employee: null,
      error: "Employee not found",
    };
  }

  return {
    employee,
    error: null,
  };
}

async function getCurrentEmployee(req) {
  return resolveEmployeeForUser({
    organizationId:
      req.organization?.id,

    userId:
      req.user?.id,

    email:
      req.user?.email,
  });
}

/*
 * HR-side users are every member whose role is not 'employee' —
 * same convention as routes/employeeInvitations.js's isHrUser().
 *
 * Every write below that acts on an arbitrary employee_id supplied
 * in the request body (marking someone else's attendance, setting
 * someone else's leave balance, creating or approving/rejecting a
 * leave request on someone else's behalf) is HR-only and must use
 * this — never the genuinely self-service writes (POST
 * /me/leave/requests), which already derive the employee from the
 * verified JWT via getCurrentEmployee() and take no employee_id
 * from the client at all.
 */
function isHrUser(req) {
  return (
    String(req.user?.organization_role ?? "")
      .trim()
      .toLowerCase() !== "employee"
  );
}

/* =========================================================
   CURRENT EMPLOYEE SELF-SERVICE
========================================================= */

router.get(
  "/me/attendance",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const attendance =
        await getEmployeeAttendance({
          organizationId:
            req.organization.id,

          employeeId:
            employee.id,

          fromDate:
            req.query.from_date || null,

          toDate:
            req.query.to_date || null,
        });

      return res.json({
        employee,
        attendance,
      });
    } catch (error) {
      console.error(
        "Current employee attendance error:",
        error,
      );

      return res.status(
        error.status || 500,
      ).json({
        message:
          error.message ||
          "Could not load attendance records",
      });
    }
  },
);

router.get(
  "/me/leave/balances",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const balances =
        await getEmployeeLeaveBalances({
          organizationId:
            req.organization.id,

          employeeId:
            employee.id,
        });

      return res.json({
        employee,
        balances,
      });
    } catch (error) {
      console.error(
        "Current employee leave balances error:",
        error,
      );

      return res.status(
        error.status || 500,
      ).json({
        message:
          error.message ||
          "Could not load leave balances",
      });
    }
  },
);

router.get(
  "/me/leave/requests",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const requests =
        await getEmployeeLeaveRequests({
          organizationId:
            req.organization.id,

          employeeId:
            employee.id,

          status:
            req.query.status || null,
        });

      return res.json({
        employee,
        requests,
      });
    } catch (error) {
      console.error(
        "Current employee leave requests error:",
        error,
      );

      return res.status(
        error.status || 500,
      ).json({
        message:
          error.message ||
          "Could not load leave requests",
      });
    }
  },
);

router.post(
  "/me/leave/requests",
  async (req, res) => {
    try {
      const employee =
        await getCurrentEmployee(req);

      const {
        leave_type,
        start_date,
        end_date,
        reason,
      } = req.body || {};

      const data =
        await createEmployeeLeaveRequest({
          organizationId:
            req.organization.id,

          employeeId:
            employee.id,

          leaveType:
            leave_type,

          startDate:
            start_date,

          endDate:
            end_date,

          reason,
        });

      return res.status(201).json(data);
    } catch (error) {
      console.error(
        "Current employee leave request creation error:",
        error,
      );

      return res.status(
        error.status || 500,
      ).json({
        message:
          error.message ||
          "Could not create leave request",

        ...(error.requests
          ? { requests: error.requests }
          : {}),
      });
    }
  },
);

/* =========================================================
   ATTENDANCE
========================================================= */

/*
 * GET ALL ATTENDANCE RECORDS
 *
 * GET /api/attendance-leave/attendance
 *
 * Optional:
 *
 * ?date=2026-08-14
 * ?employee_id=UUID
 * ?status=Present
 */

router.get(
  "/attendance",
  async (req, res) => {
    try {
      const {
        date,
        employee_id,
        status,
      } = req.query;

      let query =
        supabaseAdmin
          .from("attendance_records")
          .select(
            `
              *,
              employees (
                id,
                full_name,
                email,
                department,
                title,
                employee_code
              )
            `,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .order(
            "attendance_date",
            {
              ascending: false,
            },
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

      if (date) {
        if (!isValidDate(date)) {
          return res.status(400).json({
            message:
              "Invalid attendance date",
          });
        }

        query = query.eq(
          "attendance_date",
          date,
        );
      }

      if (employee_id) {
        if (!isValidUUID(employee_id)) {
          return res.status(400).json({
            message:
              "Invalid employee ID",
          });
        }

        query = query.eq(
          "employee_id",
          employee_id,
        );
      }

      if (status) {
        if (
          !ATTENDANCE_STATUSES.includes(
            status,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid attendance status",
          });
        }

        query = query.eq(
          "status",
          status,
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load attendance records error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load attendance records",
          detail: error.message,
        });
      }

      return res.json(data || []);
    } catch (error) {
      console.error(
        "Unexpected attendance list error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load attendance records",
      });
    }
  },
);

/*
 * CREATE / UPDATE ATTENDANCE
 *
 * POST /api/attendance-leave/attendance
 *
 * One record per employee per date.
 *
 * If a record already exists for that employee/date,
 * it will be updated instead of creating a duplicate.
 */

router.post(
  "/attendance",
  async (req, res) => {
    try {
      if (!isHrUser(req)) {
        return res.status(403).json({
          message:
            "Only HR users can mark attendance.",
        });
      }

      const {
        employee_id,
        attendance_date,
        status,
        check_in,
        check_out,
        notes,
      } = req.body || {};

      if (!employee_id) {
        return res.status(400).json({
          message:
            "Employee is required",
        });
      }

      if (!attendance_date) {
        return res.status(400).json({
          message:
            "Attendance date is required",
        });
      }

      if (!isValidDate(attendance_date)) {
        return res.status(400).json({
          message:
            "Invalid attendance date",
        });
      }

      if (
        !status ||
        !ATTENDANCE_STATUSES.includes(
          status,
        )
      ) {
        return res.status(400).json({
          message:
            "Valid attendance status is required",
        });
      }

      if (!isValidTime(check_in)) {
        return res.status(400).json({
          message:
            "Invalid check-in time",
        });
      }

      if (!isValidTime(check_out)) {
        return res.status(400).json({
          message:
            "Invalid check-out time",
        });
      }

      const {
        employee,
        error: employeeError,
      } =
        await getOrganizationEmployee(
          req.organization.id,
          employee_id,
        );

      if (employeeError) {
        return res.status(404).json({
          message: employeeError,
        });
      }

      const payload = {
        organization_id:
          req.organization.id,

        employee_id:
          employee.id,

        attendance_date,

        status,

        check_in:
          cleanOptionalString(
            check_in,
          ),

        check_out:
          cleanOptionalString(
            check_out,
          ),

        notes:
          cleanOptionalString(
            notes,
          ),

        updated_at:
          new Date().toISOString(),
      };

      /*
       * Upsert is safe because the database has:
       *
       * unique(employee_id, attendance_date)
       */

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("attendance_records")
        .upsert(
          payload,
          {
            onConflict:
              "employee_id,attendance_date",
          },
        )
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            )
          `,
        )
        .single();

      if (error) {
        console.error(
          "Save attendance error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not save attendance record",
          detail: error.message,
        });
      }

      return res.status(200).json(
        data,
      );
    } catch (error) {
      console.error(
        "Unexpected attendance save error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not save attendance record",
      });
    }
  },
);

/* =========================================================
   ATTENDANCE SUMMARY
========================================================= */

/*
 * GET /api/attendance-leave/attendance/summary
 *
 * Optional:
 *
 * ?date=2026-08-14
 */

router.get(
  "/attendance/summary",
  async (req, res) => {
    try {
      const date =
        req.query.date ||
        new Date()
          .toISOString()
          .slice(0, 10);

      if (!isValidDate(date)) {
        return res.status(400).json({
          message:
            "Invalid summary date",
        });
      }

      const {
        data: employees,
        error:
          employeesError,
      } = await supabaseAdmin
        .from("employees")
        .select(
          "id, full_name, employment_status",
        )
        .eq(
          "organization_id",
          req.organization.id,
        );

      if (employeesError) {
        return res.status(500).json({
          message:
            "Could not load employees for summary",
          detail:
            employeesError.message,
        });
      }

      const {
        data: attendance,
        error:
          attendanceError,
      } = await supabaseAdmin
        .from("attendance_records")
        .select(
          "employee_id, status",
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .eq(
          "attendance_date",
          date,
        );

      if (attendanceError) {
        return res.status(500).json({
          message:
            "Could not load attendance summary",
          detail:
            attendanceError.message,
        });
      }

      const summary = {
        date,

        total_employees:
          employees?.length || 0,

        present: 0,

        absent: 0,

        half_day: 0,

        on_leave: 0,

        holiday: 0,

        work_from_home: 0,

        not_marked: 0,
      };

      for (const record of
        attendance || []) {
        switch (record.status) {
          case "Present":
            summary.present++;
            break;

          case "Absent":
            summary.absent++;
            break;

          case "Half Day":
            summary.half_day++;
            break;

          case "On Leave":
            summary.on_leave++;
            break;

          case "Holiday":
            summary.holiday++;
            break;

          case "Work From Home":
            summary.work_from_home++;
            break;

          default:
            break;
        }
      }

      const markedCount =
        (attendance || []).length;

      summary.not_marked = Math.max(
        0,
        summary.total_employees -
          markedCount,
      );

      return res.json(
        summary,
      );
    } catch (error) {
      console.error(
        "Attendance summary error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load attendance summary",
      });
    }
  },
);

/* =========================================================
   LEAVE BALANCES
========================================================= */

/*
 * GET /api/attendance-leave/balances
 *
 * Optional:
 *
 * ?employee_id=UUID
 */

router.get(
  "/balances",
  async (req, res) => {
    try {
      const {
        employee_id,
      } = req.query;

      let query =
        supabaseAdmin
          .from("leave_balances")
          .select(
            `
              *,
              employees (
                id,
                full_name,
                email,
                department,
                title,
                employee_code
              )
            `,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .order(
            "created_at",
            {
              ascending: true,
            },
          );

      if (employee_id) {
        if (!isValidUUID(employee_id)) {
          return res.status(400).json({
            message:
              "Invalid employee ID",
          });
        }

        query = query.eq(
          "employee_id",
          employee_id,
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load leave balances error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load leave balances",
          detail: error.message,
        });
      }

      return res.json(
        data || [],
      );
    } catch (error) {
      console.error(
        "Unexpected leave balance list error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load leave balances",
      });
    }
  },
);

/*
 * CREATE / UPDATE LEAVE BALANCE
 *
 * POST /api/attendance-leave/balances
 */

router.post(
  "/balances",
  async (req, res) => {
    try {
      if (!isHrUser(req)) {
        return res.status(403).json({
          message:
            "Only HR users can set leave balances.",
        });
      }

      const {
        employee_id,
        leave_type,
        allocated,
        carried_forward,
      } = req.body || {};

      if (!employee_id) {
        return res.status(400).json({
          message:
            "Employee is required",
        });
      }

      if (!leave_type) {
        return res.status(400).json({
          message:
            "Leave type is required",
        });
      }

      const {
        employee,
        error: employeeError,
      } =
        await getOrganizationEmployee(
          req.organization.id,
          employee_id,
        );

      if (employeeError) {
        return res.status(404).json({
          message: employeeError,
        });
      }

      const allocatedValue =
        Number(allocated ?? 0);

      const carriedForwardValue =
        Number(
          carried_forward ?? 0,
        );

      if (
        !Number.isFinite(
          allocatedValue,
        ) ||
        allocatedValue < 0
      ) {
        return res.status(400).json({
          message:
            "Allocated leave must be a non-negative number",
        });
      }

      if (
        !Number.isFinite(
          carriedForwardValue,
        ) ||
        carriedForwardValue < 0
      ) {
        return res.status(400).json({
          message:
            "Carried forward leave must be a non-negative number",
        });
      }

      /*
       * Do not allow the frontend to arbitrarily
       * overwrite "used".
       *
       * Used leave should come from approved
       * leave requests.
       */

      const {
        data: existing,
        error:
          existingError,
      } = await supabaseAdmin
        .from("leave_balances")
        .select(
          "id, used",
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .eq(
          "employee_id",
          employee.id,
        )
        .eq(
          "leave_type",
          cleanString(
            leave_type,
          ),
        )
        .maybeSingle();

      if (existingError) {
        return res.status(500).json({
          message:
            "Could not check existing leave balance",
          detail:
            existingError.message,
        });
      }

      const payload = {
        organization_id:
          req.organization.id,

        employee_id:
          employee.id,

        leave_type:
          cleanString(
            leave_type,
          ),

        allocated:
          allocatedValue,

        carried_forward:
          carriedForwardValue,

        used:
          Number(
            existing?.used || 0,
          ),

        updated_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("leave_balances")
        .upsert(
          payload,
          {
            onConflict:
              "employee_id,leave_type",
          },
        )
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            )
          `,
        )
        .single();

      if (error) {
        console.error(
          "Save leave balance error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not save leave balance",
          detail: error.message,
        });
      }

      return res.status(200).json(
        data,
      );
    } catch (error) {
      console.error(
        "Unexpected leave balance save error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not save leave balance",
      });
    }
  },
);

/* =========================================================
   LEAVE REQUESTS
========================================================= */

/*
 * GET /api/attendance-leave/requests
 *
 * Optional:
 *
 * ?employee_id=UUID
 * ?status=Pending
 */

router.get(
  "/requests",
  async (req, res) => {
    try {
      const {
        employee_id,
        status,
      } = req.query;

      let query =
        supabaseAdmin
          .from("leave_requests")
          .select(
            `
              *,
              employees (
                id,
                full_name,
                email,
                department,
                title,
                employee_code
              )
            `,
          )
          .eq(
            "organization_id",
            req.organization.id,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

      if (employee_id) {
        if (!isValidUUID(employee_id)) {
          return res.status(400).json({
            message:
              "Invalid employee ID",
          });
        }

        query = query.eq(
          "employee_id",
          employee_id,
        );
      }

      if (status) {
        if (
          !LEAVE_STATUSES.includes(
            status,
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid leave request status",
          });
        }

        query = query.eq(
          "status",
          status,
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        console.error(
          "Load leave requests error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not load leave requests",
          detail: error.message,
        });
      }

      return res.json(
        data || [],
      );
    } catch (error) {
      console.error(
        "Unexpected leave request list error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not load leave requests",
      });
    }
  },
);

/*
 * CREATE LEAVE REQUEST
 *
 * POST /api/attendance-leave/requests
 */

router.post(
  "/requests",
  async (req, res) => {
    try {
      if (!isHrUser(req)) {
        return res.status(403).json({
          message:
            "Only HR users can create a leave request on another employee's behalf.",
        });
      }

      const {
        employee_id,
        leave_type,
        start_date,
        end_date,
        reason,
      } = req.body || {};

      if (!employee_id) {
        return res.status(400).json({
          message:
            "Employee is required",
        });
      }

      if (!leave_type) {
        return res.status(400).json({
          message:
            "Leave type is required",
        });
      }

      if (!start_date) {
        return res.status(400).json({
          message:
            "Start date is required",
        });
      }

      if (!end_date) {
        return res.status(400).json({
          message:
            "End date is required",
        });
      }

      if (
        !isValidDate(start_date) ||
        !isValidDate(end_date)
      ) {
        return res.status(400).json({
          message:
            "Invalid leave dates",
        });
      }

      if (
        new Date(start_date) >
        new Date(end_date)
      ) {
        return res.status(400).json({
          message:
            "End date cannot be before start date",
        });
      }

      const {
        employee,
        error: employeeError,
      } =
        await getOrganizationEmployee(
          req.organization.id,
          employee_id,
        );

      if (employeeError) {
        return res.status(404).json({
          message: employeeError,
        });
      }

      const totalDays =
        calculateLeaveDays(
          start_date,
          end_date,
        );

      if (totalDays <= 0) {
        return res.status(400).json({
          message:
            "Leave duration must be at least one day",
        });
      }

      /*
       * Check for overlapping active requests.
       */

      const {
        data: overlappingRequests,
        error:
          overlapError,
      } = await supabaseAdmin
        .from("leave_requests")
        .select(
          "id, start_date, end_date, status",
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .eq(
          "employee_id",
          employee.id,
        )
        .in(
          "status",
          [
            "Pending",
            "Approved",
          ],
        )
        .lte(
          "start_date",
          end_date,
        )
        .gte(
          "end_date",
          start_date,
        );

      if (overlapError) {
        return res.status(500).json({
          message:
            "Could not check overlapping leave requests",
          detail:
            overlapError.message,
        });
      }

      if (
        overlappingRequests &&
        overlappingRequests.length > 0
      ) {
        return res.status(409).json({
          message:
            "This employee already has an overlapping leave request",
          requests:
            overlappingRequests,
        });
      }

      const payload = {
        organization_id:
          req.organization.id,

        employee_id:
          employee.id,

        leave_type:
          cleanString(
            leave_type,
          ),

        start_date,

        end_date,

        total_days:
          totalDays,

        reason:
          cleanOptionalString(
            reason,
          ),

        status: "Pending",
      };

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("leave_requests")
        .insert(payload)
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            )
          `,
        )
        .single();

      if (error) {
        console.error(
          "Create leave request error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not create leave request",
          detail: error.message,
        });
      }

      return res.status(201).json(
        data,
      );
    } catch (error) {
      console.error(
        "Unexpected leave request creation error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not create leave request",
      });
    }
  },
);

/*
 * UPDATE LEAVE REQUEST STATUS
 *
 * PUT /api/attendance-leave/requests/:id
 *
 * Used by HR to:
 *
 * Pending -> Approved
 * Pending -> Rejected
 * Pending -> Cancelled
 */

router.put(
  "/requests/:id",
  async (req, res) => {
    try {
      if (!isHrUser(req)) {
        return res.status(403).json({
          message:
            "Only HR users can approve, reject, or cancel a leave request.",
        });
      }

      const requestId =
        req.params.id;

      const {
        status,
        review_comment,
      } = req.body || {};

      if (!isValidUUID(requestId)) {
        return res.status(400).json({
          message:
            "Invalid leave request ID",
        });
      }

      if (
        !status ||
        !LEAVE_STATUSES.includes(
          status,
        )
      ) {
        return res.status(400).json({
          message:
            "Valid leave request status is required",
        });
      }

      const {
        data: existingRequest,
        error:
          existingError,
      } = await supabaseAdmin
        .from("leave_requests")
        .select("*")
        .eq("id", requestId)
        .eq(
          "organization_id",
          req.organization.id,
        )
        .maybeSingle();

      if (existingError) {
        return res.status(500).json({
          message:
            "Could not load leave request",
          detail:
            existingError.message,
        });
      }

      if (!existingRequest) {
        return res.status(404).json({
          message:
            "Leave request not found",
        });
      }

      /*
       * Only pending requests can be
       * approved or rejected.
       */

      if (
        existingRequest.status !==
          "Pending" &&
        status !== "Cancelled"
      ) {
        return res.status(409).json({
          message:
            "Only pending leave requests can be approved or rejected",
        });
      }

      const updatePayload = {
        status,

        review_comment:
          cleanOptionalString(
            review_comment,
          ),

        reviewed_by:
          req.user.id,

        reviewed_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      };

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("leave_requests")
        .update(
          updatePayload,
        )
        .eq(
          "id",
          requestId,
        )
        .eq(
          "organization_id",
          req.organization.id,
        )
        .select(
          `
            *,
            employees (
              id,
              full_name,
              email,
              department,
              title,
              employee_code
            )
          `,
        )
        .single();

      if (error) {
        console.error(
          "Update leave request error:",
          error,
        );

        return res.status(500).json({
          message:
            "Could not update leave request",
          detail: error.message,
        });
      }

      /*
       * If a request becomes Approved,
       * automatically update the corresponding
       * leave balance.
       *
       * We do this only when transitioning
       * Pending -> Approved.
       */

      if (
        existingRequest.status ===
          "Pending" &&
        status === "Approved"
      ) {
        const {
          data: balance,
          error:
            balanceError,
        } = await supabaseAdmin
          .from("leave_balances")
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "employee_id",
            existingRequest.employee_id,
          )
          .eq(
            "leave_type",
            existingRequest.leave_type,
          )
          .maybeSingle();

        if (balanceError) {
          console.error(
            "Load leave balance after approval error:",
            balanceError,
          );
        } else if (
          balance
        ) {
          const currentUsed =
            Number(
              balance.used || 0,
            );

          const newUsed =
            currentUsed +
            Number(
              existingRequest.total_days ||
                0,
            );

          const {
            error:
              balanceUpdateError,
          } = await supabaseAdmin
            .from("leave_balances")
            .update({
              used: newUsed,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              balance.id,
            )
            .eq(
              "organization_id",
              req.organization.id,
            );

          if (
            balanceUpdateError
          ) {
            console.error(
              "Update leave balance after approval error:",
              balanceUpdateError,
            );
          }
        }
      }

      /*
       * If a previously approved request is
       * cancelled, return the used days to the balance.
       */

      if (
        existingRequest.status ===
          "Approved" &&
        status === "Cancelled"
      ) {
        const {
          data: balance,
          error:
            balanceError,
        } = await supabaseAdmin
          .from("leave_balances")
          .select("*")
          .eq(
            "organization_id",
            req.organization.id,
          )
          .eq(
            "employee_id",
            existingRequest.employee_id,
          )
          .eq(
            "leave_type",
            existingRequest.leave_type,
          )
          .maybeSingle();

        if (balanceError) {
          console.error(
            "Load balance for cancellation error:",
            balanceError,
          );
        } else if (
          balance
        ) {
          const currentUsed =
            Number(
              balance.used || 0,
            );

          const returnedDays =
            Number(
              existingRequest.total_days ||
                0,
            );

          const newUsed =
            Math.max(
              0,
              currentUsed -
                returnedDays,
            );

          const {
            error:
              balanceUpdateError,
          } = await supabaseAdmin
            .from("leave_balances")
            .update({
              used: newUsed,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              balance.id,
            )
            .eq(
              "organization_id",
              req.organization.id,
            );

          if (
            balanceUpdateError
          ) {
            console.error(
              "Return leave balance error:",
              balanceUpdateError,
            );
          }
        }
      }

      /*
       * Notify the employee when their request is approved or
       * rejected. A notification failure must never fail the
       * approval/rejection itself — createNotification() already
       * swallows its own errors and returns null on failure.
       */

      if (
        existingRequest.status ===
          "Pending" &&
        (status === "Approved" ||
          status === "Rejected")
      ) {
        await createNotification({
          organizationId:
            req.organization.id,

          employeeId:
            existingRequest.employee_id,

          type:
            status === "Approved"
              ? "leave_request_approved"
              : "leave_request_rejected",

          title:
            status === "Approved"
              ? `Your ${existingRequest.leave_type} request was approved`
              : `Your ${existingRequest.leave_type} request was rejected`,

          message:
            `${formatLeaveDateRange(
              existingRequest.start_date,
              existingRequest.end_date,
            )} (${existingRequest.total_days} day${
              existingRequest.total_days === 1 ? "" : "s"
            })${
              review_comment
                ? ` — ${cleanOptionalString(review_comment)}`
                : ""
            }`,
        });
      }

      return res.json(
        data,
      );
    } catch (error) {
      console.error(
        "Unexpected leave request update error:",
        error,
      );

      return res.status(500).json({
        message:
          "Could not update leave request",
      });
    }
  },
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
