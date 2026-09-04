import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   PAYROLL COST ANALYTICS SERVICE

   Uses existing payroll data:
   - payroll_runs
   - payroll_run_items
   - employees
   - payroll_statutory_deductions

   No duplicate analytics table is required.
========================================================= */

/* =========================================================
   HELPERS
========================================================= */

function serviceError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Math.round(
    (num(value) + Number.EPSILON) * 100,
  ) / 100;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeDimension(
  value,
  fallback = "Unassigned",
) {
  const cleaned = clean(value);
  return cleaned || fallback;
}

function getEmployeeName(employee = {}) {
  return normalizeDimension(
    employee.full_name ??
      employee.name ??
      employee.employee_name,
    "Unknown Employee",
  );
}

function getEmployeeCode(employee = {}) {
  return clean(
    employee.employee_code ??
      employee.employeeCode ??
      employee.code ??
      employee.employee_id,
  );
}

function getDepartment(employee = {}) {
  return normalizeDimension(
    employee.department ??
      employee.department_name ??
      employee.team ??
      employee.team_name,
    "Unassigned Department",
  );
}

function getLocation(employee = {}) {
  return normalizeDimension(
    employee.location ??
      employee.location_name ??
      employee.office_location ??
      employee.work_location ??
      employee.city ??
      employee.office,
    "Unassigned Location",
  );
}

function getRole(employee = {}) {
  return normalizeDimension(
    employee.title ??
      employee.designation ??
      employee.job_title ??
      employee.position ??
      employee.role,
    "Unassigned Role",
  );
}

function getEmploymentStatus(employee = {}) {
  return clean(
    employee.employment_status ??
      employee.status,
  );
}

function normalizeMonth(value) {
  if (!value) {
    return null;
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}$/.test(raw)) {
    return `${raw}-01`;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;
}

function monthKey(value) {
  if (!value) {
    return null;
  }

  return String(value).slice(0, 7);
}

function monthLabel(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function percentage(part, total) {
  if (!num(total)) {
    return 0;
  }

  return money(
    (num(part) / num(total)) * 100,
  );
}

function average(total, count) {
  if (!num(count)) {
    return 0;
  }

  return money(
    num(total) / num(count),
  );
}

/* =========================================================
   PAGINATED FETCH
========================================================= */

async function fetchAllRows(
  table,
  select,
  buildQuery,
) {
  const pageSize = 1000;
  let offset = 0;
  const rows = [];

  while (true) {
    let query = supabaseAdmin
      .from(table)
      .select(select)
      .range(
        offset,
        offset + pageSize - 1,
      );

    if (typeof buildQuery === "function") {
      query = buildQuery(query);
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      throw error;
    }

    const page =
      Array.isArray(data)
        ? data
        : [];

    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return rows;
}

/* =========================================================
   PAYROLL RUNS
========================================================= */

export async function getAnalyticsPayrollRuns(
  organizationId,
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  return fetchAllRows(
    "payroll_runs",
    `
      id,
      organization_id,
      payroll_month,
      status,
      employee_count,
      gross_pay,
      total_deductions,
      total_reimbursements,
      net_pay,
      created_at,
      updated_at
    `,
    (query) =>
      query
        .eq(
          "organization_id",
          organizationId,
        )
        .order(
          "payroll_month",
          {
            ascending: false,
          },
        ),
  );
}

/* =========================================================
   EMPLOYEES
========================================================= */

async function getEmployees(
  organizationId,
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  return fetchAllRows(
    "employees",
    "*",
    (query) =>
      query
        .eq(
          "organization_id",
          organizationId,
        )
        .order(
          "created_at",
          {
            ascending: true,
          },
        ),
  );
}

/* =========================================================
   PAYROLL RUN ITEMS
========================================================= */

async function getPayrollItems(
  organizationId,
  payrollRunIds = [],
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  let ids = Array.isArray(
    payrollRunIds,
  )
    ? payrollRunIds.filter(Boolean)
    : [];

  if (!ids.length) {
    return [];
  }

  return fetchAllRows(
    "payroll_run_items",
    `
      id,
      payroll_run_id,
      organization_id,
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
      validation_status,
      validation_messages,
      created_at,
      updated_at
    `,
    (query) =>
      query
        .eq(
          "organization_id",
          organizationId,
        )
        .in(
          "payroll_run_id",
          ids,
        ),
  );
}

/* =========================================================
   EMPLOYER STATUTORY CONTRIBUTIONS
========================================================= */

async function getEmployerContributions(
  organizationId,
  payrollRunIds = [],
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  const ids = Array.isArray(
    payrollRunIds,
  )
    ? payrollRunIds.filter(Boolean)
    : [];

  if (!ids.length) {
    return [];
  }

  try {
    return await fetchAllRows(
      "payroll_statutory_deductions",
      `
        id,
        organization_id,
        payroll_run_id,
        payroll_run_item_id,
        employee_id,
        rule_id,
        employee_amount,
        employer_amount,
        created_at
      `,
      (query) =>
        query
          .eq(
            "organization_id",
            organizationId,
          )
          .in(
            "payroll_run_id",
            ids,
          ),
    );
  } catch (error) {
    /*
     * Analytics can still operate using payroll_run_items
     * if the statutory table is unavailable.
     */
    if (
      error?.code === "42P01" ||
      error?.statusCode === 404
    ) {
      return [];
    }

    throw error;
  }
}

/* =========================================================
   BUILD ANALYTICS DATASET
========================================================= */

async function buildAnalyticsDataset({
  organizationId,
  payrollRunId = null,
  payrollMonth = null,
  status = null,
  department = null,
  location = null,
  role = null,
} = {}) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  const normalizedMonth =
    normalizeMonth(
      payrollMonth,
    );

  const runs =
    await getAnalyticsPayrollRuns(
      organizationId,
    );

  const filteredRuns =
    runs.filter((run) => {
      if (
        payrollRunId &&
        run.id !== payrollRunId
      ) {
        return false;
      }

      if (normalizedMonth) {
        const runMonth =
          monthKey(
            run.payroll_month,
          );

        const selectedMonth =
          monthKey(
            normalizedMonth,
          );

        if (
          runMonth !==
          selectedMonth
        ) {
          return false;
        }
      }

      if (
        status &&
        String(run.status)
          .toLowerCase() !==
          String(status)
            .toLowerCase()
      ) {
        return false;
      }

      return true;
    });

  const payrollRunIds =
    filteredRuns.map(
      (run) => run.id,
    );

  if (!payrollRunIds.length) {
    return {
      runs: [],
      employees: [],
      items: [],
      employerContributions: [],
    };
  }

  const [
    employees,
    payrollItems,
    employerContributions,
  ] = await Promise.all([
    getEmployees(
      organizationId,
    ),

    getPayrollItems(
      organizationId,
      payrollRunIds,
    ),

    getEmployerContributions(
      organizationId,
      payrollRunIds,
    ),
  ]);

  const employeeMap =
    new Map(
      employees.map(
        (employee) => [
          employee.id,
          employee,
        ],
      ),
    );

  const runMap =
    new Map(
      filteredRuns.map(
        (run) => [
          run.id,
          run,
        ],
      ),
    );

  const employerContributionMap =
    new Map();

  for (
    const contribution of
      employerContributions
  ) {
    const itemId =
      contribution.payroll_run_item_id;

    const current =
      employerContributionMap.get(
        itemId,
      ) || 0;

    employerContributionMap.set(
      itemId,
      money(
        current +
          num(
            contribution.employer_amount,
          ),
      ),
    );
  }

  const dataset = [];

  for (
    const payrollItem of
      payrollItems
  ) {
    const employee =
      employeeMap.get(
        payrollItem.employee_id,
      ) || {};

    const run =
      runMap.get(
        payrollItem.payroll_run_id,
      );

    if (!run) {
      continue;
    }

    const departmentValue =
      getDepartment(
        employee,
      );

    const locationValue =
      getLocation(
        employee,
      );

    const roleValue =
      getRole(
        employee,
      );

    if (
      department &&
      departmentValue !==
        department
    ) {
      continue;
    }

    if (
      location &&
      locationValue !==
        location
    ) {
      continue;
    }

    if (
      role &&
      roleValue !== role
    ) {
      continue;
    }

    const grossPay =
      money(
        payrollItem.gross_pay,
      );

    const totalDeductions =
      money(
        payrollItem.total_deductions,
      );

    const reimbursements =
      money(
        payrollItem.reimbursements,
      );

    const netPay =
      money(
        payrollItem.net_pay,
      );

    const employerContributions =
      money(
        employerContributionMap.get(
          payrollItem.id,
        ) || 0,
      );

    /*
     * Total employer payroll cost:
     *
     * Gross payroll
     * +
     * Employer statutory contributions
     */
    const totalCost =
      money(
        grossPay +
          employerContributions,
      );

    dataset.push({
      payroll_run_id:
        payrollItem.payroll_run_id,

      payroll_month:
        run.payroll_month,

      payroll_status:
        run.status,

      payroll_run_item_id:
        payrollItem.id,

      employee_id:
        payrollItem.employee_id,

      employee_name:
        getEmployeeName(
          employee,
        ),

      employee_code:
        getEmployeeCode(
          employee,
        ),

      department:
        departmentValue,

      location:
        locationValue,

      role:
        roleValue,

      employment_status:
        getEmploymentStatus(
          employee,
        ),

      working_days:
        num(
          payrollItem.working_days,
        ),

      paid_days:
        num(
          payrollItem.paid_days,
        ),

      unpaid_days:
        num(
          payrollItem.unpaid_days,
        ),

      overtime_hours:
        num(
          payrollItem.overtime_hours,
        ),

      base_salary:
        money(
          payrollItem.base_salary,
        ),

      allowances:
        money(
          payrollItem.allowances,
        ),

      overtime_pay:
        money(
          payrollItem.overtime_pay,
        ),

      bonus:
        money(
          payrollItem.bonus,
        ),

      reimbursements,

      gross_pay:
        grossPay,

      fixed_deductions:
        money(
          payrollItem.fixed_deductions,
        ),

      statutory_deductions:
        money(
          payrollItem.statutory_deductions,
        ),

      other_deductions:
        money(
          payrollItem.other_deductions,
        ),

      total_deductions:
        totalDeductions,

      net_pay:
        netPay,

      employer_contributions:
        employerContributions,

      total_cost:
        totalCost,

      validation_status:
        payrollItem.validation_status,

      validation_messages:
        Array.isArray(
          payrollItem.validation_messages,
        )
          ? payrollItem.validation_messages
          : [],
    });
  }

  return {
    runs: filteredRuns,
    employees,
    items: dataset,
    employerContributions,
  };
}

/* =========================================================
   SUMMARY
========================================================= */

export async function getPayrollCostSummary({
  organizationId,
  payrollRunId = null,
  payrollMonth = null,
  status = null,
  department = null,
  location = null,
  role = null,
} = {}) {
  const dataset =
    await buildAnalyticsDataset({
      organizationId,
      payrollRunId,
      payrollMonth,
      status,
      department,
      location,
      role,
    });

  let grossPay = 0;
  let totalDeductions = 0;
  let totalReimbursements = 0;
  let netPay = 0;
  let employerContributions = 0;
  let totalCost = 0;

  const employeeIds =
    new Set();

  for (
    const item of dataset.items
  ) {
    grossPay +=
      num(item.gross_pay);

    totalDeductions +=
      num(
        item.total_deductions,
      );

    totalReimbursements +=
      num(
        item.reimbursements,
      );

    netPay +=
      num(item.net_pay);

    employerContributions +=
      num(
        item.employer_contributions,
      );

    totalCost +=
      num(item.total_cost);

    if (item.employee_id) {
      employeeIds.add(
        item.employee_id,
      );
    }
  }

  grossPay =
    money(grossPay);

  totalDeductions =
    money(totalDeductions);

  totalReimbursements =
    money(
      totalReimbursements,
    );

  netPay =
    money(netPay);

  employerContributions =
    money(
      employerContributions,
    );

  totalCost =
    money(totalCost);

  return {
    filters: {
      payroll_run_id:
        payrollRunId,

      payroll_month:
        payrollMonth || null,

      status:
        status || null,

      department:
        department || null,

      location:
        location || null,

      role:
        role || null,
    },

    payroll_run_count:
      dataset.runs.length,

    payroll_item_count:
      dataset.items.length,

    employee_count:
      employeeIds.size,

    gross_pay:
      grossPay,

    total_deductions:
      totalDeductions,

    total_reimbursements:
      totalReimbursements,

    net_pay:
      netPay,

    employer_contributions:
      employerContributions,

    total_cost:
      totalCost,

    average_cost_per_employee:
      average(
        totalCost,
        employeeIds.size,
      ),

    average_gross_pay_per_employee:
      average(
        grossPay,
        employeeIds.size,
      ),

    average_net_pay_per_employee:
      average(
        netPay,
        employeeIds.size,
      ),

    deduction_rate:
      percentage(
        totalDeductions,
        grossPay,
      ),

    reimbursement_rate:
      percentage(
        totalReimbursements,
        grossPay,
      ),

    employer_contribution_rate:
      percentage(
        employerContributions,
        grossPay,
      ),
  };
}

/* =========================================================
   DIMENSION BREAKDOWN
========================================================= */

function buildDimensionBreakdown(
  items,
  dimension,
) {
  const groups =
    new Map();

  for (
    const item of items
  ) {
    const key =
      normalizeDimension(
        item[dimension],
      );

    let group =
      groups.get(key);

    if (!group) {
      group = {
        dimension_value:
          key,

        employee_ids:
          new Set(),

        payroll_run_ids:
          new Set(),

        gross_pay: 0,

        total_deductions: 0,

        total_reimbursements: 0,

        net_pay: 0,

        employer_contributions: 0,

        total_cost: 0,

        overtime_pay: 0,

        bonus: 0,

        allowances: 0,
      };

      groups.set(
        key,
        group,
      );
    }

    if (item.employee_id) {
      group.employee_ids.add(
        item.employee_id,
      );
    }

    if (item.payroll_run_id) {
      group.payroll_run_ids.add(
        item.payroll_run_id,
      );
    }

    group.gross_pay +=
      num(item.gross_pay);

    group.total_deductions +=
      num(
        item.total_deductions,
      );

    group.total_reimbursements +=
      num(
        item.reimbursements,
      );

    group.net_pay +=
      num(item.net_pay);

    group.employer_contributions +=
      num(
        item.employer_contributions,
      );

    group.total_cost +=
      num(item.total_cost);

    group.overtime_pay +=
      num(item.overtime_pay);

    group.bonus +=
      num(item.bonus);

    group.allowances +=
      num(item.allowances);
  }

  return [
    ...groups.values(),
  ]
    .map((group) => {
      const employeeCount =
        group.employee_ids.size;

      return {
        dimension:
          dimension,

        dimension_value:
          group.dimension_value,

        employee_count:
          employeeCount,

        payroll_run_count:
          group.payroll_run_ids.size,

        gross_pay:
          money(
            group.gross_pay,
          ),

        total_deductions:
          money(
            group.total_deductions,
          ),

        total_reimbursements:
          money(
            group.total_reimbursements,
          ),

        net_pay:
          money(group.net_pay),

        employer_contributions:
          money(
            group.employer_contributions,
          ),

        total_cost:
          money(
            group.total_cost,
          ),

        overtime_pay:
          money(
            group.overtime_pay,
          ),

        bonus:
          money(group.bonus),

        allowances:
          money(
            group.allowances,
          ),

        average_cost_per_employee:
          average(
            group.total_cost,
            employeeCount,
          ),

        average_gross_pay_per_employee:
          average(
            group.gross_pay,
            employeeCount,
          ),

        average_net_pay_per_employee:
          average(
            group.net_pay,
            employeeCount,
          ),
      };
    })
    .sort(
      (a, b) =>
        num(b.total_cost) -
        num(a.total_cost),
    );
}

/* =========================================================
   DEPARTMENT BREAKDOWN
========================================================= */

export async function getPayrollCostByDepartment(
  options = {},
) {
  const dataset =
    await buildAnalyticsDataset(
      options,
    );

  const rows =
    buildDimensionBreakdown(
      dataset.items,
      "department",
    );

  const total =
    rows.reduce(
      (sum, row) =>
        sum +
        num(row.total_cost),
      0,
    );

  return rows.map(
    (row) => ({
      ...row,

      cost_percentage:
        percentage(
          row.total_cost,
          total,
        ),
    }),
  );
}

/* =========================================================
   LOCATION BREAKDOWN
========================================================= */

export async function getPayrollCostByLocation(
  options = {},
) {
  const dataset =
    await buildAnalyticsDataset(
      options,
    );

  const rows =
    buildDimensionBreakdown(
      dataset.items,
      "location",
    );

  const total =
    rows.reduce(
      (sum, row) =>
        sum +
        num(row.total_cost),
      0,
    );

  return rows.map(
    (row) => ({
      ...row,

      cost_percentage:
        percentage(
          row.total_cost,
          total,
        ),
    }),
  );
}

/* =========================================================
   ROLE BREAKDOWN
========================================================= */

export async function getPayrollCostByRole(
  options = {},
) {
  const dataset =
    await buildAnalyticsDataset(
      options,
    );

  const rows =
    buildDimensionBreakdown(
      dataset.items,
      "role",
    );

  const total =
    rows.reduce(
      (sum, row) =>
        sum +
        num(row.total_cost),
      0,
    );

  return rows.map(
    (row) => ({
      ...row,

      cost_percentage:
        percentage(
          row.total_cost,
          total,
        ),
    }),
  );
}

/* =========================================================
   MONTHLY TREND
========================================================= */

export async function getPayrollCostTrend({
  organizationId,
  startMonth = null,
  endMonth = null,
  status = null,
} = {}) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  const runs =
    await getAnalyticsPayrollRuns(
      organizationId,
    );

  const start =
    normalizeMonth(
      startMonth,
    );

  const end =
    normalizeMonth(
      endMonth,
    );

  const startKey =
    monthKey(start);

  const endKey =
    monthKey(end);

  const filteredRuns =
    runs.filter((run) => {
      const currentMonth =
        monthKey(
          run.payroll_month,
        );

      if (!currentMonth) {
        return false;
      }

      if (
        startKey &&
        currentMonth <
          startKey
      ) {
        return false;
      }

      if (
        endKey &&
        currentMonth >
          endKey
      ) {
        return false;
      }

      if (
        status &&
        String(run.status)
          .toLowerCase() !==
          String(status)
            .toLowerCase()
      ) {
        return false;
      }

      return true;
    });

  if (!filteredRuns.length) {
    return [];
  }

  const runIds =
    filteredRuns.map(
      (run) => run.id,
    );

  const [
    items,
    contributions,
  ] = await Promise.all([
    getPayrollItems(
      organizationId,
      runIds,
    ),

    getEmployerContributions(
      organizationId,
      runIds,
    ),
  ]);

  const contributionMap =
    new Map();

  for (
    const contribution of
      contributions
  ) {
    const itemId =
      contribution.payroll_run_item_id;

    const current =
      contributionMap.get(
        itemId,
      ) || 0;

    contributionMap.set(
      itemId,
      money(
        current +
          num(
            contribution.employer_amount,
          ),
      ),
    );
  }

  const runMap =
    new Map(
      filteredRuns.map(
        (run) => [
          run.id,
          run,
        ],
      ),
    );

  const groups =
    new Map();

  for (
    const item of items
  ) {
    const run =
      runMap.get(
        item.payroll_run_id,
      );

    if (!run) {
      continue;
    }

    const key =
      monthKey(
        run.payroll_month,
      );

    if (!key) {
      continue;
    }

    let group =
      groups.get(key);

    if (!group) {
      group = {
        payroll_month:
          run.payroll_month,

        employee_ids:
          new Set(),

        payroll_run_ids:
          new Set(),

        gross_pay: 0,

        total_deductions: 0,

        total_reimbursements: 0,

        net_pay: 0,

        employer_contributions: 0,

        total_cost: 0,
      };

      groups.set(
        key,
        group,
      );
    }

    if (item.employee_id) {
      group.employee_ids.add(
        item.employee_id,
      );
    }

    group.payroll_run_ids.add(
      item.payroll_run_id,
    );

    const employerContribution =
      num(
        contributionMap.get(
          item.id,
        ) || 0,
      );

    group.gross_pay +=
      num(item.gross_pay);

    group.total_deductions +=
      num(
        item.total_deductions,
      );

    group.total_reimbursements +=
      num(
        item.reimbursements,
      );

    group.net_pay +=
      num(item.net_pay);

    group.employer_contributions +=
      employerContribution;

    group.total_cost +=
      num(item.gross_pay) +
      employerContribution;
  }

  return [
    ...groups.entries(),
  ]
    .sort(
      ([a], [b]) =>
        a.localeCompare(b),
    )
    .map(
      ([month, group]) => {
        const employeeCount =
          group.employee_ids.size;

        return {
          payroll_month:
            group.payroll_month,

          month,

          label:
            monthLabel(
              group.payroll_month,
            ),

          employee_count:
            employeeCount,

          payroll_run_count:
            group.payroll_run_ids.size,

          gross_pay:
            money(
              group.gross_pay,
            ),

          total_deductions:
            money(
              group.total_deductions,
            ),

          total_reimbursements:
            money(
              group.total_reimbursements,
            ),

          net_pay:
            money(group.net_pay),

          employer_contributions:
            money(
              group.employer_contributions,
            ),

          total_cost:
            money(
              group.total_cost,
            ),

          average_cost_per_employee:
            average(
              group.total_cost,
              employeeCount,
            ),
        };
      },
    );
}

/* =========================================================
   EMPLOYEE DETAIL
========================================================= */

export async function getPayrollCostByEmployee(
  options = {},
) {
  const dataset =
    await buildAnalyticsDataset(
      options,
    );

  return dataset.items
    .map((item) => ({
      payroll_run_id:
        item.payroll_run_id,

      payroll_month:
        item.payroll_month,

      payroll_status:
        item.payroll_status,

      employee_id:
        item.employee_id,

      employee_name:
        item.employee_name,

      employee_code:
        item.employee_code,

      department:
        item.department,

      location:
        item.location,

      role:
        item.role,

      employment_status:
        item.employment_status,

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

      employer_contributions:
        item.employer_contributions,

      total_cost:
        item.total_cost,

      working_days:
        item.working_days,

      paid_days:
        item.paid_days,

      unpaid_days:
        item.unpaid_days,

      overtime_hours:
        item.overtime_hours,
    }))
    .sort(
      (a, b) =>
        num(b.total_cost) -
        num(a.total_cost),
    );
}

/* =========================================================
   FILTER OPTIONS
========================================================= */

export async function getPayrollCostFilters(
  organizationId,
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  const [
    runs,
    employees,
  ] = await Promise.all([
    getAnalyticsPayrollRuns(
      organizationId,
    ),

    getEmployees(
      organizationId,
    ),
  ]);

  const departments = [
    ...new Set(
      employees
        .map(
          (employee) =>
            getDepartment(
              employee,
            ),
        )
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b),
  );

  const locations = [
    ...new Set(
      employees
        .map(
          (employee) =>
            getLocation(
              employee,
            ),
        )
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b),
  );

  const roles = [
    ...new Set(
      employees
        .map(
          (employee) =>
            getRole(
              employee,
            ),
        )
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b),
  );

  const months = [
    ...new Set(
      runs
        .map(
          (run) =>
            monthKey(
              run.payroll_month,
            ),
        )
        .filter(Boolean),
    ),
  ].sort().reverse();

  const statuses = [
    ...new Set(
      runs
        .map(
          (run) =>
            clean(run.status),
        )
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b),
  );

  return {
    months,
    statuses,
    departments,
    locations,
    roles,
  };
}

/* =========================================================
   COMPLETE DASHBOARD
========================================================= */

export async function getPayrollCostAnalytics(
  options = {},
) {
  const [
    summary,
    byDepartment,
    byLocation,
    byRole,
    employees,
  ] = await Promise.all([
    getPayrollCostSummary(
      options,
    ),

    getPayrollCostByDepartment(
      options,
    ),

    getPayrollCostByLocation(
      options,
    ),

    getPayrollCostByRole(
      options,
    ),

    getPayrollCostByEmployee(
      options,
    ),
  ]);

  return {
    summary,

    breakdowns: {
      department:
        byDepartment,

      location:
        byLocation,

      role:
        byRole,
    },

    employees,

    generated_at:
      new Date().toISOString(),
  };
}