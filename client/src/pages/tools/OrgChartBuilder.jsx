import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GitBranch,
  RefreshCw,
  Search,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    employee?.employeeId ||
    null
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.fullName ||
    employee?.name ||
    "Unnamed employee"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    employee?.departmentName ||
    "Unassigned"
  );
}

function getEmployeeTitle(employee) {
  return (
    employee?.title ||
    employee?.job_title ||
    employee?.jobTitle ||
    employee?.designation ||
    "No title"
  );
}

function getEmployeeCode(employee) {
  return (
    employee?.employee_code ||
    employee?.employeeCode ||
    employee?.employee_number ||
    employee?.employeeNumber ||
    null
  );
}

function getManagerId(employee) {
  return (
    employee?.manager_id ??
    employee?.reporting_manager_id ??
    employee?.managerId ??
    employee?.reportingManagerId ??
    employee?.manager?.id ??
    employee?.reporting_manager?.id ??
    null
  );
}

function getManagerName(employee) {
  return (
    employee?.manager_name ||
    employee?.reporting_manager_name ||
    employee?.managerName ||
    employee?.reportingManagerName ||
    employee?.manager?.full_name ||
    employee?.manager?.name ||
    employee?.reporting_manager?.full_name ||
    employee?.reporting_manager?.name ||
    null
  );
}

/* =========================================================
   EMPLOYEE CARD
========================================================= */

function EmployeeCard({
  employee,
  childrenMap,
  employees,
  draftManagers,
  updatingEmployeeId,
  expandedEmployees,
  onToggle,
  onManagerChange,
  onSaveManager,
  getBlockedManagerIds,
  visited,
}) {
  const employeeId = getEmployeeId(employee);

  if (!employeeId) return null;

  const employeeKey = String(employeeId);

  if (visited.has(employeeKey)) {
    return null;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(employeeKey);

  const children =
    childrenMap.get(employeeKey) || [];

  const employeeName =
    getEmployeeName(employee);

  const department =
    getEmployeeDepartment(employee);

  const title =
    getEmployeeTitle(employee);

  const employeeCode =
    getEmployeeCode(employee);

  const currentManagerId =
    getManagerId(employee);

  const currentManagerName =
    getManagerName(employee);

  const draftManagerId =
    draftManagers[employeeKey] ??
    currentManagerId ??
    "";

  const isUpdating =
    updatingEmployeeId === employeeKey;

  const hasChildren = children.length > 0;

  const isExpanded =
    expandedEmployees[employeeKey] !== false;

  const blockedManagerIds =
    getBlockedManagerIds(employeeKey);

  return (
    <div className="relative">
      {/* EMPLOYEE CARD */}

      <div className="w-[360px] max-w-[360px] rounded-xl border border-ink-200 bg-white shadow-sm">
        {/* CARD HEADER */}

        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <UserCog className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink-900">
                {employeeName}
              </p>

              <p className="mt-0.5 truncate text-xs text-ink-500">
                {title}
              </p>

              <p className="mt-1 truncate text-xs text-ink-400">
                {department}
              </p>
            </div>
          </div>

          {hasChildren && (
            <button
              type="button"
              onClick={() =>
                onToggle(employeeKey)
              }
              className="rounded-md p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
              title={
                isExpanded
                  ? "Collapse team"
                  : "Expand team"
              }
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* CARD BODY */}

        <div className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                Employee ID
              </p>

              <p
                className="mt-1 truncate text-xs font-medium text-ink-700"
                title={
                  employeeCode ||
                  employeeKey
                }
              >
                {employeeCode ||
                  employeeKey ||
                  "—"}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">
                Reports to
              </p>

              <p className="mt-1 truncate text-xs font-medium text-ink-700">
                {currentManagerName ||
                  "No manager"}
              </p>
            </div>
          </div>

          {/* MANAGER */}

          <div>
            <label
              htmlFor={`manager-${employeeKey}`}
              className="mb-1.5 block text-xs font-medium text-ink-600"
            >
              Reporting manager
            </label>

            <select
              id={`manager-${employeeKey}`}
              value={draftManagerId}
              disabled={isUpdating}
              onChange={(event) =>
                onManagerChange(
                  employeeKey,
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-ink-50"
            >
              <option value="">
                No reporting manager
              </option>

              {employees
                .filter((manager) => {
                  const managerId =
                    getEmployeeId(manager);

                  if (!managerId) {
                    return false;
                  }

                  if (
                    String(managerId) ===
                    employeeKey
                  ) {
                    return false;
                  }

                  if (
                    blockedManagerIds.has(
                      String(managerId),
                    )
                  ) {
                    return false;
                  }

                  return true;
                })
                .sort((a, b) =>
                  getEmployeeName(
                    a,
                  ).localeCompare(
                    getEmployeeName(b),
                  ),
                )
                .map((manager) => {
                  const managerId =
                    getEmployeeId(manager);

                  return (
                    <option
                      key={managerId}
                      value={managerId}
                    >
                      {getEmployeeName(
                        manager,
                      )}{" "}
                      —{" "}
                      {getEmployeeTitle(
                        manager,
                      )}
                    </option>
                  );
                })}
            </select>
          </div>

          {/* SAVE / CANCEL */}

          {String(draftManagerId || "") !==
            String(
              currentManagerId || "",
            ) && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() =>
                  onManagerChange(
                    employeeKey,
                    currentManagerId || "",
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>

              <button
                type="button"
                disabled={isUpdating}
                onClick={() =>
                  onSaveManager(
                    employeeKey,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save manager"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CHILDREN */}

      {hasChildren && isExpanded && (
        <div className="relative ml-10 mt-6 border-l border-ink-200 pl-10">
          <div className="space-y-6">
            {children.map((child) => {
              const childId =
                getEmployeeId(child);

              if (!childId) {
                return null;
              }

              return (
                <div
                  key={String(childId)}
                  className="relative"
                >
                  {/* CONNECTOR */}

                  <div className="absolute -left-10 top-8 h-px w-10 bg-ink-200" />

                  <EmployeeCard
                    employee={child}
                    childrenMap={
                      childrenMap
                    }
                    employees={employees}
                    draftManagers={
                      draftManagers
                    }
                    updatingEmployeeId={
                      updatingEmployeeId
                    }
                    expandedEmployees={
                      expandedEmployees
                    }
                    onToggle={onToggle}
                    onManagerChange={
                      onManagerChange
                    }
                    onSaveManager={
                      onSaveManager
                    }
                    getBlockedManagerIds={
                      getBlockedManagerIds
                    }
                    visited={
                      nextVisited
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function OrgChartBuilder() {
  const navigate = useNavigate();

  const [orgChart, setOrgChart] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [draftManagers, setDraftManagers] =
    useState({});

  const [
    updatingEmployeeId,
    setUpdatingEmployeeId,
  ] = useState(null);

  const [
    expandedEmployees,
    setExpandedEmployees,
  ] = useState({});

  /* =======================================================
     LOAD
  ======================================================= */

  const loadOrgChart = async (
    isRefresh = false,
  ) => {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response =
        await api.get("/org-chart");

      const data = response?.data;

      if (!data) {
        throw new Error(
          "Organization chart response was empty.",
        );
      }

      setOrgChart(data);

      const employees =
        Array.isArray(data.employees)
          ? data.employees
          : [];

      const managerDrafts = {};
      const expanded = {};

      employees.forEach((employee) => {
        const id =
          getEmployeeId(employee);

        if (!id) return;

        const key = String(id);

        managerDrafts[key] =
          getManagerId(employee) || "";

        expanded[key] = true;
      });

      setDraftManagers(
        managerDrafts,
      );

      setExpandedEmployees(
        expanded,
      );
    } catch (err) {
      console.error(
        "[OrgChartBuilder] Load failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load organization chart.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrgChart();
  }, []);

  /* =======================================================
     EMPLOYEES
  ======================================================= */

  const employees = useMemo(() => {
    return Array.isArray(
      orgChart?.employees,
    )
      ? orgChart.employees
      : [];
  }, [orgChart]);

  /* =======================================================
     EMPLOYEE MAP
  ======================================================= */

  const employeeMap = useMemo(() => {
    const map = new Map();

    employees.forEach((employee) => {
      const id =
        getEmployeeId(employee);

      if (id) {
        map.set(
          String(id),
          employee,
        );
      }
    });

    return map;
  }, [employees]);

  /* =======================================================
     CHILDREN MAP
  ======================================================= */

  const childrenMap = useMemo(() => {
    const map = new Map();

    employees.forEach((employee) => {
      const managerId =
        getManagerId(employee);

      if (!managerId) {
        return;
      }

      const key = String(managerId);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(employee);
    });

    map.forEach((children) => {
      children.sort((a, b) =>
        getEmployeeName(
          a,
        ).localeCompare(
          getEmployeeName(b),
        ),
      );
    });

    return map;
  }, [employees]);

  /* =======================================================
     ROOTS
  ======================================================= */

  const rootEmployees = useMemo(() => {
    return employees
      .filter((employee) => {
        const managerId =
          getManagerId(employee);

        if (!managerId) {
          return true;
        }

        return !employeeMap.has(
          String(managerId),
        );
      })
      .sort((a, b) =>
        getEmployeeName(
          a,
        ).localeCompare(
          getEmployeeName(b),
        ),
      );
  }, [
    employees,
    employeeMap,
  ]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredEmployees =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return employees;
      }

      return employees.filter(
        (employee) => {
          const managerId =
            getManagerId(employee);

          const manager =
            managerId
              ? employeeMap.get(
                  String(managerId),
                )
              : null;

          return [
            getEmployeeName(
              employee,
            ),
            getEmployeeDepartment(
              employee,
            ),
            getEmployeeTitle(
              employee,
            ),
            getEmployeeCode(
              employee,
            ),
            getEmployeeId(
              employee,
            ),
            getManagerName(
              employee,
            ),
            getEmployeeName(
              manager,
            ),
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query),
            );
        },
      );
    }, [
      employees,
      employeeMap,
      search,
    ]);

  /* =======================================================
     CYCLE PROTECTION
  ======================================================= */

  const getBlockedManagerIds = (
    employeeId,
  ) => {
    const blocked = new Set();

    const visit = (managerId) => {
      const children =
        childrenMap.get(
          String(managerId),
        ) || [];

      children.forEach((child) => {
        const childId =
          getEmployeeId(child);

        if (!childId) {
          return;
        }

        const childKey =
          String(childId);

        if (
          childKey ===
          String(employeeId)
        ) {
          return;
        }

        if (
          blocked.has(childKey)
        ) {
          return;
        }

        blocked.add(childKey);

        visit(childId);
      });
    };

    visit(employeeId);

    return blocked;
  };

  /* =======================================================
     MANAGER CHANGE
  ======================================================= */

  const handleManagerChange = (
    employeeId,
    managerId,
  ) => {
    setDraftManagers(
      (current) => ({
        ...current,
        [String(employeeId)]:
          managerId,
      }),
    );

    setError("");
    setSuccess("");
  };

  /* =======================================================
     SAVE MANAGER
  ======================================================= */

  const saveManager = async (
    employeeId,
  ) => {
    try {
      setError("");
      setSuccess("");

      setUpdatingEmployeeId(
        String(employeeId),
      );

      const managerId =
        draftManagers[
          String(employeeId)
        ] || null;

      const response =
        await api.patch(
          `/org-chart/${employeeId}/manager`,
          {
            manager_id:
              managerId,
          },
        );

      setSuccess(
        response?.data?.message ||
          "Reporting manager updated successfully.",
      );

      /*
       * IMPORTANT:
       * Reload everything from backend.
       */
      await loadOrgChart(true);
    } catch (err) {
      console.error(
        "[OrgChartBuilder] Update failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update reporting manager.",
      );
    } finally {
      setUpdatingEmployeeId(
        null,
      );
    }
  };

  /* =======================================================
     EXPAND / COLLAPSE
  ======================================================= */

  const toggleEmployee = (
    employeeId,
  ) => {
    const key = String(employeeId);

    setExpandedEmployees(
      (current) => ({
        ...current,
        [key]:
          current[key] === false,
      }),
    );
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div className="min-w-0 space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-xl font-semibold text-ink-900">
              Live Org Chart Builder
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              Org charts that stay in sync with reality
            </p>
          </div>
        </div>

        <div className="card flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />

            <p className="mt-3 text-sm text-ink-500">
              Loading organization chart...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div className="min-w-0 space-y-6 pb-8">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="mt-0.5 rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">
                Live Org Chart Builder
              </h1>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Live
              </span>
            </div>

            <p className="mt-1 text-sm text-ink-500">
              Org charts that stay in sync with reality
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            loadOrgChart(true)
          }
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
        >
          <RefreshCw
            className={
              refreshing
                ? "h-4 w-4 animate-spin"
                : "h-4 w-4"
            }
          />

          Refresh
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SUCCESS */}

      {success && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <p>{success}</p>

          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-500">
                Total employees
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {Number(
                  orgChart?.totalEmployees ??
                    employees.length,
                )}
              </p>
            </div>

            <div className="rounded-lg bg-brand-50 p-2.5 text-brand-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-500">
                Top-level employees
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {Number(
                  orgChart?.totalRoots ??
                    rootEmployees.length,
                )}
              </p>
            </div>

            <div className="rounded-lg bg-brand-50 p-2.5 text-brand-700">
              <GitBranch className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-500">
                Reporting relationships
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {Math.max(
                  employees.length -
                    rootEmployees.length,
                  0,
                )}
              </p>
            </div>

            <div className="rounded-lg bg-brand-50 p-2.5 text-brand-700">
              <UserCog className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* ORGANIZATION */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Organization structure
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Real employee reporting relationships from your organization data.
              </p>
            </div>

            <div className="relative w-full lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search employees..."
                className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>
        </div>

        {/* SEARCH RESULTS */}

        {search.trim() ? (
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left">
                  <th className="px-5 py-3 font-medium text-ink-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Department
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Job title
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Reporting manager
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Employee ID
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map(
                  (employee) => {
                    const employeeId =
                      getEmployeeId(
                        employee,
                      );

                    const managerId =
                      getManagerId(
                        employee,
                      );

                    const manager =
                      managerId
                        ? employeeMap.get(
                            String(
                              managerId,
                            ),
                          )
                        : null;

                    return (
                      <tr
                        key={employeeId}
                        className="border-b border-ink-100 last:border-0"
                      >
                        <td className="px-5 py-4 font-medium text-ink-900">
                          {getEmployeeName(
                            employee,
                          )}
                        </td>

                        <td className="px-5 py-4 text-ink-700">
                          {getEmployeeDepartment(
                            employee,
                          )}
                        </td>

                        <td className="px-5 py-4 text-ink-700">
                          {getEmployeeTitle(
                            employee,
                          )}
                        </td>

                        <td className="px-5 py-4 text-ink-700">
                          {getManagerName(
                            employee,
                          ) ||
                            getEmployeeName(
                              manager,
                            ) ||
                            "No manager"}
                        </td>

                        <td className="px-5 py-4 text-xs text-ink-500">
                          {getEmployeeCode(
                            employee,
                          ) ||
                            employeeId ||
                            "—"}
                        </td>
                      </tr>
                    );
                  },
                )}

                {filteredEmployees.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-ink-400"
                    >
                      No employees match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TREE */

          <div className="overflow-x-auto p-6">
            {rootEmployees.length ===
            0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-700">
                No top-level employees were found.
              </div>
            ) : (
              <div className="flex min-w-max flex-col gap-10">
                {rootEmployees.map(
                  (employee) => {
                    const id =
                      getEmployeeId(
                        employee,
                      );

                    return (
                      <EmployeeCard
                        key={id}
                        employee={employee}
                        childrenMap={
                          childrenMap
                        }
                        employees={
                          employees
                        }
                        draftManagers={
                          draftManagers
                        }
                        updatingEmployeeId={
                          updatingEmployeeId
                        }
                        expandedEmployees={
                          expandedEmployees
                        }
                        onToggle={
                          toggleEmployee
                        }
                        onManagerChange={
                          handleManagerChange
                        }
                        onSaveManager={
                          saveManager
                        }
                        getBlockedManagerIds={
                          getBlockedManagerIds
                        }
                        visited={
                          new Set()
                        }
                      />
                    );
                  },
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}