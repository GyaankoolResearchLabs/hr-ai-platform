import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   PAYROLL RUN SERVICE
========================================================= */

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function money(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function nonNegativeMoney(value) {
  return Math.max(0, money(value));
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
}

function firstExistingValue(employee, fields) {
  for (const field of fields) {
    const value = employee?.[field];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return null;
}

/* =========================================================
   DATE HELPERS
========================================================= */

function normalizePayrollMonth(value) {
  if (!value) {
    throw createServiceError("Payroll month is required.", 400);
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    const monthNumber = Number(month);

    if (monthNumber < 1 || monthNumber > 12) {
      throw createServiceError("Invalid payroll month.", 400);
    }

    return `${year}-${month}-01`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const date = new Date(`${text}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
      throw createServiceError("Invalid payroll month.", 400);
    }

    return text;
  }

  throw createServiceError(
    "Payroll month must be in YYYY-MM format.",
    400,
  );
}

function getMonthDateRange(payrollMonth) {
  const startDate = new Date(`${payrollMonth}T00:00:00Z`);

  if (Number.isNaN(startDate.getTime())) {
    throw createServiceError("Invalid payroll month.", 400);
  }

  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth();

  const lastDay = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  return {
    startDate: `${year}-${String(month + 1).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/* =========================================================
   EMPLOYEE DATA RESOLUTION
========================================================= */

function getEmployeeAnnualSalary(employee) {
  return toNumber(
    firstExistingValue(employee, [
      "salary",
      "annual_salary",
      "current_salary",
      "base_salary",
      "annualSalary",
      "currentSalary",
      "baseSalary",
      "ctc",
      "annual_ctc",
      "annualCTC",
      "total_compensation",
      "totalCompensation",
      "compensation",
    ]),
    0,
  );
}

function getMonthlySalary(employee) {
  const annualSalary = getEmployeeAnnualSalary(employee);

  if (annualSalary > 0) {
    return money(annualSalary / 12);
  }

  return 0;
}

function getEmployeeJobFamily(employee) {
  return cleanText(
    firstExistingValue(employee, [
      "job_family",
      "jobFamily",
      "job_family_name",
      "department",
      "department_name",
      "team",
      "function",
      "business_unit",
    ]),
  );
}

function getEmployeeLevel(employee) {
  return cleanText(
    firstExistingValue(employee, [
      "level",
      "job_level",
      "jobLevel",
      "job_title",
      "jobTitle",
      "title",
      "designation",
      "seniority",
      "grade",
      "job_grade",
      "designation_level",
    ]),
  );
}

function getEmploymentStatus(employee) {
  return cleanText(
    firstExistingValue(employee, [
      "employment_status",
      "employmentStatus",
      "status",
    ]),
  );
}

/* =========================================================
   PAY BAND LOOKUP
========================================================= */

async function getPayBandSalary(organizationId, employee) {
  const jobFamily = getEmployeeJobFamily(employee);
  const level = getEmployeeLevel(employee);

  if (!jobFamily || !level) {
    console.warn(
      "[Payroll] Missing job family or level:",
      {
        employeeId: employee?.id,
        jobFamily,
        level,
      },
    );

    return 0;
  }

  console.log("[Payroll] Looking up pay band:", {
    employeeId: employee?.id,
    jobFamily,
    level,
  });

  const { data, error } = await supabaseAdmin
    .from("pay_bands")
    .select(
      "id, job_family, level, currency, minimum, midpoint, maximum, status",
    )
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .ilike("job_family", jobFamily)
    .ilike("level", level)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      "[Payroll] Pay band lookup failed:",
      error.message,
    );

    return 0;
  }

  console.log("[Payroll] Pay band result:", {
    employeeId: employee?.id,
    jobFamily,
    level,
    payBand: data,
  });

  return money(data?.midpoint || 0);
}

/* =========================================================
   ATTENDANCE
========================================================= */

function getDefaultWorkingDays() {
  return [
    1,
    2,
    3,
    4,
    5,
  ];
}

function normalizeWorkingDays(workingDays) {
  if (!Array.isArray(workingDays) || workingDays.length === 0) {
    return getDefaultWorkingDays();
  }

  const dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const normalized = workingDays
    .map((day) => {
      if (typeof day === "number") {
        return day >= 0 && day <= 6 ? day : null;
      }

      const key = String(day || "")
        .trim()
        .toLowerCase();

      return Object.prototype.hasOwnProperty.call(dayMap, key)
        ? dayMap[key]
        : null;
    })
    .filter((day) => day !== null);

  return normalized.length > 0
    ? [...new Set(normalized)]
    : getDefaultWorkingDays();
}

function calculateWorkingDays(
  year,
  month,
  workingDays = getDefaultWorkingDays(),
  holidayDates = new Set(),
) {
  const days = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  const scheduledWeekdays = new Set(
    normalizeWorkingDays(workingDays),
  );

  let workingDaysCount = 0;

  for (let day = 1; day <= days; day++) {
    const date = new Date(
      Date.UTC(year, month, day),
    );

    const weekday = date.getUTCDay();

    if (!scheduledWeekdays.has(weekday)) {
      continue;
    }

    const dateKey =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (holidayDates.has(dateKey)) {
      continue;
    }

    workingDaysCount++;
  }

  return workingDaysCount;
}

async function getPayrollCalendarContext(
  organizationId,
  employeeIds,
  payrollMonth,
) {
  const { startDate, endDate } =
    getMonthDateRange(payrollMonth);

  const [assignmentsResult, holidaysResult] =
    await Promise.all([
      supabaseAdmin
        .from("employee_shift_assignments")
        .select(`
          employee_id,
          created_at,
          organization_shifts (
            id,
            location_id,
            working_days
          )
        `)
        .eq("organization_id", organizationId)
        .in("employee_id", employeeIds)
        .order("created_at", {
          ascending: false,
        }),

      supabaseAdmin
        .from("organization_holidays")
        .select("holiday_date, location_id, holiday_type")
        .eq("organization_id", organizationId)
        .gte("holiday_date", startDate)
        .lte("holiday_date", endDate),
    ]);

  if (assignmentsResult.error) {
    throw assignmentsResult.error;
  }

  if (holidaysResult.error) {
    throw holidaysResult.error;
  }

  const assignmentsByEmployee = new Map();

  for (const assignment of Array.isArray(assignmentsResult.data)
    ? assignmentsResult.data
    : []) {
    const employeeId = assignment?.employee_id;

    if (!employeeId || assignmentsByEmployee.has(employeeId)) {
      continue;
    }

    const shift = assignment?.organization_shifts;

    assignmentsByEmployee.set(employeeId, {
      locationId: shift?.location_id || null,
      workingDays: normalizeWorkingDays(shift?.working_days),
      shiftId: shift?.id || null,
    });
  }

  const holidays = Array.isArray(holidaysResult.data)
    ? holidaysResult.data
    : [];

  return {
    assignmentsByEmployee,
    holidays,
  };
}

function getEmployeeHolidayDates(
  calendarContext,
  employeeId,
) {
  const assignment =
    calendarContext?.assignmentsByEmployee?.get(employeeId);

  if (!assignment?.locationId) {
    return new Set();
  }

  return new Set(
    (calendarContext?.holidays || [])
      .filter(
        (holiday) =>
          String(holiday?.location_id || "") ===
          String(assignment.locationId),
      )
      .map((holiday) =>
        String(holiday?.holiday_date || "").trim(),
      )
      .filter(Boolean),
  );
}

/*
 * Attendance rules:
 *
 * Present       -> Paid
 * Worked        -> Paid
 * Approved      -> Paid
 * On Leave      -> Paid
 * Holiday       -> Paid
 * Work From Home-> Paid
 * Half Day      -> 0.5 paid day
 * Absent        -> Unpaid
 * Unmarked      -> Paid by default
 *
 * Unmarked days are treated as paid because missing
 * attendance should not accidentally make an employee's
 * entire monthly salary zero.
 */
async function getAttendanceSummary(
  organizationId,
  employeeId,
  payrollMonth,
  calendarContext = null,
) {
  const { startDate, endDate } =
    getMonthDateRange(payrollMonth);

  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .select("attendance_date, status")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate);

  if (error) {
    throw error;
  }

  const records = Array.isArray(data) ? data : [];

  const attendanceByDate = new Map();

  for (const record of records) {
    const date = String(
      record?.attendance_date || "",
    ).trim();

    if (!date) {
      continue;
    }

    attendanceByDate.set(date, record);
  }

  const payrollDate = new Date(
    `${payrollMonth}T00:00:00Z`,
  );

  if (Number.isNaN(payrollDate.getTime())) {
    throw createServiceError(
      "Invalid payroll month.",
      400,
    );
  }

  const year = payrollDate.getUTCFullYear();
  const month = payrollDate.getUTCMonth();

  const lastDay = new Date(
    Date.UTC(year, month + 1, 0),
  ).getUTCDate();

  let present = 0;
  let absent = 0;
  let onLeave = 0;
  let halfDay = 0;
  let holiday = 0;
  let workFromHome = 0;
  let unmarked = 0;

  const assignment =
    calendarContext?.assignmentsByEmployee?.get(employeeId);

  const scheduledWeekdays = new Set(
    normalizeWorkingDays(
      assignment?.workingDays,
    ),
  );

  const holidayDates = getEmployeeHolidayDates(
    calendarContext,
    employeeId,
  );

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(
      Date.UTC(year, month, day),
    );

    const weekday = date.getUTCDay();

    if (!scheduledWeekdays.has(weekday)) {
      continue;
    }

    const dateKey =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    // Company holidays are outside the scheduled working-day denominator.
    if (holidayDates.has(dateKey)) {
      holiday++;
      continue;
    }

    const record = attendanceByDate.get(dateKey);

    /*
     * No attendance record:
     *
     * Assume the employee worked the scheduled day.
     * This prevents missing attendance from becoming
     * accidental unpaid leave.
     */
    if (!record) {
      unmarked++;
      continue;
    }

    const status = String(
      record?.status || "",
    )
      .trim()
      .toLowerCase();

    if (
      status === "present" ||
      status === "worked" ||
      status === "approved"
    ) {
      present++;
    } else if (
      status === "absent"
    ) {
      absent++;
    } else if (
      status === "leave" ||
      status === "on_leave" ||
      status === "on leave"
    ) {
      onLeave++;
    } else if (
      status === "half_day" ||
      status === "half-day" ||
      status === "half day"
    ) {
      halfDay++;
    } else if (
      status === "holiday"
    ) {
      holiday++;
    } else if (
      status === "work from home" ||
      status === "work_from_home" ||
      status === "wfh"
    ) {
      workFromHome++;
    } else {
      /*
       * Unknown status:
       * treat it as unmarked rather than unpaid.
       */
      unmarked++;
    }
  }

  return {
    records,
    present,
    absent,
    onLeave,
    halfDay,
    holiday,
    workFromHome,
    unmarked,
  };
}

/* =========================================================
   EMPLOYEE PAYROLL CALCULATION
========================================================= */

export async function calculateEmployeePayroll({
  organizationId,
  employee,
  payrollMonth,
  overrides = {},
  calendarContext = null,
}) {
  const employeeId = employee?.id;

  if (!employeeId) {
    throw createServiceError(
      "Employee ID is missing.",
      400,
    );
  }

  let monthlySalary =
    getMonthlySalary(employee);

  /*
   * If employee salary is not available,
   * use the matching active pay-band midpoint.
   */
  if (monthlySalary <= 0) {
    const annualPayBandSalary =
      await getPayBandSalary(
        organizationId,
        employee,
      );

    if (annualPayBandSalary > 0) {
      monthlySalary =
        annualPayBandSalary / 12;
    }
  }

  monthlySalary =
    nonNegativeMoney(monthlySalary);

  const attendance =
    await getAttendanceSummary(
      organizationId,
      employeeId,
      payrollMonth,
      calendarContext,
    );

  const payrollDate = new Date(
    `${payrollMonth}T00:00:00Z`,
  );

  const year =
    payrollDate.getUTCFullYear();

  const month =
    payrollDate.getUTCMonth();

  const employeeCalendar =
    calendarContext?.assignmentsByEmployee?.get(
      employeeId,
    );

  const employeeWorkingDays =
    normalizeWorkingDays(
      employeeCalendar?.workingDays,
    );

  const employeeHolidayDates =
    getEmployeeHolidayDates(
      calendarContext,
      employeeId,
    );

  const defaultWorkingDays =
    calculateWorkingDays(
      year,
      month,
      employeeWorkingDays,
      employeeHolidayDates,
    );

  const workingDays = Math.max(
    0,
    toNumber(
      overrides.working_days,
      defaultWorkingDays,
    ),
  );

  /*
   * IMPORTANT:
   *
   * Missing attendance records are NOT unpaid.
   *
   * Only explicit Absent and Half Day statuses
   * reduce paid days.
   *
   * Holiday, WFH, Present and On Leave are paid.
   */
  let paidDays = Math.min(
    workingDays,
    Math.max(
      0,
      workingDays -
        attendance.absent -
        attendance.halfDay * 0.5,
    ),
  );

  if (
    overrides.paid_days !== undefined
  ) {
    paidDays = Math.min(
      workingDays,
      Math.max(
        0,
        toNumber(
          overrides.paid_days,
        ),
      ),
    );
  }

  const unpaidDays = Math.max(
    0,
    toNumber(
      overrides.unpaid_days,
      workingDays - paidDays,
    ),
  );

  const overtimeHours = Math.max(
    0,
    toNumber(
      overrides.overtime_hours,
      0,
    ),
  );

  const dailyRate =
    workingDays > 0
      ? monthlySalary / workingDays
      : 0;

  const proratedBaseSalary =
    money(
      dailyRate * paidDays,
    );

  const allowances =
    nonNegativeMoney(
      overrides.allowances ??
        employee?.allowances ??
        employee?.fixed_allowances ??
        employee?.monthly_allowances ??
        0,
    );

  const overtimeHourlyRate =
    monthlySalary / 26 / 8;

  const overtimeMultiplier =
    Math.max(
      0,
      toNumber(
        overrides.overtime_multiplier,
        1.5,
      ),
    );

  const overtimePay =
    money(
      overtimeHours *
        overtimeHourlyRate *
        overtimeMultiplier,
    );

  const bonus =
    nonNegativeMoney(
      overrides.bonus ??
        employee?.bonus ??
        0,
    );

  const reimbursements =
    nonNegativeMoney(
      overrides.reimbursements ??
        employee?.reimbursements ??
        0,
    );

  const grossPay =
    money(
      proratedBaseSalary +
        allowances +
        overtimePay +
        bonus,
    );

  const fixedDeductions =
    nonNegativeMoney(
      overrides.fixed_deductions ??
        employee?.fixed_deductions ??
        employee?.deductions ??
        0,
    );

  const statutoryDeductions =
    nonNegativeMoney(
      overrides.statutory_deductions ??
        0,
    );

  const otherDeductions =
    nonNegativeMoney(
      overrides.other_deductions ??
        0,
    );

  const totalDeductions =
    money(
      fixedDeductions +
        statutoryDeductions +
        otherDeductions,
    );

  const netPay =
    money(
      Math.max(
        0,
        grossPay -
          totalDeductions +
          reimbursements,
      ),
    );

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validationMessages = [];

  if (monthlySalary <= 0) {
    validationMessages.push(
      "No salary or active pay-band midpoint was found for this employee.",
    );
  }

  if (workingDays <= 0) {
    validationMessages.push(
      "Working days are zero.",
    );
  }

  if (paidDays > workingDays) {
    validationMessages.push(
      "Paid days exceed working days.",
    );
  }

  if (unpaidDays > workingDays) {
    validationMessages.push(
      "Unpaid days exceed working days.",
    );
  }

  const hasSalaryError =
    validationMessages.some(
      (message) =>
        message.includes("No salary"),
    );

  const validationStatus =
    hasSalaryError
      ? "error"
      : validationMessages.length
        ? "warning"
        : "valid";

  return {
    employee_id: employeeId,

    employee_name: cleanText(
      employee?.full_name ??
        employee?.name,
    ),

    employee_code: cleanText(
      employee?.employee_code ??
        employee?.employeeCode,
    ),

    department: cleanText(
      employee?.department,
    ),

    job_title: cleanText(
      employee?.title ??
        employee?.designation ??
        employee?.job_title,
    ),

    working_days:
      money(workingDays),

    paid_days:
      money(paidDays),

    unpaid_days:
      money(unpaidDays),

    overtime_hours:
      money(overtimeHours),

    base_salary:
      proratedBaseSalary,

    allowances,

    overtime_pay:
      overtimePay,

    bonus,

    reimbursements,

    gross_pay:
      grossPay,

    fixed_deductions:
      fixedDeductions,

    statutory_deductions:
      statutoryDeductions,

    other_deductions:
      otherDeductions,

    total_deductions:
      totalDeductions,

    net_pay:
      netPay,

    validation_status:
      validationStatus,

    validation_messages:
      validationMessages,
  };
}
/* =========================================================
   EMPLOYEES
========================================================= */

async function getOrganizationEmployees(
  organizationId,
) {
  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

/* =========================================================
   RUN TOTALS
========================================================= */

function calculateRunTotals(items) {
  let grossPay = 0;
  let totalDeductions = 0;
  let totalReimbursements = 0;
  let netPay = 0;

  for (const item of items) {
    grossPay +=
      toNumber(item.gross_pay);

    totalDeductions +=
      toNumber(
        item.total_deductions,
      );

    totalReimbursements +=
      toNumber(
        item.reimbursements,
      );

    netPay +=
      toNumber(item.net_pay);
  }

  return {
    grossPay:
      money(grossPay),

    totalDeductions:
      money(totalDeductions),

    totalReimbursements:
      money(totalReimbursements),

    netPay:
      money(netPay),
  };
}

/* =========================================================
   CREATE PAYROLL RUN
========================================================= */

export async function createPayrollRun({
  organizationId,
  userId,
  payrollMonth,
  notes = null,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const normalizedMonth =
    normalizePayrollMonth(
      payrollMonth,
    );

  const {
    data: existingRun,
    error: existingError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("id, status")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_month",
        normalizedMonth,
      )
      .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingRun) {
    throw createServiceError(
      `A payroll run already exists for ${normalizedMonth.slice(0, 7)}.`,
      409,
    );
  }

  const employees =
    await getOrganizationEmployees(
      organizationId,
    );

  const activeEmployees =
    employees.filter(
      (employee) => {
        const status =
          getEmploymentStatus(
            employee,
          );

        return (
          !status ||
          status.toLowerCase() ===
            "active"
        );
      },
    );

  if (activeEmployees.length === 0) {
    throw createServiceError(
      "No active employees were found for this organization.",
      400,
    );
  }

  const calendarContext =
    await getPayrollCalendarContext(
      organizationId,
      activeEmployees.map(
        (employee) =>
          employee.id,
      ),
      normalizedMonth,
    );

  const {
    data: run,
    error: runError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .insert({
        organization_id:
          organizationId,

        payroll_month:
          normalizedMonth,

        status:
          "draft",

        employee_count:
          0,

        gross_pay:
          0,

        total_deductions:
          0,

        total_reimbursements:
          0,

        net_pay:
          0,

        notes:
          cleanText(notes),

        created_by:
          userId || null,
      })
      .select("*")
      .single();

  if (runError) {
    throw runError;
  }

  try {
    const calculatedItems = [];

    for (
      const employee of activeEmployees
    ) {
      const item =
        await calculateEmployeePayroll({
          organizationId,

          employee,

          payrollMonth:
            normalizedMonth,

          calendarContext,
        });

      calculatedItems.push(item);
    }

    const rows =
      calculatedItems.map(
        (item) => ({
          payroll_run_id:
            run.id,

          organization_id:
            organizationId,

          employee_id:
            item.employee_id,

          working_days:
            item.working_days,

          paid_days:
            item.paid_days,

          unpaid_days:
            item.unpaid_days,

          overtime_hours:
            item.overtime_hours,

          base_salary:
            item.base_salary,

          allowances:
            item.allowances,

          overtime_pay:
            item.overtime_pay,

          bonus:
            item.bonus,

          reimbursements:
            item.reimbursements,

          gross_pay:
            item.gross_pay,

          fixed_deductions:
            item.fixed_deductions,

          statutory_deductions:
            item.statutory_deductions,

          other_deductions:
            item.other_deductions,

          total_deductions:
            item.total_deductions,

          net_pay:
            item.net_pay,

          validation_status:
            item.validation_status,

          validation_messages:
            item.validation_messages,
        }),
      );

    if (rows.length > 0) {
      const {
        error: itemsError,
      } =
        await supabaseAdmin
          .from(
            "payroll_run_items",
          )
          .insert(rows);

      if (itemsError) {
        throw itemsError;
      }
    }

    const totals =
      calculateRunTotals(
        calculatedItems,
      );

    const {
      data: updatedRun,
      error: updateError,
    } =
      await supabaseAdmin
        .from("payroll_runs")
        .update({
          employee_count:
            calculatedItems.length,

          gross_pay:
            totals.grossPay,

          total_deductions:
            totals.totalDeductions,

          total_reimbursements:
            totals.totalReimbursements,

          net_pay:
            totals.netPay,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          run.id,
        )
        .eq(
          "organization_id",
          organizationId,
        )
        .select("*")
        .single();

    if (updateError) {
      throw updateError;
    }

    return {
      ...updatedRun,

      items:
        calculatedItems,
    };
  } catch (error) {
    await supabaseAdmin
      .from("payroll_runs")
      .delete()
      .eq(
        "id",
        run.id,
      )
      .eq(
        "organization_id",
        organizationId,
      );

    throw error;
  }
}

/* =========================================================
   GET ALL PAYROLL RUNS
========================================================= */

export async function getPayrollRuns(
  organizationId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order(
        "payroll_month",
        {
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return Array.isArray(data)
    ? data
    : [];
}

/* =========================================================
   GET SINGLE PAYROLL RUN
========================================================= */

export async function getPayrollRun(
  organizationId,
  runId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: run,
    error: runError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (runError) {
    throw runError;
  }

  if (!run) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  const {
    data: items,
    error: itemsError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          title,
          employee_code,
          employment_status
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (itemsError) {
    throw itemsError;
  }

  return {
    ...run,

    items:
      Array.isArray(items)
        ? items
        : [],
  };
}

/* =========================================================
   REFRESH RUN TOTALS
========================================================= */

async function refreshPayrollRunTotals(
  organizationId,
  runId,
) {
  const {
    data: items,
    error,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(
        "gross_pay, total_deductions, reimbursements, net_pay",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      );

  if (error) {
    throw error;
  }

  const totals =
    calculateRunTotals(
      items || [],
    );

  const {
    error: updateError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update({
        employee_count:
          Array.isArray(items)
            ? items.length
            : 0,

        gross_pay:
          totals.grossPay,

        total_deductions:
          totals.totalDeductions,

        total_reimbursements:
          totals.totalReimbursements,

        net_pay:
          totals.netPay,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      );

  if (updateError) {
    throw updateError;
  }
}

/* =========================================================
   UPDATE PAYROLL ITEM
========================================================= */

export async function updatePayrollItem({
  organizationId,
  runId,
  itemId,
  updates = {},
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Payroll item ID is required.",
      400,
    );
  }

  const {
    data: run,
    error: runError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("id, status")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (runError) {
    throw runError;
  }

  if (!run) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    run.status !== "draft" &&
    run.status !== "review"
  ) {
    throw createServiceError(
      "Only draft or review payroll runs can be edited.",
      409,
    );
  }

  const allowedFields = [
    "working_days",
    "paid_days",
    "unpaid_days",
    "overtime_hours",
    "allowances",
    "overtime_pay",
    "bonus",
    "reimbursements",
    "fixed_deductions",
    "statutory_deductions",
    "other_deductions",
  ];

  const patch = {};

  for (
    const field of allowedFields
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        updates,
        field,
      )
    ) {
      patch[field] =
        nonNegativeMoney(
          updates[field],
        );
    }
  }

  if (
    Object.keys(patch).length === 0
  ) {
    throw createServiceError(
      "No valid payroll fields were supplied.",
      400,
    );
  }

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .eq(
        "id",
        itemId,
      )
      .maybeSingle();

  if (itemError) {
    throw itemError;
  }

  if (!item) {
    throw createServiceError(
      "Payroll item not found.",
      404,
    );
  }

  const merged = {
    ...item,
    ...patch,
  };

  const grossPay =
    money(
      toNumber(
        merged.base_salary,
      ) +
        toNumber(
          merged.allowances,
        ) +
        toNumber(
          merged.overtime_pay,
        ) +
        toNumber(
          merged.bonus,
        ),
    );

  const totalDeductions =
    money(
      toNumber(
        merged.fixed_deductions,
      ) +
        toNumber(
          merged.statutory_deductions,
      ) +
        toNumber(
          merged.other_deductions,
        ),
    );

  const netPay =
    money(
      Math.max(
        0,
        grossPay -
          totalDeductions +
          toNumber(
            merged.reimbursements,
          ),
      ),
    );

  patch.gross_pay =
    grossPay;

  patch.total_deductions =
    totalDeductions;

  patch.net_pay =
    netPay;

  patch.updated_at =
    new Date().toISOString();

  const {
    data: updatedItem,
    error: updateError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .update(patch)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .eq(
        "id",
        itemId,
      )
      .select("*")
      .single();

  if (updateError) {
    throw updateError;
  }

  await refreshPayrollRunTotals(
    organizationId,
    runId,
  );

  return updatedItem;
}
/* =========================================================
   SUBMIT FOR REVIEW
========================================================= */

export async function submitPayrollForReview(
  organizationId,
  runId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status !==
    "draft"
  ) {
    throw createServiceError(
      "Only draft payroll runs can be submitted for review.",
      409,
    );
  }

  const validation =
    await validatePayrollRun(
      organizationId,
      runId,
    );

  if (!validation.valid) {
    throw createServiceError(
      "Payroll contains validation errors and cannot be submitted for review.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update({
        status: "review",
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   APPROVE PAYROLL
========================================================= */

export async function approvePayroll(
  organizationId,
  runId,
  userId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  if (!userId) {
    throw createServiceError(
      "Approving user is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status !==
    "review"
  ) {
    throw createServiceError(
      "Only payroll runs under review can be approved.",
      409,
    );
  }

  const validation =
    await validatePayrollRun(
      organizationId,
      runId,
    );

  if (!validation.valid) {
    throw createServiceError(
      "Payroll contains validation errors and cannot be approved.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update({
        status: "approved",

        approved_by:
          userId,

        approved_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   PROCESS PAYROLL
========================================================= */

export async function processPayroll(
  organizationId,
  runId,
  userId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  if (!userId) {
    throw createServiceError(
      "Processing user is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status !==
    "approved"
  ) {
    throw createServiceError(
      "Only approved payroll runs can be processed.",
      409,
    );
  }

  const validation =
    await validatePayrollRun(
      organizationId,
      runId,
    );

  if (!validation.valid) {
    throw createServiceError(
      "Payroll contains validation errors and cannot be processed.",
      409,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update({
        status: "processed",

        processed_by:
          userId,

        processed_at:
          new Date().toISOString(),

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   DELETE PAYROLL RUN
========================================================= */

export async function deletePayrollRun({
  organizationId,
  runId,
}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status ===
    "processed"
  ) {
    throw createServiceError(
      "Processed payroll cannot be deleted.",
      409,
    );
  }

  const {
    error: deleteError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      );

  if (deleteError) {
    throw deleteError;
  }

  return {
    success: true,
    id: runId,
  };
}

/* =========================================================
   GET PAYROLL ITEM
========================================================= */

export async function getPayrollItem(
  organizationId,
  runId,
  itemId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Payroll item ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          title,
          employee_code,
          employment_status
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .eq(
        "id",
        itemId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Payroll item not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   VALIDATE PAYROLL RUN
========================================================= */

export async function validatePayrollRun(
  organizationId,
  runId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  const {
    data: items,
    error: itemsError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(`
        id,
        employee_id,
        working_days,
        paid_days,
        unpaid_days,
        gross_pay,
        total_deductions,
        net_pay,
        validation_status,
        validation_messages
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      );

  if (itemsError) {
    throw itemsError;
  }

  const rows =
    Array.isArray(items)
      ? items
      : [];

  const errors = [];
  const warnings = [];

  for (const item of rows) {
    const messages =
      Array.isArray(
        item.validation_messages,
      )
        ? item.validation_messages
        : [];

    if (
      item.validation_status ===
      "error"
    ) {
      errors.push({
        ...item,
        messages,
      });
    } else if (
      item.validation_status ===
      "warning"
    ) {
      warnings.push({
        ...item,
        messages,
      });
    }

    if (
      toNumber(
        item.paid_days,
      ) >
      toNumber(
        item.working_days,
      )
    ) {
      errors.push({
        ...item,
        messages: [
          ...messages,
          "Paid days exceed working days.",
        ],
      });
    }

    if (
      toNumber(
        item.unpaid_days,
      ) >
      toNumber(
        item.working_days,
      )
    ) {
      errors.push({
        ...item,
        messages: [
          ...messages,
          "Unpaid days exceed working days.",
        ],
      });
    }

    if (
      toNumber(
        item.net_pay,
      ) < 0
    ) {
      errors.push({
        ...item,
        messages: [
          ...messages,
          "Net pay cannot be negative.",
        ],
      });
    }
  }

  return {
    valid:
      errors.length === 0,

    employee_count:
      rows.length,

    error_count:
      errors.length,

    warning_count:
      warnings.length,

    errors,

    warnings,
  };
}

/* =========================================================
   RECALCULATE PAYROLL ITEM
========================================================= */

export async function recalculatePayrollItem(
  organizationId,
  runId,
  itemId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  if (!itemId) {
    throw createServiceError(
      "Payroll item ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, status, payroll_month",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status ===
      "approved" ||
    payroll.status ===
      "processed"
  ) {
    throw createServiceError(
      "Approved or processed payroll cannot be recalculated.",
      409,
    );
  }

  const {
    data: item,
    error: itemError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(
        "employee_id",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .eq(
        "id",
        itemId,
      )
      .maybeSingle();

  if (itemError) {
    throw itemError;
  }

  if (!item) {
    throw createServiceError(
      "Payroll item not found.",
      404,
    );
  }

  const {
    data: employee,
    error: employeeError,
  } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        item.employee_id,
      )
      .maybeSingle();

  if (employeeError) {
    throw employeeError;
  }

  if (!employee) {
    throw createServiceError(
      "Employee not found.",
      404,
    );
  }

  const calendarContext =
    await getPayrollCalendarContext(
      organizationId,
      [employee.id],
      payroll.payroll_month,
    );

  const calculated =
    await calculateEmployeePayroll({
      organizationId,
      employee,
      payrollMonth:
        payroll.payroll_month,
      calendarContext,
    });

  const {
    data: updatedItem,
    error: updateError,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .update({
        working_days:
          calculated.working_days,

        paid_days:
          calculated.paid_days,

        unpaid_days:
          calculated.unpaid_days,

        overtime_hours:
          calculated.overtime_hours,

        base_salary:
          calculated.base_salary,

        allowances:
          calculated.allowances,

        overtime_pay:
          calculated.overtime_pay,

        bonus:
          calculated.bonus,

        reimbursements:
          calculated.reimbursements,

        gross_pay:
          calculated.gross_pay,

        fixed_deductions:
          calculated.fixed_deductions,

        statutory_deductions:
          calculated.statutory_deductions,

        other_deductions:
          calculated.other_deductions,

        total_deductions:
          calculated.total_deductions,

        net_pay:
          calculated.net_pay,

        validation_status:
          calculated.validation_status,

        validation_messages:
          calculated.validation_messages,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      )
      .eq(
        "id",
        itemId,
      )
      .select(`
        *,
        employees (
          id,
          full_name,
          email,
          department,
          title,
          employee_code,
          employment_status
        )
      `)
      .single();

  if (updateError) {
    throw updateError;
  }

  await refreshPayrollRunTotals(
    organizationId,
    runId,
  );

  return updatedItem;
}

/* =========================================================
   RETURN PAYROLL TO DRAFT
========================================================= */

export async function returnPayrollToDraft(
  organizationId,
  runId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status !==
      "review" &&
    payroll.status !==
      "approved"
  ) {
    throw createServiceError(
      "Only review or approved payroll can be returned to draft.",
      409,
    );
  }

  const updateData = {
    status: "draft",
    updated_at:
      new Date().toISOString(),
  };

  if (
    payroll.status ===
    "approved"
  ) {
    updateData.approved_by =
      null;

    updateData.approved_at =
      null;
  }

  const {
    data,
    error: updateError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update(updateData)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (updateError) {
    throw updateError;
  }

  return data;
}
/* =========================================================
   UPDATE PAYROLL RUN
========================================================= */

export async function updatePayrollRun(
  organizationId,
  runId,
  updates = {},
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: payroll,
    error: payrollError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select(
        "id, status",
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (payrollError) {
    throw payrollError;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    payroll.status ===
    "processed"
  ) {
    throw createServiceError(
      "Processed payroll cannot be edited.",
      409,
    );
  }

  const updateData = {};

  if (
    Object.prototype.hasOwnProperty.call(
      updates,
      "notes",
    )
  ) {
    updateData.notes =
      cleanText(
        updates.notes,
      );
  }

  if (
    Object.keys(updateData).length ===
    0
  ) {
    throw createServiceError(
      "No valid payroll run fields were supplied.",
      400,
    );
  }

  updateData.updated_at =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update(updateData)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   GET PAYROLL SUMMARY
========================================================= */

export async function getPayrollSummary(
  organizationId,
  runId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!runId) {
    throw createServiceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const {
    data: items,
    error,
  } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select(`
        employee_id,
        working_days,
        paid_days,
        unpaid_days,
        overtime_hours,
        base_salary,
        allowances,
        overtime_pay,
        bonus,
        reimbursements,
        gross_pay,
        fixed_deductions,
        statutory_deductions,
        other_deductions,
        total_deductions,
        net_pay,
        validation_status
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        runId,
      );

  if (error) {
    throw error;
  }

  const rows =
    Array.isArray(items)
      ? items
      : [];

  let totalWorkingDays = 0;
  let totalPaidDays = 0;
  let totalUnpaidDays = 0;
  let totalOvertimeHours = 0;
  let totalBaseSalary = 0;
  let totalAllowances = 0;
  let totalOvertimePay = 0;
  let totalBonus = 0;
  let totalReimbursements = 0;
  let totalGrossPay = 0;
  let totalFixedDeductions = 0;
  let totalStatutoryDeductions = 0;
  let totalOtherDeductions = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;

  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (
    const item of rows
  ) {
    totalWorkingDays +=
      toNumber(
        item.working_days,
      );

    totalPaidDays +=
      toNumber(
        item.paid_days,
      );

    totalUnpaidDays +=
      toNumber(
        item.unpaid_days,
      );

    totalOvertimeHours +=
      toNumber(
        item.overtime_hours,
      );

    totalBaseSalary +=
      toNumber(
        item.base_salary,
      );

    totalAllowances +=
      toNumber(
        item.allowances,
      );

    totalOvertimePay +=
      toNumber(
        item.overtime_pay,
      );

    totalBonus +=
      toNumber(
        item.bonus,
      );

    totalReimbursements +=
      toNumber(
        item.reimbursements,
      );

    totalGrossPay +=
      toNumber(
        item.gross_pay,
      );

    totalFixedDeductions +=
      toNumber(
        item.fixed_deductions,
      );

    totalStatutoryDeductions +=
      toNumber(
        item.statutory_deductions,
      );

    totalOtherDeductions +=
      toNumber(
        item.other_deductions,
      );

    totalDeductions +=
      toNumber(
        item.total_deductions,
      );

    totalNetPay +=
      toNumber(
        item.net_pay,
      );

    if (
      item.validation_status ===
      "error"
    ) {
      errorCount++;
    } else if (
      item.validation_status ===
      "warning"
    ) {
      warningCount++;
    } else {
      validCount++;
    }
  }

  return {
    employee_count:
      rows.length,

    total_working_days:
      money(totalWorkingDays),

    total_paid_days:
      money(totalPaidDays),

    total_unpaid_days:
      money(totalUnpaidDays),

    total_overtime_hours:
      money(totalOvertimeHours),

    total_base_salary:
      money(totalBaseSalary),

    total_allowances:
      money(totalAllowances),

    total_overtime_pay:
      money(totalOvertimePay),

    total_bonus:
      money(totalBonus),

    total_reimbursements:
      money(totalReimbursements),

    total_gross_pay:
      money(totalGrossPay),

    total_fixed_deductions:
      money(totalFixedDeductions),

    total_statutory_deductions:
      money(
        totalStatutoryDeductions,
      ),

    total_other_deductions:
      money(
        totalOtherDeductions,
      ),

    total_deductions:
      money(totalDeductions),

    total_net_pay:
      money(totalNetPay),

    validation: {
      valid:
        validCount,

      warning:
        warningCount,

      error:
        errorCount,
    },
  };
}

/* =========================================================
   EXPORT PAYROLL DATA
========================================================= */

export async function exportPayrollData(
  organizationId,
  runId,
) {
  const payroll =
    await getPayrollRun(
      organizationId,
      runId,
    );

  return {
    payroll_run: {
      id:
        payroll.id,

      organization_id:
        payroll.organization_id,

      payroll_month:
        payroll.payroll_month,

      status:
        payroll.status,

      employee_count:
        payroll.employee_count,

      gross_pay:
        payroll.gross_pay,

      total_deductions:
        payroll.total_deductions,

      total_reimbursements:
        payroll.total_reimbursements,

      net_pay:
        payroll.net_pay,

      notes:
        payroll.notes,
    },

    employees:
      payroll.items.map(
        (item) => ({
          employee_id:
            item.employee_id,

          employee_name:
            item.employees?.full_name ||
            item.employee_name ||
            null,

          employee_code:
            item.employees?.employee_code ||
            null,

          department:
            item.employees?.department ||
            null,

          working_days:
            item.working_days,

          paid_days:
            item.paid_days,

          unpaid_days:
            item.unpaid_days,

          overtime_hours:
            item.overtime_hours,

          base_salary:
            item.base_salary,

          allowances:
            item.allowances,

          overtime_pay:
            item.overtime_pay,

          bonus:
            item.bonus,

          reimbursements:
            item.reimbursements,

          gross_pay:
            item.gross_pay,

          fixed_deductions:
            item.fixed_deductions,

          statutory_deductions:
            item.statutory_deductions,

          other_deductions:
            item.other_deductions,

          total_deductions:
            item.total_deductions,

          net_pay:
            item.net_pay,

          validation_status:
            item.validation_status,

          validation_messages:
            item.validation_messages,
        }),
      ),
  };
}

/* =========================================================
   PAYROLL RUN STATUS
========================================================= */

export async function updatePayrollStatus(
  organizationId,
  runId,
  status,
  userId = null,
) {
  const normalizedStatus =
    String(
      status || "",
    )
      .trim()
      .toLowerCase();

  const allowedStatuses = [
    "draft",
    "review",
    "approved",
    "processed",
  ];

  if (
    !allowedStatuses.includes(
      normalizedStatus,
    )
  ) {
    throw createServiceError(
      "Invalid payroll status.",
      400,
    );
  }

  const {
    data: payroll,
    error,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!payroll) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  if (
    normalizedStatus ===
    payroll.status
  ) {
    return payroll;
  }

  /*
   * Controlled lifecycle:
   *
   * draft -> review
   * review -> draft / approved
   * approved -> processed
   *
   * Processed payroll is immutable.
   */
  const validTransition =
    (
      payroll.status ===
        "draft" &&
      normalizedStatus ===
        "review"
    ) ||
    (
      payroll.status ===
        "review" &&
      (
        normalizedStatus ===
          "draft" ||
        normalizedStatus ===
          "approved"
      )
    ) ||
    (
      payroll.status ===
        "approved" &&
      normalizedStatus ===
        "processed"
    );

  if (!validTransition) {
    throw createServiceError(
      `Invalid payroll status transition from ${payroll.status} to ${normalizedStatus}.`,
      409,
    );
  }

  if (
    normalizedStatus ===
      "review" ||
    normalizedStatus ===
      "approved" ||
    normalizedStatus ===
      "processed"
  ) {
    const validation =
      await validatePayrollRun(
        organizationId,
        runId,
      );

    if (!validation.valid) {
      throw createServiceError(
        "Payroll contains validation errors.",
        409,
      );
    }
  }

  const updateData = {
    status:
      normalizedStatus,

    updated_at:
      new Date().toISOString(),
  };

  if (
    normalizedStatus ===
    "approved"
  ) {
    updateData.approved_by =
      userId;

    updateData.approved_at =
      new Date().toISOString();
  }

  if (
    normalizedStatus ===
    "draft"
  ) {
    updateData.approved_by =
      null;

    updateData.approved_at =
      null;
  }

  if (
    normalizedStatus ===
    "processed"
  ) {
    updateData.processed_by =
      userId;

    updateData.processed_at =
      new Date().toISOString();
  }

  const {
    data,
    error: updateError,
  } =
    await supabaseAdmin
      .from("payroll_runs")
      .update(updateData)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        runId,
      )
      .select("*")
      .single();

  if (updateError) {
    throw updateError;
  }

  return data;
}

/* =========================================================
   FINAL PAYROLL CHECK
========================================================= */

export async function finalPayrollCheck(
  organizationId,
  runId,
) {
  const payroll =
    await getPayrollRun(
      organizationId,
      runId,
    );

  const validation =
    await validatePayrollRun(
      organizationId,
      runId,
    );

  const summary =
    await getPayrollSummary(
      organizationId,
      runId,
    );

  const checks = [];

  checks.push({
    key:
      "employee_count",

    label:
      "Employee count",

    passed:
      payroll.employee_count >
      0,

    value:
      payroll.employee_count,
  });

  checks.push({
    key:
      "gross_pay",

    label:
      "Gross payroll",

    passed:
      toNumber(
        payroll.gross_pay,
      ) >= 0,

    value:
      payroll.gross_pay,
  });

  checks.push({
    key:
      "deductions",

    label:
      "Total deductions",

    passed:
      toNumber(
        payroll.total_deductions,
      ) >= 0,

    value:
      payroll.total_deductions,
  });

  checks.push({
    key:
      "net_pay",

    label:
      "Net payroll",

    passed:
      toNumber(
        payroll.net_pay,
      ) >= 0,

    value:
      payroll.net_pay,
  });

  checks.push({
    key:
      "validation",

    label:
      "Payroll validation",

    passed:
      validation.valid,

    value:
      validation.error_count,
  });

  return {
    payroll,

    summary,

    validation,

    checks,

    ready:
      validation.valid &&
      payroll.employee_count >
        0 &&
      toNumber(
        payroll.gross_pay,
      ) >= 0 &&
      toNumber(
        payroll.net_pay,
      ) >= 0,
  };
}

/* =========================================================
   MODULE EXPORTS
========================================================= */

export {
  createServiceError,
  toNumber,
  money,
  nonNegativeMoney,
  cleanText,
  normalizePayrollMonth,
  getMonthDateRange,
  calculateWorkingDays,
  getPayrollCalendarContext,
  getEmployeeHolidayDates,
  getAttendanceSummary,
  getOrganizationEmployees,
  calculateRunTotals,
};