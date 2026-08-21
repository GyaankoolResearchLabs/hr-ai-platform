import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "hr-ai-employee-data-quality-result";
const HISTORY_KEY = "hr-ai-employee-data-quality-history";
const MAX_HISTORY_ITEMS = 10;

const FIELD_ALIASES = {
  employeeId: [
    "employee_id",
    "employeeid",
    "employee_number",
    "employee_no",
    "emp_id",
    "empid",
    "id",
  ],
  name: [
    "full_name",
    "fullname",
    "employee_name",
    "employee",
    "name",
  ],
  email: [
    "email",
    "email_address",
    "work_email",
    "official_email",
    "company_email",
  ],
  department: [
    "department",
    "dept",
    "team",
    "business_unit",
  ],
  designation: [
    "designation",
    "job_title",
    "jobtitle",
    "role",
    "position",
    "title",
  ],
  joiningDate: [
    "joining_date",
    "joiningdate",
    "date_of_joining",
    "hire_date",
    "start_date",
    "employment_start_date",
  ],
  status: [
    "status",
    "employment_status",
    "employee_status",
  ],
};

const REQUIRED_FIELDS = [
  "employeeId",
  "name",
  "email",
  "department",
  "joiningDate",
];

const OPTIONAL_FIELDS = [
  "designation",
  "status",
];

const FIELD_LABELS = {
  employeeId: "Employee ID",
  name: "Employee Name",
  email: "Email",
  department: "Department",
  designation: "Designation",
  joiningDate: "Joining Date",
  status: "Employment Status",
};

const ALLOWED_STATUSES = [
  "active",
  "inactive",
  "on_leave",
  "terminated",
  "probation",
  "notice_period",
  "contract",
];

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
  terminated: "Terminated",
  probation: "Probation",
  notice_period: "Notice Period",
  contract: "Contract",
};

const text = (value) =>
  String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();

const normalize = (value) =>
  text(value)
    .toLowerCase()
    .replace(/\s+/g, "_");

const labelFor = (field) =>
  FIELD_LABELS[field] || field;

/* =========================================================
   CSV PARSER
========================================================= */

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];

    if (ch === '"') {
      if (quoted && next === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }

      continue;
    }

    if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (ch === "\n" || ch === "\r") &&
      !quoted
    ) {
      if (ch === "\r" && next === "\n") {
        i += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => text(value))) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += ch;
  }

  if (cell !== "" || row.length) {
    row.push(cell);

    if (row.some((value) => text(value))) {
      rows.push(row);
    }
  }

  if (rows.length < 2) {
    return {
      headers: [],
      records: [],
    };
  }

  const headers = rows[0].map(text);

  const records = rows
    .slice(1)
    .map((values) => {
      const record = {};

      headers.forEach((header, index) => {
        record[header] = text(values[index]);
      });

      return record;
    });

  return {
    headers,
    records,
  };
}

/* =========================================================
   FIELD DETECTION
========================================================= */

function resolveField(headers, aliases) {
  const map = new Map(
    headers.map((header) => [
      normalize(header),
      header,
    ])
  );

  return (
    aliases
      .map(normalize)
      .map((alias) => map.get(alias))
      .find(Boolean) || null
  );
}

function detectFields(headers) {
  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(
      ([field, aliases]) => [
        field,
        resolveField(headers, aliases),
      ]
    )
  );
}

/* =========================================================
   ISSUE CREATION
========================================================= */

function addIssue(issues, issue) {
  issues.push({
    severity: issue.severity,
    category: issue.category,
    row: issue.row,
    employee: issue.employee,
    field: issue.field,
    message: issue.message,
    whyItMatters: issue.whyItMatters,
    recommendation: issue.recommendation,
    humanReview:
      issue.humanReview !== false,
  });
}

/* =========================================================
   VALIDATION HELPERS
========================================================= */

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    text(value)
  );
}

function validDate(value) {
  const raw = text(value);

  if (!raw) return null;

  const iso = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (iso) {
    const [
      year,
      month,
      day,
    ] = iso.slice(1).map(Number);

    const date = new Date(
      year,
      month - 1,
      day
    );

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    )
      ? date
      : null;
  }

  const date = new Date(raw);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

/* =========================================================
   DATASET ANALYSIS
========================================================= */

function analyzeDataset(headers, records) {
  const fields = detectFields(headers);
  const issues = [];

  const employeeIdRows = new Map();
  const emailRows = new Map();

  const duplicateRows = new Set();
  const invalidRows = new Set();
  const consistencyRows = new Set();

  /* -------------------------------------------------------
     DUPLICATE HEADERS
  ------------------------------------------------------- */

  const duplicateHeaders = [];
  const seenHeaders = new Set();

  headers.forEach((header) => {
    const key = normalize(header);

    if (!key) return;

    if (seenHeaders.has(key)) {
      duplicateHeaders.push(header);
    } else {
      seenHeaders.add(key);
    }
  });

  duplicateHeaders.forEach((header) => {
    addIssue(issues, {
      severity: "critical",
      category: "Column Structure",
      row: 1,
      employee: "Dataset",
      field: header,
      message: `The column "${header}" appears more than once.`,
      whyItMatters:
        "Duplicate column names can cause data to be overwritten or incorrectly mapped.",
      recommendation:
        "Rename or remove the duplicate column before using this dataset.",
    });
  });

  /* -------------------------------------------------------
     REQUIRED COLUMNS
  ------------------------------------------------------- */

  REQUIRED_FIELDS.forEach((field) => {
    if (!fields[field]) {
      addIssue(issues, {
        severity: "critical",
        category: "Missing Column",
        row: 1,
        employee: "Dataset",
        field,
        message: `Required column "${labelFor(
          field
        )}" was not found.`,
        whyItMatters:
          "This field is required to perform reliable employee-data validation.",
        recommendation: `Add or map a "${labelFor(
          field
        )}" column.`,
      });
    }
  });

  /* -------------------------------------------------------
     BUILD DUPLICATE MAPS
  ------------------------------------------------------- */

  records.forEach((record, index) => {
    const row = index + 2;

    if (fields.employeeId) {
      const value = normalize(
        record[fields.employeeId]
      );

      if (value) {
        employeeIdRows.set(value, [
          ...(employeeIdRows.get(value) || []),
          row,
        ]);
      }
    }

    if (fields.email) {
      const value = normalize(
        record[fields.email]
      );

      if (value) {
        emailRows.set(value, [
          ...(emailRows.get(value) || []),
          row,
        ]);
      }
    }
  });

  /* -------------------------------------------------------
     DUPLICATE EMPLOYEE CHECKS
  ------------------------------------------------------- */

  const addDuplicateIssues = (
    map,
    type
  ) => {
    map.forEach((rows, value) => {
      if (rows.length < 2) return;

      rows.forEach((row) => {
        duplicateRows.add(row);

        const record =
          records[row - 2];

        addIssue(issues, {
          severity: "critical",
          category:
            "Duplicate Employee",
          row,
          employee:
            text(
              record?.[
                fields.employeeId
              ]
            ) ||
            text(
              record?.[fields.email]
            ) ||
            `Row ${row}`,
          field:
            type === "id"
              ? fields.employeeId
              : fields.email,

          message:
            type === "id"
              ? `Employee ID "${value}" appears in multiple employee records.`
              : `Email address "${value}" appears in multiple employee records.`,

          whyItMatters:
            type === "id"
              ? "Duplicate employee IDs can cause payroll, benefits, reporting, and employee-record conflicts."
              : "Duplicate work emails can indicate duplicate employee records or incorrect identity mapping.",

          recommendation:
            type === "id"
              ? "Verify which record belongs to the employee and assign a unique employee ID to every employee."
              : "Verify the employee identity and ensure each employee record uses the correct unique work email.",
        });
      });
    });
  };

  addDuplicateIssues(
    employeeIdRows,
    "id"
  );

  addDuplicateIssues(
    emailRows,
    "email"
  );

  /* -------------------------------------------------------
     RECORD VALIDATION
  ------------------------------------------------------- */

  records.forEach((record, index) => {
    const row = index + 2;

    const employee =
      text(
        fields.name
          ? record[fields.name]
          : ""
      ) || `Row ${row}`;

    /* Required fields */

    REQUIRED_FIELDS.forEach(
      (field) => {
        if (!fields[field]) return;

        if (
          !text(
            record[fields[field]]
          )
        ) {
          addIssue(issues, {
            severity: "critical",
            category: "Missing Data",
            row,
            employee,
            field: fields[field],
            message: `${labelFor(
              field
            )} is missing.`,
            whyItMatters:
              "Missing required employee information can break HR workflows and downstream reporting.",
            recommendation: `Provide a valid ${labelFor(
              field
            )} value for this employee.`,
          });
        }
      }
    );

    /* Email */

    if (fields.email) {
      const email = text(
        record[fields.email]
      );

      if (
        email &&
        !validEmail(email)
      ) {
        invalidRows.add(row);

        addIssue(issues, {
          severity: "critical",
          category: "Invalid Data",
          row,
          employee,
          field: fields.email,
          message: `Email address "${email}" is not in a valid format.`,
          whyItMatters:
            "Invalid email addresses can prevent employee communication and system synchronization.",
          recommendation:
            "Verify the employee's official work email address.",
        });
      }
    }

    /* Joining date */

    if (fields.joiningDate) {
      const rawDate = text(
        record[fields.joiningDate]
      );

      if (rawDate) {
        const date =
          validDate(rawDate);

        if (!date) {
          invalidRows.add(row);

          addIssue(issues, {
            severity: "critical",
            category: "Invalid Data",
            row,
            employee,
            field:
              fields.joiningDate,
            message: `Joining date "${rawDate}" could not be interpreted as a valid date.`,
            whyItMatters:
              "Incorrect dates can affect tenure, benefits, leave, payroll, and workforce reporting.",
            recommendation:
              "Convert the joining date to a valid date format such as YYYY-MM-DD.",
          });
        } else {
          const today = new Date();

          today.setHours(
            23,
            59,
            59,
            999
          );

          if (date > today) {
            consistencyRows.add(
              row
            );

            addIssue(issues, {
              severity: "warning",
              category: "Consistency",
              row,
              employee,
              field:
                fields.joiningDate,
              message:
                "Joining date is in the future.",
              whyItMatters:
                "A future joining date may be valid for a planned hire, but it can also indicate an incorrect employee record.",
              recommendation:
                "Confirm whether this is a planned future employee or a data-entry error.",
            });
          }
        }
      }
    }

    /* Employment status */

    if (fields.status) {
      const status = normalize(
        record[fields.status]
      );

      if (
        status &&
        !ALLOWED_STATUSES.includes(
          status
        )
      ) {
        invalidRows.add(row);

        addIssue(issues, {
          severity: "warning",
          category: "Invalid Data",
          row,
          employee,
          field: fields.status,
          message: `Employment status "${text(
            record[fields.status]
          )}" is not one of the recognized status values.`,
          whyItMatters:
            "Inconsistent employment statuses can affect reporting, workflow rules, and employee lifecycle processing.",
          recommendation: `Use one of the supported values: ${ALLOWED_STATUSES.map(
            (statusValue) =>
              STATUS_LABELS[
                statusValue
              ]
          ).join(", ")}.`,
        });
      }
    }
  });

  /* -------------------------------------------------------
     SCORE CALCULATION
  ------------------------------------------------------- */

  const recordCount =
    records.length;

  const requiredCells =
    REQUIRED_FIELDS.length *
    recordCount;

  let missingCells = 0;

  REQUIRED_FIELDS.forEach(
    (field) => {
      if (!fields[field]) {
        missingCells +=
          recordCount;
      } else {
        records.forEach(
          (record) => {
            if (
              !text(
                record[
                  fields[field]
                ]
              )
            ) {
              missingCells += 1;
            }
          }
        );
      }
    }
  );

  const score = (
    bad,
    total
  ) =>
    total
      ? Math.max(
          0,
          Math.round(
            100 -
              (bad / total) *
                100
          )
        )
      : 100;

  const completenessScore =
    score(
      missingCells,
      requiredCells
    );

  const uniquenessScore =
    score(
      duplicateRows.size,
      recordCount
    );

  const validityScore =
    score(
      invalidRows.size,
      recordCount
    );

  const consistencyScore =
    score(
      consistencyRows.size,
      recordCount
    );

  /*
   * Weighted quality score.
   */

  const weightedScore =
    completenessScore *
      0.35 +
    uniquenessScore *
      0.3 +
    validityScore *
      0.25 +
    consistencyScore *
      0.1;

  /*
   * Critical affected-record adjustment.
   *
   * This prevents a dataset containing many employees
   * with critical problems from still being labelled Excellent.
   */

  const criticalAffectedRows =
    new Set(
      issues
        .filter(
          (issue) =>
            issue.severity ===
              "critical" &&
            issue.row > 1
        )
        .map(
          (issue) =>
            issue.row
        )
    );

  const criticalRiskAdjustment =
    recordCount
      ? (criticalAffectedRows.size /
          recordCount) *
        25
      : 0;

  const qualityScore =
    Math.max(
      0,
      Math.round(
        weightedScore -
          criticalRiskAdjustment
      )
    );

  /*
   * Missing required columns impose a hard ceiling.
   */

  const missingRequiredColumnCount =
    REQUIRED_FIELDS.filter(
      (field) =>
        !fields[field]
    ).length;

  const finalScore =
    missingRequiredColumnCount
      ? Math.min(
          qualityScore,
          59
        )
      : qualityScore;

  const affectedRows =
    new Set(
      issues
        .filter(
          (issue) =>
            issue.row > 1
        )
        .map(
          (issue) =>
            issue.row
        )
    );

  return {
    headers,
    records,
    fields,
    issues,
    recordCount,
    qualityScore:
      finalScore,
    completenessScore,
    uniquenessScore,
    validityScore,
    consistencyScore,
    affectedRecordCount:
      affectedRows.size,
    criticalAffectedCount:
      criticalAffectedRows.size,

    criticalIssueCount:
      issues.filter(
        (issue) =>
          issue.severity ===
          "critical"
      ).length,

    warningCount:
      issues.filter(
        (issue) =>
          issue.severity ===
          "warning"
      ).length,

    missingCount:
      issues.filter(
        (issue) =>
          issue.category ===
            "Missing Data" ||
          issue.category ===
            "Missing Column"
      ).length,

    invalidCount:
      issues.filter(
        (issue) =>
          issue.category ===
          "Invalid Data"
      ).length,

    duplicateIssueCount:
      issues.filter(
        (issue) =>
          issue.category ===
          "Duplicate Employee"
      ).length,

    analyzedAt:
      new Date().toISOString(),
  };
}

/* =========================================================
   QUALITY LABEL
========================================================= */

function qualityLabel(score) {
  const value =
    Number.isFinite(
      Number(score)
    )
      ? Number(score)
      : 0;

  if (value >= 95) {
    return {
      label: "Excellent",
      description:
        "Very few or no material employee-data quality problems were detected.",
    };
  }

  if (value >= 85) {
    return {
      label: "Good",
      description:
        "The dataset is generally usable but contains issues that should be reviewed.",
    };
  }

  if (value >= 70) {
    return {
      label: "Needs attention",
      description:
        "A meaningful portion of the dataset contains data-quality problems.",
    };
  }

  return {
    label: "High risk",
    description:
      "The dataset contains significant employee-data quality problems and should be corrected before critical HR use.",
  };
}

/* =========================================================
   PERSISTED DATA SAFETY
========================================================= */

function idFor(fileName) {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}-${normalize(
    fileName
  ).slice(0, 20)}`;
}

function normalizeIssue(issue) {
  if (
    !issue ||
    typeof issue !==
      "object"
  ) {
    return null;
  }

  return {
    severity:
      issue.severity ===
      "warning"
        ? "warning"
        : "critical",

    category:
      text(issue.category) ||
      "Data Quality",

    row: Number.isFinite(
      Number(issue.row)
    )
      ? Number(issue.row)
      : 0,

    employee:
      text(issue.employee) ||
      "Unknown",

    field:
      text(issue.field),

    message:
      text(issue.message) ||
      "Data-quality issue detected.",

    whyItMatters:
      text(
        issue.whyItMatters
      ) ||
      "This issue may affect employee-data reliability.",

    recommendation:
      text(
        issue.recommendation
      ) ||
      "Review and correct the source employee record.",

    humanReview:
      issue.humanReview !==
      false,
  };
}

function normalizeAnalysis(
  value,
  fallbackName = "Employee dataset"
) {
  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return null;
  }

  const headers =
    Array.isArray(
      value.headers
    )
      ? value.headers
          .map(text)
          .filter(Boolean)
      : [];

  const records =
    Array.isArray(
      value.records
    )
      ? value.records.filter(
          (record) =>
            record &&
            typeof record ===
              "object"
        )
      : [];

  const fileName =
    text(value.fileName) ||
    fallbackName;

  /*
   * IMPORTANT:
   * If actual records exist, always recalculate.
   * This repairs stale/blind scores from previous versions.
   */

  if (
    headers.length &&
    records.length
  ) {
    const fresh =
      analyzeDataset(
        headers,
        records
      );

    return {
      ...fresh,
      fileName,
      id:
        value.id ||
        idFor(fileName),
      analyzedAt:
        text(
          value.analyzedAt
        ) ||
        fresh.analyzedAt,
    };
  }

  /*
   * Fallback for very old/incomplete saved objects.
   * Never allow malformed data to crash the page.
   */

  const issues =
    Array.isArray(
      value.issues
    )
      ? value.issues
          .map(normalizeIssue)
          .filter(Boolean)
      : [];

  const safeNumber = (
    value,
    fallback = 0
  ) =>
    Number.isFinite(
      Number(value)
    )
      ? Number(value)
      : fallback;

  const safeScore = (
    value
  ) =>
    Math.max(
      0,
      Math.min(
        100,
        Math.round(
          safeNumber(
            value,
            0
          )
        )
      )
    );

  return {
    headers,
    records,

    fields:
      value.fields &&
      typeof value.fields ===
        "object"
        ? {
            ...value.fields,
          }
        : detectFields(
            headers
          ),

    issues,

    recordCount:
      safeNumber(
        value.recordCount,
        records.length
      ),

    qualityScore:
      safeScore(
        value.qualityScore
      ),

    completenessScore:
      safeScore(
        value.completenessScore
      ),

    uniquenessScore:
      safeScore(
        value.uniquenessScore
      ),

    validityScore:
      safeScore(
        value.validityScore
      ),

    consistencyScore:
      safeScore(
        value.consistencyScore
      ),

    affectedRecordCount:
      safeNumber(
        value.affectedRecordCount
      ),

    criticalAffectedCount:
      safeNumber(
        value.criticalAffectedCount
      ),

    criticalIssueCount:
      safeNumber(
        value.criticalIssueCount,
        issues.filter(
          (issue) =>
            issue.severity ===
            "critical"
        ).length
      ),

    warningCount:
      safeNumber(
        value.warningCount,
        issues.filter(
          (issue) =>
            issue.severity ===
            "warning"
        ).length
      ),

    missingCount:
      safeNumber(
        value.missingCount,
        issues.filter(
          (issue) =>
            issue.category ===
              "Missing Data" ||
            issue.category ===
              "Missing Column"
        ).length
      ),

    invalidCount:
      safeNumber(
        value.invalidCount,
        issues.filter(
          (issue) =>
            issue.category ===
            "Invalid Data"
        ).length
      ),

    duplicateIssueCount:
      safeNumber(
        value.duplicateIssueCount,
        issues.filter(
          (issue) =>
            issue.category ===
            "Duplicate Employee"
        ).length
      ),

    analyzedAt:
      text(
        value.analyzedAt
      ) ||
      new Date().toISOString(),

    fileName,

    id:
      value.id ||
      idFor(fileName),
  };
}

function normalizeHistory(
  value
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return value
    .map((item) =>
      normalizeAnalysis(item)
    )
    .filter(Boolean)
    .slice(
      0,
      MAX_HISTORY_ITEMS
    );
}

/* =========================================================
   DISPLAY / REPORT HELPERS
========================================================= */

function formatDateTime(
  value
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function escapeCsv(value) {
  const result =
    String(value ?? "");

  return /[,"\n]/.test(
    result
  )
    ? `"${result.replace(
        /"/g,
        '""'
      )}"`
    : result;
}

function downloadReport(
  analysis
) {
  const issues =
    Array.isArray(
      analysis?.issues
    )
      ? analysis.issues
      : [];

  const rows = [
    [
      "Row",
      "Employee",
      "Category",
      "Severity",
      "Field",
      "Issue",
      "Why It Matters",
      "Recommended Action",
    ],

    ...issues.map(
      (issue) => [
        issue.row,
        issue.employee,
        issue.category,
        issue.severity,
        issue.field,
        issue.message,
        issue.whyItMatters,
        issue.recommendation,
      ]
    ),
  ];

  const csv =
    rows
      .map((row) =>
        row
          .map(escapeCsv)
          .join(",")
      )
      .join("\n");

  const blob =
    new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download = `employee-data-quality-report-${Date.now()}.csv`;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function EmployeeDataQualityChecker() {
  const [
    analysis,
    setAnalysis,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    filter,
    setFilter,
  ] = useState("all");

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  /* -------------------------------------------------------
     LOAD PERSISTED DATA
  ------------------------------------------------------- */

  useEffect(() => {
    /*
     * Current analysis
     */

    try {
      const saved =
        localStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        const normalized =
          normalizeAnalysis(
            JSON.parse(saved)
          );

        if (normalized) {
          setAnalysis(
            normalized
          );

          try {
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(
                normalized
              )
            );
          } catch {
            /*
             * Memory state remains usable
             * even if localStorage is full.
             */
          }
        }
      }
    } catch {
      localStorage.removeItem(
        STORAGE_KEY
      );

      setAnalysis(null);
    }

    /*
     * Analysis history
     */

    try {
      const saved =
        localStorage.getItem(
          HISTORY_KEY
        );

      if (saved) {
        const normalized =
          normalizeHistory(
            JSON.parse(saved)
          );

        setHistory(
          normalized
        );

        try {
          localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(
              normalized
            )
          );
        } catch {
          /*
           * History remains available
           * for the current session.
           */
        }
      }
    } catch {
      localStorage.removeItem(
        HISTORY_KEY
      );

      setHistory([]);
    }
  }, []);

  /* -------------------------------------------------------
     SAVE ANALYSIS
  ------------------------------------------------------- */

  const saveAnalysis = (
    result,
    fileName
  ) => {
    const normalized =
      normalizeAnalysis(
        {
          ...result,
          fileName,
        },
        fileName
      );

    if (!normalized) {
      setError(
        "Unable to save the analysis result."
      );

      return;
    }

    setAnalysis(
      normalized
    );

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          normalized
        )
      );
    } catch {
      /*
       * Keep current result in memory.
       */
    }

    setHistory(
      (previous) => {
        const safePrevious =
          normalizeHistory(
            previous
          );

        const item = {
          ...normalized,
          id: idFor(
            fileName
          ),
        };

        const updated = [
          item,

          ...safePrevious.filter(
            (old) =>
              !(
                old.fileName ===
                  fileName &&
                old.analyzedAt ===
                  normalized.analyzedAt
              )
          ),
        ].slice(
          0,
          MAX_HISTORY_ITEMS
        );

        try {
          localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(
              updated
            )
          );
        } catch {
          /*
           * Keep history in memory.
           */
        }

        return updated;
      }
    );
  };

  /* -------------------------------------------------------
     FILE PROCESSING
  ------------------------------------------------------- */

  const processFile =
    async (file) => {
      setError("");

      if (!file) return;

      if (
        !file.name
          .toLowerCase()
          .endsWith(".csv")
      ) {
        setError(
          "Please upload a CSV file."
        );

        return;
      }

      setLoading(true);

      try {
        const {
          headers,
          records,
        } = parseCsv(
          await file.text()
        );

        if (
          !headers.length ||
          !records.length
        ) {
          throw new Error(
            "The CSV does not contain a valid header row and employee records."
          );
        }

        const result =
          analyzeDataset(
            headers,
            records
          );

        saveAnalysis(
          result,
          file.name
        );

        setFilter("all");
      } catch (err) {
        setError(
          err?.message ||
            "Unable to analyze this CSV file."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleFileChange =
    (event) => {
      const file =
        event.target.files?.[0];

      processFile(file);

      event.target.value = "";
    };

  const handleDrop =
    (event) => {
      event.preventDefault();

      setDragActive(false);

      processFile(
        event.dataTransfer.files?.[0]
      );
    };

  /* -------------------------------------------------------
     HISTORY
  ------------------------------------------------------- */

  const selectHistory =
    (item) => {
      const normalized =
        normalizeAnalysis(
          item
        );

      if (!normalized) {
        setError(
          "This saved analysis could not be loaded."
        );

        return;
      }

      setAnalysis(
        normalized
      );

      setFilter("all");

      setError("");

      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(
            normalized
          )
        );
      } catch {
        /*
         * Selected result remains
         * available in memory.
         */
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    };

  const deleteHistoryItem =
    (id) => {
      setHistory(
        (previous) => {
          const updated =
            previous.filter(
              (item) =>
                item.id !== id
            );

          try {
            localStorage.setItem(
              HISTORY_KEY,
              JSON.stringify(
                updated
              )
            );
          } catch {
            /*
             * Keep memory state.
             */
          }

          return updated;
        }
      );
    };

  const clearHistory =
    () => {
      setHistory([]);

      try {
        localStorage.removeItem(
          HISTORY_KEY
        );
      } catch {
        /*
         * Ignore storage errors.
         */
      }
    };

  /* -------------------------------------------------------
     SAFE ISSUE ACCESS
  ------------------------------------------------------- */

  const issues =
    Array.isArray(
      analysis?.issues
    )
      ? analysis.issues
      : [];

  const filteredIssues =
    useMemo(() => {
      if (
        filter ===
        "critical"
      ) {
        return issues.filter(
          (issue) =>
            issue.severity ===
            "critical"
        );
      }

      if (
        filter ===
        "warning"
      ) {
        return issues.filter(
          (issue) =>
            issue.severity ===
            "warning"
        );
      }

      if (
        filter ===
        "missing"
      ) {
        return issues.filter(
          (issue) =>
            issue.category ===
              "Missing Data" ||
            issue.category ===
              "Missing Column"
        );
      }

      if (
        filter ===
        "invalid"
      ) {
        return issues.filter(
          (issue) =>
            issue.category ===
            "Invalid Data"
        );
      }

      return issues;
    }, [
      issues,
      filter,
    ]);

  const issueCategories =
    useMemo(
      () =>
        issues.reduce(
          (
            result,
            issue
          ) => {
            result[
              issue.category
            ] =
              (result[
                issue.category
              ] || 0) + 1;

            return result;
          },
          {}
        ),
      [issues]
    );

  const quality =
    analysis
      ? qualityLabel(
          analysis.qualityScore
        )
      : null;

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  return (
    <div className="space-y-8">
      <Link
        to="/app/categories/administrative-hr"
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Administrative HR
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ShieldCheck
              className="h-6 w-6"
              strokeWidth={1.75}
            />
          </span>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
              Employee Records &
              Documentation
            </p>

            <h1 className="mt-1 font-display text-2xl font-semibold text-ink-950">
              Employee Data Quality
              Checker
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Detect missing,
              duplicate, invalid,
              and suspicious
              employee records
              before they create
              downstream HR
              problems.
            </p>
          </div>
        </div>

        {analysis && (
          <button
            type="button"
            onClick={() =>
              downloadReport(
                analysis
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Download className="h-4 w-4" />
            Download report
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />

          <div>
            <p className="font-medium">
              Analysis failed
            </p>

            <p className="mt-1">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          UPLOAD
      ===================================================== */}

      <section className="card p-6">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() =>
            setDragActive(false)
          }
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragActive
              ? "border-brand-500 bg-brand-50"
              : "border-ink-200 bg-canvas"
          }`}
        >
          {loading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-700" />

              <p className="mt-3 text-sm font-medium text-ink-800">
                Analyzing employee
                data...
              </p>

              <p className="mt-1 text-xs text-ink-500">
                Checking
                completeness,
                duplicates,
                validity, and
                consistency.
              </p>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="mx-auto h-9 w-9 text-brand-700" />

              <h2 className="mt-3 text-base font-semibold text-ink-900">
                Upload employee CSV
              </h2>

              <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-ink-500">
                Upload a CSV
                containing employee
                records. The checker
                automatically detects
                common HR column names
                and analyzes the
                dataset.
              </p>

              <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-900">
                <Upload className="h-4 w-4" />
                Choose CSV

                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={
                    handleFileChange
                  }
                />
              </label>

              <p className="mt-3 text-xs text-ink-400">
                Or drag and drop
                your CSV here
              </p>
            </>
          )}
        </div>
      </section>

      {/* =====================================================
          HISTORY
      ===================================================== */}

      {history.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-brand-700" />

                <h2 className="text-sm font-semibold text-ink-900">
                  Analysis history
                </h2>
              </div>

              <p className="mt-1 text-xs text-ink-400">
                Your last{" "}
                {MAX_HISTORY_ITEMS}{" "}
                uploaded datasets
                are available here.
              </p>
            </div>

            <button
              type="button"
              onClick={
                clearHistory
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear history
            </button>
          </div>

          <div className="divide-y divide-ink-100">
            {history.map(
              (item) => {
                const itemQuality =
                  qualityLabel(
                    item.qualityScore
                  );

                const selected =
                  analysis?.id ===
                    item.id ||
                  (analysis?.fileName ===
                    item.fileName &&
                    analysis?.analyzedAt ===
                      item.analyzedAt);

                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-5 py-4 ${
                      selected
                        ? "bg-brand-50/50"
                        : "hover:bg-canvas"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectHistory(
                          item
                        )
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <FileSpreadsheet className="h-5 w-5 shrink-0 text-brand-700" />

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {item.fileName ||
                            "Employee dataset"}
                        </p>

                        <p className="mt-1 text-xs text-ink-400">
                          {formatDateTime(
                            item.analyzedAt
                          )}{" "}
                          ·{" "}
                          {
                            item.recordCount
                          }{" "}
                          employees ·{" "}
                          {
                            Array.isArray(
                              item.issues
                            )
                              ? item
                                  .issues
                                  .length
                              : 0
                          }{" "}
                          issues
                        </p>
                      </div>
                    </button>

                    <span
                      className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:inline-flex ${
                        itemQuality.label ===
                        "Excellent"
                          ? "bg-emerald-50 text-emerald-700"
                          : itemQuality.label ===
                            "Good"
                          ? "bg-teal-50 text-teal-700"
                          : itemQuality.label ===
                            "Needs attention"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {
                        item.qualityScore
                      }
                      % ·{" "}
                      {
                        itemQuality.label
                      }
                    </span>

                    <button
                      type="button"
                      title="Delete this analysis"
                      onClick={() =>
                        deleteHistoryItem(
                          item.id
                        )
                      }
                      className="shrink-0 rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              }
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          RESULTS
      ===================================================== */}

      {analysis &&
        quality && (
          <div className="space-y-6">
            {/* Dataset header */}

            <section className="card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet className="h-6 w-6 shrink-0 text-brand-700" />

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {analysis.fileName ||
                        "Employee dataset"}
                    </p>

                    <p className="mt-1 text-xs text-ink-400">
                      Analyzed{" "}
                      {formatDateTime(
                        analysis.analyzedAt
                      )}
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                    quality.label ===
                    "Excellent"
                      ? "bg-emerald-50 text-emerald-700"
                      : quality.label ===
                        "Good"
                      ? "bg-teal-50 text-teal-700"
                      : quality.label ===
                        "Needs attention"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {
                    quality.label
                  }
                </span>
              </div>

              <div className="mt-4 rounded-lg bg-canvas px-4 py-3">
                <p className="text-sm font-medium text-ink-800">
                  {
                    quality.description
                  }
                </p>

                <p className="mt-1 text-xs leading-5 text-ink-500">
                  Score is
                  calculated from
                  actual
                  record-level
                  completeness,
                  uniqueness,
                  validity, and
                  consistency
                  results. It is not
                  based on the raw
                  number of issue
                  messages.
                </p>
              </div>
            </section>

            {/* Metrics */}

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Metric
                label="Employees"
                value={
                  analysis.recordCount
                }
              />

              <Metric
                label="Quality score"
                value={`${analysis.qualityScore}%`}
              />

              <Metric
                label="Affected records"
                value={
                  analysis.affectedRecordCount
                }
                alert={
                  analysis.affectedRecordCount >
                  0
                }
              />

              <Metric
                label="Critical issues"
                value={
                  analysis.criticalIssueCount
                }
                alert={
                  analysis.criticalIssueCount >
                  0
                }
              />

              <Metric
                label="Warnings"
                value={
                  analysis.warningCount
                }
                alert={
                  analysis.warningCount >
                  0
                }
              />
            </section>

            {/* Score breakdown */}

            <section className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-ink-900">
                    Quality score
                    breakdown
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-ink-500">
                    The score is based
                    on measurable
                    employee-record
                    quality dimensions.
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-3xl font-semibold text-ink-950">
                    {
                      analysis.qualityScore
                    }
                    %
                  </p>

                  <p className="text-xs text-ink-400">
                    Overall quality
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ScoreItem
                  label="Completeness · 35%"
                  value={`${analysis.completenessScore}%`}
                  description="Required employee fields populated"
                />

                <ScoreItem
                  label="Uniqueness · 30%"
                  value={`${analysis.uniquenessScore}%`}
                  description="Duplicate employee records avoided"
                />

                <ScoreItem
                  label="Validity · 25%"
                  value={`${analysis.validityScore}%`}
                  description="Employee values pass validation"
                />

                <ScoreItem
                  label="Consistency · 10%"
                  value={`${analysis.consistencyScore}%`}
                  description="Employee information is internally consistent"
                />
              </div>
            </section>

            {/* Additional metrics */}

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Metric
                label="Duplicate issues"
                value={
                  analysis.duplicateIssueCount
                }
                alert={
                  analysis.duplicateIssueCount >
                  0
                }
              />

              <Metric
                label="Missing"
                value={
                  analysis.missingCount
                }
                alert={
                  analysis.missingCount >
                  0
                }
              />

              <Metric
                label="Invalid"
                value={
                  analysis.invalidCount
                }
                alert={
                  analysis.invalidCount >
                  0
                }
              />

              <Metric
                label="Affected employees"
                value={`${analysis.affectedRecordCount}/${analysis.recordCount}`}
                alert={
                  analysis.affectedRecordCount >
                  0
                }
              />
            </section>

            {/* Issues */}

            <section className="card overflow-hidden">
              <div className="border-b border-ink-100 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="font-semibold text-ink-900">
                      Data quality
                      assessment
                    </h2>

                    <p className="mt-1 text-sm text-ink-500">
                      Each issue is
                      tied to a
                      specific employee
                      record or
                      dataset structure
                      problem.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FilterButton
                      active={
                        filter === "all"
                      }
                      label={`All (${issues.length})`}
                      onClick={() =>
                        setFilter("all")
                      }
                    />

                    <FilterButton
                      active={
                        filter ===
                        "critical"
                      }
                      label={`Critical (${analysis.criticalIssueCount})`}
                      onClick={() =>
                        setFilter(
                          "critical"
                        )
                      }
                    />

                    <FilterButton
                      active={
                        filter ===
                        "warning"
                      }
                      label={`Warnings (${analysis.warningCount})`}
                      onClick={() =>
                        setFilter(
                          "warning"
                        )
                      }
                    />

                    <FilterButton
                      active={
                        filter ===
                        "missing"
                      }
                      label={`Missing (${analysis.missingCount})`}
                      onClick={() =>
                        setFilter(
                          "missing"
                        )
                      }
                    />

                    <FilterButton
                      active={
                        filter ===
                        "invalid"
                      }
                      label={`Invalid (${analysis.invalidCount})`}
                      onClick={() =>
                        setFilter(
                          "invalid"
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {issues.length ===
              0 ? (
                <div className="flex items-center gap-3 px-5 py-10 text-sm text-emerald-700">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />

                  <div>
                    <p className="font-medium">
                      No issues detected
                    </p>

                    <p className="mt-1 text-xs text-emerald-600">
                      All configured
                      employee
                      data-quality
                      checks passed.
                    </p>
                  </div>
                </div>
              ) : filteredIssues.length ===
                0 ? (
                <div className="px-5 py-10 text-center text-sm text-ink-500">
                  No issues match
                  this filter.
                </div>
              ) : (
                <div className="divide-y divide-ink-100">
                  {filteredIssues.map(
                    (
                      issue,
                      index
                    ) => (
                      <IssueRow
                        key={`${issue.row}-${issue.field}-${index}`}
                        issue={issue}
                      />
                    )
                  )}
                </div>
              )}
            </section>

            {/* Fields / issue breakdown */}

            <section className="grid gap-5 lg:grid-cols-2">
              <section className="card p-5">
                <h2 className="font-semibold text-ink-900">
                  Detected employee
                  fields
                </h2>

                <p className="mt-1 text-sm leading-6 text-ink-500">
                  Common HR column
                  names are mapped
                  automatically.
                </p>

                <div className="mt-4 space-y-2">
                  {[
                    ...REQUIRED_FIELDS,
                    ...OPTIONAL_FIELDS,
                  ].map(
                    (field) => (
                      <div
                        key={field}
                        className="flex items-center justify-between gap-4 rounded-lg bg-canvas px-3 py-2.5"
                      >
                        <span className="text-sm text-ink-700">
                          {labelFor(
                            field
                          )}
                        </span>

                        <span
                          className={`text-xs font-medium ${
                            analysis
                              .fields[
                                field
                              ]
                              ? "text-emerald-700"
                              : REQUIRED_FIELDS.includes(
                                  field
                                )
                              ? "text-red-600"
                              : "text-ink-400"
                          }`}
                        >
                          {analysis
                            .fields[
                              field
                            ] ||
                            (REQUIRED_FIELDS.includes(
                              field
                            )
                              ? "Missing"
                              : "Not provided")}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </section>

              <section className="card p-5">
                <h2 className="font-semibold text-ink-900">
                  Issue breakdown
                </h2>

                <p className="mt-1 text-sm leading-6 text-ink-500">
                  Problems grouped
                  by the type of HR
                  data-quality risk.
                </p>

                <div className="mt-4 space-y-2">
                  {Object.keys(
                    issueCategories
                  ).length === 0 ? (
                    <div className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                      No issue
                      categories
                      detected.
                    </div>
                  ) : (
                    Object.entries(
                      issueCategories
                    ).map(
                      ([
                        category,
                        count,
                      ]) => (
                        <div
                          key={
                            category
                          }
                          className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2.5"
                        >
                          <span className="text-sm text-ink-700">
                            {category}
                          </span>

                          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-600">
                            {count}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              </section>
            </section>

            {/* Human review */}

            <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-5">
              <div className="flex gap-3">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />

                <div>
                  <h2 className="font-semibold text-brand-900">
                    Human review is
                    intentionally
                    preserved
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-brand-800">
                    The checker
                    identifies
                    data-quality
                    problems and
                    prepares
                    correction
                    information. It
                    does not silently
                    modify employee
                    records, merge
                    employees, or
                    decide which
                    employee
                    information is
                    correct. HR
                    remains
                    responsible for
                    validating and
                    correcting source
                    data.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function Metric({
  label,
  value,
  alert = false,
}) {
  return (
    <div
      className={`card p-4 ${
        alert
          ? "border-amber-200"
          : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold ${
          alert
            ? "text-amber-700"
            : "text-ink-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ScoreItem({
  label,
  value,
  description,
}) {
  return (
    <div className="rounded-lg bg-canvas px-4 py-3">
      <p className="text-xs font-medium text-ink-400">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-ink-900">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-ink-500">
        {description}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-brand-800 text-white"
          : "bg-ink-50 text-ink-600 hover:bg-ink-100"
      }`}
    >
      {label}
    </button>
  );
}

function IssueRow({
  issue,
}) {
  const critical =
    issue.severity ===
    "critical";

  return (
    <div className="px-5 py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          {critical ? (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">
                {
                  issue.employee
                }
              </p>

              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                {
                  issue.category
                }
              </span>

              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  critical
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {critical
                  ? "Critical"
                  : "Warning"}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-ink-700">
              {
                issue.message
              }
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ActionBlock
                title="Why it matters"
                text={
                  issue.whyItMatters
                }
              />

              <ActionBlock
                title="Recommended action"
                text={
                  issue.recommendation
                }
              />

              <ActionBlock
                title="Human review"
                text={
                  issue.humanReview
                    ? "Required"
                    : "Not required"
                }
                positive={
                  !issue.humanReview
                }
              />
            </div>
          </div>
        </div>

        <span className="shrink-0 text-xs text-ink-400">
          {issue.row ===
          1
            ? "Header"
            : `Row ${issue.row}`}
        </span>
      </div>
    </div>
  );
}

function ActionBlock({
  title,
  text: value,
  positive = false,
}) {
  return (
    <div className="rounded-lg bg-canvas px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {title}
      </p>

      <p
        className={`mt-1 text-xs leading-5 ${
          positive
            ? "text-emerald-700"
            : "text-ink-600"
        }`}
      >
        {value}
      </p>
    </div>
  );
}