import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   FULL & FINAL SETTLEMENT SERVICE
========================================================= */

/* ---------------------------------------------------------
   CONSTANTS
--------------------------------------------------------- */

const SETTLEMENT_STATUSES = [
  "draft",
  "calculated",
  "under_review",
  "approved",
  "processed",
  "cancelled",
];

const ITEM_TYPES = [
  "earning",
  "deduction",
];

/* ---------------------------------------------------------
   GENERIC HELPERS
--------------------------------------------------------- */

function toNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function roundMoney(value) {
  return Math.round(
    (toNumber(value) + Number.EPSILON) *
      100
  ) / 100;
}

function roundRate(value) {
  return Math.round(
    (toNumber(value) + Number.EPSILON) *
      10000
  ) / 10000;
}

function cleanString(value) {
  const result =
    String(value ?? "").trim();

  return result || null;
}

function cleanUpperString(value) {
  const result =
    String(value ?? "")
      .trim()
      .toUpperCase();

  return result || null;
}

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function isValidDate(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  return !Number.isNaN(
    date.getTime()
  );
}

function dateOnly(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString().slice(
    0,
    10
  );
}

function monthKeyFromDate(value) {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(2, "0")}`;
}

function getDaysInMonth(
  year,
  month
) {
  return new Date(
    year,
    month,
    0
  ).getDate();
}

function getCalendarDaysThroughDate(
  dateValue
) {
  const date = new Date(
    `${dateValue}T00:00:00`
  );

  return date.getDate();
}

function getCalendarDaysBetween(
  startDate,
  endDate
) {
  const start = new Date(
    `${startDate}T00:00:00`
  );

  const end = new Date(
    `${endDate}T00:00:00`
  );

  if (
    Number.isNaN(
      start.getTime()
    ) ||
    Number.isNaN(
      end.getTime()
    )
  ) {
    return 0;
  }

  const milliseconds =
    end.getTime() -
    start.getTime();

  return (
    Math.floor(
      milliseconds /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
}

function getMonthStart(monthKey) {
  return `${monthKey}-01`;
}

function getMonthEnd(monthKey) {
  const [year, month] =
    monthKey
      .split("-")
      .map(Number);

  const lastDay =
    getDaysInMonth(
      year,
      month
    );

  return `${monthKey}-${String(
    lastDay
  ).padStart(2, "0")}`;
}

/* ---------------------------------------------------------
   FIELD RESOLUTION
--------------------------------------------------------- */

function firstDefined(
  object,
  keys,
  fallback = null
) {
  for (const key of keys) {
    if (
      object &&
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return fallback;
}

function getEmployeeName(employee) {
  return (
    firstDefined(
      employee,
      [
        "full_name",
        "name",
        "employee_name",
      ],
      "Employee"
    ) || "Employee"
  );
}

function getEmployeeEmail(employee) {
  return firstDefined(
    employee,
    [
      "email",
      "work_email",
      "official_email",
    ],
    null
  );
}

function getEmployeeCode(employee) {
  return firstDefined(
    employee,
    [
      "employee_code",
      "employee_id",
      "code",
    ],
    null
  );
}

function getEmployeeDepartment(
  employee
) {
  return firstDefined(
    employee,
    [
      "department",
      "department_name",
    ],
    null
  );
}

function getEmployeeTitle(
  employee
) {
  return firstDefined(
    employee,
    [
      "title",
      "job_title",
      "designation",
    ],
    null
  );
}

function getEmployeeLocation(
  employee
) {
  return firstDefined(
    employee,
    [
      "location",
      "office_location",
      "work_location",
      "city",
    ],
    null
  );
}

/* ---------------------------------------------------------
   PAYROLL FIELD RESOLUTION
--------------------------------------------------------- */

function getPayrollGross(item) {
  return toNumber(
    firstDefined(
      item,
      [
        "gross_pay",
        "gross_salary",
        "gross",
      ],
      0
    )
  );
}

function getPayrollBaseSalary(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "base_salary",
        "basic_salary",
        "monthly_salary",
        "salary",
      ],
      0
    )
  );
}

function getPayrollAllowances(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "allowances",
        "total_allowances",
      ],
      0
    )
  );
}

function getPayrollOvertime(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "overtime_pay",
        "overtime_amount",
      ],
      0
    )
  );
}

function getPayrollBonus(item) {
  return toNumber(
    firstDefined(
      item,
      [
        "bonus",
        "bonus_amount",
      ],
      0
    )
  );
}

function getPayrollReimbursements(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "reimbursements",
        "reimbursement_amount",
      ],
      0
    )
  );
}

function getPayrollDeductions(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "total_deductions",
        "deductions",
      ],
      0
    )
  );
}

function getPayrollFixedDeductions(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "fixed_deductions",
      ],
      0
    )
  );
}

function getPayrollStatutoryDeductions(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "statutory_deductions",
        "statutory_deduction",
      ],
      0
    )
  );
}

function getPayrollOtherDeductions(
  item
) {
  return toNumber(
    firstDefined(
      item,
      [
        "other_deductions",
      ],
      0
    )
  );
}

/* ---------------------------------------------------------
   CLAIM FIELD RESOLUTION
--------------------------------------------------------- */

function getClaimAmount(claim) {
  return toNumber(
    firstDefined(
      claim,
      [
        "approved_amount",
        "reimbursed_amount",
        "total_amount",
      ],
      0
    )
  );
}

/* =========================================================
   EMPLOYEE
========================================================= */

export async function getEmployeeForSettlement(
  organizationId,
  employeeId
) {
  if (
    !isValidUUID(employeeId)
  ) {
    throw new Error(
      "Invalid employee ID"
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      employeeId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load employee: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Employee not found"
    );
  }

  return data;
}

/* =========================================================
   ELIGIBLE EMPLOYEES
========================================================= */

export async function getEligibleEmployees(
  organizationId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .order(
      "full_name",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Could not load employees: ${error.message}`
    );
  }

  return (data || []).map(
    (employee) => ({
      id: employee.id,

      fullName:
        getEmployeeName(
          employee
        ),

      email:
        getEmployeeEmail(
          employee
        ),

      employeeCode:
        getEmployeeCode(
          employee
        ),

      department:
        getEmployeeDepartment(
          employee
        ),

      title:
        getEmployeeTitle(
          employee
        ),

      location:
        getEmployeeLocation(
          employee
        ),

      employmentStatus:
        employee.employment_status ||
        "Active",

      joiningDate:
        dateOnly(
          employee.joining_date
        ),

      lastWorkingDate:
        dateOnly(
          employee.last_working_date
        ),
    })
  );
}

/* =========================================================
   PAYROLL DATA
========================================================= */

export async function getPayrollRunForSettlement(
  organizationId,
  employeeId,
  monthKey
) {
  const normalizedPayrollMonth =
    typeof monthKey === "string" &&
    /^\d{4}-\d{2}$/.test(monthKey)
      ? `${monthKey}-01`
      : monthKey;

  const {
    data: runs,
    error: runsError,
  } = await supabaseAdmin
    .from("payroll_runs")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "payroll_month",
      normalizedPayrollMonth
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (runsError) {
    throw new Error(
      `Could not load payroll runs: ${runsError.message}`
    );
  }

  if (!runs?.length) {
    return {
      run: null,
      item: null,
    };
  }

  for (const run of runs) {
    const {
      data: item,
      error: itemError,
    } = await supabaseAdmin
      .from("payroll_run_items")
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "payroll_run_id",
        run.id
      )
      .eq(
        "employee_id",
        employeeId
      )
      .maybeSingle();

    if (itemError) {
      throw new Error(
        `Could not load payroll item: ${itemError.message}`
      );
    }

    if (item) {
      return {
        run,
        item,
      };
    }
  }

  return {
    run: null,
    item: null,
  };
}

/* =========================================================
   LATEST PAYROLL DATA
========================================================= */

export async function getLatestPayrollData(
  organizationId,
  employeeId,
  beforeOrOnDate = null
) {
  let query =
    supabaseAdmin
      .from("payroll_run_items")
      .select(
        "*, payroll_runs(*)"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "employee_id",
        employeeId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(20);

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `Could not load payroll history: ${error.message}`
    );
  }

  const rows =
    data || [];

  if (!beforeOrOnDate) {
    return rows[0] || null;
  }

  const cutoff =
    new Date(
      `${beforeOrOnDate}T23:59:59`
    ).getTime();

  const eligible =
    rows.filter(
      (row) => {
        const created =
          new Date(
            row.created_at
          ).getTime();

        return (
          Number.isFinite(
            created
          ) &&
          created <= cutoff
        );
      }
    );

  return eligible[0] || null;
}

/* =========================================================
   STATUTORY DEDUCTIONS
========================================================= */

export async function getStatutoryDeductionsForPayroll(
  organizationId,
  payrollRunId,
  employeeId
) {
  if (
    !payrollRunId
  ) {
    return [];
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "payroll_statutory_deductions"
    )
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "payroll_run_id",
      payrollRunId
    )
    .eq(
      "employee_id",
      employeeId
    );

  if (error) {
    throw new Error(
      `Could not load statutory deductions: ${error.message}`
    );
  }

  return data || [];
}

function getStatutoryEmployeeAmount(
  row
) {
  return toNumber(
    firstDefined(
      row,
      [
        "employee_amount",
        "employee_contribution",
        "employee_deduction",
        "deduction_amount",
        "amount",
      ],
      0
    )
  );
}

/* =========================================================
   REIMBURSEMENTS
========================================================= */

export async function getPendingReimbursements(
  organizationId,
  employeeId,
  lastWorkingDate
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from("expense_claims")
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "employee_id",
      employeeId
    )
    .in(
      "status",
      [
        "approved",
        "partially_approved",
        "paid",
      ]
    )
    .order(
      "claim_date",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Could not load reimbursement claims: ${error.message}`
    );
  }

  const cutoff =
    lastWorkingDate
      ? new Date(
          `${lastWorkingDate}T23:59:59`
        ).getTime()
      : null;

  const claims =
    (data || []).filter(
      (claim) => {
        if (!cutoff) {
          return true;
        }

        if (
          !claim.claim_date
        ) {
          return true;
        }

        const claimDate =
          new Date(
            `${claim.claim_date}T23:59:59`
          ).getTime();

        return (
          Number.isFinite(
            claimDate
          ) &&
          claimDate <= cutoff
        );
      }
    );

  const total =
    claims.reduce(
      (sum, claim) =>
        sum +
        getClaimAmount(
          claim
        ),
      0
    );

  return {
    total: roundMoney(total),

    claims,
  };
}

/* =========================================================
   LEAVE BALANCE DISCOVERY
========================================================= */

export async function getLeaveInformation(
  organizationId,
  employeeId,
  lastWorkingDate
) {
  const possibleTables = [
    "employee_leave_balances",
    "leave_balances",
    "employee_leave_balance",
  ];

  for (const table of possibleTables) {
    try {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(table)
        .select("*")
        .eq(
          "organization_id",
          organizationId
        )
        .eq(
          "employee_id",
          employeeId
        );

      if (
        error ||
        !data?.length
      ) {
        continue;
      }

      const row =
        data[0];

      const eligibleLeave =
        toNumber(
          firstDefined(
            row,
            [
              "eligible_leave_days",
              "available_leave_days",
              "balance_days",
              "leave_balance",
              "remaining_days",
              "closing_balance",
            ],
            0
          )
        );

      const encashableLeave =
        toNumber(
          firstDefined(
            row,
            [
              "encashable_days",
              "encashment_days",
              "eligible_leave_days",
              "available_leave_days",
              "balance_days",
              "leave_balance",
              "remaining_days",
              "closing_balance",
            ],
            eligibleLeave
          )
        );

      return {
        sourceTable:
          table,

        available:
          true,

        eligibleLeaveDays:
          roundRate(
            eligibleLeave
          ),

        encashableDays:
          roundRate(
            encashableLeave
          ),

        raw: row,
      };
    } catch {
      continue;
    }
  }

  return {
    sourceTable: null,

    available: false,

    eligibleLeaveDays: 0,

    encashableDays: 0,

    raw: null,
  };
}

/* =========================================================
   SETTLEMENT NUMBER
========================================================= */

export async function generateSettlementNumber(
  organizationId
) {
  const year =
    new Date().getFullYear();

  const prefix =
    `FNF-${year}-`;

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .select(
      "settlement_number"
    )
    .eq(
      "organization_id",
      organizationId
    )
    .like(
      "settlement_number",
      `${prefix}%`
    )
    .order(
      "settlement_number",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (error) {
    throw new Error(
      `Could not generate settlement number: ${error.message}`
    );
  }

  let sequence = 1;

  if (
    data?.length &&
    data[0]
      ?.settlement_number
  ) {
    const match =
      data[0].settlement_number.match(
        /-(\d+)$/
      );

    if (match) {
      sequence =
        Number(
          match[1]
        ) + 1;
    }
  }

  return `${prefix}${String(
    sequence
  ).padStart(5, "0")}`;
}

/* =========================================================
   CALCULATION ENGINE
========================================================= */

export async function calculateSettlement(
  organizationId,
  employeeId,
  options = {}
) {
  const employee =
    await getEmployeeForSettlement(
      organizationId,
      employeeId
    );

  const suppliedLastWorkingDate =
    dateOnly(
      options.lastWorkingDate
    );

  const employeeLastWorkingDate =
    dateOnly(
      employee.last_working_date
    );

  const lastWorkingDate =
    suppliedLastWorkingDate ||
    employeeLastWorkingDate;

  if (!lastWorkingDate) {
    throw new Error(
      "Last working date is required to calculate final settlement"
    );
  }

  if (
    !isValidDate(
      lastWorkingDate
    )
  ) {
    throw new Error(
      "Invalid last working date"
    );
  }

  const resignationDate =
    dateOnly(
      options.resignationDate ||
        employee.resignation_date ||
        employee.resigned_on ||
        null
    );

  const monthKey =
    monthKeyFromDate(
      lastWorkingDate
    );

  if (!monthKey) {
    throw new Error(
      "Could not determine settlement payroll month"
    );
  }

  const payroll =
    await getPayrollRunForSettlement(
      organizationId,
      employeeId,
      monthKey
    );

  let payrollRun =
    payroll.run;

  let payrollItem =
    payroll.item;

    if (
    !payrollItem
  ) {
    const latest =
      await getLatestPayrollData(
        organizationId,
        employeeId,
        lastWorkingDate
      );

    if (latest) {
      payrollItem =
        latest;

      payrollRun =
        latest.payroll_runs ||
        null;
    }
  }

  /*
   * FINAL SALARY FALLBACK
   *
   * If there is no payroll item available on or before
   * the employee's last working date, use the most recent
   * payroll item for this employee as the salary basis.
   *
   * This is important when payroll was processed after
   * the employee's last working date.
   */
  if (
    !payrollItem
  ) {
    const {
      data: fallbackPayrollItem,
      error: fallbackPayrollError,
    } = await supabaseAdmin
      .from("payroll_run_items")
      .select(
        "*, payroll_runs(*)"
      )
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "employee_id",
        employeeId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (
      fallbackPayrollError
    ) {
      throw new Error(
        `Could not load fallback payroll salary: ${fallbackPayrollError.message}`
      );
    }

    if (
      fallbackPayrollItem
    ) {
      payrollItem =
        fallbackPayrollItem;

      payrollRun =
        fallbackPayrollItem.payroll_runs ||
        payrollRun ||
        null;
    }
  }

  const payrollGross =
    getPayrollGross(
      payrollItem
    );

  const payrollBaseSalary =
    getPayrollBaseSalary(
      payrollItem
    );

  const payrollAllowances =
    getPayrollAllowances(
      payrollItem
    );

  const payrollOvertime =
    getPayrollOvertime(
      payrollItem
    );

  const payrollBonus =
    getPayrollBonus(
      payrollItem
    );

  const payrollReimbursements =
    getPayrollReimbursements(
      payrollItem
    );

  const payrollDeductions =
    getPayrollDeductions(
      payrollItem
    );

  const payrollFixedDeductions =
    getPayrollFixedDeductions(
      payrollItem
    );

   const payrollOtherDeductions =
    getPayrollOtherDeductions(
      payrollItem
    );

  const payrollStatutoryDeductions =
    getPayrollStatutoryDeductions(
      payrollItem
    );

  const statutoryRows =
    await getStatutoryDeductionsForPayroll(
      organizationId,
      payrollRun?.id ||
        null,
      employeeId
    );

  const statutoryFromEngine =
    statutoryRows.reduce(
      (
        total,
        row
      ) =>
        total +
        getStatutoryEmployeeAmount(
          row
        ),
      0
    );

  const statutoryDeductions =
    statutoryRows.length
      ? roundMoney(
          statutoryFromEngine
        )
      : roundMoney(
          getPayrollStatutoryDeductions(
            payrollItem
          )
        );

  /* -------------------------------------------------------
     SALARY CALCULATION
  ------------------------------------------------------- */

  const [
    year,
    month,
  ] = monthKey
    .split("-")
    .map(Number);

  const daysInMonth =
    getDaysInMonth(
      year,
      month
    );

  const monthlyGrossSalary =
    roundMoney(
      options.monthlyGrossSalary ??
        payrollGross ??
        payrollBaseSalary
    );

  if (
    monthlyGrossSalary <= 0
  ) {
    throw new Error(
      "No usable payroll salary was found for this employee"
    );
  }

  const dailySalary =
    roundRate(
      monthlyGrossSalary /
        daysInMonth
    );

  const joiningDate =
    dateOnly(
      employee.joining_date
    );

  let payableDays =
    getCalendarDaysThroughDate(
      lastWorkingDate
    );

  if (
    joiningDate &&
    monthKeyFromDate(
      joiningDate
    ) === monthKey
  ) {
    const joiningDay =
      getCalendarDaysThroughDate(
        joiningDate
      );

    payableDays =
      Math.max(
        0,
        payableDays -
          joiningDay +
          1
      );
  }

  if (
    options.payableDays !==
      undefined &&
    options.payableDays !==
      null
  ) {
    payableDays =
      Math.max(
        0,
        toNumber(
          options.payableDays
        )
      );
  }

  const salaryForPayableDays =
    roundMoney(
      dailySalary *
        payableDays
    );

  /* -------------------------------------------------------
     LEAVE ENCASHMENT
  ------------------------------------------------------- */

  const leave =
    await getLeaveInformation(
      organizationId,
      employeeId,
      lastWorkingDate
    );

  let leaveEncashmentDays =
    toNumber(
      options.leaveEncashmentDays,
      leave.encashableDays
    );

  if (
    leaveEncashmentDays <
    0
  ) {
    leaveEncashmentDays = 0;
  }

  const leaveEncashmentRate =
    roundRate(
      options.leaveEncashmentRate ??
        dailySalary
    );

  const leaveEncashmentAmount =
    roundMoney(
      leaveEncashmentDays *
        leaveEncashmentRate
    );

  /* -------------------------------------------------------
     NOTICE PERIOD
  ------------------------------------------------------- */

  const noticePeriodDays =
    Math.max(
      0,
      toNumber(
        options.noticePeriodDays,
        employee.notice_period ||
          employee.notice_period_days ||
          0
      )
    );

  const noticeServedDays =
    Math.max(
      0,
      toNumber(
        options.noticeServedDays,
        0
      )
    );

  const noticeShortfallDays =
    Math.max(
      0,
      noticePeriodDays -
        noticeServedDays
    );

  const noticeRecoveryAmount =
    roundMoney(
      noticeShortfallDays *
        dailySalary
    );

  const noticePayableDays =
    Math.max(
      0,
      noticeServedDays -
        noticePeriodDays
    );

  const noticePayableAmount =
    roundMoney(
      noticePayableDays *
        dailySalary
    );

  /* -------------------------------------------------------
     REIMBURSEMENTS
  ------------------------------------------------------- */

  const reimbursementData =
    await getPendingReimbursements(
      organizationId,
      employeeId,
      lastWorkingDate
    );

  const pendingReimbursements =
    roundMoney(
      options.pendingReimbursements ??
        reimbursementData.total
    );

  /* -------------------------------------------------------
     OTHER EARNINGS
  ------------------------------------------------------- */

  const bonusAmount =
    roundMoney(
      options.bonusAmount ??
        payrollBonus
    );

  const incentivesAmount =
    roundMoney(
      options.incentivesAmount ??
        0
    );

  const otherEarnings =
    roundMoney(
      options.otherEarnings ??
        0
    );

  /* -------------------------------------------------------
     OTHER DEDUCTIONS
  ------------------------------------------------------- */

  const outstandingDeductions =
    roundMoney(
      options.outstandingDeductions ??
        0
    );

  const assetRecoveryAmount =
    roundMoney(
      options.assetRecoveryAmount ??
        0
    );

  const otherDeductions =
    roundMoney(
      options.otherDeductions ??
        0
    );

  /* -------------------------------------------------------
     TOTALS
  ------------------------------------------------------- */

  const totalEarnings =
    roundMoney(
      salaryForPayableDays +
        leaveEncashmentAmount +
        noticePayableAmount +
        pendingReimbursements +
        bonusAmount +
        incentivesAmount +
        otherEarnings
    );

  const totalDeductions =
    roundMoney(
      statutoryDeductions +
        noticeRecoveryAmount +
        outstandingDeductions +
        assetRecoveryAmount +
        otherDeductions
    );

  const finalSettlementAmount =
    roundMoney(
      totalEarnings -
        totalDeductions
    );

  /* -------------------------------------------------------
     LINE ITEMS
  ------------------------------------------------------- */

  const items = [];

  items.push({
    itemType: "earning",
    category: "salary",
    itemName:
      "Salary through last working day",
    description:
      `Salary calculated for ${payableDays} calendar day(s) in ${monthKey}.`,
    quantity:
      payableDays,
    rate:
      dailySalary,
    amount:
      salaryForPayableDays,
    sourceType:
      payrollRun ? "payroll_run" : null,
    sourceId:
      payrollRun?.id || null,
    calculationBasis: {
      monthlyGrossSalary,
      daysInMonth,
      payableDays,
      dailySalary,
      lastWorkingDate,
      joiningDate,
    },
  });

  if (
    leaveEncashmentAmount >
    0
  ) {
    items.push({
      itemType: "earning",
      category:
        "leave_encashment",
      itemName:
        "Leave encashment",
      description:
        "Eligible leave balance encashed during final settlement.",
      quantity:
        leaveEncashmentDays,
      rate:
        leaveEncashmentRate,
      amount:
        leaveEncashmentAmount,
      sourceType:
        leave.sourceTable ||
        null,
      sourceId: null,
      calculationBasis: {
        eligibleLeaveDays:
          leave.eligibleLeaveDays,
        encashmentDays:
          leaveEncashmentDays,
        rate:
          leaveEncashmentRate,
        leaveSourceAvailable:
          leave.available,
      },
    });
  }

  if (
    noticePayableAmount >
    0
  ) {
    items.push({
      itemType: "earning",
      category:
        "notice_pay",
      itemName:
        "Notice pay",
      description:
        "Payable amount for notice days served beyond required notice period.",
      quantity:
        noticePayableDays,
      rate:
        dailySalary,
      amount:
        noticePayableAmount,
      sourceType:
        "settlement_calculation",
      sourceId: null,
      calculationBasis: {
        noticePeriodDays,
        noticeServedDays,
        noticePayableDays,
        dailySalary,
      },
    });
  }

  if (
    bonusAmount >
    0
  ) {
    items.push({
      itemType: "earning",
      category: "bonus",
      itemName:
        "Bonus",
      description:
        "Bonus included in final settlement.",
      quantity: 1,
      rate:
        bonusAmount,
      amount:
        bonusAmount,
      sourceType:
        payrollItem
          ? "payroll_run_item"
          : "manual",
      sourceId:
        payrollItem?.id ||
        null,
      calculationBasis: {
        payrollBonus,
      },
    });
  }

  if (
    incentivesAmount >
    0
  ) {
    items.push({
      itemType: "earning",
      category:
        "incentive",
      itemName:
        "Incentives",
      description:
        "Incentive amount included in final settlement.",
      quantity: 1,
      rate:
        incentivesAmount,
      amount:
        incentivesAmount,
      sourceType:
        "manual",
      sourceId: null,
      calculationBasis: {},
    });
  }

  if (
    pendingReimbursements >
    0
  ) {
    items.push({
      itemType: "earning",
      category:
        "reimbursement",
      itemName:
        "Pending reimbursements",
      description:
        "Approved employee expense claims included in final settlement.",
      quantity: 1,
      rate:
        pendingReimbursements,
      amount:
        pendingReimbursements,
      sourceType:
        "expense_claims",
      sourceId: null,
      calculationBasis: {
        claimCount:
          reimbursementData
            .claims.length,
        claims:
          reimbursementData.claims.map(
            (claim) => ({
              id: claim.id,
              claimNumber:
                claim.claim_number ||
                null,
              amount:
                getClaimAmount(
                  claim
                ),
              status:
                claim.status,
            })
          ),
      },
    });
  }

  if (
    otherEarnings >
    0
  ) {
    items.push({
      itemType: "earning",
      category:
        "other_earning",
      itemName:
        "Other earnings",
      description:
        "Other approved earnings included in final settlement.",
      quantity: 1,
      rate:
        otherEarnings,
      amount:
        otherEarnings,
      sourceType:
        "manual",
      sourceId: null,
      calculationBasis: {},
    });
  }

  if (
    statutoryDeductions >
    0
  ) {
    items.push({
      itemType: "deduction",
      category:
        "statutory",
      itemName:
        "Statutory deductions",
      description:
        "Employee statutory deductions sourced from the payroll/statutory engine.",
      quantity: 1,
      rate:
        statutoryDeductions,
      amount:
        statutoryDeductions,
      sourceType:
        statutoryRows.length
          ? "payroll_statutory_deductions"
          : "payroll_run_item",
      sourceId:
        payrollRun?.id ||
        null,
      calculationBasis: {
        sourceRows:
          statutoryRows.map(
            (row) => ({
              id: row.id,
              ruleId:
                firstDefined(
                  row,
                  [
                    "rule_id",
                    "statutory_rule_id",
                  ],
                  null
                ),
              employeeAmount:
                getStatutoryEmployeeAmount(
                  row
                ),
            })
          ),
        fallbackPayrollAmount:
          payrollStatutoryDeductions,
      },
    });
  }

  if (
    noticeRecoveryAmount >
    0
  ) {
    items.push({
      itemType: "deduction",
      category:
        "notice_recovery",
      itemName:
        "Notice period recovery",
      description:
        "Recovery for unserved notice period.",
      quantity:
        noticeShortfallDays,
      rate:
        dailySalary,
      amount:
        noticeRecoveryAmount,
      sourceType:
        "settlement_calculation",
      sourceId: null,
      calculationBasis: {
        noticePeriodDays,
        noticeServedDays,
        noticeShortfallDays,
        dailySalary,
      },
    });
  }

  if (
    outstandingDeductions >
    0
  ) {
    items.push({
      itemType: "deduction",
      category:
        "outstanding",
      itemName:
        "Outstanding deductions",
      description:
        "Outstanding employee deductions included in final settlement.",
      quantity: 1,
      rate:
        outstandingDeductions,
      amount:
        outstandingDeductions,
      sourceType:
        "manual",
      sourceId: null,
      calculationBasis: {},
    });
  }

  if (
    assetRecoveryAmount >
    0
  ) {
    items.push({
      itemType: "deduction",
      category:
        "asset_recovery",
      itemName:
        "Asset recovery",
      description:
        "Amount recoverable for outstanding company assets.",
      quantity: 1,
      rate:
        assetRecoveryAmount,
      amount:
        assetRecoveryAmount,
      sourceType:
        "manual",
      sourceId: null,
      calculationBasis: {},
    });
  }

  if (
    otherDeductions >
    0
  ) {
    items.push({
      itemType: "deduction",
      category:
        "other_deduction",
      itemName:
        "Other deductions",
      description:
        "Other approved deductions included in final settlement.",
      quantity: 1,
      rate:
        otherDeductions,
      amount:
        otherDeductions,
      sourceType:
        "manual",
      sourceId: null,
      calculationBasis: {},
    });
  }

  /* -------------------------------------------------------
     SNAPSHOTS
  ------------------------------------------------------- */

  const employeeSnapshot = {
    id: employee.id,
    fullName:
      getEmployeeName(
        employee
      ),
    email:
      getEmployeeEmail(
        employee
      ),
    employeeCode:
      getEmployeeCode(
        employee
      ),
    department:
      getEmployeeDepartment(
        employee
      ),
    title:
      getEmployeeTitle(
        employee
      ),
    location:
      getEmployeeLocation(
        employee
      ),
    employmentStatus:
      employee.employment_status ||
      "Active",
    joiningDate,
    lastWorkingDate,
  };

  const payrollSnapshot = {
    payrollRunId:
      payrollRun?.id ||
      null,

    payrollMonth:
      payrollRun?.payroll_month ||
      monthKey,

    payrollStatus:
      payrollRun?.status ||
      null,

    payrollItemId:
      payrollItem?.id ||
      null,

    monthlyGrossSalary,

    baseSalary:
      payrollBaseSalary,

    allowances:
      payrollAllowances,

    overtime:
      payrollOvertime,

    bonus:
      payrollBonus,

    reimbursements:
      payrollReimbursements,

    grossPay:
      payrollGross,

    fixedDeductions:
      payrollFixedDeductions,

    statutoryDeductions:
      payrollStatutoryDeductions,

    otherDeductions:
      payrollOtherDeductions,

    totalDeductions:
      payrollDeductions,
  };

  const leaveSnapshot = {
    sourceTable:
      leave.sourceTable,

    sourceAvailable:
      leave.available,

    eligibleLeaveDays:
      leave.eligibleLeaveDays,

    encashableDays:
      leave.encashableDays,

    settlementEncashmentDays:
      leaveEncashmentDays,

    settlementEncashmentRate:
      leaveEncashmentRate,

    settlementEncashmentAmount:
      leaveEncashmentAmount,

    raw:
      leave.raw,
  };

  const reimbursementSnapshot = {
    total:
      pendingReimbursements,

    claimCount:
      reimbursementData
        .claims.length,

    claims:
      reimbursementData.claims.map(
        (claim) => ({
          id: claim.id,
          claimNumber:
            claim.claim_number ||
            null,
          title:
            claim.title ||
            null,
          claimDate:
            claim.claim_date ||
            null,
          amount:
            getClaimAmount(
              claim
            ),
          status:
            claim.status,
        })
      ),
  };

  const calculationSnapshot = {
    version:
      "fnf-v1",

    calculatedAt:
      new Date().toISOString(),

    settlementMonth:
      monthKey,

    lastWorkingDate,

    resignationDate,

    daysInMonth,

    monthlyGrossSalary,

    dailySalary,

    payableDays,

    salaryForPayableDays,

    leaveEncashmentDays,

    leaveEncashmentRate,

    leaveEncashmentAmount,

    noticePeriodDays,

    noticeServedDays,

    noticeShortfallDays,

    noticeRecoveryAmount,

    noticePayableDays,

    noticePayableAmount,

    pendingReimbursements,

    bonusAmount,

    incentivesAmount,

    otherEarnings,

    statutoryDeductions,

    outstandingDeductions,

    assetRecoveryAmount,

    otherDeductions,

    totalEarnings,

    totalDeductions,

    finalSettlementAmount,

    payrollRunId:
      payrollRun?.id ||
      null,

    payrollRunItemId:
      payrollItem?.id ||
      null,
  };

  return {
    employee,

    employeeSnapshot,

    payrollRun,

    payrollItem,

    payrollSnapshot,

    leaveSnapshot,

    reimbursementSnapshot,

    calculationSnapshot,

    items,

    totals: {
      monthlyGrossSalary,
      dailySalary,
      payableDays,
      salaryForPayableDays,
      eligibleLeaveDays:
        leave.eligibleLeaveDays,
      leaveEncashmentDays,
      leaveEncashmentAmount,
      noticePeriodDays,
      noticeServedDays,
      noticeShortfallDays,
      noticeRecoveryAmount,
      noticePayableAmount,
      pendingReimbursements,
      bonusAmount,
      incentivesAmount,
      otherEarnings,
      statutoryDeductions,
      outstandingDeductions,
      assetRecoveryAmount,
      otherDeductions,
      totalEarnings,
      totalDeductions,
      finalSettlementAmount,
    },
  };
}

/* =========================================================
   CREATE SETTLEMENT
========================================================= */

export async function createSettlement(
  organizationId,
  userId,
  payload = {}
) {
  const employeeId =
    payload.employeeId ||
    payload.employee_id;

  if (
    !isValidUUID(employeeId)
  ) {
    throw new Error(
      "A valid employee is required"
    );
  }

  const employee =
    await getEmployeeForSettlement(
      organizationId,
      employeeId
    );

  const lastWorkingDate =
    dateOnly(
      payload.lastWorkingDate ||
        payload.last_working_date ||
        employee.last_working_date
    );

  if (!lastWorkingDate) {
    throw new Error(
      "Last working date is required"
    );
  }

  const existing =
    await supabaseAdmin
      .from(
        "fnf_settlements"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "employee_id",
        employeeId
      )
      .neq(
        "settlement_status",
        "cancelled"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1);

  if (
    existing.error
  ) {
    throw new Error(
      `Could not check existing settlements: ${existing.error.message}`
    );
  }

  if (
    existing.data?.length
  ) {
    return getSettlement(
      organizationId,
      existing.data[0].id
    );
  }

  const calculation =
    await calculateSettlement(
      organizationId,
      employeeId,
      payload
    );

  const settlementNumber =
    await generateSettlementNumber(
      organizationId
    );

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .insert({
      organization_id:
        organizationId,

      employee_id:
        employeeId,

      settlement_number:
        settlementNumber,

      settlement_status:
        "draft",

      resignation_date:
        dateOnly(
          payload.resignationDate ||
            payload.resignation_date ||
            employee.resignation_date ||
            null
        ),

      last_working_date:
        lastWorkingDate,

      settlement_date:
        dateOnly(
          payload.settlementDate ||
            payload.settlement_date ||
            null
        ),

      currency_code:
        cleanUpperString(
          payload.currencyCode ||
            payload.currency_code ||
            "INR"
        ),

      monthly_gross_salary:
        calculation.totals
          .monthlyGrossSalary,

      daily_salary:
        calculation.totals
          .dailySalary,

      payable_days:
        calculation.totals
          .payableDays,

      salary_for_payable_days:
        calculation.totals
          .salaryForPayableDays,

      eligible_leave_days:
        calculation.totals
          .eligibleLeaveDays,

      leave_encashment_days:
        calculation.totals
          .leaveEncashmentDays,

      leave_encashment_amount:
        calculation.totals
          .leaveEncashmentAmount,

      notice_period_days:
        calculation.totals
          .noticePeriodDays,

      notice_served_days:
        calculation.totals
          .noticeServedDays,

      notice_shortfall_days:
        calculation.totals
          .noticeShortfallDays,

      notice_recovery_amount:
        calculation.totals
          .noticeRecoveryAmount,

      notice_payable_amount:
        calculation.totals
          .noticePayableAmount,

      pending_reimbursements:
        calculation.totals
          .pendingReimbursements,

      bonus_amount:
        calculation.totals
          .bonusAmount,

      incentives_amount:
        calculation.totals
          .incentivesAmount,

      other_earnings:
        calculation.totals
          .otherEarnings,

      statutory_deductions:
        calculation.totals
          .statutoryDeductions,

      outstanding_deductions:
        calculation.totals
          .outstandingDeductions,

      asset_recovery_amount:
        calculation.totals
          .assetRecoveryAmount,

      other_deductions:
        calculation.totals
          .otherDeductions,

      total_earnings:
        calculation.totals
          .totalEarnings,

      total_deductions:
        calculation.totals
          .totalDeductions,

      final_settlement_amount:
        calculation.totals
          .finalSettlementAmount,

      notes:
        cleanString(
          payload.notes
        ),

      employee_snapshot:
        calculation.employeeSnapshot,

      payroll_snapshot:
        calculation.payrollSnapshot,

      leave_snapshot:
        calculation.leaveSnapshot,

      reimbursement_snapshot:
        calculation.reimbursementSnapshot,

      calculation_snapshot:
        calculation.calculationSnapshot,

      created_by:
        userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not create settlement: ${error.message}`
    );
  }

  await insertSettlementItems(
    organizationId,
    data.id,
    calculation.items
  );

  await addSettlementEvent({
    organizationId,

    settlementId:
      data.id,

    eventType:
      "settlement_created",

    oldStatus: null,

    newStatus:
      "draft",

    message:
      `Final settlement ${settlementNumber} created for ${getEmployeeName(
        employee
      )}.`,

    metadata: {
      employeeId,
      settlementNumber,
    },

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   UPDATE / RECALCULATE SETTLEMENT
========================================================= */

export async function recalculateSettlement(
  organizationId,
  userId,
  settlementId,
  payload = {}
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    ![
      "draft",
      "calculated",
      "under_review",
    ].includes(
      settlement.settlement_status
    )
  ) {
    throw new Error(
      `Settlement cannot be recalculated while it is ${settlement.settlement_status}`
    );
  }

  const calculation =
    await calculateSettlement(
      organizationId,
      settlement.employee_id,
      {
        ...payload,

        lastWorkingDate:
          payload.lastWorkingDate ||
          settlement.last_working_date,

        resignationDate:
          payload.resignationDate ||
          settlement.resignation_date,

        monthlyGrossSalary:
          payload.monthlyGrossSalary ??
          settlement.monthly_gross_salary,
      }
    );

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .update({
      settlement_status:
        "calculated",

      resignation_date:
        dateOnly(
          payload.resignationDate ||
            settlement.resignation_date
        ),

      last_working_date:
        dateOnly(
          payload.lastWorkingDate ||
            settlement.last_working_date
        ),

      settlement_date:
        dateOnly(
          payload.settlementDate ||
            settlement.settlement_date ||
            null
        ),

      monthly_gross_salary:
        calculation.totals
          .monthlyGrossSalary,

      daily_salary:
        calculation.totals
          .dailySalary,

      payable_days:
        calculation.totals
          .payableDays,

      salary_for_payable_days:
        calculation.totals
          .salaryForPayableDays,

      eligible_leave_days:
        calculation.totals
          .eligibleLeaveDays,

      leave_encashment_days:
        calculation.totals
          .leaveEncashmentDays,

      leave_encashment_amount:
        calculation.totals
          .leaveEncashmentAmount,

      notice_period_days:
        calculation.totals
          .noticePeriodDays,

      notice_served_days:
        calculation.totals
          .noticeServedDays,

      notice_shortfall_days:
        calculation.totals
          .noticeShortfallDays,

      notice_recovery_amount:
        calculation.totals
          .noticeRecoveryAmount,

      notice_payable_amount:
        calculation.totals
          .noticePayableAmount,

      pending_reimbursements:
        calculation.totals
          .pendingReimbursements,

      bonus_amount:
        calculation.totals
          .bonusAmount,

      incentives_amount:
        calculation.totals
          .incentivesAmount,

      other_earnings:
        calculation.totals
          .otherEarnings,

      statutory_deductions:
        calculation.totals
          .statutoryDeductions,

      outstanding_deductions:
        calculation.totals
          .outstandingDeductions,

      asset_recovery_amount:
        calculation.totals
          .assetRecoveryAmount,

      other_deductions:
        calculation.totals
          .otherDeductions,

      total_earnings:
        calculation.totals
          .totalEarnings,

      total_deductions:
        calculation.totals
          .totalDeductions,

      final_settlement_amount:
        calculation.totals
          .finalSettlementAmount,

      notes:
        payload.notes !==
        undefined
          ? cleanString(
              payload.notes
            )
          : settlement.notes,

      employee_snapshot:
        calculation.employeeSnapshot,

      payroll_snapshot:
        calculation.payrollSnapshot,

      leave_snapshot:
        calculation.leaveSnapshot,

      reimbursement_snapshot:
        calculation.reimbursementSnapshot,

      calculation_snapshot:
        calculation.calculationSnapshot,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not recalculate settlement: ${error.message}`
    );
  }

  await supabaseAdmin
    .from(
      "fnf_settlement_items"
    )
    .delete()
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "settlement_id",
      settlementId
    );

  await insertSettlementItems(
    organizationId,
    settlementId,
    calculation.items
  );

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "settlement_recalculated",

    oldStatus:
      settlement.settlement_status,

    newStatus:
      "calculated",

    message:
      "Final settlement was recalculated using current payroll, statutory, leave, reimbursement, and settlement inputs.",

    metadata:
      calculation.calculationSnapshot,

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   INSERT ITEMS
========================================================= */

async function insertSettlementItems(
  organizationId,
  settlementId,
  items
) {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return;
  }

  const rows =
    items.map(
      (item) => ({
        organization_id:
          organizationId,

        settlement_id:
          settlementId,

        item_type:
          item.itemType,

        category:
          item.category,

        item_name:
          item.itemName,

        description:
          item.description ||
          null,

        quantity:
          toNumber(
            item.quantity,
            1
          ),

        rate:
          roundRate(
            item.rate
          ),

        amount:
          roundMoney(
            item.amount
          ),

        source_type:
          item.sourceType ||
          null,

        source_id:
          isValidUUID(
            item.sourceId
          )
            ? item.sourceId
            : null,

        calculation_basis:
          item.calculationBasis ||
          {},
      })
    );

  const {
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlement_items"
    )
    .insert(rows);

  if (error) {
    throw new Error(
      `Could not save settlement items: ${error.message}`
    );
  }
}

/* =========================================================
   GET SETTLEMENT
========================================================= */

export async function getSettlement(
  organizationId,
  settlementId
) {
  if (
    !isValidUUID(
      settlementId
    )
  ) {
    throw new Error(
      "Invalid settlement ID"
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Could not load settlement: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Settlement not found"
    );
  }

  const [
    itemsResult,
    eventsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        "fnf_settlement_items"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "settlement_id",
        settlementId
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      ),

    supabaseAdmin
      .from(
        "fnf_settlement_events"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .eq(
        "settlement_id",
        settlementId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      ),
  ]);

  if (
    itemsResult.error
  ) {
    throw new Error(
      `Could not load settlement items: ${itemsResult.error.message}`
    );
  }

  if (
    eventsResult.error
  ) {
    throw new Error(
      `Could not load settlement events: ${eventsResult.error.message}`
    );
  }

  return {
    ...data,

    items:
      itemsResult.data ||
      [],

    events:
      eventsResult.data ||
      [],

    employee:
      data.employee_snapshot ||
      {},

    payroll:
      data.payroll_snapshot ||
      {},

    leave:
      data.leave_snapshot ||
      {},

    reimbursements:
      data.reimbursement_snapshot ||
      {},

    calculation:
      data.calculation_snapshot ||
      {},
  };
}

/* =========================================================
   LIST SETTLEMENTS
========================================================= */

export async function listSettlements(
  organizationId,
  filters = {}
) {
  let query =
    supabaseAdmin
      .from(
        "fnf_settlements"
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (
    filters.status &&
    SETTLEMENT_STATUSES.includes(
      filters.status
    )
  ) {
    query =
      query.eq(
        "settlement_status",
        filters.status
      );
  }

  if (
    filters.employeeId &&
    isValidUUID(
      filters.employeeId
    )
  ) {
    query =
      query.eq(
        "employee_id",
        filters.employeeId
      );
  }

  if (
    filters.fromDate &&
    isValidDate(
      filters.fromDate
    )
  ) {
    query =
      query.gte(
        "last_working_date",
        dateOnly(
          filters.fromDate
        )
      );
  }

  if (
    filters.toDate &&
    isValidDate(
      filters.toDate
    )
  ) {
    query =
      query.lte(
        "last_working_date",
        dateOnly(
          filters.toDate
        )
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `Could not load settlements: ${error.message}`
    );
  }

  return data || [];
}

/* =========================================================
   SUBMIT FOR REVIEW
========================================================= */

export async function submitSettlementForReview(
  organizationId,
  userId,
  settlementId
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    ![
      "draft",
      "calculated",
    ].includes(
      settlement.settlement_status
    )
  ) {
    throw new Error(
      "Only draft or calculated settlements can be submitted for review"
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .update({
      settlement_status:
        "under_review",

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not submit settlement for review: ${error.message}`
    );
  }

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "submitted_for_review",

    oldStatus:
      settlement.settlement_status,

    newStatus:
      "under_review",

    message:
      "Final settlement submitted for review.",

    metadata: {},

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   APPROVE SETTLEMENT
========================================================= */

export async function approveSettlement(
  organizationId,
  userId,
  settlementId,
  notes = null
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    settlement.settlement_status !==
    "under_review"
  ) {
    throw new Error(
      "Only settlements under review can be approved"
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .update({
      settlement_status:
        "approved",

      approved_at:
        now,

      approved_by:
        userId,

      notes:
        notes !== null
          ? cleanString(
              notes
            )
          : settlement.notes,

      updated_at:
        now,
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not approve settlement: ${error.message}`
    );
  }

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "settlement_approved",

    oldStatus:
      settlement.settlement_status,

    newStatus:
      "approved",

    message:
      `Final settlement ${settlement.settlement_number} approved.`,

    metadata: {
      finalSettlementAmount:
        data.final_settlement_amount,

      currencyCode:
        data.currency_code,
    },

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   PROCESS SETTLEMENT
========================================================= */

export async function processSettlement(
  organizationId,
  userId,
  settlementId,
  paymentReference = null
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    settlement.settlement_status !==
    "approved"
  ) {
    throw new Error(
      "Only approved settlements can be processed"
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .update({
      settlement_status:
        "processed",

      settlement_date:
        dateOnly(
          settlement.settlement_date ||
            now
        ),

      payment_reference:
        cleanString(
          paymentReference
        ) ||
        settlement.payment_reference ||
        null,

      processed_at:
        now,

      processed_by:
        userId,

      updated_at:
        now,
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not process settlement: ${error.message}`
    );
  }

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "settlement_processed",

    oldStatus:
      settlement.settlement_status,

    newStatus:
      "processed",

    message:
      `Final settlement ${settlement.settlement_number} marked as processed.`,

    metadata: {
      paymentReference:
        data.payment_reference,

      finalSettlementAmount:
        data.final_settlement_amount,
    },

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   CANCEL SETTLEMENT
========================================================= */

export async function cancelSettlement(
  organizationId,
  userId,
  settlementId,
  reason
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    settlement.settlement_status ===
    "processed"
  ) {
    throw new Error(
      "Processed settlements cannot be cancelled"
    );
  }

  if (
    settlement.settlement_status ===
    "cancelled"
  ) {
    throw new Error(
      "Settlement is already cancelled"
    );
  }

  const cleanReason =
    cleanString(
      reason
    );

  if (!cleanReason) {
    throw new Error(
      "Cancellation reason is required"
    );
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .update({
      settlement_status:
        "cancelled",

      cancelled_at:
        now,

      cancelled_by:
        userId,

      cancellation_reason:
        cleanReason,

      updated_at:
        now,
    })
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    )
    .select()
    .single();

  if (error) {
    throw new Error(
      `Could not cancel settlement: ${error.message}`
    );
  }

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "settlement_cancelled",

    oldStatus:
      settlement.settlement_status,

    newStatus:
      "cancelled",

    message:
      `Final settlement ${settlement.settlement_number} was cancelled.`,

    metadata: {
      reason:
        cleanReason,
    },

    performedBy:
      userId,
  });

  return getSettlement(
    organizationId,
    data.id
  );
}

/* =========================================================
   DELETE DRAFT
========================================================= */

export async function deleteDraftSettlement(
  organizationId,
  userId,
  settlementId
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  if (
    settlement.settlement_status !==
    "draft"
  ) {
    throw new Error(
      "Only draft settlements can be deleted"
    );
  }

  const {
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .delete()
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "id",
      settlementId
    );

  if (error) {
    throw new Error(
      `Could not delete settlement: ${error.message}`
    );
  }

  await addSettlementEvent({
    organizationId,

    settlementId,

    eventType:
      "settlement_deleted",

    oldStatus:
      "draft",

    newStatus:
      null,

    message:
      `Draft settlement ${settlement.settlement_number} was deleted.`,

    metadata: {},

    performedBy:
      userId,
  });

  return {
    success: true,

    settlementId,
  };
}

/* =========================================================
   EVENTS
========================================================= */

export async function addSettlementEvent({
  organizationId,
  settlementId,
  eventType,
  oldStatus = null,
  newStatus = null,
  message = null,
  metadata = {},
  performedBy = null,
}) {
  const {
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlement_events"
    )
    .insert({
      organization_id:
        organizationId,

      settlement_id:
        settlementId,

      event_type:
        eventType,

      old_status:
        oldStatus,

      new_status:
        newStatus,

      message,

      metadata:
        metadata || {},

      performed_by:
        performedBy,
    });

  if (error) {
    console.error(
      "[F&F] Could not write settlement event:",
      error
    );
  }
}

/* =========================================================
   SETTLEMENT EVENTS
========================================================= */

export async function getSettlementEvents(
  organizationId,
  settlementId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlement_events"
    )
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "settlement_id",
      settlementId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Could not load settlement events: ${error.message}`
    );
  }

  return data || [];
}

/* =========================================================
   SETTLEMENT ITEMS
========================================================= */

export async function getSettlementItems(
  organizationId,
  settlementId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlement_items"
    )
    .select("*")
    .eq(
      "organization_id",
      organizationId
    )
    .eq(
      "settlement_id",
      settlementId
    )
    .order(
      "created_at",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Could not load settlement items: ${error.message}`
    );
  }

  return data || [];
}

/* =========================================================
   SUMMARY
========================================================= */

export async function getSettlementSummary(
  organizationId
) {
  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "fnf_settlements"
    )
    .select(
      "settlement_status, final_settlement_amount, total_earnings, total_deductions"
    )
    .eq(
      "organization_id",
      organizationId
    );

  if (error) {
    throw new Error(
      `Could not load settlement summary: ${error.message}`
    );
  }

  const rows =
    data || [];

  const summary = {
    total: rows.length,

    draft: 0,

    calculated: 0,

    underReview: 0,

    approved: 0,

    processed: 0,

    cancelled: 0,

    totalEarnings: 0,

    totalDeductions: 0,

    totalFinalSettlement: 0,
  };

  rows.forEach(
    (row) => {
      switch (
        row.settlement_status
      ) {
        case "draft":
          summary.draft += 1;
          break;

        case "calculated":
          summary.calculated += 1;
          break;

        case "under_review":
          summary.underReview += 1;
          break;

        case "approved":
          summary.approved += 1;
          break;

        case "processed":
          summary.processed += 1;
          break;

        case "cancelled":
          summary.cancelled += 1;
          break;

        default:
          break;
      }

      summary.totalEarnings +=
        toNumber(
          row.total_earnings
        );

      summary.totalDeductions +=
        toNumber(
          row.total_deductions
        );

      summary.totalFinalSettlement +=
        toNumber(
          row.final_settlement_amount
        );
    }
  );

  summary.totalEarnings =
    roundMoney(
      summary.totalEarnings
    );

  summary.totalDeductions =
    roundMoney(
      summary.totalDeductions
    );

  summary.totalFinalSettlement =
    roundMoney(
      summary.totalFinalSettlement
    );

  return summary;
}

/* =========================================================
   PREVIEW CALCULATION
   No database write.
========================================================= */

export async function previewSettlement(
  organizationId,
  employeeId,
  payload = {}
) {
  const calculation =
    await calculateSettlement(
      organizationId,
      employeeId,
      payload
    );

  return {
    employee:
      calculation.employeeSnapshot,

    payroll:
      calculation.payrollSnapshot,

    leave:
      calculation.leaveSnapshot,

    reimbursements:
      calculation.reimbursementSnapshot,

    calculation:
      calculation.calculationSnapshot,

    items:
      calculation.items,

    totals:
      calculation.totals,
  };
}

/* =========================================================
   VALIDATE SETTLEMENT
========================================================= */

export async function validateSettlement(
  organizationId,
  settlementId
) {
  const settlement =
    await getSettlement(
      organizationId,
      settlementId
    );

  const warnings = [];

  const errors = [];

  if (
    !settlement.employee_id
  ) {
    errors.push(
      "Employee is missing"
    );
  }

  if (
    !settlement.last_working_date
  ) {
    errors.push(
      "Last working date is missing"
    );
  }

  if (
    toNumber(
      settlement.monthly_gross_salary
    ) <= 0
  ) {
    errors.push(
      "Monthly gross salary is not available"
    );
  }

  if (
    !settlement.payroll_snapshot
      ?.payrollRunId
  ) {
    warnings.push(
      "No matching payroll run was found for the settlement month"
    );
  }

  if (
    !settlement.leave_snapshot
      ?.sourceAvailable
  ) {
    warnings.push(
      "No leave balance source was found; leave encashment has not been automatically added"
    );
  }

  if (
    toNumber(
      settlement.final_settlement_amount
    ) < 0
  ) {
    warnings.push(
      "Final settlement is negative because deductions exceed earnings"
    );
  }

  if (
    settlement.settlement_status ===
    "approved"
  ) {
    warnings.push(
      "Settlement is already approved"
    );
  }

  return {
    valid:
      errors.length === 0,

    errors,

    warnings,

    settlementId,

    settlementNumber:
      settlement.settlement_number,
  };
}

/* =========================================================
   EXPORT
========================================================= */

export default {
  getEmployeeForSettlement,

  getEligibleEmployees,

  getPayrollRunForSettlement,

  getLatestPayrollData,

  getStatutoryDeductionsForPayroll,

  getPendingReimbursements,

  getLeaveInformation,

  generateSettlementNumber,

  calculateSettlement,

  createSettlement,

  recalculateSettlement,

  getSettlement,

  listSettlements,

  submitSettlementForReview,

  approveSettlement,

  processSettlement,

  cancelSettlement,

  deleteDraftSettlement,

  addSettlementEvent,

  getSettlementEvents,

  getSettlementItems,

  getSettlementSummary,

  previewSettlement,

  validateSettlement,
};