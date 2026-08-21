import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  UserMinus,
  Target,
  BriefcaseBusiness,
  RefreshCw,
  Search,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

export default function AttritionDemandForecasting() {
  const navigate = useNavigate();

  const [forecast, setForecast] = useState(null);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadForecast = async (
    selectedMonths = months,
    isRefresh = false,
  ) => {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(
        `/attrition-forecasting?months=${selectedMonths}`,
      );

      if (!response?.data) {
        throw new Error("Forecast response was empty.");
      }

      setForecast(response.data);
    } catch (err) {
      console.error(
        "[AttritionForecasting] Load failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load attrition forecast.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadForecast(months);
  }, [months]);

  /*
   * ---------------------------------------------------------
   * REAL BACKEND DATA
   * ---------------------------------------------------------
   */

  const summary = forecast?.summary || {};

  const monthlyAttrition = Array.isArray(
    forecast?.monthlyAttrition,
  )
    ? forecast.monthlyAttrition
    : [];

  const departments = Array.isArray(
    forecast?.departments,
  )
    ? forecast.departments
    : [];

  const hiringDemand = Array.isArray(
    forecast?.hiringDemand,
  )
    ? forecast.hiringDemand
    : [];

  const attritionEmployees = Array.isArray(
    forecast?.attritionEmployees,
  )
    ? forecast.attritionEmployees
    : [];

  /*
   * ---------------------------------------------------------
   * DYNAMIC CALCULATIONS
   * ---------------------------------------------------------
   */

  const calculatedHistoricalExits = useMemo(() => {
    if (monthlyAttrition.length === 0) return 0;

    return monthlyAttrition.reduce(
      (total, month) =>
        total + Number(month?.exits || 0),
      0,
    );
  }, [monthlyAttrition]);

  const calculatedProjectedExits = useMemo(() => {
    if (hiringDemand.length === 0) return 0;

    return hiringDemand.reduce(
      (total, department) =>
        total + Number(department?.projectedExits || 0),
      0,
    );
  }, [hiringDemand]);

  const calculatedHiringNeed = useMemo(() => {
    if (hiringDemand.length === 0) return 0;

    return hiringDemand.reduce(
      (total, department) =>
        total + Number(department?.recommendedHiring || 0),
      0,
    );
  }, [hiringDemand]);

  const totalEmployees =
    Number(summary.totalEmployees) ||
    departments.reduce(
      (total, department) =>
        total +
        Number(department?.currentHeadcount || 0),
      0,
    );

  const activeEmployees =
    Number(summary.activeEmployees) ||
    totalEmployees;

  const historicalExits =
    Number(summary.historicalExits) ||
    calculatedHistoricalExits;

  const projectedExits =
    Number(summary.projectedExits) ||
    calculatedProjectedExits;

  const projectedHiringNeed =
    Number(summary.projectedHiringNeed) ||
    calculatedHiringNeed;

  const annualizedAttritionRate =
    summary.annualizedAttritionRate ??
    (totalEmployees > 0
      ? (
          (historicalExits / totalEmployees) *
          100
        ).toFixed(1)
      : 0);

  const averageMonthlyExits =
    summary.averageMonthlyExits ??
    (monthlyAttrition.length > 0
      ? (
          calculatedHistoricalExits /
          monthlyAttrition.length
        ).toFixed(1)
      : 0);

  /*
   * ---------------------------------------------------------
   * TREND
   * ---------------------------------------------------------
   */

  const calculatedTrend = useMemo(() => {
    if (monthlyAttrition.length < 2) {
      return "stable";
    }

    const midpoint = Math.floor(
      monthlyAttrition.length / 2,
    );

    const firstHalf = monthlyAttrition.slice(
      0,
      midpoint,
    );

    const secondHalf = monthlyAttrition.slice(
      midpoint,
    );

    const firstAverage =
      firstHalf.reduce(
        (total, item) =>
          total + Number(item?.exits || 0),
        0,
      ) / (firstHalf.length || 1);

    const secondAverage =
      secondHalf.reduce(
        (total, item) =>
          total + Number(item?.exits || 0),
        0,
      ) / (secondHalf.length || 1);

    if (secondAverage > firstAverage) {
      return "increasing";
    }

    if (secondAverage < firstAverage) {
      return "decreasing";
    }

    return "stable";
  }, [monthlyAttrition]);

  const trend =
    summary.trend || calculatedTrend;

  const TrendIcon =
    trend === "increasing"
      ? TrendingUp
      : trend === "decreasing"
        ? TrendingDown
        : Minus;

  const trendLabel =
    trend === "increasing"
      ? "Increasing"
      : trend === "decreasing"
        ? "Decreasing"
        : "Stable";

  /*
   * ---------------------------------------------------------
   * SEARCH
   * ---------------------------------------------------------
   */

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return attritionEmployees;
    }

    return attritionEmployees.filter(
      (employee) =>
        [
          employee?.full_name,
          employee?.email,
          employee?.department,
          employee?.title,
          employee?.employment_status,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query),
          ),
    );
  }, [attritionEmployees, search]);

  /*
   * ---------------------------------------------------------
   * FORECAST PERIOD
   * ---------------------------------------------------------
   */

  const forecastPeriod =
    forecast?.forecastPeriod || {};

  const historicalPeriod =
    forecast?.historicalPeriod || {};

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 animate-pulse rounded-lg bg-ink-100" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-xl bg-ink-50"
            />
          ))}
        </div>

        <div className="h-80 animate-pulse rounded-xl bg-ink-50" />

        <div className="h-64 animate-pulse rounded-xl bg-ink-50" />
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
   */

  if (error) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadForecast(months, true)
            }
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * CHART DATA
   * ---------------------------------------------------------
   */

  const maxExits = Math.max(
    ...monthlyAttrition.map(
      (item) => Number(item?.exits || 0),
    ),
    1,
  );

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="space-y-7">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <TrendingUp
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                Attrition & Demand Forecasting
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Identify attrition trends and forecast
                upcoming hiring needs.
              </p>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-400">
                {historicalPeriod.start && (
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Historical:{" "}
                    {formatDate(
                      historicalPeriod.start,
                    )}{" "}
                    –{" "}
                    {formatDate(
                      historicalPeriod.end,
                    )}
                  </span>
                )}

                {forecastPeriod.start && (
                  <span className="inline-flex items-center gap-1">
                    <Target className="h-3.5 w-3.5" />
                    Forecast:{" "}
                    {formatDate(
                      forecastPeriod.start,
                    )}{" "}
                    –{" "}
                    {formatDate(
                      forecastPeriod.end,
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={months}
            onChange={(event) =>
              setMonths(
                Number(event.target.value),
              )
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
          >
            <option value={3}>
              Next 3 months
            </option>

            <option value={6}>
              Next 6 months
            </option>

            <option value={12}>
              Next 12 months
            </option>
          </select>

          <button
            type="button"
            onClick={() =>
              loadForecast(months, true)
            }
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total employees"
          value={totalEmployees}
        />

        <MetricCard
          icon={UserMinus}
          label="Historical exits"
          value={historicalExits}
          subtitle={
            historicalPeriod.start
              ? `${formatDate(
                  historicalPeriod.start,
                )} – ${formatDate(
                  historicalPeriod.end,
                )}`
              : "Historical period"
          }
        />

        <MetricCard
          icon={TrendingUp}
          label="Attrition rate"
          value={`${annualizedAttritionRate}%`}
          subtitle="Historical"
        />

        <MetricCard
          icon={Target}
          label="Projected hiring need"
          value={projectedHiringNeed}
          subtitle={`Next ${months} months`}
        />
      </div>

      {/* TREND + MONTHLY ATTRITION */}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Attrition trend
              </p>

              <p className="mt-2 text-2xl font-semibold text-ink-950">
                {trendLabel}
              </p>
            </div>

            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <TrendIcon className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-500">
                Average monthly exits
              </span>

              <span className="font-medium text-ink-900">
                {averageMonthlyExits}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ink-500">
                Projected exits
              </span>

              <span className="font-medium text-ink-900">
                {projectedExits}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ink-500">
                Active employees
              </span>

              <span className="font-medium text-ink-900">
                {activeEmployees}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-ink-500">
                Departments
              </span>

              <span className="font-medium text-ink-900">
                {departments.length}
              </span>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Monthly attrition
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Actual employee exits from the historical
              analysis period.
            </p>
          </div>

          {monthlyAttrition.length === 0 ? (
            <div className="mt-6 flex h-48 items-center justify-center text-sm text-ink-400">
              No historical attrition data available.
            </div>
          ) : (
            <div className="mt-6 flex h-48 items-end gap-2 overflow-x-auto">
              {monthlyAttrition.map(
                (month, index) => {
                  const exits = Number(
                    month?.exits || 0,
                  );

                  const height =
                    exits === 0
                      ? 4
                      : Math.max(
                          12,
                          (exits / maxExits) *
                            150,
                        );

                  return (
                    <div
                      key={
                        month?.month ||
                        `month-${index}`
                      }
                      className="flex min-w-[45px] flex-1 flex-col items-center justify-end gap-2"
                    >
                      <span className="text-xs font-medium text-ink-700">
                        {exits}
                      </span>

                      <div
                        className="w-full max-w-10 rounded-t-md bg-brand-500"
                        style={{
                          height: `${height}px`,
                        }}
                        title={`${formatMonth(
                          month?.month,
                        )}: ${exits} exits`}
                      />

                      <span className="text-[10px] text-ink-400">
                        {formatMonth(
                          month?.month,
                        )}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      </div>

      {/* HIRING DEMAND */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-semibold text-ink-900">
            Hiring demand by department
          </h2>

          <p className="mt-1 text-sm text-ink-500">
            Departments with the highest projected
            replacement demand.
          </p>
        </div>

        {hiringDemand.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-ink-400">
            No hiring demand data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left">
                  <th className="px-5 py-3 font-medium text-ink-500">
                    Department
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Current
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Historical exits
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Attrition
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Projected exits
                  </th>

                  <th className="px-5 py-3 font-medium text-ink-500">
                    Hiring need
                  </th>
                </tr>
              </thead>

              <tbody>
                {hiringDemand.map(
                  (department, index) => (
                    <tr
                      key={
                        department?.department ||
                        `department-${index}`
                      }
                      className="border-b border-ink-100 last:border-0"
                    >
                      <td className="px-5 py-4 font-medium text-ink-900">
                        {department?.department ||
                          "Unassigned"}
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {Number(
                          department?.currentHeadcount ||
                            0,
                        )}
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {Number(
                          department?.historicalExits ||
                            0,
                        )}
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {Number(
                          department?.attritionRate ||
                            0,
                        )}
                        %
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {Number(
                          department?.projectedExits ||
                            0,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          <BriefcaseBusiness className="h-3.5 w-3.5" />

                          {Number(
                            department?.recommendedHiring ||
                              0,
                          )}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECENT ATTRITION */}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Recent attrition
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Employees who exited during the historical
              analysis period.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search employees..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50 text-left">
                <th className="px-5 py-3 font-medium text-ink-500">
                  Employee
                </th>

                <th className="px-5 py-3 font-medium text-ink-500">
                  Department
                </th>

                <th className="px-5 py-3 font-medium text-ink-500">
                  Title
                </th>

                <th className="px-5 py-3 font-medium text-ink-500">
                  Status
                </th>

                <th className="px-5 py-3 font-medium text-ink-500">
                  Last working date
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-ink-400"
                  >
                    No attrition records found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map(
                  (employee, index) => (
                    <tr
                      key={
                        employee?.id ||
                        `employee-${index}`
                      }
                      className="border-b border-ink-100 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-medium text-ink-900">
                            {employee?.full_name ||
                              "Unnamed employee"}
                          </p>

                          <p className="mt-0.5 text-xs text-ink-400">
                            {employee?.email || "—"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {employee?.department ||
                          "Unassigned"}
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {employee?.title || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">
                          {employee?.employment_status ||
                            "Unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-ink-700">
                        {formatDate(
                          employee?.last_working_date,
                        )}
                      </td>
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * METRIC CARD
 * ---------------------------------------------------------
 */

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {value}
          </p>

          {subtitle && (
            <p className="mt-1 text-xs text-ink-400">
              {subtitle}
            </p>
          )}
        </div>

        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-50 text-ink-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

/*
 * ---------------------------------------------------------
 * DATE HELPERS
 * ---------------------------------------------------------
 */

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function formatMonth(value) {
  if (!value) return "—";

  const date = new Date(`${value}-01`);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(5);
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
    },
  );
}