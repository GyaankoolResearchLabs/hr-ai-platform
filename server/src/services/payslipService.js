import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   PAYSLIP SERVICE
   Generates and manages payslips from persisted payroll runs.
========================================================= */

/* =========================================================
   ERROR / VALUE HELPERS
========================================================= */

function createServiceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function toNumber(value, fallback = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function money(value) {
  return Math.round(
    (toNumber(value) + Number.EPSILON) * 100,
  ) / 100;
}

function nonNegativeMoney(value) {
  return Math.max(
    0,
    money(value),
  );
}

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

function firstExistingValue(
  object,
  fields,
) {
  for (const field of fields) {
    const value = object?.[field];

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

function uniqueArray(values = []) {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== "",
        )
        .map((value) =>
          String(value),
        ),
    ),
  ];
}

/* =========================================================
   DATE HELPERS
========================================================= */

function normalizePayrollMonth(value) {
  if (!value) {
    throw createServiceError(
      "Payroll month is required.",
      400,
    );
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] =
      text.split("-");

    const monthNumber =
      Number(month);

    if (
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw createServiceError(
        "Invalid payroll month.",
        400,
      );
    }

    return `${year}-${month}-01`;
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      text,
    )
  ) {
    const date = new Date(
      `${text}T00:00:00Z`,
    );

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      throw createServiceError(
        "Invalid payroll month.",
        400,
      );
    }

    return text;
  }

  throw createServiceError(
    "Payroll month must be in YYYY-MM format.",
    400,
  );
}

function getMonthDateRange(
  payrollMonth,
) {
  const normalized =
    normalizePayrollMonth(
      payrollMonth,
    );

  const startDate = new Date(
    `${normalized}T00:00:00Z`,
  );

  if (
    Number.isNaN(
      startDate.getTime(),
    )
  ) {
    throw createServiceError(
      "Invalid payroll month.",
      400,
    );
  }

  const year =
    startDate.getUTCFullYear();

  const month =
    startDate.getUTCMonth();

  const lastDay =
    new Date(
      Date.UTC(
        year,
        month + 1,
        0,
      ),
    ).getUTCDate();

  return {
    startDate:
      `${year}-${String(
        month + 1,
      ).padStart(2, "0")}-01`,

    endDate:
      `${year}-${String(
        month + 1,
      ).padStart(2, "0")}-${String(
        lastDay,
      ).padStart(2, "0")}`,

    payrollMonth:
      `${year}-${String(
        month + 1,
      ).padStart(2, "0")}-01`,
  };
}

/* =========================================================
   EMPLOYEE SNAPSHOT
========================================================= */

function buildEmployeeSnapshot(
  employee = {},
) {
  const employeeId =
    employee.id ||
    employee.employee_id ||
    null;

  const employeeCode =
    firstExistingValue(
      employee,
      [
        "employee_id",
        "employeeId",
        "employee_code",
        "employeeCode",
        "employee_number",
        "employeeNumber",
        "code",
      ],
    );

  const firstName =
    firstExistingValue(
      employee,
      [
        "first_name",
        "firstName",
      ],
    );

  const lastName =
    firstExistingValue(
      employee,
      [
        "last_name",
        "lastName",
      ],
    );

  const fullName =
    firstExistingValue(
      employee,
      [
        "name",
        "full_name",
        "fullName",
        "employee_name",
        "employeeName",
      ],
    );

  const resolvedName =
    fullName ||
    [
      firstName,
      lastName,
    ]
      .filter(Boolean)
      .join(" ") ||
    employeeCode ||
    employeeId ||
    "Employee";

  return {
    id: employeeId,

    employee_id:
      employeeCode,

    name:
      resolvedName,

    first_name:
      firstName,

    last_name:
      lastName,

    email:
      firstExistingValue(
        employee,
        [
          "email",
          "work_email",
          "workEmail",
          "official_email",
        ],
      ),

    phone:
      firstExistingValue(
        employee,
        [
          "phone",
          "phone_number",
          "phoneNumber",
          "mobile",
        ],
      ),

    department:
      firstExistingValue(
        employee,
        [
          "department",
          "department_name",
          "departmentName",
        ],
      ),

    designation:
      firstExistingValue(
        employee,
        [
          "designation",
          "job_title",
          "jobTitle",
          "title",
          "position",
        ],
      ),

    job_title:
      firstExistingValue(
        employee,
        [
          "job_title",
          "jobTitle",
          "title",
          "designation",
          "position",
        ],
      ),

    employment_status:
      firstExistingValue(
        employee,
        [
          "employment_status",
          "employmentStatus",
          "status",
        ],
      ),

    joining_date:
      firstExistingValue(
        employee,
        [
          "joining_date",
          "joiningDate",
          "date_of_joining",
          "dateOfJoining",
          "start_date",
          "startDate",
        ],
      ),

    location:
      firstExistingValue(
        employee,
        [
          "location",
          "location_name",
          "locationName",
          "city",
          "office_location",
        ],
      ),

    country_code:
      firstExistingValue(
        employee,
        [
          "country_code",
          "countryCode",
          "country",
        ],
      ),

    region_code:
      firstExistingValue(
        employee,
        [
          "region_code",
          "regionCode",
          "state_code",
          "stateCode",
          "state",
        ],
      ),
  };
}

/* =========================================================
   ATTENDANCE SNAPSHOT
========================================================= */

function buildAttendanceSnapshot(
  item = {},
) {
  const workingDays =
    nonNegativeMoney(
      firstExistingValue(
        item,
        [
          "working_days",
          "workingDays",
        ],
      ),
    );

  const paidDays =
    nonNegativeMoney(
      firstExistingValue(
        item,
        [
          "paid_days",
          "paidDays",
        ],
      ),
    );

  const unpaidDays =
    nonNegativeMoney(
      firstExistingValue(
        item,
        [
          "unpaid_days",
          "unpaidDays",
        ],
      ),
    );

  const overtimeHours =
    nonNegativeMoney(
      firstExistingValue(
        item,
        [
          "overtime_hours",
          "overtimeHours",
        ],
      ),
    );

  return {
    working_days:
      workingDays,

    paid_days:
      paidDays,

    unpaid_days:
      unpaidDays,

    overtime_hours:
      overtimeHours,
  };
}

/* =========================================================
   EARNINGS SNAPSHOT
========================================================= */

function buildEarningsSnapshot(
  item = {},
) {
  const baseSalary =
    nonNegativeMoney(
      item.base_salary,
    );

  const allowances =
    nonNegativeMoney(
      item.allowances,
    );

  const overtimePay =
    nonNegativeMoney(
      item.overtime_pay,
    );

  const bonus =
    nonNegativeMoney(
      item.bonus,
    );

  const reimbursements =
    nonNegativeMoney(
      item.reimbursements,
    );

  return [
    {
      code: "BASE_SALARY",
      name: "Base Salary",
      amount: baseSalary,
    },

    {
      code: "ALLOWANCES",
      name: "Allowances",
      amount: allowances,
    },

    {
      code: "OVERTIME",
      name: "Overtime Pay",
      amount: overtimePay,
    },

    {
      code: "BONUS",
      name: "Bonus",
      amount: bonus,
    },

    {
      code: "REIMBURSEMENTS",
      name: "Reimbursements",
      amount: reimbursements,
    },
  ].filter(
    (entry) =>
      entry.amount > 0,
  );
}

/* =========================================================
   DEDUCTION SNAPSHOT
========================================================= */

function buildBasicDeductionSnapshot(
  item = {},
) {
  const fixed =
    nonNegativeMoney(
      item.fixed_deductions,
    );

  const statutory =
    nonNegativeMoney(
      item.statutory_deductions,
    );

  const other =
    nonNegativeMoney(
      item.other_deductions,
    );

  return [
    {
      code: "FIXED_DEDUCTIONS",
      name: "Fixed Deductions",
      amount: fixed,
    },

    {
      code: "STATUTORY_DEDUCTIONS",
      name: "Statutory Deductions",
      amount: statutory,
    },

    {
      code: "OTHER_DEDUCTIONS",
      name: "Other Deductions",
      amount: other,
    },
  ].filter(
    (entry) =>
      entry.amount > 0,
  );
}

/* =========================================================
   STATUTORY DEDUCTION SNAPSHOT
========================================================= */

async function getStatutoryDeductionsForItem(
  organizationId,
  payrollRunItemId,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from(
        "payroll_statutory_deductions",
      )
      .select(`
        id,
        rule_id,
        calculation_base,
        employee_amount,
        employer_amount,
        employee_rate,
        employer_rate,
        rule_snapshot,
        calculation_details,
        statutory_deduction_rules (
          id,
          name,
          code,
          description,
          calculation_method,
          base_component,
          country_code,
          region_code
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_item_id",
        payrollRunItemId,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return data || [];
}

function buildStatutoryDeductionSnapshot(
  rows = [],
) {
  return rows
    .map((row) => {
      const rule =
        row.statutory_deduction_rules ||
        {};

      return {
        id:
          row.id,

        rule_id:
          row.rule_id,

        code:
          rule.code ||
          row.rule_snapshot?.code ||
          null,

        name:
          rule.name ||
          row.rule_snapshot?.name ||
          "Statutory Deduction",

        description:
          rule.description ||
          row.rule_snapshot?.description ||
          null,

        calculation_base:
          money(
            row.calculation_base,
          ),

        employee_rate:
          row.employee_rate ===
          null
            ? null
            : toNumber(
                row.employee_rate,
              ),

        employer_rate:
          row.employer_rate ===
          null
            ? null
            : toNumber(
                row.employer_rate,
              ),

        employee_amount:
          nonNegativeMoney(
            row.employee_amount,
          ),

        employer_amount:
          nonNegativeMoney(
            row.employer_amount,
          ),

        calculation_method:
          rule.calculation_method ||
          row.rule_snapshot
            ?.calculation_method ||
          null,

        base_component:
          rule.base_component ||
          row.rule_snapshot
            ?.base_component ||
          null,

        calculation_details:
          row.calculation_details ||
          {},
      };
    });
}

/* =========================================================
   EMPLOYER CONTRIBUTIONS
========================================================= */

function buildEmployerContributionSnapshot(
  rows = [],
) {
  return rows
    .filter(
      (row) =>
        nonNegativeMoney(
          row.employer_amount,
        ) > 0,
    )
    .map((row) => {
      const rule =
        row.statutory_deduction_rules ||
        {};

      return {
        id:
          row.id,

        rule_id:
          row.rule_id,

        code:
          rule.code ||
          row.rule_snapshot?.code ||
          null,

        name:
          rule.name ||
          row.rule_snapshot?.name ||
          "Employer Contribution",

        amount:
          nonNegativeMoney(
            row.employer_amount,
          ),

        rate:
          row.employer_rate ===
          null
            ? null
            : toNumber(
                row.employer_rate,
              ),
      };
    });
}

/* =========================================================
   PAYROLL RUN ACCESS
========================================================= */

async function getPayrollRun(
  organizationId,
  payrollRunId,
) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  if (!payrollRunId) {
    throw createServiceError(
      "Payroll run is required.",
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
      .eq(
        "id",
        payrollRunId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Payroll run not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   PAYROLL RUN ITEMS
========================================================= */

async function getPayrollRunItems(
  organizationId,
  payrollRunId,
  employeeId = null,
) {
  let query =
    supabaseAdmin
      .from(
        "payroll_run_items",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        payrollRunId,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (employeeId) {
    query =
      query.eq(
        "employee_id",
        employeeId,
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/* =========================================================
   EMPLOYEES
========================================================= */

async function getEmployeesByIds(
  organizationId,
  employeeIds = [],
) {
  const ids =
    uniqueArray(
      employeeIds,
    );

  if (!ids.length) {
    return [];
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .in(
        "id",
        ids,
      );

  if (error) {
    throw error;
  }

  return data || [];
}

function buildEmployeeMap(
  employees = [],
) {
  return new Map(
    employees.map(
      (employee) => [
        employee.id,
        employee,
      ],
    ),
  );
}

/* =========================================================
   PAYSLIP NUMBER
========================================================= */

function formatMonthForNumber(
  payrollMonth,
) {
  const normalized =
    normalizePayrollMonth(
      payrollMonth,
    );

  return normalized
    .slice(0, 7)
    .replace("-", "");
}

function createPayslipNumber(
  payrollMonth,
  employee,
  sequence,
) {
  const month =
    formatMonthForNumber(
      payrollMonth,
    );

  const employeeCode =
    firstExistingValue(
      employee,
      [
        "employee_id",
        "employeeId",
        "employee_code",
        "employeeCode",
        "employee_number",
        "employeeNumber",
        "code",
      ],
    );

  const safeEmployeeCode =
    cleanText(
      employeeCode,
    ) ||
    cleanText(
      employee?.id,
    ) ||
    `EMP${String(
      sequence,
    ).padStart(4, "0")}`;

  const normalizedEmployeeCode =
    String(
      safeEmployeeCode,
    )
      .replace(
        /[^a-zA-Z0-9]/g,
        "",
      )
      .toUpperCase();

  return `PS-${month}-${normalizedEmployeeCode}`;
}

async function ensureUniquePayslipNumber(
  organizationId,
  desiredNumber,
) {
  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .select("id")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payslip_number",
        desiredNumber,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return desiredNumber;
  }

  return `${desiredNumber}-${Date.now()}`;
}

/* =========================================================
   PAYSLIP PAY VALIDATION
========================================================= */

function validatePayrollItem(
  item,
) {
  const errors = [];

  const gross =
    nonNegativeMoney(
      item.gross_pay,
    );

  const deductions =
    nonNegativeMoney(
      item.total_deductions,
    );

  const reimbursements =
    nonNegativeMoney(
      item.reimbursements,
    );

  const net =
    nonNegativeMoney(
      item.net_pay,
    );

  const expectedNet =
    nonNegativeMoney(
      gross -
        deductions +
        reimbursements,
    );

  if (
    Math.abs(
      expectedNet - net,
    ) > 0.01
  ) {
    errors.push(
      `Net pay mismatch. Expected ${expectedNet.toFixed(
        2,
      )}, received ${net.toFixed(2)}.`,
    );
  }

  if (
    gross < 0 ||
    deductions < 0 ||
    reimbursements < 0 ||
    net < 0
  ) {
    errors.push(
      "Payroll contains negative monetary values.",
    );
  }

  return errors;
}

/* =========================================================
   BUILD PAYSLIP
========================================================= */

async function buildPayslipPayload({
  organizationId,
  payrollRun,
  payrollRunItem,
  employee,
  generatedBy = null,
  sequence = 1,
}) {
  if (!employee) {
    throw createServiceError(
      `Employee ${payrollRunItem.employee_id} could not be found.`,
      400,
    );
  }

  const validationErrors =
    validatePayrollItem(
      payrollRunItem,
    );

  if (validationErrors.length) {
    throw createServiceError(
      validationErrors.join(" "),
      400,
    );
  }

  const {
    startDate,
    endDate,
    payrollMonth,
  } =
    getMonthDateRange(
      payrollRun.payroll_month,
    );

  const statutoryRows =
    await getStatutoryDeductionsForItem(
      organizationId,
      payrollRunItem.id,
    );

  const statutoryDeductions =
    buildStatutoryDeductionSnapshot(
      statutoryRows,
    );

  const employerContributions =
    buildEmployerContributionSnapshot(
      statutoryRows,
    );

  const employeeSnapshot =
    buildEmployeeSnapshot(
      employee,
    );

  const attendanceSnapshot =
    buildAttendanceSnapshot(
      payrollRunItem,
    );

  const earnings =
    buildEarningsSnapshot(
      payrollRunItem,
    );

  const basicDeductions =
    buildBasicDeductionSnapshot(
      payrollRunItem,
    );

  const statutoryBasicEntry =
    basicDeductions.find(
      (entry) =>
        entry.code ===
        "STATUTORY_DEDUCTIONS",
    );

  if (
    statutoryBasicEntry
  ) {
    statutoryBasicEntry.details =
      statutoryDeductions;
  }

  const deductions =
    basicDeductions;

  const grossPay =
    nonNegativeMoney(
      payrollRunItem.gross_pay,
    );

  const allowances =
    nonNegativeMoney(
      payrollRunItem.allowances,
    );

  const overtimePay =
    nonNegativeMoney(
      payrollRunItem.overtime_pay,
    );

  const bonus =
    nonNegativeMoney(
      payrollRunItem.bonus,
    );

  const reimbursements =
    nonNegativeMoney(
      payrollRunItem.reimbursements,
    );

  const fixedDeductions =
    nonNegativeMoney(
      payrollRunItem.fixed_deductions,
    );

  const statutoryDeductionTotal =
    nonNegativeMoney(
      payrollRunItem.statutory_deductions,
    );

  const otherDeductions =
    nonNegativeMoney(
      payrollRunItem.other_deductions,
    );

  const totalDeductions =
    nonNegativeMoney(
      payrollRunItem.total_deductions,
    );

  const netPay =
    nonNegativeMoney(
      payrollRunItem.net_pay,
    );

  const totalEmployerContributions =
    money(
      employerContributions.reduce(
        (
          total,
          contribution,
        ) =>
          total +
          nonNegativeMoney(
            contribution.amount,
          ),
        0,
      ),
    );

  const desiredPayslipNumber =
    createPayslipNumber(
      payrollRun.payroll_month,
      employee,
      sequence,
    );

  const payslipNumber =
    await ensureUniquePayslipNumber(
      organizationId,
      desiredPayslipNumber,
    );

  return {
    organization_id:
      organizationId,

    payroll_run_id:
      payrollRun.id,

    payroll_run_item_id:
      payrollRunItem.id,

    employee_id:
      payrollRunItem.employee_id,

    payslip_number:
      payslipNumber,

    payroll_month:
      payrollMonth,

    period_start:
      startDate,

    period_end:
      endDate,

    employee_snapshot:
      employeeSnapshot,

    attendance_snapshot:
      attendanceSnapshot,

    earnings,

    gross_pay:
      grossPay,

    allowances,

    overtime_pay:
      overtimePay,

    bonus,

    reimbursements,

    deductions,

    fixed_deductions:
      fixedDeductions,

    statutory_deductions:
      statutoryDeductionTotal,

    other_deductions:
      otherDeductions,

    total_deductions:
      totalDeductions,

    net_pay:
      netPay,

    employer_contributions:
      employerContributions,

    total_employer_contributions:
      totalEmployerContributions,

    status:
      "generated",

    generated_by:
      generatedBy,

    notes:
      null,
  };
}

/* =========================================================
   GENERATE PAYSLIPS
========================================================= */

export async function generatePayslipsForPayrollRun({
  organizationId,
  payrollRunId,
  userId = null,
  employeeId = null,
} = {}) {
  const payrollRun =
    await getPayrollRun(
      organizationId,
      payrollRunId,
    );

  if (
    payrollRun.status ===
    "draft"
  ) {
    throw createServiceError(
      "Payslips cannot be generated while the payroll run is still in draft status.",
      400,
    );
  }

  const items =
    await getPayrollRunItems(
      organizationId,
      payrollRunId,
      employeeId,
    );

  if (!items.length) {
    throw createServiceError(
      "No payroll employees were found for this run.",
      400,
    );
  }

  const employeeIds =
    items.map(
      (item) =>
        item.employee_id,
    );

  const employees =
    await getEmployeesByIds(
      organizationId,
      employeeIds,
    );

  const employeeMap =
    buildEmployeeMap(
      employees,
    );

  const generated = [];
  const skipped = [];

  let sequence = 1;

  for (const item of items) {
    const employee =
      employeeMap.get(
        item.employee_id,
      );

    if (!employee) {
      skipped.push({
        payroll_run_item_id:
          item.id,

        employee_id:
          item.employee_id,

        reason:
          "Employee record not found.",
      });

      continue;
    }

    const {
      data: existing,
      error: existingError,
    } =
      await supabaseAdmin
        .from("payslips")
        .select("*")
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "payroll_run_item_id",
          item.id,
        )
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      skipped.push({
        payslip:
          existing,

        payroll_run_item_id:
          item.id,

        employee_id:
          item.employee_id,

        reason:
          "Payslip already exists for this payroll item.",
      });

      continue;
    }

    const payload =
      await buildPayslipPayload({
        organizationId,
        payrollRun,
        payrollRunItem:
          item,
        employee,
        generatedBy:
          userId,
        sequence,
      });

    const {
      data,
      error,
    } =
      await supabaseAdmin
        .from("payslips")
        .insert(
          payload,
        )
        .select("*")
        .single();

    if (error) {
      if (
        error.code ===
        "23505"
      ) {
        const {
          data: retryExisting,
          error:
            retryError,
        } =
          await supabaseAdmin
            .from("payslips")
            .select("*")
            .eq(
              "organization_id",
              organizationId,
            )
            .eq(
              "payroll_run_item_id",
              item.id,
            )
            .maybeSingle();

        if (retryError) {
          throw retryError;
        }

        if (retryExisting) {
          skipped.push({
            payslip:
              retryExisting,

            payroll_run_item_id:
              item.id,

            employee_id:
              item.employee_id,

            reason:
              "Payslip already exists for this payroll item.",
          });

          continue;
        }
      }

      throw error;
    }

    generated.push(data);

    sequence += 1;
  }

  return {
    payroll_run:
      payrollRun,

    generated,

    skipped,

    generated_count:
      generated.length,

    skipped_count:
      skipped.length,

    total_items:
      items.length,
  };
}

/* =========================================================
   REGENERATE A SINGLE PAYSLIP
========================================================= */

export async function regeneratePayslip({
  organizationId,
  payslipId,
  userId = null,
} = {}) {
  if (!payslipId) {
    throw createServiceError(
      "Payslip ID is required.",
      400,
    );
  }

  const existing =
    await getPayslipById({
      organizationId,
      payslipId,
    });

  const payrollRun =
    await getPayrollRun(
      organizationId,
      existing.payroll_run_id,
    );

  const items =
    await getPayrollRunItems(
      organizationId,
      existing.payroll_run_id,
      existing.employee_id,
    );

  const payrollRunItem =
    items.find(
      (item) =>
        item.id ===
        existing.payroll_run_item_id,
    );

  if (!payrollRunItem) {
    throw createServiceError(
      "The payroll item associated with this payslip no longer exists.",
      404,
    );
  }

  const employees =
    await getEmployeesByIds(
      organizationId,
      [
        existing.employee_id,
      ],
    );

  const employee =
    employees[0];

  if (!employee) {
    throw createServiceError(
      "The employee associated with this payslip could not be found.",
      404,
    );
  }

  const payload =
    await buildPayslipPayload({
      organizationId,
      payrollRun,
      payrollRunItem,
      employee,
      generatedBy:
        userId,
      sequence: 1,
    });

  const updatePayload = {
    ...payload,

    payslip_number:
      existing.payslip_number,

    status:
      existing.status,

    published_at:
      existing.published_at,

    published_by:
      existing.published_by,

    first_viewed_at:
      existing.first_viewed_at,

    last_viewed_at:
      existing.last_viewed_at,

    downloaded_at:
      existing.downloaded_at,

    pdf_file_path:
      existing.pdf_file_path,

    pdf_generated_at:
      existing.pdf_generated_at,
  };

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update(
        updatePayload,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   GET PAYSLIPS
========================================================= */

export async function getPayslips({
  organizationId,
  payrollRunId = null,
  employeeId = null,
  status = null,
  search = null,
  limit = 50,
  offset = 0,
} = {}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 50,
      1,
    ),
    200,
  );

  const safeOffset =
    Math.max(
      Number(offset) || 0,
      0,
    );

  let query =
    supabaseAdmin
      .from("payslips")
      .select(
        "*",
        {
          count: "exact",
        },
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .order(
        "payroll_month",
        {
          ascending: false,
        },
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .range(
        safeOffset,
        safeOffset +
          safeLimit -
          1,
      );

  if (payrollRunId) {
    query =
      query.eq(
        "payroll_run_id",
        payrollRunId,
      );
  }

  if (employeeId) {
    query =
      query.eq(
        "employee_id",
        employeeId,
      );
  }

  if (status) {
    query =
      query.eq(
        "status",
        status,
      );
  }

  if (search) {
    const safeSearch =
      String(search)
        .trim()
        .replace(
          /[%(),]/g,
          "",
        );

    if (safeSearch) {
      query =
        query.or(
          `payslip_number.ilike.%${safeSearch}%,employee_snapshot->>name.ilike.%${safeSearch}%,employee_snapshot->>employee_id.ilike.%${safeSearch}%`,
        );
    }
  }

  const {
    data,
    error,
    count,
  } =
    await query;

  if (error) {
    throw error;
  }

  return {
    data:
      data || [],

    total:
      count || 0,

    limit:
      safeLimit,

    offset:
      safeOffset,
  };
}

/* =========================================================
   GET SINGLE PAYSLIP
========================================================= */

export async function getPayslipById({
  organizationId,
  payslipId,
} = {}) {
  if (!payslipId) {
    throw createServiceError(
      "Payslip ID is required.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .select(`
        *,
        payroll_runs (
          id,
          payroll_month,
          status,
          employee_count,
          gross_pay,
          total_deductions,
          total_reimbursements,
          net_pay,
          created_at,
          processed_at
        )
      `)
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw createServiceError(
      "Payslip not found.",
      404,
    );
  }

  return data;
}

/* =========================================================
   EMPLOYEE SELF-SERVICE
========================================================= */

export async function getEmployeePayslips({
  organizationId,
  employeeId,
  status = null,
  limit = 50,
  offset = 0,
} = {}) {
  if (!employeeId) {
    throw createServiceError(
      "Employee ID is required.",
      400,
    );
  }

  return getPayslips({
    organizationId,
    employeeId,
    status,
    limit,
    offset,
  });
}

/* =========================================================
   PUBLISH PAYSLIP
========================================================= */

export async function publishPayslip({
  organizationId,
  payslipId,
  userId = null,
} = {}) {
  const payslip =
    await getPayslipById({
      organizationId,
      payslipId,
    });

  if (
    payslip.status ===
    "void"
  ) {
    throw createServiceError(
      "A void payslip cannot be published.",
      400,
    );
  }

  if (
    payslip.status ===
    "published"
  ) {
    return payslip;
  }

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update({
        status:
          "published",

        published_at:
          now,

        published_by:
          userId || null,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   PUBLISH MULTIPLE PAYSLIPS
========================================================= */

export async function publishPayslips({
  organizationId,
  payslipIds = [],
  userId = null,
} = {}) {
  const ids =
    uniqueArray(
      payslipIds,
    );

  if (!ids.length) {
    throw createServiceError(
      "At least one payslip is required.",
      400,
    );
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update({
        status:
          "published",

        published_at:
          new Date().toISOString(),

        published_by:
          userId || null,
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .in(
        "id",
        ids,
      )
      .neq(
        "status",
        "void",
      )
      .select("*");

  if (error) {
    throw error;
  }

  return {
    data:
      data || [],

    published_count:
      data?.length || 0,
  };
}

/* =========================================================
   VOID PAYSLIP
========================================================= */

export async function voidPayslip({
  organizationId,
  payslipId,
} = {}) {
  const payslip =
    await getPayslipById({
      organizationId,
      payslipId,
    });

  if (
    payslip.status ===
    "void"
  ) {
    return payslip;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update({
        status:
          "void",
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   MARK AS VIEWED
========================================================= */

export async function markPayslipViewed({
  organizationId,
  payslipId,
} = {}) {
  const payslip =
    await getPayslipById({
      organizationId,
      payslipId,
    });

  const now =
    new Date().toISOString();

  const updatePayload = {
    last_viewed_at:
      now,
  };

  if (
    !payslip.first_viewed_at
  ) {
    updatePayload.first_viewed_at =
      now;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update(
        updatePayload,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   MARK AS DOWNLOADED
========================================================= */

export async function markPayslipDownloaded({
  organizationId,
  payslipId,
} = {}) {
  await getPayslipById({
    organizationId,
    payslipId,
  });

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update({
        downloaded_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   PDF METADATA
========================================================= */

export async function updatePayslipPdfMetadata({
  organizationId,
  payslipId,
  pdfFilePath,
  pdfGeneratedAt = null,
} = {}) {
  if (!pdfFilePath) {
    throw createServiceError(
      "PDF file path is required.",
      400,
    );
  }

  await getPayslipById({
    organizationId,
    payslipId,
  });

  const {
    data,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .update({
        pdf_file_path:
          pdfFilePath,

        pdf_generated_at:
          pdfGeneratedAt ||
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      )
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

/* =========================================================
   PAYROLL RUN SUMMARY
========================================================= */

export async function getPayslipSummary({
  organizationId,
  payrollRunId = null,
} = {}) {
  if (!organizationId) {
    throw createServiceError(
      "Organization is required.",
      400,
    );
  }

  let query =
    supabaseAdmin
      .from("payslips")
      .select(
        `
          id,
          payroll_run_id,
          employee_id,
          status,
          gross_pay,
          total_deductions,
          reimbursements,
          net_pay,
          total_employer_contributions
        `,
      )
      .eq(
        "organization_id",
        organizationId,
      );

  if (payrollRunId) {
    query =
      query.eq(
        "payroll_run_id",
        payrollRunId,
      );
  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {
    throw error;
  }

  const rows =
    data || [];

  const summary = {
    total:
      rows.length,

    generated:
      rows.filter(
        (row) =>
          row.status ===
          "generated",
      ).length,

    published:
      rows.filter(
        (row) =>
          row.status ===
          "published",
      ).length,

    void:
      rows.filter(
        (row) =>
          row.status ===
          "void",
      ).length,

    gross_pay:
      money(
        rows.reduce(
          (
            total,
            row,
          ) =>
            total +
            nonNegativeMoney(
              row.gross_pay,
            ),
          0,
        ),
      ),

    total_deductions:
      money(
        rows.reduce(
          (
            total,
            row,
          ) =>
            total +
            nonNegativeMoney(
              row.total_deductions,
            ),
          0,
        ),
      ),

    reimbursements:
      money(
        rows.reduce(
          (
            total,
            row,
          ) =>
            total +
            nonNegativeMoney(
              row.reimbursements,
            ),
          0,
        ),
      ),

    net_pay:
      money(
        rows.reduce(
          (
            total,
            row,
          ) =>
            total +
            nonNegativeMoney(
              row.net_pay,
            ),
          0,
        ),
      ),

    employer_contributions:
      money(
        rows.reduce(
          (
            total,
            row,
          ) =>
            total +
            nonNegativeMoney(
              row.total_employer_contributions,
            ),
          0,
        ),
      ),
  };

  return summary;
}

/* =========================================================
   PAYSLIP DELETE
========================================================= */

export async function deletePayslip({
  organizationId,
  payslipId,
} = {}) {
  const payslip =
    await getPayslipById({
      organizationId,
      payslipId,
    });

  if (
    payslip.status ===
    "published"
  ) {
    throw createServiceError(
      "Published payslips cannot be deleted. Void the payslip instead.",
      400,
    );
  }

  const {
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .delete()
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "id",
        payslipId,
      );

  if (error) {
    throw error;
  }

  return {
    success: true,

    id:
      payslipId,
  };
}

/* =========================================================
   BULK GENERATION STATUS
========================================================= */

export async function getPayrollRunPayslipStatus({
  organizationId,
  payrollRunId,
} = {}) {
  const payrollRun =
    await getPayrollRun(
      organizationId,
      payrollRunId,
    );

  const items =
    await getPayrollRunItems(
      organizationId,
      payrollRunId,
    );

  const {
    data: payslips,
    error,
  } =
    await supabaseAdmin
      .from("payslips")
      .select(
        `
          id,
          payroll_run_item_id,
          employee_id,
          payslip_number,
          status,
          created_at,
          published_at,
          first_viewed_at,
          last_viewed_at,
          downloaded_at
        `,
      )
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        payrollRunId,
      );

  if (error) {
    throw error;
  }

  const generatedItems =
    new Set(
      (payslips || []).map(
        (payslip) =>
          payslip.payroll_run_item_id,
      ),
    );

  return {
    payroll_run:
      payrollRun,

    total_payroll_items:
      items.length,

    total_payslips:
      payslips?.length || 0,

    missing_payslips:
      items.filter(
        (item) =>
          !generatedItems.has(
            item.id,
          ),
      ).length,

    generated:
      (payslips || []).filter(
        (payslip) =>
          payslip.status ===
          "generated",
      ).length,

    published:
      (payslips || []).filter(
        (payslip) =>
          payslip.status ===
          "published",
      ).length,

    void:
      (payslips || []).filter(
        (payslip) =>
          payslip.status ===
          "void",
      ).length,

    payslips:
      payslips || [],
  };
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  generatePayslipsForPayrollRun,
  regeneratePayslip,
  getPayslips,
  getPayslipById,
  getEmployeePayslips,
  publishPayslip,
  publishPayslips,
  voidPayslip,
  markPayslipViewed,
  markPayslipDownloaded,
  updatePayslipPdfMetadata,
  getPayslipSummary,
  deletePayslip,
  getPayrollRunPayslipStatus,
};