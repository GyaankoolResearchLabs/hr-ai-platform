import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";

import { employeeService } from "../../services/employeeService";

export default function DuplicateEmployeeDetector() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      setLoading(true);
      setError("");

      const data = await employeeService.list();

      const employeeList = Array.isArray(data)
        ? data
        : Array.isArray(data?.employees)
          ? data.employees
          : Array.isArray(data?.data)
            ? data.data
            : [];

      setEmployees(employeeList);
    } catch (err) {
      console.error("Could not load employees:", err);

      setEmployees([]);

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load employee records."
      );
    } finally {
      setLoading(false);
    }
  }

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function getEmployeeName(employee) {
    if (employee?.name) return employee.name;

    const fullName = [
      employee?.first_name,
      employee?.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (fullName) return fullName;

    return "Unnamed employee";
  }

  function getEmployeeId(employee) {
    return (
      employee?.employee_id ||
      employee?.employeeId ||
      employee?.emp_id ||
      employee?.id ||
      "—"
    );
  }

  function getEmail(employee) {
    return employee?.email || employee?.work_email || "—";
  }

  function getDepartment(employee) {
    return (
      employee?.department ||
      employee?.department_name ||
      "—"
    );
  }

  function getPosition(employee) {
    return (
      employee?.position ||
      employee?.job_title ||
      employee?.role ||
      "—"
    );
  }

  /*
   * Duplicate detection strategy:
   *
   * 1. Same employee ID
   * 2. Same email
   * 3. Same normalized name
   *
   * We intentionally do NOT automatically mark employees as duplicates
   * merely because their names are similar. HR should review the result.
   */

  const duplicateGroups = useMemo(() => {
    const groups = new Map();

    employees.forEach((employee) => {
      const name = normalize(getEmployeeName(employee));
      const employeeId = normalize(getEmployeeId(employee));
      const email = normalize(getEmail(employee));

      const keys = [];

      if (employeeId && employeeId !== "—") {
        keys.push(`id:${employeeId}`);
      }

      if (email && email !== "—") {
        keys.push(`email:${email}`);
      }

      if (name && name !== "unnamed employee") {
        keys.push(`name:${name}`);
      }

      keys.forEach((key) => {
        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key).push(employee);
      });
    });

    const result = [];
    const seenPairs = new Set();

    groups.forEach((group, key) => {
      if (group.length < 2) {
        return;
      }

      for (let i = 0; i < group.length; i += 1) {
        for (let j = i + 1; j < group.length; j += 1) {
          const first = group[i];
          const second = group[j];

          const firstId = String(
            first?.id ||
              first?.employee_id ||
              first?.employeeId ||
              i
          );

          const secondId = String(
            second?.id ||
              second?.employee_id ||
              second?.employeeId ||
              j
          );

          const pairKey = [firstId, secondId]
            .sort()
            .join("::");

          if (seenPairs.has(pairKey)) {
            continue;
          }

          seenPairs.add(pairKey);

          result.push({
            key,
            first,
            second,
          });
        }
      }
    });

    return result;
  }, [employees]);

  const filteredDuplicates = useMemo(() => {
    const query = normalize(search);

    if (!query) {
      return duplicateGroups;
    }

    return duplicateGroups.filter(({ first, second }) => {
      const firstText = [
        getEmployeeName(first),
        getEmployeeId(first),
        getEmail(first),
        getDepartment(first),
        getPosition(first),
      ]
        .join(" ")
        .toLowerCase();

      const secondText = [
        getEmployeeName(second),
        getEmployeeId(second),
        getEmail(second),
        getDepartment(second),
        getPosition(second),
      ]
        .join(" ")
        .toLowerCase();

      return (
        firstText.includes(query) ||
        secondText.includes(query)
      );
    });
  }, [duplicateGroups, search]);

  const highConfidenceCount = duplicateGroups.filter(
    ({ key }) =>
      key.startsWith("id:") ||
      key.startsWith("email:")
  ).length;

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
            Identify likely duplicate employee records before
            they create downstream HR problems.
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
            {duplicateGroups.length}
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

      {/* SEARCH */}

      <div className="card mb-6 p-4">
        <label className="mb-2 block text-sm font-medium text-ink-700">
          Search duplicate results
        </label>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search employee name, ID, email..."
            className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink-900 outline-none focus:border-ink-400"
          />
        </div>
      </div>

      {/* LOADING */}

      {loading && (
        <div className="card flex items-center justify-center gap-3 p-10 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin" />

          Scanning employee records...
        </div>
      )}

      {/* NO DUPLICATES */}

      {!loading &&
        !error &&
        duplicateGroups.length === 0 && (
          <div className="card p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-ink-950">
              No likely duplicates found
            </h2>

            <p className="mx-auto mt-2 max-w-lg text-sm text-ink-500">
              The current employee records do not contain
              obvious duplicate IDs, email addresses, or
              normalized names.
            </p>
          </div>
        )}

      {/* RESULTS */}

      {!loading &&
        duplicateGroups.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-950">
                  Potential duplicate records
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Review these records before taking any HR
                  action.
                </p>
              </div>

              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                {filteredDuplicates.length} result
                {filteredDuplicates.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            {filteredDuplicates.length === 0 ? (
              <div className="card p-6 text-center text-sm text-ink-500">
                No duplicate results match your search.
              </div>
            ) : (
              filteredDuplicates.map(
                ({ first, second, key }, index) => (
                  <div
                    key={`${key}-${index}`}
                    className="card overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-ink-100 bg-amber-50 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />

                        <span className="text-sm font-medium text-amber-800">
                          Potential duplicate
                        </span>
                      </div>

                      <span className="text-xs text-amber-700">
                        {key.startsWith("id:")
                          ? "Same employee ID"
                          : key.startsWith("email:")
                            ? "Same email"
                            : "Same name"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 divide-y divide-ink-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                      {/* FIRST EMPLOYEE */}

                      <div className="p-5">
                        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Employee 1
                        </p>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-ink-400">
                              Name
                            </p>

                            <p className="text-sm font-medium text-ink-900">
                              {getEmployeeName(first)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Employee ID
                            </p>

                            <p className="text-sm text-ink-700">
                              {getEmployeeId(first)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Email
                            </p>

                            <p className="break-all text-sm text-ink-700">
                              {getEmail(first)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Department
                            </p>

                            <p className="text-sm text-ink-700">
                              {getDepartment(first)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Position
                            </p>

                            <p className="text-sm text-ink-700">
                              {getPosition(first)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* SECOND EMPLOYEE */}

                      <div className="p-5">
                        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-400">
                          Employee 2
                        </p>

                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-ink-400">
                              Name
                            </p>

                            <p className="text-sm font-medium text-ink-900">
                              {getEmployeeName(second)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Employee ID
                            </p>

                            <p className="text-sm text-ink-700">
                              {getEmployeeId(second)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Email
                            </p>

                            <p className="break-all text-sm text-ink-700">
                              {getEmail(second)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Department
                            </p>

                            <p className="text-sm text-ink-700">
                              {getDepartment(second)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-ink-400">
                              Position
                            </p>

                            <p className="text-sm text-ink-700">
                              {getPosition(second)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )
            )}
          </div>
        )}
    </div>
  );
}