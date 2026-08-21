import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  AlertCircle,
  Building2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

const toNumber = (value, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace("%", "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const number = toNumber(value, NaN);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const getDepartmentRows = (metrics) => {
  const source =
    metrics?.departmentBreakdown ??
    metrics?.department_breakdown ??
    metrics?.departments ??
    metrics?.byDepartment ??
    metrics?.by_department ??
    metrics?.departmentMetrics ??
    metrics?.department_metrics ??
    [];

  if (Array.isArray(source)) {
    return source
      .map((item, index) => {
        if (typeof item === "string") {
          return {
            name: item,
            headcount: 0,
            active: 0,
            exited: 0,
            attrition: 0,
            key: `${item}-${index}`,
          };
        }

        if (!item || typeof item !== "object") return null;

        const name =
          item.department ??
          item.department_name ??
          item.name ??
          item.label ??
          `Department ${index + 1}`;

        const headcount = firstNumber(
          item.headcount,
          item.total,
          item.totalEmployees,
          item.total_employees,
          item.count
        );

        const active = firstNumber(
          item.active,
          item.activeEmployees,
          item.active_employees
        );

        const exited = firstNumber(
          item.exited,
          item.exits,
          item.terminated,
          item.terminatedEmployees,
          item.terminated_employees
        );

        const attrition = firstNumber(
          item.attrition,
          item.attritionRate,
          item.attrition_rate,
          headcount > 0 ? (exited / headcount) * 100 : 0
        );

        return {
          name: String(name),
          headcount,
          active,
          exited,
          attrition,
          key: `${String(name)}-${index}`,
        };
      })
      .filter(Boolean);
  }

  if (source && typeof source === "object") {
    return Object.entries(source).map(([name, value], index) => {
      if (typeof value === "number" || typeof value === "string") {
        return {
          name,
          headcount: toNumber(value),
          active: 0,
          exited: 0,
          attrition: 0,
          key: `${name}-${index}`,
        };
      }

      const item = value && typeof value === "object" ? value : {};

      const headcount = firstNumber(
        item.headcount,
        item.total,
        item.totalEmployees,
        item.total_employees,
        item.count
      );

      const active = firstNumber(
        item.active,
        item.activeEmployees,
        item.active_employees
      );

      const exited = firstNumber(
        item.exited,
        item.exits,
        item.terminated,
        item.terminatedEmployees,
        item.terminated_employees
      );

      return {
        name,
        headcount,
        active,
        exited,
        attrition: firstNumber(
          item.attrition,
          item.attritionRate,
          item.attrition_rate,
          headcount > 0 ? (exited / headcount) * 100 : 0
        ),
        key: `${name}-${index}`,
      };
    });
  }

  return [];
};

const normalizeMetrics = (raw) => {
  const metrics =
    raw?.metrics ??
    raw?.data?.metrics ??
    raw?.data ??
    raw ??
    {};

  const departmentRows = getDepartmentRows(metrics);

  const headcount = firstNumber(
    metrics?.headcount,
    metrics?.totalEmployees,
    metrics?.total_employees,
    metrics?.totalHeadcount,
    metrics?.total_headcount,
    metrics?.employeeCount,
    metrics?.employee_count,
    departmentRows.reduce((sum, item) => sum + item.headcount, 0)
  );

  const activeEmployees = firstNumber(
    metrics?.activeEmployees,
    metrics?.active_employees,
    metrics?.active,
    metrics?.activeCount,
    metrics?.active_count,
    departmentRows.reduce((sum, item) => sum + item.active, 0)
  );

  const exitedEmployees = firstNumber(
    metrics?.exitedEmployees,
    metrics?.exited_employees,
    metrics?.exited,
    metrics?.terminatedEmployees,
    metrics?.terminated_employees,
    metrics?.terminations,
    departmentRows.reduce((sum, item) => sum + item.exited, 0)
  );

  const newHires = firstNumber(
    metrics?.newHires,
    metrics?.new_hires,
    metrics?.newHireCount,
    metrics?.new_hire_count,
    metrics?.hires,
    metrics?.recentHires
  );

  const calculatedAttrition =
    headcount > 0 ? (exitedEmployees / headcount) * 100 : 0;

  const attrition = firstNumber(
    metrics?.attrition,
    metrics?.attritionRate,
    metrics?.attrition_rate,
    calculatedAttrition
  );

  const attendanceRate = firstNumber(
    metrics?.attendanceRate,
    metrics?.attendance_rate,
    metrics?.attendance,
    metrics?.attendancePercentage,
    metrics?.attendance_percentage
  );

  const departmentCount =
    departmentRows.length ||
    firstNumber(
      metrics?.departmentCount,
      metrics?.department_count,
      metrics?.numberOfDepartments,
      metrics?.number_of_departments
    );

  return {
    headcount,
    activeEmployees,
    exitedEmployees,
    newHires,
    attrition,
    attendanceRate,
    departmentCount,
    departmentRows,
    raw: metrics,
  };
};

function MetricCard({ title, value, description, icon: Icon, trend }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
          <Icon size={19} className="text-slate-700" />
        </div>

        {trend !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            {trend >= 0 ? (
              <TrendingUp size={13} />
            ) : (
              <TrendingDown size={13} />
            )}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

export default function WorkforceMetrics() {
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("headcount");

  const loadMetrics = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      const response = await api.get("/workforce-metrics");

      const payload = response?.data ?? {};
      setMetrics(payload?.metrics ?? payload);
    } catch (err) {
      console.error("[WorkforceMetrics] Failed to load:", err);

      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (status === 401
          ? "Your session has expired. Please sign in again."
          : "Failed to load workforce metrics.");

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const normalized = useMemo(
    () => normalizeMetrics(metrics),
    [metrics]
  );

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...normalized.departmentRows]
      .filter((row) =>
        query ? row.name.toLowerCase().includes(query) : true
      )
      .sort((a, b) => {
        if (sortBy === "active") return b.active - a.active;
        if (sortBy === "attrition") return b.attrition - a.attrition;
        return b.headcount - a.headcount;
      });
  }, [normalized.departmentRows, search, sortBy]);

  const activePercentage =
    normalized.headcount > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (normalized.activeEmployees / normalized.headcount) * 100
          )
        )
      : 0;

  const maxDepartmentHeadcount = Math.max(
    1,
    ...normalized.departmentRows.map((row) => row.headcount)
  );

  const cards = [
    {
      title: "Total Headcount",
      value: normalized.headcount,
      icon: Users,
      description: "Employees in your organization",
    },
    {
      title: "Active Employees",
      value: normalized.activeEmployees,
      icon: UserPlus,
      description: "Currently active employees",
    },
    {
      title: "New Hires",
      value: normalized.newHires,
      icon: TrendingUp,
      description: "Recent employee additions",
    },
    {
      title: "Attrition Rate",
      value: `${normalized.attrition.toFixed(1)}%`,
      icon: UserMinus,
      description: "Calculated from workforce exits",
    },
  ];

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                <Users size={20} className="text-slate-700" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Workforce Metrics
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                  Workforce Metrics Dashboard
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  A live view of your organization's workforce.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadMetrics(true)}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-600"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-800">
                Unable to load workforce metrics
              </p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => loadMetrics()}
                className="mt-3 text-sm font-semibold text-red-800 underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-100" />
                  <div className="mt-5 h-4 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="mt-2 h-9 w-20 animate-pulse rounded bg-slate-100" />
                  <div className="mt-3 h-3 w-40 animate-pulse rounded bg-slate-100" />
                </div>
              ))
            : cards.map((card) => (
                <MetricCard key={card.title} {...card} />
              ))}
        </div>

        {/* WORKFORCE OVERVIEW */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Workforce Overview
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current workforce utilization and structure.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50">
                <Building2 size={19} className="text-slate-600" />
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    Active workforce
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {normalized.activeEmployees}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-all duration-500"
                    style={{ width: `${activePercentage}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {activePercentage.toFixed(1)}% of headcount
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">Attrition</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {normalized.attrition.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, normalized.attrition)
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {normalized.exitedEmployees} workforce exits
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-slate-600">
                    Attendance
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {normalized.attendanceRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-800 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, normalized.attendanceRate)
                      )}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Based on available attendance records
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Organization Snapshot
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current workforce structure.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Departments
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {normalized.departmentCount}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Active
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {normalized.activeEmployees}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  New Hires
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {normalized.newHires}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Exits
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {normalized.exitedEmployees}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DEPARTMENT BREAKDOWN */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Department Breakdown
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Workforce distribution across departments.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search department..."
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                />

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  <option value="headcount">Sort: Headcount</option>
                  <option value="active">Sort: Active</option>
                  <option value="attrition">Sort: Attrition</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : filteredDepartments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Headcount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Active
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Exited
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Attrition
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Distribution
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredDepartments.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {row.name}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-700">
                        {row.headcount}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-700">
                        {row.active}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-700">
                        {row.exited}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                        {row.attrition.toFixed(1)}%
                      </td>
                      <td className="min-w-[180px] px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-slate-700 transition-all duration-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (row.headcount / maxDepartmentHeadcount) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-xs text-slate-500">
                            {normalized.headcount > 0
                              ? `${(
                                  (row.headcount / normalized.headcount) *
                                  100
                                ).toFixed(0)}%`
                              : "0%"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center">
              <Building2
                size={32}
                className="mx-auto text-slate-400"
              />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                No department data available
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                The workforce API returned no department breakdown.
              </p>
            </div>
          )}
        </div>

        {/* EMPTY STATE */}
        {!loading &&
          !error &&
          normalized.headcount === 0 &&
          normalized.departmentRows.length === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Users size={34} className="mx-auto text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">
                No workforce data available
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add employees to your organization to populate workforce
                metrics.
              </p>
            </div>
          )}
      </div>
    </div>
  );
}