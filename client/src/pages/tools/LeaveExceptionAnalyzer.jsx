import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  FileWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  TriangleAlert,
  Users,
  X,
  WalletCards,
  ExternalLink,
  CircleCheck,
  CircleX,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import employeeService from "../../services/employeeService";
import attendanceLeaveService from "../../services/attendanceLeaveService";

/* =========================================================
   CONSTANTS
========================================================= */

const SEVERITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const IGNORED_STATUSES = [
  "Rejected",
  "Cancelled",
  "Canceled",
];

const REVIEWED_STORAGE_KEY =
  "leave_exception_analyzer_reviewed";

/* =========================================================
   HELPERS
========================================================= */

function normalizeId(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function getEmployeeId(employee) {
  return normalizeId(
    employee?.id ||
      employee?.employee_id ||
      employee?.employeeId
  );
}

function getRequestEmployeeId(request) {
  return normalizeId(
    request?.employee_id ||
      request?.employeeId ||
      request?.employee?.id
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    employee?.fullName ||
    "Unknown Employee"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "—"
  );
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function calculateLeaveDays(
  startDate,
  endDate
) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return null;
  }

  const difference =
    end.getTime() -
    start.getTime();

  return (
    Math.floor(
      difference /
        (1000 * 60 * 60 * 24)
    ) + 1
  );
}

function normalizeStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function normalizeLeaveType(type) {
  return String(type || "")
    .trim()
    .toLowerCase();
}

function getBalanceRemaining(balance) {
  if (!balance) {
    return null;
  }

  if (
    balance.remaining !== undefined &&
    balance.remaining !== null
  ) {
    return Number(balance.remaining);
  }

  if (
    balance.remaining_days !==
      undefined &&
    balance.remaining_days !== null
  ) {
    return Number(
      balance.remaining_days
    );
  }

  if (
    balance.available !== undefined &&
    balance.available !== null
  ) {
    return Number(
      balance.available
    );
  }

  if (
    balance.balance !== undefined &&
    balance.balance !== null
  ) {
    return Number(
      balance.balance
    );
  }

  const allocated = Number(
    balance.allocated || 0
  );

  const carriedForward = Number(
    balance.carried_forward || 0
  );

  const used = Number(
    balance.used ||
      balance.used_days ||
      0
  );

  const pending = Number(
    balance.pending ||
      balance.pending_days ||
      0
  );

  return (
    allocated +
    carriedForward -
    used -
    pending
  );
}

function getBalanceEmployeeId(
  balance
) {
  return normalizeId(
    balance?.employee_id ||
      balance?.employeeId ||
      balance?.employee?.id
  );
}

function getBalanceLeaveType(
  balance
) {
  return normalizeLeaveType(
    balance?.leave_type ||
      balance?.leaveType ||
      balance?.type
  );
}

function datesOverlap(
  startA,
  endA,
  startB,
  endB
) {
  const aStart = parseDate(startA);
  const aEnd = parseDate(endA);
  const bStart = parseDate(startB);
  const bEnd = parseDate(endB);

  if (
    !aStart ||
    !aEnd ||
    !bStart ||
    !bEnd
  ) {
    return false;
  }

  return (
    aStart <= bEnd &&
    bStart <= aEnd
  );
}

/* =========================================================
   EXCEPTION DETECTOR
========================================================= */

function detectLeaveExceptions(
  requests,
  employees,
  balances
) {
  const exceptions = [];

  const employeeMap = new Map();

  employees.forEach((employee) => {
    const id = getEmployeeId(employee);

    if (id) {
      employeeMap.set(
        id,
        employee
      );
    }
  });

  const activeRequests =
    requests.filter(
      (request) => {
        const status =
          normalizeStatus(
            request?.status
          );

        return (
          !IGNORED_STATUSES.includes(
            request?.status
          ) &&
          status !== "rejected" &&
          status !== "cancelled" &&
          status !== "canceled"
        );
      }
    );

  requests.forEach(
    (request, requestIndex) => {
      const requestId =
        normalizeId(
          request?.id ||
            request?.request_id ||
            requestIndex
        );

      const employeeId =
        getRequestEmployeeId(
          request
        );

      const employee =
        employeeMap.get(
          employeeId
        );

      const employeeName =
        employee
          ? getEmployeeName(
              employee
            )
          : "Unknown Employee";

      const department =
        employee
          ? getEmployeeDepartment(
              employee
            )
          : "—";

      const leaveType =
        request?.leave_type ||
        request?.leaveType ||
        "Unknown Leave";

      const startDate =
        request?.start_date ||
        request?.startDate;

      const endDate =
        request?.end_date ||
        request?.endDate;

      const status =
        request?.status ||
        "Unknown";

      const leaveDays =
        calculateLeaveDays(
          startDate,
          endDate
        );

      const matchingBalance =
        balances.find(
          (balance) =>
            getBalanceEmployeeId(
              balance
            ) === employeeId &&
            getBalanceLeaveType(
              balance
            ) ===
              normalizeLeaveType(
                leaveType
              )
        );

      const availableBalance =
        matchingBalance
          ? getBalanceRemaining(
              matchingBalance
            )
          : null;

      /* =====================================================
         RULE 1 — UNKNOWN EMPLOYEE
      ===================================================== */

      if (!employee) {
        exceptions.push({
          id: `${requestId}-employee`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.HIGH,
          type: "Employee Record",
          title:
            "Employee record not found",
          details:
            "This leave request is linked to an employee record that could not be found.",
        });
      }

      /* =====================================================
         RULE 2 — INVALID DATE RANGE
      ===================================================== */

      if (
        !startDate ||
        !endDate
      ) {
        exceptions.push({
          id: `${requestId}-missing-date`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.HIGH,
          type: "Invalid Dates",
          title:
            "Leave dates are incomplete",
          details:
            "The leave request does not contain both a valid start date and end date.",
        });
      } else if (
        parseDate(startDate) &&
        parseDate(endDate) &&
        parseDate(endDate) <
          parseDate(startDate)
      ) {
        exceptions.push({
          id: `${requestId}-date-order`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.HIGH,
          type: "Invalid Dates",
          title:
            "End date is before start date",
          details:
            "The leave request contains an invalid date range.",
        });
      }

      /* =====================================================
         RULE 3 — MISSING LEAVE BALANCE
      ===================================================== */

      if (
        employee &&
        leaveDays &&
        !matchingBalance
      ) {
        exceptions.push({
          id: `${requestId}-balance`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance: null,
          severity:
            SEVERITY.MEDIUM,
          type: "Leave Balance",
          title:
            "Leave balance not found",
          details:
            `No ${leaveType} balance is configured for this employee.`,
        });
      }

      /* =====================================================
         RULE 4 — INSUFFICIENT BALANCE
      ===================================================== */

      if (
        matchingBalance &&
        leaveDays !== null &&
        availableBalance !== null &&
        !Number.isNaN(
          availableBalance
        ) &&
        leaveDays >
          availableBalance
      ) {
        exceptions.push({
          id: `${requestId}-insufficient`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          shortfall:
            leaveDays -
            availableBalance,
          severity:
            SEVERITY.HIGH,
          type: "Leave Balance",
          title:
            "Insufficient leave balance",
          details:
            `The request is for ${leaveDays} day${
              leaveDays === 1
                ? ""
                : "s"
            }, but only ${availableBalance} day${
              availableBalance ===
              1
                ? ""
                : "s"
            } remain available.`,
        });
      }

      /* =====================================================
         RULE 5 — OVERLAPPING REQUESTS
      ===================================================== */

      const overlappingRequests =
        activeRequests.filter(
          (otherRequest) => {
            const otherId =
              normalizeId(
                otherRequest?.id ||
                  otherRequest?.request_id
              );

            if (
              otherId ===
              requestId
            ) {
              return false;
            }

            const otherEmployeeId =
              getRequestEmployeeId(
                otherRequest
              );

            if (
              otherEmployeeId !==
              employeeId
            ) {
              return false;
            }

            const otherStart =
              otherRequest?.start_date ||
              otherRequest?.startDate;

            const otherEnd =
              otherRequest?.end_date ||
              otherRequest?.endDate;

            return datesOverlap(
              startDate,
              endDate,
              otherStart,
              otherEnd
            );
          }
        );

      if (
        overlappingRequests.length >
        0
      ) {
        const other =
          overlappingRequests[0];

        const otherType =
          other?.leave_type ||
          other?.leaveType ||
          "leave";

        exceptions.push({
          id: `${requestId}-overlap`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.HIGH,
          type: "Date Conflict",
          title:
            "Overlapping leave request",
          details:
            `This request overlaps another ${otherType} request for the same employee.`,
        });
      }

      /* =====================================================
         RULE 6 — EXTENDED LEAVE
      ===================================================== */

      if (
        leaveDays &&
        leaveDays >= 15
      ) {
        exceptions.push({
          id: `${requestId}-long`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.MEDIUM,
          type: "Extended Leave",
          title:
            "Extended leave duration",
          details:
            `This leave request covers ${leaveDays} consecutive days and may require HR review.`,
        });
      }

      /* =====================================================
         RULE 7 — PENDING REQUEST
      ===================================================== */

      const normalizedStatus =
        normalizeStatus(status);

      if (
        normalizedStatus ===
          "pending" ||
        normalizedStatus ===
          "requested"
      ) {
        exceptions.push({
          id: `${requestId}-pending`,
          requestId,
          employeeId,
          employeeName,
          department,
          leaveType,
          startDate,
          endDate,
          status,
          days: leaveDays,
          availableBalance,
          severity:
            SEVERITY.LOW,
          type: "Pending Review",
          title:
            "Leave request awaiting review",
          details:
            "This leave request has not yet been approved or rejected and requires HR attention.",
        });
      }
    }
  );

  return exceptions;
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LeaveExceptionAnalyzer() {
  const navigate =
    useNavigate();

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    requests,
    setRequests,
  ] = useState([]);

  const [
    balances,
    setBalances,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    severityFilter,
    setSeverityFilter,
  ] = useState("All");

  const [
    selectedException,
    setSelectedException,
  ] = useState(null);

  const [
    reviewedExceptions,
    setReviewedExceptions,
  ] = useState(
    () => {
      try {
        const saved =
          localStorage.getItem(
            REVIEWED_STORAGE_KEY
          );

        return saved
          ? JSON.parse(saved)
          : [];
      } catch {
        return [];
      }
    }
  );

  const [
    actionLoading,
    setActionLoading,
  ] = useState(false);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        employeeData,
        requestData,
        balanceData,
      ] = await Promise.all([
        employeeService.list(),
        attendanceLeaveService.getLeaveRequests(),
        attendanceLeaveService.getLeaveBalances(),
      ]);

      setEmployees(
        Array.isArray(
          employeeData
        )
          ? employeeData
          : []
      );

      setRequests(
        Array.isArray(
          requestData
        )
          ? requestData
          : []
      );

      setBalances(
        Array.isArray(
          balanceData
        )
          ? balanceData
          : []
      );
    } catch (err) {
      console.error(
        "Leave exception analyzer error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to load leave data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     DETECT EXCEPTIONS
  ========================================================= */

  const exceptions =
    useMemo(
      () =>
        detectLeaveExceptions(
          requests,
          employees,
          balances
        ),
      [
        requests,
        employees,
        balances,
      ]
    );

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredExceptions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return exceptions.filter(
        (exception) => {
          const matchesSearch =
            !query ||
            exception.employeeName
              .toLowerCase()
              .includes(query) ||
            exception.department
              .toLowerCase()
              .includes(query) ||
            exception.leaveType
              .toLowerCase()
              .includes(query) ||
            exception.title
              .toLowerCase()
              .includes(query);

          const matchesSeverity =
            severityFilter ===
              "All" ||
            exception.severity ===
              severityFilter;

          return (
            matchesSearch &&
            matchesSeverity
          );
        }
      );
    }, [
      exceptions,
      search,
      severityFilter,
    ]);

  /* =========================================================
     SUMMARY
  ========================================================= */

  const highCount =
    exceptions.filter(
      (item) =>
        item.severity ===
        SEVERITY.HIGH
    ).length;

  const mediumCount =
    exceptions.filter(
      (item) =>
        item.severity ===
        SEVERITY.MEDIUM
    ).length;

  const lowCount =
    exceptions.filter(
      (item) =>
        item.severity ===
        SEVERITY.LOW
    ).length;

  /* =========================================================
     MARK REVIEWED
  ========================================================= */

  function markAsReviewed(
    exception
  ) {
    if (!exception?.id) {
      return;
    }

    setReviewedExceptions(
      (current) => {
        if (
          current.includes(
            exception.id
          )
        ) {
          return current;
        }

        const updated = [
          ...current,
          exception.id,
        ];

        localStorage.setItem(
          REVIEWED_STORAGE_KEY,
          JSON.stringify(
            updated
          )
        );

        return updated;
      }
    );

    setSelectedException(
      null
    );
  }

  /* =========================================================
     APPROVE REQUEST
  ========================================================= */

  async function handleApprove(
    exception
  ) {
    if (
      !exception?.requestId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to approve this leave request?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await attendanceLeaveService.approveLeaveRequest(
        exception.requestId
      );

      setSelectedException(
        null
      );

      await loadData();
    } catch (err) {
      console.error(
        "Approve leave request error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to approve the leave request."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* =========================================================
     REJECT REQUEST
  ========================================================= */

  async function handleReject(
    exception
  ) {
    if (
      !exception?.requestId
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Are you sure you want to reject this leave request?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");

      await attendanceLeaveService.rejectLeaveRequest(
        exception.requestId
      );

      setSelectedException(
        null
      );

      await loadData();
    } catch (err) {
      console.error(
        "Reject leave request error:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to reject the leave request."
      );
    } finally {
      setActionLoading(false);
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-6">
        <button
          type="button"
         onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowLeft
            size={16}
          />
          Back to Attendance &
          Leave
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
              <FileWarning
                size={16}
              />
              Attendance & Leave
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Leave Exception
              Analyzer
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Identify leave requests
              that may require HR
              review.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadData
            }
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={15}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <TriangleAlert
              size={17}
            />
            {error}
          </div>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="text-red-500 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={
            <Users
              size={18}
            />
          }
          value={
            requests.length
          }
          label="Leave Requests Analyzed"
        />

        <SummaryCard
          icon={
            <ShieldAlert
              size={18}
            />
          }
          value={highCount}
          label="High Severity"
        />

        <SummaryCard
          icon={
            <TriangleAlert
              size={18}
            />
          }
          value={mediumCount}
          label="Medium Severity"
        />

        <SummaryCard
          icon={
            <CheckCircle2
              size={18}
            />
          }
          value={lowCount}
          label="Low Severity"
        />
      </div>

      {/* =====================================================
          EXPLANATION
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <ShieldAlert
              size={18}
            />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              What is being
              checked?
            </h2>

            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              The analyzer reviews
              leave requests for
              insufficient balances,
              invalid dates,
              overlapping requests,
              missing employee
              records, extended
              leave, and pending
              requests that require
              HR attention.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          RESULTS
      ===================================================== */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Detected
              Exceptions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Review leave requests
              that may require human
              attention.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search employees..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-56"
              />
            </div>

            <select
              value={
                severityFilter
              }
              onChange={(
                event
              ) =>
                setSeverityFilter(
                  event.target
                    .value
                )
              }
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="All">
                All severity
              </option>

              <option value="High">
                High
              </option>

              <option value="Medium">
                Medium
              </option>

              <option value="Low">
                Low
              </option>
            </select>
          </div>
        </div>

        {/* ===================================================
            LOADING
        =================================================== */}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <RefreshCw
                size={17}
                className="animate-spin"
              />
              Analyzing leave
              requests...
            </div>
          </div>
        ) : filteredExceptions.length ===
          0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2
                size={22}
              />
            </div>

            <h3 className="text-sm font-semibold text-slate-900">
              No exceptions
              detected
            </h3>

            <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
              The available leave
              requests currently do
              not contain patterns
              that meet the configured
              exception rules.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dates
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Exception
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Severity
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Details
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredExceptions.map(
                  (exception) => {
                    const reviewed =
                      reviewedExceptions.includes(
                        exception.id
                      );

                    return (
                      <tr
                        key={
                          exception.id
                        }
                        className="border-b border-slate-100 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-900">
                            {
                              exception.employeeName
                            }
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {
                              exception.department
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-700">
                            {formatDate(
                              exception.startDate
                            )}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-400">
                            to{" "}
                            {formatDate(
                              exception.endDate
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-slate-800">
                            {
                              exception.title
                            }
                          </div>

                          <div className="mt-0.5 text-xs text-slate-500">
                            {
                              exception.leaveType
                            }
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-2">
                            <SeverityBadge
                              severity={
                                exception.severity
                              }
                            />

                            {reviewed && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                                <Check
                                  size={11}
                                />
                                Reviewed
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="max-w-[340px] px-5 py-4">
                          <p className="text-sm leading-relaxed text-slate-600">
                            {
                              exception.details
                            }
                          </p>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedException(
                                exception
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye
                              size={14}
                            />
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          REVIEW MODAL
      ===================================================== */}

      {selectedException && (
        <ReviewModal
          exception={
            selectedException
          }
          reviewed={reviewedExceptions.includes(
            selectedException.id
          )}
          actionLoading={
            actionLoading
          }
          onClose={() =>
            setSelectedException(
              null
            )
          }
          onMarkReviewed={
            markAsReviewed
          }
          onApprove={
            handleApprove
          }
          onReject={
            handleReject
          }
          onViewBalance={() =>
            navigate(
              "/app/tools/attendance-leave-tracker"
            )
          }
          onViewRequests={() =>
            navigate(
              "/app/tools/attendance-leave-tracker"
            )
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon,
  value,
  label,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-teal-700">
          {icon}
        </div>

        <div className="text-2xl font-semibold text-slate-950">
          {value}
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   SEVERITY BADGE
========================================================= */

function SeverityBadge({
  severity,
}) {
  const styles = {
    High:
      "border-red-200 bg-red-50 text-red-700",
    Medium:
      "border-amber-200 bg-amber-50 text-amber-700",
    Low:
      "border-blue-200 bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[severity] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {severity}
    </span>
  );
}

/* =========================================================
   REVIEW MODAL
========================================================= */

function ReviewModal({
  exception,
  reviewed,
  actionLoading,
  onClose,
  onMarkReviewed,
  onApprove,
  onReject,
  onViewBalance,
  onViewRequests,
}) {
  const isPending =
    normalizeStatus(
      exception.status
    ) === "pending" ||
    normalizeStatus(
      exception.status
    ) === "requested";

  const isBalanceException =
    exception.type ===
      "Leave Balance" ||
    exception.title.toLowerCase()
      .includes("balance");

  const shortfall =
    exception.shortfall ??
    (
      exception.days !== null &&
      exception.availableBalance !==
        null
        ? Math.max(
            0,
            exception.days -
              exception.availableBalance
          )
        : null
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Leave Exception
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {exception.title}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Review this exception before
              taking any HR action.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* =================================================
            SCROLLABLE CONTENT
        ================================================= */}

        <div className="overflow-y-auto p-6">
          <div className="space-y-5">
            {/* ===============================================
                PRIORITY
            =============================================== */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Why this was flagged
                  </p>

                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {
                      exception.details
                    }
                  </p>
                </div>

                <SeverityBadge
                  severity={
                    exception.severity
                  }
                />
              </div>
            </div>

            {/* ===============================================
                LEAVE SUMMARY
            =============================================== */}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Leave Summary
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Information associated with
                    this leave request.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoItem
                  label="Employee"
                  value={
                    exception.employeeName
                  }
                />

                <InfoItem
                  label="Department"
                  value={
                    exception.department
                  }
                />

                <InfoItem
                  label="Leave type"
                  value={
                    exception.leaveType
                  }
                />

                <InfoItem
                  label="Request status"
                  value={
                    exception.status
                  }
                />

                <InfoItem
                  label="Start date"
                  value={formatDate(
                    exception.startDate
                  )}
                />

                <InfoItem
                  label="End date"
                  value={formatDate(
                    exception.endDate
                  )}
                />

                <InfoItem
                  label="Requested days"
                  value={
                    exception.days !==
                    null
                      ? String(
                          exception.days
                        )
                      : "—"
                  }
                />

                <InfoItem
                  label="Exception type"
                  value={
                    exception.type
                  }
                />
              </div>
            </section>

            {/* ===============================================
                BALANCE IMPACT
            =============================================== */}

            {isBalanceException && (
              <section>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Balance Impact
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Compare the requested leave
                    against the available balance.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <ImpactCard
                    label="Available balance"
                    value={
                      exception.availableBalance !==
                      null
                        ? `${exception.availableBalance} day${
                            exception.availableBalance ===
                            1
                              ? ""
                              : "s"
                          }`
                        : "Not configured"
                    }
                    icon={
                      <WalletCards
                        size={17}
                      />
                    }
                  />

                  <ImpactCard
                    label="Requested"
                    value={
                      exception.days !==
                      null
                        ? `${exception.days} day${
                            exception.days ===
                            1
                              ? ""
                              : "s"
                          }`
                        : "—"
                    }
                    icon={
                      <FileWarning
                        size={17}
                      />
                    }
                  />

                  <ImpactCard
                    label="Shortfall"
                    value={
                      shortfall !==
                      null
                        ? `${shortfall} day${
                            shortfall ===
                            1
                              ? ""
                              : "s"
                          }`
                        : "—"
                    }
                    icon={
                      <TriangleAlert
                        size={17}
                      />
                    }
                    danger={
                      shortfall >
                      0
                    }
                  />
                </div>
              </section>
            )}

            {/* ===============================================
                RECOMMENDED HR ACTION
            =============================================== */}

            <section>
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Recommended HR Action
                </h3>

                <p className="mt-0.5 text-xs text-slate-400">
                  Suggested steps for human review.
                </p>
              </div>

              <RecommendationPanel
                exception={
                  exception
                }
              />
            </section>

            {/* ===============================================
                QUICK ACTIONS
            =============================================== */}

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                What can HR do?
              </h3>

              <div className="flex flex-wrap gap-2">
                {isBalanceException && (
                  <ActionButton
                    icon={
                      <WalletCards
                        size={15}
                      />
                    }
                    label="Review Balance"
                    onClick={
                      onViewBalance
                    }
                  />
                )}

                <ActionButton
                  icon={
                    <ExternalLink
                      size={15}
                    />
                  }
                  label="View Leave Requests"
                  onClick={
                    onViewRequests
                  }
                />

                {!reviewed && (
                  <ActionButton
                    icon={
                      <Check
                        size={15}
                      />
                    }
                    label="Mark Reviewed"
                    onClick={() =>
                      onMarkReviewed(
                        exception
                      )
                    }
                    primary
                  />
                )}
              </div>
            </section>

            {/* ===============================================
                PENDING REQUEST ACTIONS
            =============================================== */}

            {isPending && (
              <section className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Request Decision
                  </h3>

                  <p className="mt-0.5 text-xs text-slate-500">
                    This request is still pending.
                    Confirm the HR decision carefully.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 p-4">
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      onApprove(
                        exception
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CircleCheck
                      size={16}
                    />
                    Approve Request
                  </button>

                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      onReject(
                        exception
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CircleX
                      size={16}
                    />
                    Reject Request
                  </button>
                </div>
              </section>
            )}

            {/* ===============================================
                REVIEW NOTICE
            =============================================== */}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert
                  size={18}
                  className="mt-0.5 shrink-0 text-amber-600"
                />

                <div>
                  <p className="text-sm font-medium text-amber-800">
                    HR review required
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-amber-700">
                    This analyzer identifies unusual
                    or potentially conflicting leave
                    records. It does not automatically
                    make an HR decision.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <div>
            {reviewed && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check
                  size={14}
                />
                Marked as reviewed
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   RECOMMENDATION PANEL
========================================================= */

function RecommendationPanel({
  exception,
}) {
  const recommendations =
    getRecommendations(
      exception
    );

  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm">
          <ShieldAlert
            size={17}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-teal-900">
            Suggested next steps
          </p>

          <ul className="mt-2 space-y-2">
            {recommendations.map(
              (
                recommendation,
                index
              ) => (
                <li
                  key={
                    `${recommendation}-${index}`
                  }
                  className="flex items-start gap-2 text-xs leading-relaxed text-teal-800"
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-teal-700">
                    {index + 1}
                  </span>

                  <span>
                    {recommendation}
                  </span>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   RECOMMENDATIONS
========================================================= */

function getRecommendations(
  exception
) {
  switch (
    exception.type
  ) {
    case "Leave Balance":
      if (
        exception.title
          .toLowerCase()
          .includes(
            "insufficient"
          )
      ) {
        return [
          "Verify the employee's current leave balance and recent leave usage.",
          "Check whether additional leave can be granted under the applicable company policy.",
          "If an adjustment is permitted, update the balance before processing the request.",
          "Document the HR decision for future reference.",
        ];
      }

      return [
        "Confirm which leave policy applies to this employee.",
        "Configure the appropriate leave balance.",
        "Re-run the analyzer after the balance has been configured.",
      ];

    case "Date Conflict":
      return [
        "Review the overlapping leave requests for the employee.",
        "Confirm the intended dates with the employee or HR manager.",
        "Determine which request should remain active.",
        "Document any correction made to the leave schedule.",
      ];

    case "Invalid Dates":
      return [
        "Verify the requested start and end dates.",
        "Ask the employee or HR administrator to correct the date range.",
        "Re-run the analyzer after the request has been corrected.",
      ];

    case "Extended Leave":
      return [
        "Review the company's policy for extended leave.",
        "Check whether supporting documentation or additional approval is required.",
        "Confirm the dates and business impact with the relevant HR manager.",
      ];

    case "Employee Record":
      return [
        "Verify that the employee still exists in the organization.",
        "Check whether the leave request is linked to the correct employee record.",
        "Correct the employee reference before taking further action.",
      ];

    case "Pending Review":
      return [
        "Review the employee's leave balance and request dates.",
        "Check the request against applicable leave policy.",
        "Approve or reject the request after HR review.",
        "Document any relevant review comments.",
      ];

    default:
      return [
        "Review the leave request details.",
        "Verify the applicable HR policy.",
        "Take the appropriate HR action after human review.",
      ];
  }
}

/* =========================================================
   IMPACT CARD
========================================================= */

function ImpactCard({
  label,
  value,
  icon,
  danger = false,
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        danger
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div
        className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white ${
          danger
            ? "text-red-600"
            : "text-teal-700"
        }`}
      >
        {icon}
      </div>

      <p className="text-xs font-medium text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 text-sm font-semibold ${
          danger
            ? "text-red-700"
            : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   ACTION BUTTON
========================================================= */

function ActionButton({
  icon,
  label,
  onClick,
  primary = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
        primary
          ? "bg-teal-700 text-white hover:bg-teal-800"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-3">
      <p className="text-xs font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm text-slate-700">
        {value}
      </p>
    </div>
  );
}