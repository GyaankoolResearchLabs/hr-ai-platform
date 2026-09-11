import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  Loader2,
  Send,
} from "lucide-react";

import employeeAttendanceLeaveService from "../services/employeeAttendanceLeaveService";

const LEAVE_TYPES = [
  "Annual Leave",
  "Casual Leave",
  "Sick Leave",
  "Unpaid Leave",
];

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getLeaveStatusClass(status) {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "Rejected":
      return "bg-red-50 text-red-700 border-red-200";

    case "Cancelled":
      return "bg-ink-50 text-ink-600 border-ink-200";

    case "Pending":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  const [hours, minutes] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getAttendanceStatusClass(status) {
  switch (status) {
    case "Present":
    case "Work From Home":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "Absent":
      return "bg-red-50 text-red-700 border-red-200";

    case "Half Day":
    case "On Leave":
      return "bg-amber-50 text-amber-700 border-amber-200";

    default:
      return "bg-ink-50 text-ink-600 border-ink-200";
  }
}

const EMPTY_FORM = {
  leave_type: LEAVE_TYPES[0],
  start_date: "",
  end_date: "",
  reason: "",
};

export default function EmployeeAttendanceLeave() {
  const [attendance, setAttendance] = useState([]);
  const [today, setToday] = useState(null);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [clocking, setClocking] = useState(false);
  const [clockError, setClockError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        attendanceResponse,
        balanceResponse,
        requestResponse,
      ] = await Promise.all([
        employeeAttendanceLeaveService.getAttendance(),
        employeeAttendanceLeaveService.getLeaveBalance(),
        employeeAttendanceLeaveService.getLeaveRequests(),
      ]);

      setAttendance(attendanceResponse.attendance);
      setToday(attendanceResponse.today);
      setBalances(balanceResponse);
      setRequests(requestResponse);
    } catch (err) {
      console.error("Employee attendance & leave load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your attendance & leave data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const balanceByType = useMemo(() => {
    const map = new Map();

    balances.forEach((balance) => {
      map.set(balance.leave_type, balance);
    });

    return map;
  }, [balances]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyTodayRecord(record) {
    setToday(record);

    setAttendance((current) => {
      const withoutToday = current.filter(
        (item) => item.attendance_date !== record.attendance_date,
      );

      return [record, ...withoutToday];
    });
  }

  async function handleClockIn() {
    setClockError("");

    try {
      setClocking(true);

      const record = await employeeAttendanceLeaveService.clockIn();

      applyTodayRecord(record);
    } catch (err) {
      console.error("Clock in error:", err);

      setClockError(
        err?.response?.data?.message || "Unable to clock in.",
      );
    } finally {
      setClocking(false);
    }
  }

  async function handleClockOut() {
    setClockError("");

    try {
      setClocking(true);

      const record = await employeeAttendanceLeaveService.clockOut();

      applyTodayRecord(record);
    } catch (err) {
      console.error("Clock out error:", err);

      setClockError(
        err?.response?.data?.message || "Unable to clock out.",
      );
    } finally {
      setClocking(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.start_date || !form.end_date) {
      setFormError("Start date and end date are required.");
      return;
    }

    try {
      setSubmitting(true);

      const created =
        await employeeAttendanceLeaveService.submitLeaveRequest({
          leaveType: form.leave_type,
          startDate: form.start_date,
          endDate: form.end_date,
          reason: form.reason,
        });

      setRequests((current) => [created, ...current]);
      setForm(EMPTY_FORM);
      setFormSuccess(
        `Leave request submitted for ${created.total_days} day(s). Status: ${created.status}.`,
      );
    } catch (err) {
      console.error("Leave request submission error:", err);

      setFormError(
        err?.response?.data?.message ||
          "Unable to submit your leave request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your attendance & leave...
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <Link
          to="/app/employee/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Portal
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Attendance &amp; Leave
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your attendance history, leave balances, and leave requests.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          LEAVE BALANCES
      ===================================================== */}

      <section className="mb-6 card p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-950">
              Leave Balance
            </h2>
            <p className="text-sm text-ink-500">
              Available days by leave type
            </p>
          </div>
        </div>

        {LEAVE_TYPES.every((type) => !balanceByType.has(type)) &&
        balances.length === 0 ? (
          <p className="text-sm text-ink-500">
            No leave balances are on file yet. Contact HR to have your
            leave balances set up.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {balances.map((balance) => {
              const allocated = Number(balance.allocated || 0);
              const carriedForward = Number(
                balance.carried_forward || 0,
              );
              const used = Number(balance.used || 0);
              const available = Math.max(
                0,
                allocated + carriedForward - used,
              );

              return (
                <div
                  key={balance.id}
                  className="rounded-lg bg-ink-50 px-4 py-3"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    {balance.leave_type}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-ink-950">
                    {available}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {used} used of {allocated + carriedForward}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* =====================================================
            ATTENDANCE HISTORY
        ===================================================== */}

        <section className="card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Clock3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-ink-950">
                Attendance History
              </h2>
              <p className="text-sm text-ink-500">
                {today
                  ? `Today: ${today.status}`
                  : "Not clocked in yet today"}
              </p>
            </div>
          </div>

          <div className="border-b border-ink-100 px-5 py-4">
            {clockError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {clockError}
              </div>
            )}

            {!today && (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={clocking}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
              >
                {clocking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Clock In
              </button>
            )}

            {today && today.check_in && !today.check_out && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-ink-600">
                  Clocked in at{" "}
                  <span className="font-medium text-ink-900">
                    {formatTime(today.check_in)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleClockOut}
                  disabled={clocking}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
                >
                  {clocking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Clock Out
                </button>
              </div>
            )}

            {today && today.check_in && today.check_out && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Clocked in at{" "}
                  <span className="font-medium">
                    {formatTime(today.check_in)}
                  </span>{" "}
                  &middot; Clocked out at{" "}
                  <span className="font-medium">
                    {formatTime(today.check_out)}
                  </span>
                </span>
              </div>
            )}

            {today && !today.check_in && (
              <p className="text-sm text-ink-500">
                Today's attendance was already marked by HR as{" "}
                <span className="font-medium text-ink-900">
                  {today.status}
                </span>
                .
              </p>
            )}
          </div>

          {attendance.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500">
              No attendance records yet.
            </div>
          ) : (
            <div className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {attendance.map((record) => (
                <div
                  key={record.id || record.attendance_date}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {formatDate(record.attendance_date)}
                    </p>
                    {(record.check_in || record.check_out) && (
                      <p className="mt-0.5 text-xs text-ink-500">
                        {record.check_in || "-"} &rarr;{" "}
                        {record.check_out || "-"}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${getAttendanceStatusClass(
                      record.status,
                    )}`}
                  >
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* =====================================================
            LEAVE REQUESTS
        ===================================================== */}

        <section className="card overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4">
            <h2 className="text-base font-semibold text-ink-950">
              My Leave Requests
            </h2>
            <p className="text-sm text-ink-500">
              Past and pending requests
            </p>
          </div>

          {requests.length === 0 ? (
            <div className="px-5 py-8 text-sm text-ink-500">
              You have not submitted any leave requests yet.
            </div>
          ) : (
            <div className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {request.leave_type}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDate(request.start_date)} to{" "}
                      {formatDate(request.end_date)} &middot;{" "}
                      {request.total_days} day
                      {request.total_days === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${getLeaveStatusClass(
                      request.status,
                    )}`}
                  >
                    {request.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* =====================================================
          NEW LEAVE REQUEST
      ===================================================== */}

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Send className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-950">
              Request Leave
            </h2>
            <p className="text-sm text-ink-500">
              Submitted requests start as Pending
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {formSuccess}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
              Leave type
            </label>
            <select
              value={form.leave_type}
              onChange={(e) =>
                updateField("leave_type", e.target.value)
              }
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
              Start date
            </label>
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) =>
                updateField("start_date", e.target.value)
              }
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
              End date
            </label>
            <input
              type="date"
              required
              value={form.end_date}
              onChange={(e) =>
                updateField("end_date", e.target.value)
              }
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
              Reason (optional)
            </label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => updateField("reason", e.target.value)}
              placeholder="e.g. Family function"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {submitting && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Submit request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
