import { supabaseAdmin } from "../config/supabase.js";

/* =========================================================
   STATUTORY DEDUCTION ENGINE
   All statutory values come from Supabase rules.
========================================================= */

function serviceError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function num(value, fallback = 0) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  return Math.round(
    (num(value) + Number.EPSILON) * 100,
  ) / 100;
}

function nonNegative(value) {
  return Math.max(0, money(value));
}

function text(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const result = String(value).trim();

  return result || null;
}

function date(value, field = "Date") {
  const valueText = text(value);

  if (
    !valueText ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valueText)
  ) {
    throw serviceError(
      `${field} must be in YYYY-MM-DD format.`,
      400,
    );
  }

  const parsed = new Date(
    `${valueText}T00:00:00Z`,
  );

  if (Number.isNaN(parsed.getTime())) {
    throw serviceError(
      `Invalid ${field.toLowerCase()}.`,
      400,
    );
  }

  return valueText;
}

function month(value) {
  const valueText = text(value);

  if (!valueText) {
    throw serviceError(
      "Payroll month is required.",
      400,
    );
  }

  if (/^\d{4}-\d{2}$/.test(valueText)) {
    const monthNumber = Number(
      valueText.slice(5),
    );

    if (
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      throw serviceError(
        "Invalid payroll month.",
        400,
      );
    }

    return `${valueText}-01`;
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      valueText,
    )
  ) {
    return date(
      valueText,
      "Payroll month",
    );
  }

  throw serviceError(
    "Payroll month must be in YYYY-MM format.",
    400,
  );
}

function monthEnd(payrollMonth) {
  const start = new Date(
    `${payrollMonth}T00:00:00Z`,
  );

  return new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      0,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

function first(object, fields) {
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

function employeeValue(
  employee,
  fields,
) {
  return text(
    first(employee, fields),
  );
}

function employeeStatus(employee) {
  return employeeValue(employee, [
    "employment_status",
    "employmentStatus",
    "status",
  ]);
}

function employeeDepartment(employee) {
  return employeeValue(employee, [
    "department",
    "department_name",
    "departmentName",
    "team",
    "function",
    "business_unit",
    "businessUnit",
  ]);
}

function employeeTitle(employee) {
  return employeeValue(employee, [
    "title",
    "job_title",
    "jobTitle",
    "designation",
    "position",
    "role",
  ]);
}

function employeeCountry(employee) {
  return (
    employeeValue(employee, [
      "country_code",
      "countryCode",
      "country",
    ])?.toUpperCase() || null
  );
}

function employeeRegion(employee) {
  return (
    employeeValue(employee, [
      "region_code",
      "regionCode",
      "state_code",
      "stateCode",
      "state",
      "province",
      "region",
    ])?.toUpperCase() || null
  );
}

function arrayValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((v) => text(v)?.toLowerCase())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function eligible(rule, employee) {
  const config =
    rule?.eligibility_rules || {};

  const status =
    employeeStatus(employee)?.toLowerCase();

  const department =
    employeeDepartment(
      employee,
    )?.toLowerCase();

  const title =
    employeeTitle(employee)?.toLowerCase();

  const id =
    text(employee?.id)?.toLowerCase();

  const excluded = arrayValue(
    config.exclude_employee_ids ??
      config.excludeEmployeeIds,
  );

  const included = arrayValue(
    config.employee_ids ??
      config.employeeIds,
  );

  const statuses = arrayValue(
    config.employment_status ??
      config.employmentStatuses,
  );

  const departments = arrayValue(
    config.departments,
  );

  const titles = arrayValue(
    config.titles ??
      config.job_titles ??
      config.jobTitles,
  );

  if (
    id &&
    excluded.includes(id)
  ) {
    return false;
  }

  if (
    included.length &&
    (!id || !included.includes(id))
  ) {
    return false;
  }

  if (
    statuses.length &&
    (!status || !statuses.includes(status))
  ) {
    return false;
  }

  if (
    departments.length &&
    (!department ||
      !departments.includes(department))
  ) {
    return false;
  }

  if (
    titles.length &&
    (!title ||
      !titles.includes(title))
  ) {
    return false;
  }

  return true;
}

function applies(rule, employee) {
  const country =
    employeeCountry(employee);

  const region =
    employeeRegion(employee);

  if (
    rule.country_code &&
    (!country ||
      rule.country_code.toUpperCase() !==
        country)
  ) {
    return false;
  }

  if (
    rule.region_code &&
    (!region ||
      rule.region_code.toUpperCase() !==
        region)
  ) {
    return false;
  }

  return eligible(
    rule,
    employee,
  );
}

/* =========================================================
   RULE NORMALIZATION
========================================================= */

function normalizeRule(input = {}) {
  const method =
    text(
      input.calculation_method ??
        input.calculationMethod,
    )?.toLowerCase() ||
    "percentage";

  const type =
    text(
      input.deduction_type ??
        input.deductionType,
    )?.toLowerCase() ||
    "employee";

  const status =
    text(input.status)?.toLowerCase() ||
    "draft";

  const base =
    text(
      input.base_component ??
        input.baseComponent,
    ) || "gross_pay";

  const effectiveFrom = date(
    input.effective_from ??
      input.effectiveFrom,
    "Effective from",
  );

  const effectiveToValue =
    input.effective_to ??
    input.effectiveTo ??
    null;

  const effectiveTo =
    effectiveToValue
      ? date(
          effectiveToValue,
          "Effective to",
        )
      : null;

  if (
    ![
      "percentage",
      "fixed",
      "percentage_capped",
      "progressive",
    ].includes(method)
  ) {
    throw serviceError(
      "Invalid statutory calculation method.",
      400,
    );
  }

  if (
    ![
      "employee",
      "employer",
      "both",
    ].includes(type)
  ) {
    throw serviceError(
      "Invalid statutory deduction type.",
      400,
    );
  }

  if (
    ![
      "draft",
      "active",
      "inactive",
      "expired",
    ].includes(status)
  ) {
    throw serviceError(
      "Invalid statutory rule status.",
      400,
    );
  }

  if (
    effectiveTo &&
    effectiveTo < effectiveFrom
  ) {
    throw serviceError(
      "Effective to cannot be before effective from.",
      400,
    );
  }

  const employeeRateInput =
    input.employee_rate ??
    input.employeeRate;

  const employerRateInput =
    input.employer_rate ??
    input.employerRate;

  const fixedInput =
    input.fixed_amount ??
    input.fixedAmount;

  const capInput =
    input.cap_amount ??
    input.capAmount;

  const brackets =
    Array.isArray(input.brackets)
      ? input.brackets.map((b) => ({
          up_to:
            b?.up_to === null ||
            b?.up_to === undefined ||
            b?.up_to === ""
              ? null
              : nonNegative(
                  b.up_to,
                ),

          rate: Math.max(
            0,
            num(b?.rate),
          ),
        }))
      : [];

  if (
    method === "progressive" &&
    !brackets.length
  ) {
    throw serviceError(
      "Progressive rules require at least one bracket.",
      400,
    );
  }

  if (
    (method === "percentage" ||
      method === "percentage_capped") &&
    employeeRateInput === undefined &&
    employerRateInput === undefined
  ) {
    throw serviceError(
      "A percentage rule requires an employee rate, employer rate, or both.",
      400,
    );
  }

  if (
    method === "fixed" &&
    (fixedInput === undefined ||
      fixedInput === null ||
      fixedInput === "")
  ) {
    throw serviceError(
      "A fixed rule requires a fixed amount.",
      400,
    );
  }

  return {
    name: text(input.name),

    code:
      text(input.code)?.toUpperCase(),

    description:
      text(input.description),

    country_code:
      text(
        input.country_code ??
          input.countryCode,
      )?.toUpperCase() || null,

    region_code:
      text(
        input.region_code ??
          input.regionCode,
      )?.toUpperCase() || null,

    deduction_type: type,

    calculation_method:
      method,

    base_component: base,

    employee_rate:
      employeeRateInput === null ||
      employeeRateInput === undefined ||
      employeeRateInput === ""
        ? null
        : num(employeeRateInput),

    employer_rate:
      employerRateInput === null ||
      employerRateInput === undefined ||
      employerRateInput === ""
        ? null
        : num(employerRateInput),

    fixed_amount:
      fixedInput === null ||
      fixedInput === undefined ||
      fixedInput === ""
        ? null
        : nonNegative(fixedInput),

    cap_amount:
      capInput === null ||
      capInput === undefined ||
      capInput === ""
        ? null
        : nonNegative(capInput),

    minimum_base: nonNegative(
      input.minimum_base ??
        input.minimumBase ??
        0,
    ),

    brackets,

    eligibility_rules:
      input.eligibility_rules ??
      input.eligibilityRules ??
      {},

    configuration:
      input.configuration ?? {},

    effective_from:
      effectiveFrom,

    effective_to:
      effectiveTo,

    status,

    priority: Math.max(
      0,
      Math.trunc(
        num(input.priority, 100),
      ),
    ),
  };
}

function validateRule(rule) {
  if (!rule.name) {
    throw serviceError(
      "Statutory rule name is required.",
      400,
    );
  }

  if (!rule.code) {
    throw serviceError(
      "Statutory rule code is required.",
      400,
    );
  }

  if (
    !/^[A-Z0-9][A-Z0-9_.-]*$/.test(
      rule.code,
    )
  ) {
    throw serviceError(
      "Rule code may contain only letters, numbers, dots, underscores, and hyphens.",
      400,
    );
  }

  if (
    rule.employee_rate !== null &&
    rule.employee_rate < 0
  ) {
    throw serviceError(
      "Employee rate cannot be negative.",
      400,
    );
  }

  if (
    rule.employer_rate !== null &&
    rule.employer_rate < 0
  ) {
    throw serviceError(
      "Employer rate cannot be negative.",
      400,
    );
  }

  if (
    rule.calculation_method ===
      "percentage_capped" &&
    rule.cap_amount === null
  ) {
    throw serviceError(
      "A capped percentage rule requires a cap amount.",
      400,
    );
  }

  if (
    rule.calculation_method ===
    "progressive"
  ) {
    const finite =
      rule.brackets
        .filter(
          (b) => b.up_to !== null,
        )
        .sort(
          (a, b) =>
            a.up_to - b.up_to,
        );

    for (
      let i = 1;
      i < finite.length;
      i++
    ) {
      if (
        finite[i].up_to <=
        finite[i - 1].up_to
      ) {
        throw serviceError(
          "Progressive brackets must have increasing upper limits.",
          400,
        );
      }
    }
  }

  return rule;
}

/* =========================================================
   RULE CRUD
========================================================= */

export async function getStatutoryRules({
  organizationId,
  status = null,
  countryCode = null,
  regionCode = null,
} = {}) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  let query =
    supabaseAdmin
      .from(
        "statutory_deduction_rules",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .order("priority", {
        ascending: true,
      })
      .order("effective_from", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

  if (status) {
    query = query.eq(
      "status",
      text(status).toLowerCase(),
    );
  }

  if (countryCode) {
    query = query.eq(
      "country_code",
      text(countryCode).toUpperCase(),
    );
  }

  if (regionCode) {
    query = query.eq(
      "region_code",
      text(regionCode).toUpperCase(),
    );
  }

  const { data, error } =
    await query;

  if (error) throw error;

  return data || [];
}

export async function getStatutoryRule({
  organizationId,
  ruleId,
} = {}) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  if (!ruleId) {
    throw serviceError(
      "Statutory rule ID is required.",
      400,
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from(
        "statutory_deduction_rules",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("id", ruleId)
      .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw serviceError(
      "Statutory rule not found.",
      404,
    );
  }

  return data;
}

export async function createStatutoryRule({
  organizationId,
  userId = null,
  rule = {},
} = {}) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  const normalized =
    validateRule(
      normalizeRule(rule),
    );

  const {
    data: duplicate,
    error: duplicateError,
  } = await supabaseAdmin
    .from(
      "statutory_deduction_rules",
    )
    .select("id")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "code",
      normalized.code,
    )
    .eq(
      "effective_from",
      normalized.effective_from,
    )
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw serviceError(
      `A statutory rule with code ${normalized.code} already exists for that effective date.`,
      409,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "statutory_deduction_rules",
    )
    .insert({
      organization_id:
        organizationId,

      ...normalized,

      created_by:
        userId || null,

      updated_by:
        userId || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function updateStatutoryRule({
  organizationId,
  userId = null,
  ruleId,
  rule = {},
} = {}) {
  const existing =
    await getStatutoryRule({
      organizationId,
      ruleId,
    });

  /*
   * The frontend sends camelCase fields while Supabase
   * stores snake_case fields.
   *
   * Explicitly synchronize every submitted camelCase field
   * to its database equivalent.
   *
   * This is important when editing values such as:
   *
   * employeeRate: 12
   *
   * because the existing database row may still contain:
   *
   * employee_rate: 10
   *
   * Without this mapping the old snake_case value can win.
   */

  const mergedRule = {
    ...existing,
    ...rule,
  };

  const fieldMappings = [
    [
      "calculationMethod",
      "calculation_method",
    ],
    [
      "deductionType",
      "deduction_type",
    ],
    [
      "baseComponent",
      "base_component",
    ],
    [
      "employeeRate",
      "employee_rate",
    ],
    [
      "employerRate",
      "employer_rate",
    ],
    [
      "fixedAmount",
      "fixed_amount",
    ],
    [
      "capAmount",
      "cap_amount",
    ],
    [
      "minimumBase",
      "minimum_base",
    ],
    [
      "effectiveFrom",
      "effective_from",
    ],
    [
      "effectiveTo",
      "effective_to",
    ],
    [
      "countryCode",
      "country_code",
    ],
    [
      "regionCode",
      "region_code",
    ],
    [
      "eligibilityRules",
      "eligibility_rules",
    ],
    [
      "configuration",
      "configuration",
    ],
    [
      "brackets",
      "brackets",
    ],
    [
      "priority",
      "priority",
    ],
    [
      "status",
      "status",
    ],
  ];

  for (
    const [
      camelCaseField,
      snakeCaseField,
    ]
    of fieldMappings
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        rule,
        camelCaseField,
      )
    ) {
      mergedRule[
        snakeCaseField
      ] =
        rule[
          camelCaseField
        ];
    }
  }

  const normalized =
    validateRule(
      normalizeRule(
        mergedRule,
      ),
    );

  const {
    data: duplicate,
    error: duplicateError,
  } = await supabaseAdmin
    .from(
      "statutory_deduction_rules",
    )
    .select("id")
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "code",
      normalized.code,
    )
    .eq(
      "effective_from",
      normalized.effective_from,
    )
    .neq(
      "id",
      ruleId,
    )
    .maybeSingle();

  if (duplicateError) {
    throw duplicateError;
  }

  if (duplicate) {
    throw serviceError(
      `A statutory rule with code ${normalized.code} already exists for that effective date.`,
      409,
    );
  }

  const {
    data,
    error,
  } = await supabaseAdmin
    .from(
      "statutory_deduction_rules",
    )
    .update({
      ...normalized,

      updated_by:
        userId || null,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      ruleId,
    )
    .select("*")
    .single();

  if (error) throw error;

  return data;
}

export async function deleteStatutoryRule({
  organizationId,
  ruleId,
} = {}) {
  await getStatutoryRule({
    organizationId,
    ruleId,
  });

  const {
    count,
    error: countError,
  } = await supabaseAdmin
    .from(
      "payroll_statutory_deductions",
    )
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "rule_id",
      ruleId,
    );

  if (countError) {
    throw countError;
  }

  if (count > 0) {
    throw serviceError(
      "This statutory rule has already been used in payroll calculations and cannot be deleted. Deactivate it instead.",
      409,
    );
  }

  const {
    error,
  } = await supabaseAdmin
    .from(
      "statutory_deduction_rules",
    )
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      ruleId,
    );

  if (error) throw error;

  return {
    deleted: true,
    id: ruleId,
  };
}

/* =========================================================
   CALCULATION ENGINE
========================================================= */

function calculationBase(
  rule,
  item,
) {
  const values = {
    base_salary:
      num(item?.base_salary),

    gross_pay:
      num(item?.gross_pay),

    allowances:
      num(item?.allowances),

    overtime_pay:
      num(item?.overtime_pay),

    bonus:
      num(item?.bonus),

    reimbursements:
      num(item?.reimbursements),

    fixed_deductions:
      num(item?.fixed_deductions),

    other_deductions:
      num(item?.other_deductions),

    statutory_deductions:
      num(
        item?.statutory_deductions,
      ),

    net_pay:
      num(item?.net_pay),
  };

  const value =
    values[rule.base_component] ??
    item?.[rule.base_component] ??
    0;

  return money(
    Math.max(
      nonNegative(value),
      nonNegative(
        rule.minimum_base,
      ),
    ),
  );
}

function percentage(
  base,
  rate,
) {
  return money(
    base *
      (num(rate) / 100),
  );
}

function progressive(
  base,
  brackets,
) {
  const ordered =
    [...(brackets || [])]
      .map((b) => ({
        up_to:
          b?.up_to === null ||
          b?.up_to === undefined ||
          b?.up_to === ""
            ? null
            : nonNegative(
                b.up_to,
              ),

        rate: Math.max(
          0,
          num(b?.rate),
        ),
      }))
      .sort((a, b) =>
        a.up_to === null
          ? 1
          : b.up_to === null
            ? -1
            : a.up_to -
              b.up_to,
      );

  let remaining =
    nonNegative(base);

  let previous = 0;
  let total = 0;

  const details = [];

  for (const bracket of ordered) {
    if (remaining <= 0) break;

    const upper =
      bracket.up_to === null
        ? null
        : Math.max(
            previous,
            bracket.up_to,
          );

    const taxable =
      upper === null
        ? remaining
        : Math.min(
            remaining,
            Math.max(
              0,
              upper - previous,
            ),
          );

    if (taxable > 0) {
      const amount =
        percentage(
          taxable,
          bracket.rate,
        );

      total = money(
        total + amount,
      );

      details.push({
        from:
          money(previous),

        to:
          upper,

        taxable_amount:
          money(taxable),

        rate:
          bracket.rate,

        amount,
      });

      remaining = money(
        remaining - taxable,
      );
    }

    if (upper !== null) {
      previous = upper;
    }
  }

  return {
    amount: money(total),
    details,
  };
}

function calculateSide(
  rule,
  base,
  side,
) {
  if (
    rule.deduction_type ===
      "employee" &&
    side === "employer"
  ) {
    return {
      amount: 0,
      rate: null,
      details: {
        reason:
          "Employee-only rule.",
      },
    };
  }

  if (
    rule.deduction_type ===
      "employer" &&
    side === "employee"
  ) {
    return {
      amount: 0,
      rate: null,
      details: {
        reason:
          "Employer-only rule.",
      },
    };
  }

  if (
    rule.calculation_method ===
    "fixed"
  ) {
    return {
      amount:
        nonNegative(
          rule.fixed_amount,
        ),

      rate: null,

      details: {
        method: "fixed",

        fixed_amount:
          nonNegative(
            rule.fixed_amount,
          ),
      },
    };
  }

  if (
    rule.calculation_method ===
    "progressive"
  ) {
    const result =
      progressive(
        base,
        rule.brackets,
      );

    return {
      amount: result.amount,

      rate: null,

      details: {
        method:
          "progressive",

        brackets:
          result.details,
      },
    };
  }

  const rate =
    side === "employer"
      ? rule.employer_rate
      : rule.employee_rate;

  const cappedBase =
    rule.calculation_method ===
      "percentage_capped" &&
    rule.cap_amount !== null
      ? Math.min(
          base,
          nonNegative(
            rule.cap_amount,
          ),
        )
      : base;

  return {
    amount:
      percentage(
        cappedBase,
        rate,
      ),

    rate:
      rate === null ||
      rate === undefined
        ? null
        : num(rate),

    details: {
      method:
        rule.calculation_method,

      original_base:
        base,

      calculation_base:
        money(cappedBase),

      rate:
        rate ?? null,

      cap_amount:
        rule.cap_amount ?? null,
    },
  };
}

function effective(
  rule,
  payrollMonth,
) {
  return (
    rule.status === "active" &&
    rule.effective_from <=
      monthEnd(payrollMonth) &&
    (!rule.effective_to ||
      rule.effective_to >=
        payrollMonth)
  );
}

export function calculateStatutoryDeductionsForEmployee({
  employee,
  payrollItem,
  rules = [],
  payrollMonth,
} = {}) {
  if (!employee?.id) {
    throw serviceError(
      "Employee is required for statutory calculation.",
      400,
    );
  }

  let employeeAmount = 0;
  let employerAmount = 0;

  const deductions = [];
  const warnings = [];

  const applicableRules =
    rules
      .filter(
        (rule) =>
          effective(
            rule,
            payrollMonth,
          ) &&
          applies(
            rule,
            employee,
          ),
      )
      .sort(
        (a, b) =>
          num(
            a.priority,
            100,
          ) -
          num(
            b.priority,
            100,
          ),
      );

  for (const rule of applicableRules) {
    const base =
      calculationBase(
        rule,
        payrollItem,
      );

    const employeeCalc =
      calculateSide(
        rule,
        base,
        "employee",
      );

    const employerCalc =
      calculateSide(
        rule,
        base,
        "employer",
      );

    const employeeValueAmount =
      nonNegative(
        employeeCalc.amount,
      );

    const employerValueAmount =
      nonNegative(
        employerCalc.amount,
      );

    if (
      !employeeValueAmount &&
      !employerValueAmount
    ) {
      continue;
    }

    employeeAmount = money(
      employeeAmount +
        employeeValueAmount,
    );

    employerAmount = money(
      employerAmount +
        employerValueAmount,
    );

    deductions.push({
      rule_id:
        rule.id,

      rule_name:
        rule.name,

      rule_code:
        rule.code,

      calculation_base:
        base,

      employee_amount:
        employeeValueAmount,

      employer_amount:
        employerValueAmount,

      employee_rate:
        employeeCalc.rate,

      employer_rate:
        employerCalc.rate,

      rule_snapshot:
        rule,

      calculation_details: {
        employee:
          employeeCalc.details,

        employer:
          employerCalc.details,
      },
    });
  }

  return {
    employee_id:
      employee.id,

    employee_amount:
      money(employeeAmount),

    employer_amount:
      money(employerAmount),

    deductions,

    warnings,
  };
}
/* =========================================================
   PAYROLL RUN HELPERS
========================================================= */

async function getRun(
  organizationId,
  payrollRunId,
) {
  if (!organizationId) {
    throw serviceError(
      "Organization is required.",
      400,
    );
  }

  if (!payrollRunId) {
    throw serviceError(
      "Payroll run ID is required.",
      400,
    );
  }

  const { data, error } =
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

  if (error) throw error;

  if (!data) {
    throw serviceError(
      "Payroll run not found.",
      404,
    );
  }

  return data;
}

async function getRunItems(
  organizationId,
  payrollRunId,
) {
  const { data, error } =
    await supabaseAdmin
      .from("payroll_run_items")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq(
        "payroll_run_id",
        payrollRunId,
      )
      .order("created_at", {
        ascending: true,
      });

  if (error) throw error;

  return data || [];
}

async function getEmployees(
  organizationId,
  ids,
) {
  if (!ids.length) {
    return [];
  }

  const { data, error } =
    await supabaseAdmin
      .from("employees")
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .in("id", ids);

  if (error) throw error;

  return data || [];
}

async function getEffectiveRules(
  organizationId,
  payrollMonth,
) {
  const { data, error } =
    await supabaseAdmin
      .from(
        "statutory_deduction_rules",
      )
      .select("*")
      .eq(
        "organization_id",
        organizationId,
      )
      .eq("status", "active")
      .lte(
        "effective_from",
        monthEnd(payrollMonth),
      )
      .or(
        `effective_to.is.null,effective_to.gte.${payrollMonth}`,
      )
      .order("priority", {
        ascending: true,
      })
      .order("effective_from", {
        ascending: false,
      });

  if (error) throw error;

  return data || [];
}

/* =========================================================
   CALCULATE ENTIRE PAYROLL RUN
========================================================= */

export async function calculateStatutoryDeductionsForPayrollRun({
  organizationId,
  payrollRunId,
  userId = null,
} = {}) {
  const run =
    await getRun(
      organizationId,
      payrollRunId,
    );

  if (
    run.status === "processed"
  ) {
    throw serviceError(
      "Processed payroll runs cannot be recalculated.",
      409,
    );
  }

  const payrollMonth =
    month(run.payroll_month);

  const items =
    await getRunItems(
      organizationId,
      payrollRunId,
    );

  if (!items.length) {
    throw serviceError(
      "The payroll run has no employee items to calculate.",
      400,
    );
  }

  const ids = [
    ...new Set(
      items
        .map(
          (item) =>
            item.employee_id,
        )
        .filter(Boolean),
    ),
  ];

  const employees =
    await getEmployees(
      organizationId,
      ids,
    );

  const employeeMap =
    new Map(
      employees.map(
        (employee) => [
          employee.id,
          employee,
        ],
      ),
    );

  const rules =
    await getEffectiveRules(
      organizationId,
      payrollMonth,
    );

  const breakdowns = [];
  const results = [];

  let employeeTotal = 0;
  let employerTotal = 0;
  let errorCount = 0;

  for (const item of items) {
    const employee =
      employeeMap.get(
        item.employee_id,
      );

    if (!employee) {
      errorCount++;

      results.push({
        payroll_run_item_id:
          item.id,

        employee_id:
          item.employee_id,

        status:
          "error",

        message:
          "Employee record could not be found for this payroll item.",

        employee_amount:
          0,

        employer_amount:
          0,
      });

      continue;
    }

    const result =
      calculateStatutoryDeductionsForEmployee({
        employee,
        payrollItem: item,
        rules,
        payrollMonth,
      });

    employeeTotal = money(
      employeeTotal +
        result.employee_amount,
    );

    employerTotal = money(
      employerTotal +
        result.employer_amount,
    );

    for (
      const deduction
      of result.deductions
    ) {
      breakdowns.push({
        organization_id:
          organizationId,

        payroll_run_id:
          payrollRunId,

        payroll_run_item_id:
          item.id,

        employee_id:
          item.employee_id,

        rule_id:
          deduction.rule_id,

        calculation_base:
          deduction.calculation_base,

        employee_amount:
          deduction.employee_amount,

        employer_amount:
          deduction.employer_amount,

        employee_rate:
          deduction.employee_rate,

        employer_rate:
          deduction.employer_rate,

        rule_snapshot:
          deduction.rule_snapshot,

        calculation_details:
          deduction.calculation_details,
      });
    }

    results.push({
      payroll_run_item_id:
        item.id,

      employee_id:
        item.employee_id,

      status:
        "valid",

      message:
        null,

      employee_amount:
        result.employee_amount,

      employer_amount:
        result.employer_amount,

      deduction_count:
        result.deductions.length,
    });
  }

  /* Remove previous calculation. */

  const {
    error: deleteError,
  } = await supabaseAdmin
    .from(
      "payroll_statutory_deductions",
    )
    .delete()
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "payroll_run_id",
      payrollRunId,
    );

  if (deleteError)
    throw deleteError;

  /* Save fresh calculation. */

  if (breakdowns.length) {
    const { error } =
      await supabaseAdmin
        .from(
          "payroll_statutory_deductions",
        )
        .insert(breakdowns);

    if (error) throw error;
  }

  /* Update payroll items. */

  for (const item of items) {
    const result =
      results.find(
        (entry) =>
          entry.payroll_run_item_id ===
          item.id,
      );

    const statutory =
      nonNegative(
        result?.employee_amount,
      );

    const fixed =
      nonNegative(
        item.fixed_deductions,
      );

    const other =
      nonNegative(
        item.other_deductions,
      );

    const totalDeductions =
      money(
        fixed +
          statutory +
          other,
      );

    /*
     * Preserve reimbursements when calculating
     * net pay.
     *
     * net pay =
     * gross pay
     * - deductions
     * + reimbursements
     */

    const reimbursements =
      nonNegative(
        item.reimbursements,
      );

    const netPay =
      Math.max(
        0,
        money(
          num(item.gross_pay) -
            totalDeductions +
            reimbursements,
        ),
      );

    const oldMessages =
      Array.isArray(
        item.validation_messages,
      )
        ? item.validation_messages
        : [];

    const messages =
      oldMessages.filter(
        (message) =>
          !String(message)
            .toLowerCase()
            .startsWith(
              "statutory:",
            ),
      );

    if (
      result?.status ===
      "error"
    ) {
      messages.push(
        `Statutory: ${result.message}`,
      );
    }

    const validationStatus =
      result?.status ===
      "error"
        ? "error"
        : item.validation_status ===
            "error"
          ? "error"
          : item.validation_status ===
              "warning"
            ? "warning"
            : "valid";

    const { error } =
      await supabaseAdmin
        .from(
          "payroll_run_items",
        )
        .update({
          statutory_deductions:
            statutory,

          total_deductions:
            totalDeductions,

          net_pay:
            netPay,

          validation_status:
            validationStatus,

          validation_messages:
            messages,
        })
        .eq(
          "organization_id",
          organizationId,
        )
        .eq(
          "payroll_run_id",
          payrollRunId,
        )
        .eq(
          "id",
          item.id,
        );

    if (error) throw error;
  }

  /* Re-read persisted values. */

  const updatedItems =
    await getRunItems(
      organizationId,
      payrollRunId,
    );

  const totals =
    updatedItems.reduce(
      (summary, item) => ({
        gross_pay:
          money(
            summary.gross_pay +
              num(
                item.gross_pay,
              ),
          ),

        total_deductions:
          money(
            summary.total_deductions +
              num(
                item.total_deductions,
              ),
          ),

        total_reimbursements:
          money(
            summary.total_reimbursements +
              num(
                item.reimbursements,
              ),
          ),

        net_pay:
          money(
            summary.net_pay +
              num(
                item.net_pay,
              ),
          ),
      }),
      {
        gross_pay: 0,
        total_deductions: 0,
        total_reimbursements: 0,
        net_pay: 0,
      },
    );

  const {
    data: updatedRun,
    error: updateError,
  } = await supabaseAdmin
    .from("payroll_runs")
    .update({
      employee_count:
        updatedItems.length,

      gross_pay:
        totals.gross_pay,

      total_deductions:
        totals.total_deductions,

      total_reimbursements:
        totals.total_reimbursements,

      net_pay:
        totals.net_pay,
    })
    .eq(
      "organization_id",
      organizationId,
    )
    .eq(
      "id",
      payrollRunId,
    )
    .select("*")
    .single();

  if (updateError)
    throw updateError;

  return {
    payroll_run:
      updatedRun,

    rules_applied:
      rules.length,

    deductions_created:
      breakdowns.length,

    total_employee_deductions:
      employeeTotal,

    total_employer_contributions:
      employerTotal,

    error_count:
      errorCount,

    calculated_by:
      userId,

    items:
      results,
  };
}

/* =========================================================
   BREAKDOWN
========================================================= */

export async function getPayrollStatutoryDeductions({
  organizationId,
  payrollRunId,
  employeeId = null,
} = {}) {
  await getRun(
    organizationId,
    payrollRunId,
  );

  let query =
    supabaseAdmin
      .from(
        "payroll_statutory_deductions",
      )
      .select(`
        *,
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
        "payroll_run_id",
        payrollRunId,
      )
      .order("created_at", {
        ascending: true,
      });

  if (employeeId) {
    query = query.eq(
      "employee_id",
      employeeId,
    );
  }

  const { data, error } =
    await query;

  if (error) throw error;

  return data || [];
}

/* =========================================================
   SUMMARY
========================================================= */

export async function getStatutoryDeductionSummary({
  organizationId,
  payrollRunId,
} = {}) {
  const deductions =
    await getPayrollStatutoryDeductions({
      organizationId,
      payrollRunId,
    });

  const byRule =
    new Map();

  let employeeTotal = 0;
  let employerTotal = 0;

  for (const row of deductions) {
    const rule =
      row.statutory_deduction_rules ||
      {};

    const key =
      row.rule_id;

    const current =
      byRule.get(key) || {
        rule_id:
          key,

        rule_name:
          rule.name ||
          "Unknown rule",

        rule_code:
          rule.code ||
          null,

        employee_amount:
          0,

        employer_amount:
          0,

        employee_count:
          0,
      };

    current.employee_amount =
      money(
        current.employee_amount +
          num(
            row.employee_amount,
          ),
      );

    current.employer_amount =
      money(
        current.employer_amount +
          num(
            row.employer_amount,
          ),
      );

    current.employee_count +=
      1;

    byRule.set(
      key,
      current,
    );

    employeeTotal =
      money(
        employeeTotal +
          num(
            row.employee_amount,
          ),
      );

    employerTotal =
      money(
        employerTotal +
          num(
            row.employer_amount,
          ),
      );
  }

  return {
    payroll_run_id:
      payrollRunId,

    employee_total:
      employeeTotal,

    employer_total:
      employerTotal,

    deduction_count:
      deductions.length,

    rules:
      [...byRule.values()],
  };
}
/* =========================================================
   RULE VALIDATION
========================================================= */

export function validateStatutoryRuleInput(
  rule = {},
) {
  try {
    const normalized =
      validateRule(
        normalizeRule(rule),
      );

    const warnings = [];

    if (
      [
        "percentage",
        "percentage_capped",
      ].includes(
        normalized.calculation_method,
      )
    ) {
      if (
        normalized.employee_rate ===
          null &&
        normalized.deduction_type !==
          "employer"
      ) {
        warnings.push(
          "No employee rate is configured.",
        );
      }

      if (
        normalized.employer_rate ===
          null &&
        normalized.deduction_type !==
          "employee"
      ) {
        warnings.push(
          "No employer rate is configured.",
        );
      }
    }

    return {
      valid: true,

      errors: [],

      warnings,

      normalized,
    };
  } catch (error) {
    return {
      valid: false,

      errors: [
        error.message,
      ],

      warnings: [],

      normalized: null,
    };
  }
}

/* =========================================================
   RULE PREVIEW
========================================================= */

export function previewStatutoryRule({
  rule,
  calculationBase,
} = {}) {
  const validation =
    validateStatutoryRuleInput(
      rule,
    );

  if (!validation.valid) {
    throw serviceError(
      validation.errors.join(
        " ",
      ),
      400,
    );
  }

  const normalized =
    validation.normalized;

  const base =
    nonNegative(
      calculationBase,
    );

  const employee =
    calculateSide(
      normalized,
      base,
      "employee",
    );

  const employer =
    calculateSide(
      normalized,
      base,
      "employer",
    );

  return {
    calculation_base:
      base,

    employee_amount:
      nonNegative(
        employee.amount,
      ),

    employer_amount:
      nonNegative(
        employer.amount,
      ),

    employee_rate:
      employee.rate,

    employer_rate:
      employer.rate,

    employee_details:
      employee.details,

    employer_details:
      employer.details,

    warnings:
      validation.warnings,
  };
}