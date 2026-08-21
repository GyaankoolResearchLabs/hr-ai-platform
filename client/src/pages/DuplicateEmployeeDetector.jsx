import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  Search,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { employeeService } from "../services/employeeService";

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

/*
  Basic similarity calculation.

  We deliberately keep this lightweight so the detector
  works entirely in the browser and does not require
  another backend dependency.
*/
function levenshteinDistance(a, b) {
  const first = normalize(a);
  const second = normalize(b);

  if (!first) return second.length;
  if (!second) return first.length;

  const matrix = Array.from(
    { length: second.length + 1 },
    () => Array(first.length + 1).fill(0)
  );

  for (let i = 0; i <= first.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= second.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= second.length; j += 1) {
    for (let i = 1; i <= first.length; i += 1) {
      const cost =
        first[i - 1] === second[j - 1]
          ? 0
          : 1;

      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost
      );
    }
  }

  return matrix[second.length][first.length];
}

function similarity(a, b) {
  const first = normalize(a);
  const second = normalize(b);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const distance = levenshteinDistance(
    first,
    second
  );

  const maxLength = Math.max(
    first.length,
    second.length
  );

  if (!maxLength) {
    return 1;
  }

  return 1 - distance / maxLength;
}

function getConfidenceClasses(score) {
  if (score >= 85) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (score >= 65) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-blue-50 text-blue-700 border-blue-200";
}

function getConfidenceLabel(score) {
  if (score >= 85) {
    return "High confidence";
  }

  if (score >= 65) {
    return "Medium confidence";
  }

  return "Possible match";
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/* =========================================================
   DUPLICATE ANALYSIS
========================================================= */

function compareEmployees(first, second) {
  let score = 0;
  const reasons = [];

  const firstEmail = normalizeEmail(first.email);
  const secondEmail = normalizeEmail(second.email);

  const firstCode = normalizeCode(
    first.employee_code
  );

  const secondCode = normalizeCode(
    second.employee_code
  );

  const nameSimilarity = similarity(
    first.full_name,
    second.full_name
  );

  /*
    Exact email is a very strong duplicate indicator.
  */

  if (
    firstEmail &&
    secondEmail &&
    firstEmail === secondEmail
  ) {
    score += 60;

    reasons.push({
      label: "Same email address",
      strength: "strong",
    });
  } else if (
    firstEmail &&
    secondEmail &&
    similarity(firstEmail, secondEmail) >= 0.9
  ) {
    score += 25;

    reasons.push({
      label: "Very similar email address",
      strength: "medium",
    });
  }

  /*
    Exact employee code is another strong indicator.
  */

  if (
    firstCode &&
    secondCode &&
    firstCode === secondCode
  ) {
    score += 55;

    reasons.push({
      label: "Same employee code",
      strength: "strong",
    });
  } else if (
    firstCode &&
    secondCode &&
    similarity(firstCode, secondCode) >= 0.85
  ) {
    score += 20;

    reasons.push({
      label: "Similar employee code",
      strength: "medium",
    });
  }

  /*
    Similar employee names.
  */

  if (nameSimilarity >= 0.95) {
    score += 35;

    reasons.push({
      label: "Almost identical employee name",
      strength: "strong",
    });
  } else if (nameSimilarity >= 0.82) {
    score += 22;

    reasons.push({
      label: "Very similar employee name",
      strength: "medium",
    });
  } else if (nameSimilarity >= 0.72) {
    score += 12;

    reasons.push({
      label: "Similar employee name",
      strength: "weak",
    });
  }

  /*
    Same department adds supporting evidence.
  */

  const firstDepartment = normalize(
    first.department
  );

  const secondDepartment = normalize(
    second.department
  );

  if (
    firstDepartment &&
    secondDepartment &&
    firstDepartment === secondDepartment
  ) {
    score += 8;

    reasons.push({
      label: "Same department",
      strength: "weak",
    });
  }

  /*
    Same job title adds supporting evidence.
  */

  const firstTitle = normalize(first.title);
  const secondTitle = normalize(second.title);

  if (
    firstTitle &&
    secondTitle &&
    firstTitle === secondTitle
  ) {
    score += 5;

    reasons.push({
      label: "Same job title",
      strength: "weak",
    });
  }

  /*
    Cap the score at 100.
  */

  score = Math.min(score, 100);

  return {
    score,
    reasons,
  };
}

/* =========================================================
   COMPONENT
========================================================= */

export default function DuplicateEmployeeDetector() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [minimumConfidence, setMinimumConfidence] =
    useState(65);

  const [selectedPair, setSelectedPair] =
    useState(null);

  /* =======================================================
     LOAD EMPLOYEES
  ======================================================= */

  async function loadEmployees() {
    setLoading(true);
    setError("");

    try {
      const data = await employeeService.list();

      setEmployees(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load employees:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Couldn't load employees. Please make sure the backend is running and your session is active."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  /* =======================================================
     FIND DUPLICATES
  ======================================================= */

  const duplicatePairs = useMemo(() => {
    const results = [];

    for (
      let firstIndex = 0;
      firstIndex < employees.length;
      firstIndex += 1
    ) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < employees.length;
        secondIndex += 1
      ) {
        const first =
          employees[firstIndex];

        const second =
          employees[secondIndex];

        const comparison =
          compareEmployees(
            first,
            second
          );

        /*
          Only show records that have enough evidence
          to be considered a possible duplicate.
        */

        if (
          comparison.score >=
          minimumConfidence
        ) {
          results.push({
            id: `${first.id}-${second.id}`,
            first,
            second,
            score: comparison.score,
            reasons:
              comparison.reasons,
          });
        }
      }
    }

    return results.sort(
      (a, b) => b.score - a.score
    );
  }, [
    employees,
    minimumConfidence,
  ]);

  /* =======================================================
     SEARCH RESULTS
  ======================================================= */

  const filteredPairs = useMemo(() => {
    const query = normalize(search);

    if (!query) {
      return duplicatePairs;
    }

    return duplicatePairs.filter(
      (pair) => {
        const first = pair.first;
        const second = pair.second;

        const searchableText = [
          first.full_name,
          first.email,
          first.employee_code,
          first.department,
          first.title,
          second.full_name,
          second.email,
          second.employee_code,
          second.department,
          second.title,
        ]
          .map(normalize)
          .join(" ");

        return searchableText.includes(
          query
        );
      }
    );
  }, [
    duplicatePairs,
    search,
  ]);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const highConfidenceCount =
    duplicatePairs.filter(
      (pair) => pair.score >= 85
    ).length;

  const mediumConfidenceCount =
    duplicatePairs.filter(
      (pair) =>
        pair.score >= 65 &&
        pair.score < 85
    ).length;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0">
      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-ink-400">
            <Users className="h-4 w-4" />
            Employee Records & Documentation
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Duplicate Employee Detector
          </h1>

          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Identify employee records that may
            represent the same person before they
            create downstream HR problems.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEmployees}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}

          Scan again
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Employees scanned
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {employees.length}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Potential duplicates
          </p>

          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {duplicatePairs.length}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            High confidence
          </p>

          <p className="mt-2 text-2xl font-semibold text-red-700">
            {highConfidenceCount}
          </p>
        </div>
      </div>

      {/* FILTERS */}

      <div className="card mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search duplicate name, email or employee ID..."
              className="w-full rounded-lg border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <select
            value={minimumConfidence}
            onChange={(event) =>
              setMinimumConfidence(
                Number(event.target.value)
              )
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value={85}>
              High confidence only
            </option>

            <option value={65}>
              Medium + high confidence
            </option>

            <option value={50}>
              Include weaker matches
            </option>
          </select>
        </div>

        <div className="mt-3 text-xs text-ink-400">
          Detection compares names, email
          addresses, employee codes, departments
          and job titles. No employee record is
          modified automatically.
        </div>
      </div>

      {/* CONTENT */}

      {loading ? (
        <div className="card flex items-center justify-center gap-2 py-20 text-sm text-ink-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Scanning employee records...
        </div>
      ) : employees.length < 2 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <Users className="h-10 w-10 text-ink-300" />

          <h2 className="mt-4 text-base font-semibold text-ink-800">
            Not enough employee records
          </h2>

          <p className="mt-1 max-w-md text-sm text-ink-500">
            At least two employee records are
            required before potential duplicates
            can be detected.
          </p>
        </div>
      ) : filteredPairs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />

          <h2 className="mt-4 text-base font-semibold text-ink-800">
            No potential duplicates found
          </h2>

          <p className="mt-1 max-w-md text-sm text-ink-500">
            No employee pairs matched the selected
            confidence threshold.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPairs.map((pair) => (
            <div
              key={pair.id}
              className="card overflow-hidden"
            >
              {/* MATCH HEADER */}

              <div className="flex flex-col gap-3 border-b border-ink-100 bg-ink-50/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getConfidenceClasses(
                      pair.score
                    )}`}
                  >
                    {getConfidenceLabel(
                      pair.score
                    )}
                  </span>

                  <span className="text-sm text-ink-500">
                    {pair.score}% match
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedPair(pair)
                  }
                  className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Compare records
                </button>
              </div>

              {/* EMPLOYEE PAIR */}

              <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
                <EmployeeCard
                  employee={pair.first}
                  label="Employee record 1"
                />

                <EmployeeCard
                  employee={pair.second}
                  label="Employee record 2"
                  bordered
                />
              </div>

              {/* REASONS */}

              <div className="border-t border-ink-100 px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  Why this pair was flagged
                </p>

                <div className="flex flex-wrap gap-2">
                  {pair.reasons.map(
                    (reason, index) => (
                      <span
                        key={`${reason.label}-${index}`}
                        className="rounded-full bg-ink-50 px-3 py-1.5 text-xs text-ink-600"
                      >
                        {reason.label}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* COMPARE MODAL */}

      {selectedPair && (
        <CompareModal
          pair={selectedPair}
          onClose={() =>
            setSelectedPair(null)
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   EMPLOYEE CARD
========================================================= */

function EmployeeCard({
  employee,
  label,
  bordered = false,
}) {
  return (
    <div
      className={`p-5 ${
        bordered
          ? "border-t border-ink-100 lg:border-l lg:border-t-0"
          : ""
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <UserRound className="h-5 w-5" />
        </span>

        <div>
          <p className="text-xs uppercase tracking-wide text-ink-400">
            {label}
          </p>

          <h3 className="font-medium text-ink-900">
            {employee.full_name ||
              "Unnamed employee"}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Info
          label="Employee ID"
          value={
            employee.employee_code ||
            "—"
          }
        />

        <Info
          label="Email"
          value={employee.email || "—"}
        />

        <Info
          label="Department"
          value={
            employee.department || "—"
          }
        />

        <Info
          label="Position"
          value={employee.title || "—"}
        />

        <Info
          label="Joining date"
          value={formatDate(
            employee.joining_date
          )}
        />

        <Info
          label="Status"
          value={
            employee.employment_status ||
            "Active"
          }
        />
      </div>
    </div>
  );
}

/* =========================================================
   INFO
========================================================= */

function Info({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm text-ink-700">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   COMPARE MODAL
========================================================= */

function CompareModal({
  pair,
  onClose,
}) {
  const fields = [
    {
      label: "Full name",
      key: "full_name",
    },
    {
      label: "Email",
      key: "email",
    },
    {
      label: "Employee code",
      key: "employee_code",
    },
    {
      label: "Department",
      key: "department",
    },
    {
      label: "Job title",
      key: "title",
    },
    {
      label: "Joining date",
      key: "joining_date",
    },
    {
      label: "Employment status",
      key: "employment_status",
    },
    {
      label: "Address",
      key: "address",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-xl">
        {/* MODAL HEADER */}

        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Compare employee records
            </h2>

            <p className="mt-1 text-xs text-ink-400">
              Review the records before deciding
              whether they represent the same person.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MODAL CONTENT */}

        <div className="max-h-[70vh] overflow-auto">
          <div className="min-w-[700px]">
            {/* COLUMN HEADERS */}

            <div className="grid grid-cols-[180px_1fr_1fr] border-b border-ink-100 bg-ink-50">
              <div className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Field
              </div>

              <div className="border-l border-ink-100 px-5 py-3">
                <p className="text-xs text-ink-400">
                  Employee 1
                </p>

                <p className="mt-1 font-medium text-ink-900">
                  {pair.first.full_name}
                </p>
              </div>

              <div className="border-l border-ink-100 px-5 py-3">
                <p className="text-xs text-ink-400">
                  Employee 2
                </p>

                <p className="mt-1 font-medium text-ink-900">
                  {pair.second.full_name}
                </p>
              </div>
            </div>

            {/* FIELDS */}

            {fields.map((field) => {
              const firstValue =
                field.key === "joining_date"
                  ? formatDate(
                      pair.first[field.key]
                    )
                  : pair.first[field.key] ||
                    "—";

              const secondValue =
                field.key === "joining_date"
                  ? formatDate(
                      pair.second[field.key]
                    )
                  : pair.second[field.key] ||
                    "—";

              const same =
                normalize(firstValue) ===
                normalize(secondValue);

              return (
                <div
                  key={field.key}
                  className="grid grid-cols-[180px_1fr_1fr] border-b border-ink-100"
                >
                  <div className="px-5 py-3 text-sm font-medium text-ink-600">
                    {field.label}
                  </div>

                  <div
                    className={`border-l border-ink-100 px-5 py-3 text-sm ${
                      same
                        ? "bg-amber-50 text-amber-800"
                        : "text-ink-700"
                    }`}
                  >
                    {firstValue}
                  </div>

                  <div
                    className={`border-l border-ink-100 px-5 py-3 text-sm ${
                      same
                        ? "bg-amber-50 text-amber-800"
                        : "text-ink-700"
                    }`}
                  >
                    {secondValue}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL FOOTER */}

        <div className="flex items-center justify-between border-t border-ink-100 px-5 py-4">
          <p className="text-xs text-ink-400">
            Detection confidence:{" "}
            <strong>
              {pair.score}%
            </strong>
          </p>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Close comparison
          </button>
        </div>
      </div>
    </div>
  );
}