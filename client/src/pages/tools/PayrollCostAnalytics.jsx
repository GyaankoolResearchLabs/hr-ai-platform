import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  MapPin,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  BriefcaseBusiness,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";

/* =========================================================
   HELPERS
========================================================= */

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(numberValue(value));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN").format(
    numberValue(value),
  );
}

function formatPercentage(value) {
  return `${numberValue(value).toFixed(1)}%`;
}

function formatMonth(value) {
  if (!value) {
    return "—";
  }

  const raw = String(value);
  const month = raw.length >= 7 ? raw.slice(0, 7) : raw;

  const date = new Date(`${month}-01T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getResponseData(response, fallback = []) {
  if (Array.isArray(response?.data)) {
    return response.data;
  }

  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data?.data)) {
    return response.data.data;
  }

  return fallback;
}

function getResponseObject(response) {
  if (response?.data?.summary) {
    return response.data;
  }

  if (response?.summary) {
    return response;
  }

  return response?.data || response || {};
}

/* =========================================================
   LOADING STATE
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-ink-200 bg-white">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2
          size={28}
          className="animate-spin text-ink-500"
        />

        <div>
          <p className="text-sm font-semibold text-ink-800">
            Loading payroll analytics
          </p>

          <p className="mt-1 text-xs text-ink-500">
            Fetching real payroll data...
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  title = "No payroll data available",
  description = "There is no payroll data matching the current filters.",
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <BarChart3 size={22} />
      </div>

      <h3 className="text-sm font-bold text-ink-900">
        {title}
      </h3>

      <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   ERROR STATE
========================================================= */

function ErrorState({
  message,
  onRetry,
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
      <div className="flex gap-3">
        <AlertCircle
          size={19}
          className="mt-0.5 shrink-0 text-red-600"
        />

        <div className="min-w-0">
          <p className="text-sm font-semibold text-red-900">
            Could not load payroll analytics
          </p>

          <p className="mt-1 text-xs leading-5 text-red-700">
            {message ||
              "Something went wrong while loading the analytics."}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  icon,
  label,
  value,
  description,
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          {icon}
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>

      <p className="mt-1 truncate text-xl font-bold text-ink-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   FILTER SELECT
========================================================= */

function FilterSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  disabled = false,
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-semibold text-ink-600">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          disabled={disabled}
          className="w-full appearance-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-900 outline-none transition focus:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50"
        >
          <option value="">
            {placeholder}
          </option>

          {options.map((option) => {
            const optionValue =
              typeof option === "object"
                ? option.value
                : option;

            const optionLabel =
              typeof option === "object"
                ? option.label
                : option;

            return (
              <option
                key={String(optionValue)}
                value={optionValue}
              >
                {optionLabel}
              </option>
            );
          })}
        </select>

        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
        />
      </div>
    </div>
  );
}

/* =========================================================
   BREAKDOWN TABLE
========================================================= */

function BreakdownTable({
  title,
  subtitle,
  icon,
  rows,
  valueLabel,
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
            {icon}
          </div>

          <div className="min-w-0">
            <h2 className="text-sm font-bold text-ink-950">
              {title}
            </h2>

            <p className="mt-0.5 text-xs text-ink-500">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={`No ${valueLabel.toLowerCase()} data`}
          description="There are no payroll records matching the selected filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-25">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  {valueLabel}
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employees
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Gross
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Deductions
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Net
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employer Cost
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Share
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${valueLabel}-${row.dimension_value}`}
                  className="border-b border-ink-100 last:border-0 hover:bg-ink-25"
                >
                  <td className="px-4 py-3">
                    <p className="max-w-[240px] truncate text-sm font-semibold text-ink-900">
                      {row.dimension_value}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-700">
                    {formatNumber(
                      row.employee_count,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-medium text-ink-800">
                    {formatCurrency(
                      row.gross_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-700">
                    {formatCurrency(
                      row.total_deductions,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-medium text-ink-800">
                    {formatCurrency(
                      row.net_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-bold text-ink-950">
                    {formatCurrency(
                      row.total_cost,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-semibold text-ink-700">
                    {formatPercentage(
                      row.cost_percentage,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   TREND TABLE
========================================================= */

function TrendSection({
  rows,
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-ink-100 p-4 sm:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          <TrendingUp size={18} />
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink-950">
            Payroll Cost Trend
          </h2>

          <p className="mt-0.5 text-xs text-ink-500">
            Monthly payroll cost based on actual payroll runs.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No trend data"
          description="Create or process payroll runs to see the monthly cost trend."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-25">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Month
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employees
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Gross
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Deductions
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Net
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employer Cost
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.month}
                  className="border-b border-ink-100 last:border-0 hover:bg-ink-25"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-ink-900">
                      {row.label ||
                        formatMonth(
                          row.payroll_month,
                        )}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-700">
                    {formatNumber(
                      row.employee_count,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-800">
                    {formatCurrency(
                      row.gross_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-700">
                    {formatCurrency(
                      row.total_deductions,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-800">
                    {formatCurrency(
                      row.net_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-bold text-ink-950">
                    {formatCurrency(
                      row.total_cost,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   EMPLOYEE TABLE
========================================================= */

function EmployeeCostTable({
  rows,
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-ink-100 p-4 sm:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          <Users size={18} />
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink-950">
            Employee Payroll Cost
          </h2>

          <p className="mt-0.5 text-xs text-ink-500">
            Employee-level payroll cost from the selected payroll data.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No employee payroll records"
          description="There are no employee payroll records matching the selected filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-25">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employee
                </th>

                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Department
                </th>

                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Location
                </th>

                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Role
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Gross
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Deductions
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Net
                </th>

                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  Employer Cost
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.payroll_run_id}-${row.employee_id}`}
                  className="border-b border-ink-100 last:border-0 hover:bg-ink-25"
                >
                  <td className="px-4 py-3">
                    <div className="min-w-0">
                      <p className="max-w-[220px] truncate text-sm font-semibold text-ink-900">
                        {row.employee_name}
                      </p>

                      <p className="mt-0.5 text-xs text-ink-500">
                        {row.employee_code || "No employee code"}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm text-ink-700">
                    {row.department}
                  </td>

                  <td className="px-4 py-3 text-sm text-ink-700">
                    {row.location}
                  </td>

                  <td className="px-4 py-3 text-sm text-ink-700">
                    {row.role}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-800">
                    {formatCurrency(
                      row.gross_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm text-ink-700">
                    {formatCurrency(
                      row.total_deductions,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-medium text-ink-800">
                    {formatCurrency(
                      row.net_pay,
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-bold text-ink-950">
                    {formatCurrency(
                      row.total_cost,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function PayrollCostAnalytics() {
  const navigate = useNavigate();

  const [analytics, setAnalytics] =
    useState(null);

  const [filters, setFilters] =
    useState({
      months: [],
      statuses: [],
      departments: [],
      locations: [],
      roles: [],
    });

  const [selectedMonth, setSelectedMonth] =
    useState("");

  const [selectedStatus, setSelectedStatus] =
    useState("");

  const [selectedDepartment, setSelectedDepartment] =
    useState("");

  const [selectedLocation, setSelectedLocation] =
    useState("");

  const [selectedRole, setSelectedRole] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [filtersLoading, setFiltersLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  /* =======================================================
     LOAD FILTERS
  ======================================================= */

  const loadFilters = useCallback(
    async () => {
      try {
        setFiltersLoading(true);

        const response =
          await api.get(
            "/payroll-cost-analytics/filters",
          );

        const data =
          getResponseObject(
            response,
          );

        setFilters({
          months:
            Array.isArray(
              data.months,
            )
              ? data.months
              : [],

          statuses:
            Array.isArray(
              data.statuses,
            )
              ? data.statuses
              : [],

          departments:
            Array.isArray(
              data.departments,
            )
              ? data.departments
              : [],

          locations:
            Array.isArray(
              data.locations,
            )
              ? data.locations
              : [],

          roles:
            Array.isArray(
              data.roles,
            )
              ? data.roles
              : [],
        });
      } catch (loadError) {
        console.error(
          "Payroll analytics filters error:",
          loadError,
        );
      } finally {
        setFiltersLoading(false);
      }
    },
    [],
  );

  /* =======================================================
     LOAD ANALYTICS
  ======================================================= */

  const loadAnalytics =
    useCallback(
      async (
        showRefreshState = false,
      ) => {
        try {
          if (showRefreshState) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError("");

          const params =
            new URLSearchParams();

          if (selectedMonth) {
            params.set(
              "payrollMonth",
              selectedMonth,
            );
          }

          if (selectedStatus) {
            params.set(
              "status",
              selectedStatus,
            );
          }

          if (selectedDepartment) {
            params.set(
              "department",
              selectedDepartment,
            );
          }

          if (selectedLocation) {
            params.set(
              "location",
              selectedLocation,
            );
          }

          if (selectedRole) {
            params.set(
              "role",
              selectedRole,
            );
          }

          const query =
            params.toString();

          const endpoint =
            query
              ? `/payroll-cost-analytics?${query}`
              : "/payroll-cost-analytics";

          const response =
            await api.get(endpoint);

          const data =
            getResponseObject(
              response,
            );

          setAnalytics(data);
        } catch (loadError) {
          console.error(
            "Payroll analytics error:",
            loadError,
          );

          setError(
            loadError?.response?.data
              ?.message ||
              loadError?.message ||
              "Could not load payroll cost analytics.",
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        selectedMonth,
        selectedStatus,
        selectedDepartment,
        selectedLocation,
        selectedRole,
      ],
    );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */

  const summary =
    analytics?.summary || {};

  const departmentRows =
    analytics?.breakdowns
      ?.department || [];

  const locationRows =
    analytics?.breakdowns
      ?.location || [];

  const roleRows =
    analytics?.breakdowns?.role ||
    [];

  const employeeRows =
    analytics?.employees || [];

  /*
   * The backend dashboard endpoint does not include
   * the monthly trend because the trend has its own
   * endpoint. Load it separately for the page.
   */

  const [trend, setTrend] =
    useState([]);

  const [trendLoading, setTrendLoading] =
    useState(false);

  const loadTrend =
    useCallback(async () => {
      try {
        setTrendLoading(true);

        const params =
          new URLSearchParams();

        if (selectedMonth) {
          params.set(
            "startMonth",
            selectedMonth,
          );

          params.set(
            "endMonth",
            selectedMonth,
          );
        }

        if (selectedStatus) {
          params.set(
            "status",
            selectedStatus,
          );
        }

        const query =
          params.toString();

        const endpoint =
          query
            ? `/payroll-cost-analytics/trend?${query}`
            : "/payroll-cost-analytics/trend";

        const response =
          await api.get(endpoint);

        setTrend(
          getResponseData(
            response,
          ),
        );
      } catch (trendError) {
        console.error(
          "Payroll cost trend error:",
          trendError,
        );

        setTrend([]);
      } finally {
        setTrendLoading(false);
      }
    }, [
      selectedMonth,
      selectedStatus,
    ]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  /* =======================================================
     FILTER RESET
  ======================================================= */

  const hasActiveFilters =
    Boolean(
      selectedMonth ||
        selectedStatus ||
        selectedDepartment ||
        selectedLocation ||
        selectedRole,
    );

  const clearFilters = () => {
    setSelectedMonth("");
    setSelectedStatus("");
    setSelectedDepartment("");
    setSelectedLocation("");
    setSelectedRole("");
  };

  /* =======================================================
     EXPORT CSV
  ======================================================= */

  const exportEmployeeCsv =
    () => {
      if (!employeeRows.length) {
        return;
      }

      const headers = [
        "Employee",
        "Employee Code",
        "Department",
        "Location",
        "Role",
        "Payroll Month",
        "Gross Pay",
        "Deductions",
        "Reimbursements",
        "Net Pay",
        "Employer Contributions",
        "Total Cost",
      ];

      const escapeCsv = (
        value,
      ) => {
        const stringValue =
          String(
            value ?? "",
          );

        return `"${stringValue.replace(
          /"/g,
          '""',
        )}"`;
      };

      const rows =
        employeeRows.map(
          (row) => [
            row.employee_name,
            row.employee_code,
            row.department,
            row.location,
            row.role,
            formatMonth(
              row.payroll_month,
            ),
            row.gross_pay,
            row.total_deductions,
            row.reimbursements,
            row.net_pay,
            row.employer_contributions,
            row.total_cost,
          ],
        );

      const csv = [
        headers,
        ...rows,
      ]
        .map((row) =>
          row
            .map(escapeCsv)
            .join(","),
        )
        .join("\n");

      const blob =
        new Blob(
          [csv],
          {
            type: "text/csv;charset=utf-8;",
          },
        );

      const url =
        URL.createObjectURL(
          blob,
        );

      const link =
        document.createElement(
          "a",
        );

      link.href = url;

      link.download =
        "payroll-cost-analytics.csv";

      document.body.appendChild(
        link,
      );

      link.click();

      document.body.removeChild(
        link,
      );

      URL.revokeObjectURL(
        url,
      );
    };

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh =
    async () => {
      await Promise.all([
        loadFilters(),
        loadAnalytics(true),
        loadTrend(),
      ]);
    };

  /* =======================================================
     FILTER OPTION LABELS
  ======================================================= */

  const monthOptions =
    useMemo(
      () =>
        filters.months.map(
          (month) => ({
            value: month,
            label: formatMonth(
              month,
            ),
          }),
        ),
      [filters.months],
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-w-0 overflow-x-hidden pb-10">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() =>
              navigate(
                "/app/dashboard",
              )
            }
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-950 text-white">
              <BarChart3 size={21} />
            </div>

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-ink-950 sm:text-2xl">
                  Payroll Cost Analytics
                </h1>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Live Data
                </span>
              </div>

              <p className="max-w-2xl text-sm leading-6 text-ink-500">
                Real-time visibility into payroll costs by department,
                location, role, and employee.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={
              exportEmployeeCsv
            }
            disabled={
              employeeRows.length ===
              0
            }
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={15} />
            Export CSV
          </button>

          <button
            type="button"
            onClick={
              handleRefresh
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="mb-5 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays
                size={16}
                className="text-ink-500"
              />

              <h2 className="text-sm font-bold text-ink-900">
                Analytics Filters
              </h2>
            </div>

            <p className="mt-1 text-xs text-ink-500">
              Filter the analytics using actual payroll records.
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={
                clearFilters
              }
              className="self-start rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-100"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FilterSelect
            label="Payroll Month"
            value={
              selectedMonth
            }
            onChange={
              setSelectedMonth
            }
            options={
              monthOptions
            }
            placeholder={
              filtersLoading
                ? "Loading months..."
                : "All months"
            }
            disabled={
              filtersLoading
            }
          />

          <FilterSelect
            label="Payroll Status"
            value={
              selectedStatus
            }
            onChange={
              setSelectedStatus
            }
            options={
              filters.statuses
            }
            placeholder="All statuses"
            disabled={
              filtersLoading
            }
          />

          <FilterSelect
            label="Department"
            value={
              selectedDepartment
            }
            onChange={
              setSelectedDepartment
            }
            options={
              filters.departments
            }
            placeholder="All departments"
            disabled={
              filtersLoading
            }
          />

          <FilterSelect
            label="Location"
            value={
              selectedLocation
            }
            onChange={
              setSelectedLocation
            }
            options={
              filters.locations
            }
            placeholder="All locations"
            disabled={
              filtersLoading
            }
          />

          <FilterSelect
            label="Role"
            value={
              selectedRole
            }
            onChange={
              setSelectedRole
            }
            options={
              filters.roles
            }
            placeholder="All roles"
            disabled={
              filtersLoading
            }
          />
        </div>
      </section>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5">
          <ErrorState
            message={error}
            onRetry={() =>
              loadAnalytics(
                true,
              )
            }
          />
        </div>
      )}

      {/* =====================================================
          CONTENT
      ===================================================== */}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {/* =================================================
              METRICS
          ================================================= */}

          <section className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={
                <CircleDollarSign
                  size={18}
                />
              }
              label="Total Payroll Cost"
              value={formatCurrency(
                summary.total_cost,
              )}
              description="Gross payroll plus employer contributions"
            />

            <MetricCard
              icon={
                <TrendingUp
                  size={18}
                />
              }
              label="Gross Payroll"
              value={formatCurrency(
                summary.gross_pay,
              )}
              description="Total employee gross pay"
            />

            <MetricCard
              icon={
                <ShieldCheck
                  size={18}
                />
              }
              label="Net Payroll"
              value={formatCurrency(
                summary.net_pay,
              )}
              description="Amount payable after deductions"
            />

            <MetricCard
              icon={
                <Users size={18} />
              }
              label="Employees"
              value={formatNumber(
                summary.employee_count,
              )}
              description="Employees included in the analysis"
            />
          </section>

          {/* =================================================
              SECONDARY METRICS
          ================================================= */}

          <section className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={
                <CircleDollarSign
                  size={18}
                />
              }
              label="Total Deductions"
              value={formatCurrency(
                summary.total_deductions,
              )}
              description={`${formatPercentage(
                summary.deduction_rate,
              )} of gross payroll`}
            />

            <MetricCard
              icon={
                <CircleDollarSign
                  size={18}
                />
              }
              label="Reimbursements"
              value={formatCurrency(
                summary.total_reimbursements,
              )}
              description={`${formatPercentage(
                summary.reimbursement_rate,
              )} of gross payroll`}
            />

            <MetricCard
              icon={
                <ShieldCheck
                  size={18}
                />
              }
              label="Employer Contributions"
              value={formatCurrency(
                summary.employer_contributions,
              )}
              description={`${formatPercentage(
                summary.employer_contribution_rate,
              )} of gross payroll`}
            />

            <MetricCard
              icon={
                <CircleDollarSign
                  size={18}
                />
              }
              label="Average Employee Cost"
              value={formatCurrency(
                summary.average_cost_per_employee,
              )}
              description="Average total employer cost"
            />
          </section>

          {/* =================================================
              BREAKDOWNS
          ================================================= */}

          <div className="mb-5 grid min-w-0 gap-5 xl:grid-cols-2">
            <BreakdownTable
              title="Department Cost"
              subtitle="Payroll cost distributed across departments."
              icon={
                <Building2
                  size={18}
                />
              }
              rows={
                departmentRows
              }
              valueLabel="Department"
            />

            <BreakdownTable
              title="Location Cost"
              subtitle="Payroll cost distributed across locations."
              icon={
                <MapPin size={18} />
              }
              rows={
                locationRows
              }
              valueLabel="Location"
            />
          </div>

          <div className="mb-5">
            <BreakdownTable
              title="Role Cost"
              subtitle="Payroll cost distributed across employee roles."
              icon={
                <BriefcaseBusiness
                  size={18}
                />
              }
              rows={roleRows}
              valueLabel="Role"
            />
          </div>

          {/* =================================================
              TREND
          ================================================= */}

          <div className="mb-5">
            {trendLoading ? (
              <section className="flex min-h-[220px] items-center justify-center rounded-2xl border border-ink-200 bg-white">
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Loading payroll trend...
                </div>
              </section>
            ) : (
              <TrendSection
                rows={trend}
              />
            )}
          </div>

          {/* =================================================
              EMPLOYEE DETAILS
          ================================================= */}

          <EmployeeCostTable
            rows={employeeRows}
          />

          {/* =================================================
              DATA SOURCE NOTE
          ================================================= */}

          <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 sm:p-5">
            <div className="flex gap-3">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-blue-600"
              />

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-blue-900">
                  Payroll data source
                </h3>

                <p className="mt-1 max-w-4xl text-xs leading-5 text-blue-700">
                  These analytics are calculated from the organization&apos;s
                  actual payroll runs and payroll run items. No payroll
                  values are hardcoded in the frontend.
                </p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}