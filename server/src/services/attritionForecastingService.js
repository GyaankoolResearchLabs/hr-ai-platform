import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   HELPERS
========================================================= */

function createServiceError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeDepartment(value) {
  const department = String(value ?? "").trim();
  return department || "Unassigned";
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

function getMonthStart(date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      1,
    ),
  );
}

function addMonths(date, months) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      1,
    ),
  );
}

function monthsBetween(start, end) {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  );
}

/* =========================================================
   MAIN FORECAST
========================================================= */

export async function getAttritionForecast(
  organizationId,
  forecastMonths = 3,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization ID is required.",
      400,
    );
  }

  const parsedForecastMonths = Number(forecastMonths);

  if (
    !Number.isInteger(parsedForecastMonths) ||
    parsedForecastMonths < 1 ||
    parsedForecastMonths > 12
  ) {
    throw createServiceError(
      "forecastMonths must be an integer between 1 and 12.",
      400,
    );
  }

  /* -------------------------------------------------------
     LOAD ACTUAL EMPLOYEE DATA
  ------------------------------------------------------- */

  const {
    data: employees,
    error,
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
        employee_code,
        joining_date,
        employment_status,
        last_working_date,
        created_at
      `,
    )
    .eq("organization_id", organizationId);

  if (error) {
    console.error(
      "[AttritionForecasting] Employee query failed:",
      error,
    );

    throw createServiceError(
      "Could not load employee data.",
      500,
    );
  }

  const employeeList = employees || [];

  /* -------------------------------------------------------
     BASIC COUNTS
  ------------------------------------------------------- */

  const activeEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "Active",
  );

  const exitedEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "Resigned" ||
      employee.employment_status === "Terminated" ||
      employee.employment_status === "Retired",
  );

  const resignedEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "Resigned",
  );

  const terminatedEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "Terminated",
  );

  const retiredEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "Retired",
  );

  const onLeaveEmployees = employeeList.filter(
    (employee) =>
      employee.employment_status === "On Leave",
  );

  /* -------------------------------------------------------
     ANALYSIS PERIOD
     
     Use the most recent 12 months based on today's date.
  ------------------------------------------------------- */

  const now = new Date();

  const currentMonth = getMonthStart(now);

  const historyStart = addMonths(
    currentMonth,
    -11,
  );

  const forecastStart = addMonths(
    currentMonth,
    1,
  );

  const forecastEnd = addMonths(
    forecastStart,
    parsedForecastMonths,
  );

  /* -------------------------------------------------------
     HISTORICAL EXITS
  ------------------------------------------------------- */

  const historicalExits = exitedEmployees
    .map((employee) => {
      const exitDate = parseDate(
        employee.last_working_date,
      );

      if (!exitDate) {
        return null;
      }

      return {
        ...employee,
        department: normalizeDepartment(
          employee.department,
        ),
        exitDate,
      };
    })
    .filter(Boolean)
    .filter(
      (employee) =>
        employee.exitDate >= historyStart &&
        employee.exitDate < forecastStart,
    );

  /* -------------------------------------------------------
     MONTHLY ATTRITION
  ------------------------------------------------------- */

  const monthlyMap = new Map();

  for (let i = 0; i < 12; i += 1) {
    const monthStart = addMonths(
      historyStart,
      i,
    );

    const key = getMonthKey(monthStart);

    monthlyMap.set(key, {
      month: key,
      exits: 0,
      resigned: 0,
      terminated: 0,
      retired: 0,
    });
  }

  historicalExits.forEach((employee) => {
    const key = getMonthKey(
      getMonthStart(employee.exitDate),
    );

    const month = monthlyMap.get(key);

    if (!month) return;

    month.exits += 1;

    if (
      employee.employment_status === "Resigned"
    ) {
      month.resigned += 1;
    }

    if (
      employee.employment_status === "Terminated"
    ) {
      month.terminated += 1;
    }

    if (
      employee.employment_status === "Retired"
    ) {
      month.retired += 1;
    }
  });

  const monthlyAttrition = Array.from(
    monthlyMap.values(),
  );

  /* -------------------------------------------------------
     HISTORICAL EXIT RATE
  ------------------------------------------------------- */

  const totalEmployees =
    employeeList.length;

  const historicalExitCount =
    historicalExits.length;

  const annualizedAttritionRate =
    totalEmployees > 0
      ? Number(
          (
            (historicalExitCount /
              totalEmployees) *
            100
          ).toFixed(2),
        )
      : 0;

  /* -------------------------------------------------------
     AVERAGE MONTHLY EXITS
  ------------------------------------------------------- */

  const averageMonthlyExits =
    Number(
      (
        historicalExitCount / 12
      ).toFixed(2),
    );

  const projectedExits = Math.max(
    0,
    Math.round(
      averageMonthlyExits *
        parsedForecastMonths,
    ),
  );

  /* -------------------------------------------------------
     DEPARTMENT ANALYSIS
  ------------------------------------------------------- */

  const departmentMap = new Map();

  employeeList.forEach((employee) => {
    const department =
      normalizeDepartment(
        employee.department,
      );

    if (!departmentMap.has(department)) {
      departmentMap.set(department, {
        department,
        totalEmployees: 0,
        activeEmployees: 0,
        exits: 0,
        resigned: 0,
        terminated: 0,
        retired: 0,
      });
    }

    const record =
      departmentMap.get(department);

    record.totalEmployees += 1;

    if (
      employee.employment_status ===
      "Active"
    ) {
      record.activeEmployees += 1;
    }

    if (
      employee.employment_status ===
        "Resigned" ||
      employee.employment_status ===
        "Terminated" ||
      employee.employment_status ===
        "Retired"
    ) {
      const exitDate = parseDate(
        employee.last_working_date,
      );

      if (
        exitDate &&
        exitDate >= historyStart &&
        exitDate < forecastStart
      ) {
        record.exits += 1;

        if (
          employee.employment_status ===
          "Resigned"
        ) {
          record.resigned += 1;
        }

        if (
          employee.employment_status ===
          "Terminated"
        ) {
          record.terminated += 1;
        }

        if (
          employee.employment_status ===
          "Retired"
        ) {
          record.retired += 1;
        }
      }
    }
  });

  const departments = Array.from(
    departmentMap.values(),
  )
    .map((department) => {
      const attritionRate =
        department.totalEmployees > 0
          ? Number(
              (
                (department.exits /
                  department.totalEmployees) *
                100
              ).toFixed(2),
            )
          : 0;

      const monthlyExitRate =
        department.exits / 12;

      const projectedAttrition =
        Math.max(
          0,
          Math.round(
            monthlyExitRate *
              parsedForecastMonths,
          ),
        );

      return {
        ...department,
        attritionRate,
        projectedAttrition,
        projectedHiringNeed:
          projectedAttrition,
      };
    })
    .sort(
      (a, b) =>
        b.projectedHiringNeed -
        a.projectedHiringNeed,
    );

  /* -------------------------------------------------------
     RECENT EXIT TREND
  ------------------------------------------------------- */

  const recentThreeMonthsStart =
    addMonths(currentMonth, -2);

  const recentExits =
    historicalExits.filter(
      (employee) =>
        employee.exitDate >=
        recentThreeMonthsStart,
    );

  const previousThreeMonthsStart =
    addMonths(currentMonth, -5);

  const previousThreeMonthsEnd =
    recentThreeMonthsStart;

  const previousExits =
    historicalExits.filter(
      (employee) =>
        employee.exitDate >=
          previousThreeMonthsStart &&
        employee.exitDate <
          previousThreeMonthsEnd,
    );

  let trend = "stable";

  if (
    recentExits.length >
    previousExits.length
  ) {
    trend = "increasing";
  } else if (
    recentExits.length <
    previousExits.length
  ) {
    trend = "decreasing";
  }

  /* -------------------------------------------------------
     EMPLOYEE EXIT DETAILS
  ------------------------------------------------------- */

  const attritionEmployees =
    historicalExits
      .sort(
        (a, b) =>
          b.exitDate.getTime() -
          a.exitDate.getTime(),
      )
      .map((employee) => ({
        id: employee.id,
        full_name: employee.full_name,
        email: employee.email,
        department: employee.department,
        title: employee.title,
        employment_status:
          employee.employment_status,
        joining_date:
          employee.joining_date,
        last_working_date:
          employee.last_working_date,
      }));

  /* -------------------------------------------------------
     DEMAND FORECAST
  ------------------------------------------------------- */

  const hiringDemand =
    departments.map((department) => ({
      department:
        department.department,
      currentHeadcount:
        department.activeEmployees,
      historicalExits:
        department.exits,
      attritionRate:
        department.attritionRate,
      forecastMonths:
        parsedForecastMonths,
      projectedExits:
        department.projectedAttrition,
      recommendedHiring:
        department.projectedHiringNeed,
    }));

  /* -------------------------------------------------------
     SUMMARY
  ------------------------------------------------------- */

  const forecast = {
    forecastMonths:
      parsedForecastMonths,

    historicalPeriod: {
      start:
        historyStart.toISOString(),
      end:
        forecastStart.toISOString(),
    },

    forecastPeriod: {
      start:
        forecastStart.toISOString(),
      end:
        forecastEnd.toISOString(),
    },

    summary: {
      totalEmployees,
      activeEmployees:
        activeEmployees.length,
      onLeaveEmployees:
        onLeaveEmployees.length,
      exitedEmployees:
        exitedEmployees.length,
      resignedEmployees:
        resignedEmployees.length,
      terminatedEmployees:
        terminatedEmployees.length,
      retiredEmployees:
        retiredEmployees.length,

      historicalExits:
        historicalExitCount,

      annualizedAttritionRate,

      averageMonthlyExits,

      projectedExits,

      projectedHiringNeed:
        projectedExits,

      trend,
    },

    monthlyAttrition,

    departments,

    hiringDemand,

    attritionEmployees,
  };

  return forecast;
}