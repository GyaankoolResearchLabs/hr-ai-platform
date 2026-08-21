import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { supabaseAdmin } from "../config/supabase.js";
import { getOrganizationForUser } from "../services/organizationLookup.js";

const router = Router();

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(requireAuth);

/* =========================================================
   ORGANIZATION
========================================================= */

async function requireOrganization(req, res, next) {
  try {
    const organization = await getOrganizationForUser(
      req.user.id,
    );

    if (!organization) {
      return res.status(403).json({
        message: "Complete organization setup first.",
      });
    }

    req.organization = organization;

    next();
  } catch (error) {
    console.error(
      "[WorkforceMetrics] Organization lookup failed:",
      error,
    );

    return res.status(500).json({
      message: "Could not determine organization.",
    });
  }
}

router.use(requireOrganization);

/* =========================================================
   HELPERS
========================================================= */

function getOrganizationId(req) {
  return (
    req.organization?.id ||
    req.user?.organization_id ||
    req.user?.organizationId ||
    null
  );
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getMonthKey(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}`;
}

/* =========================================================
   GET WORKFORCE METRICS

   GET /api/workforce-metrics
========================================================= */

router.get("/", async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);

    if (!organizationId) {
      return res.status(403).json({
        message:
          "Authenticated user is not associated with an organization.",
      });
    }

    /* -------------------------------------------------------
       EMPLOYEES
    ------------------------------------------------------- */

    const {
      data: employees,
      error: employeesError,
    } = await supabaseAdmin
      .from("employees")
      .select(
        `
          id,
          organization_id,
          full_name,
          email,
          department,
          title,
          employment_status,
          joining_date,
          last_working_date,
          created_at
        `,
      )
      .eq("organization_id", organizationId)
      .order("created_at", {
        ascending: false,
      });

    if (employeesError) {
      throw employeesError;
    }

    const employeeRows = employees || [];

    /* -------------------------------------------------------
       ATTENDANCE
    ------------------------------------------------------- */

    const {
      data: attendanceRecords,
      error: attendanceError,
    } = await supabaseAdmin
      .from("attendance_records")
      .select(
        `
          id,
          organization_id,
          employee_id,
          attendance_date,
          status
        `,
      )
      .eq("organization_id", organizationId)
      .order("attendance_date", {
        ascending: false,
      });

    if (attendanceError) {
      console.warn(
        "[WorkforceMetrics] Attendance query failed:",
        attendanceError.message,
      );
    }

    const attendanceRows = attendanceRecords || [];

    /* =====================================================
       HEADCOUNT
    ===================================================== */

    const totalEmployees = employeeRows.length;

    const activeEmployees = employeeRows.filter(
      (employee) =>
        normalizeStatus(employee.employment_status) ===
        "active",
    ).length;

    const inactiveEmployees =
      totalEmployees - activeEmployees;

    /* =====================================================
       ATTRITION
    ===================================================== */

    const exitedEmployees = employeeRows.filter(
      (employee) => {
        const status = normalizeStatus(
          employee.employment_status,
        );

        return (
          status === "resigned" ||
          status === "terminated" ||
          status === "retired" ||
          Boolean(employee.last_working_date)
        );
      },
    );

    const historicalExits =
      exitedEmployees.length;

    const attritionRate =
      totalEmployees > 0
        ? Number(
            (
              (historicalExits / totalEmployees) *
              100
            ).toFixed(1),
          )
        : 0;

    /* =====================================================
       DEPARTMENT BREAKDOWN
    ===================================================== */

    const departmentMap = new Map();

    for (const employee of employeeRows) {
      const department =
        String(employee.department || "Unassigned").trim() ||
        "Unassigned";

      if (!departmentMap.has(department)) {
        departmentMap.set(department, {
          department,
          headcount: 0,
          active: 0,
          exited: 0,
        });
      }

      const item = departmentMap.get(department);

      item.headcount += 1;

      if (
        normalizeStatus(
          employee.employment_status,
        ) === "active"
      ) {
        item.active += 1;
      }

      if (
        exitedEmployees.some(
          (exited) => exited.id === employee.id,
        )
      ) {
        item.exited += 1;
      }
    }

    const departments = Array.from(
      departmentMap.values(),
    )
      .map((department) => ({
        ...department,
        attritionRate:
          department.headcount > 0
            ? Number(
                (
                  (department.exited /
                    department.headcount) *
                  100
                ).toFixed(1),
              )
            : 0,
      }))
      .sort(
        (a, b) =>
          b.headcount - a.headcount,
      );

    /* =====================================================
       ATTENDANCE METRICS
    ===================================================== */

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;

    for (const record of attendanceRows) {
      const status = normalizeStatus(
        record.status,
      );

      if (status === "present") {
        presentCount += 1;
      } else if (status === "absent") {
        absentCount += 1;
      } else if (
        status === "on leave" ||
        status === "leave"
      ) {
        leaveCount += 1;
      }
    }

    const attendanceTotal =
      presentCount +
      absentCount +
      leaveCount;

    const attendanceRate =
      attendanceTotal > 0
        ? Number(
            (
              (presentCount /
                attendanceTotal) *
              100
            ).toFixed(1),
          )
        : 0;

    /* =====================================================
       MONTHLY HEADCOUNT
    ===================================================== */

    const monthlyHeadcountMap = new Map();

    for (const employee of employeeRows) {
      const joiningMonth = getMonthKey(
        employee.joining_date ||
          employee.created_at,
      );

      if (joiningMonth) {
        if (
          !monthlyHeadcountMap.has(
            joiningMonth,
          )
        ) {
          monthlyHeadcountMap.set(
            joiningMonth,
            0,
          );
        }

        monthlyHeadcountMap.set(
          joiningMonth,
          monthlyHeadcountMap.get(
            joiningMonth,
          ) + 1,
        );
      }
    }

    const monthlyHeadcount = Array.from(
      monthlyHeadcountMap.entries(),
    )
      .sort(([a], [b]) =>
        a.localeCompare(b),
      )
      .map(([month, joined]) => ({
        month,
        joined,
      }));

    /* =====================================================
       RECENT ATTRITION
    ===================================================== */

    const recentAttrition =
      exitedEmployees
        .filter(
          (employee) =>
            employee.last_working_date,
        )
        .sort(
          (a, b) =>
            new Date(
              b.last_working_date,
            ) -
            new Date(
              a.last_working_date,
            ),
        )
        .slice(0, 20);

    /* =====================================================
       RESPONSE
    ===================================================== */

    return res.status(200).json({
      success: true,

      summary: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        historicalExits,
        attritionRate,
        attendanceRate,
        presentCount,
        absentCount,
        leaveCount,
        departments: departments.length,
      },

      departments,

      monthlyHeadcount,

      recentAttrition,

      attendance: {
        totalRecords: attendanceTotal,
        present: presentCount,
        absent: absentCount,
        onLeave: leaveCount,
        attendanceRate,
      },

      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[WorkforceMetrics] GET failed:",
      error,
    );

    return res.status(
      error?.statusCode || 500,
    ).json({
      success: false,
      message:
        error?.message ||
        "Failed to load workforce metrics.",
    });
  }
});

/* =========================================================
   GET EMPLOYEE WORKFORCE DETAILS

   GET /api/workforce-metrics/employees
========================================================= */

router.get(
  "/employees",
  async (req, res) => {
    try {
      const organizationId =
        getOrganizationId(req);

      if (!organizationId) {
        return res.status(403).json({
          message:
            "Authenticated user is not associated with an organization.",
        });
      }

      const {
        data,
        error,
      } = await supabaseAdmin
        .from("employees")
        .select(
          `
            id,
            full_name,
            email,
            department,
            title,
            employment_status,
            joining_date,
            last_working_date
          `,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .order("full_name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      return res.status(200).json({
        success: true,
        employees: data || [],
      });
    } catch (error) {
      console.error(
        "[WorkforceMetrics] Employee details failed:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to load workforce employees.",
      });
    }
  },
);

export default router;