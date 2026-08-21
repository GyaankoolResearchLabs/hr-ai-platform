import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
  XCircle,
} from "lucide-react";

import employeeService from "../../services/employeeService";
import attendanceLeaveService from "../../services/attendanceLeaveService";

/* =========================================================
   CONSTANTS
========================================================= */

const ATTENDANCE_STATUSES = [
  "Present",
  "Absent",
  "Half Day",
  "On Leave",
  "Holiday",
  "Work From Home",
];

const LEAVE_TYPES = [
  "Annual Leave",
  "Casual Leave",
  "Sick Leave",
  "Unpaid Leave",
];

const today = () =>
  new Date().toISOString().slice(0, 10);

/* =========================================================
   SMALL UI HELPERS
========================================================= */

function formatDate(dateValue) {
  if (!dateValue) {
    return "—";
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/*
 * Convert database time such as:
 *
 * 09:14
 * 09:14:00
 *
 * into:
 *
 * 09:14 AM
 *
 * 06:02 PM
 */
function formatTime(timeValue) {
  if (!timeValue) {
    return "—";
  }

  const value = String(timeValue).slice(0, 5);

  const parts = value.split(":");

  if (parts.length !== 2) {
    return value;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return value;
  }

  const period = hours >= 12 ? "PM" : "AM";

  const displayHours =
    hours % 12 === 0
      ? 12
      : hours % 12;

  return `${String(displayHours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")} ${period}`;
}

/*
 * Return the current local time in HH:mm format.
 *
 * Example:
 *
 * 09:14
 * 18:02
 */
function getCurrentTime() {
  const now = new Date();

  const hours = String(
    now.getHours()
  ).padStart(2, "0");

  const minutes = String(
    now.getMinutes()
  ).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function getStatusClass(status) {
  switch (status) {
    case "Present":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "Absent":
      return "bg-red-50 text-red-700 border-red-200";

    case "Half Day":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "On Leave":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "Holiday":
      return "bg-purple-50 text-purple-700 border-purple-200";

    case "Work From Home":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getLeaveStatusClass(status) {
  switch (status) {
    case "Approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "Rejected":
      return "bg-red-50 text-red-700 border-red-200";

    case "Cancelled":
      return "bg-slate-50 text-slate-600 border-slate-200";

    case "Pending":
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AttendanceLeaveTracker() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [summary, setSummary] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  const [selectedDate, setSelectedDate] =
    useState(today());

  const [search, setSearch] = useState("");

  const [activeSection, setActiveSection] =
    useState("attendance");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showAttendanceForm, setShowAttendanceForm] =
    useState(false);

  const [showLeaveForm, setShowLeaveForm] =
    useState(false);

  const [showBalanceForm, setShowBalanceForm] =
    useState(false);

  const [attendanceForm, setAttendanceForm] =
    useState({
      employeeId: "",
      status: "Present",
      checkIn: "",
      checkOut: "",
      notes: "",
    });

  const [leaveForm, setLeaveForm] =
    useState({
      employeeId: "",
      leaveType: "Annual Leave",
      startDate: today(),
      endDate: today(),
      reason: "",
    });

  const [balanceForm, setBalanceForm] =
    useState({
      employeeId: "",
      leaveType: "Annual Leave",
      allocated: "",
      carriedForward: "0",
    });

  /* =========================================================
     LOAD ALL DATA
  ========================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        employeeData,
        attendanceData,
        summaryData,
        balanceData,
        requestData,
      ] = await Promise.all([
        employeeService.list(),

        attendanceLeaveService.getAttendance({
          date: selectedDate,
        }),

        attendanceLeaveService.getAttendanceSummary(
          selectedDate
        ),

        attendanceLeaveService.getLeaveBalances(),

        attendanceLeaveService.getLeaveRequests(),
      ]);

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : []
      );

      setAttendance(
        Array.isArray(attendanceData)
          ? attendanceData
          : []
      );

      setSummary(summaryData || null);

      setLeaveBalances(
        Array.isArray(balanceData)
          ? balanceData
          : []
      );

      setLeaveRequests(
        Array.isArray(requestData)
          ? requestData
          : []
      );
    } catch (err) {
      console.error(
        "Attendance & Leave load error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load Attendance & Leave data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  /* =========================================================
     FILTERED EMPLOYEES
  ========================================================= */

  const filteredEmployees = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter(
      (employee) =>
        employee?.full_name
          ?.toLowerCase()
          .includes(query) ||
        employee?.email
          ?.toLowerCase()
          .includes(query) ||
        employee?.department
          ?.toLowerCase()
          .includes(query) ||
        employee?.employee_code
          ?.toLowerCase()
          .includes(query)
    );
  }, [employees, search]);

  /* =========================================================
     ATTENDANCE MAP
  ========================================================= */

  const attendanceMap = useMemo(() => {
    const map = {};

    for (const record of attendance) {
      if (record?.employee_id) {
        map[record.employee_id] = record;
      }
    }

    return map;
  }, [attendance]);

  /* =========================================================
     CLEAR MESSAGES
  ========================================================= */

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  /* =========================================================
     ATTENDANCE FORM
  ========================================================= */

  function openAttendanceForm(employeeId = "") {
    clearMessages();

    const existingRecord =
      attendanceMap[employeeId];

    setAttendanceForm({
      employeeId,

      status:
        existingRecord?.status ||
        "Present",

      checkIn:
        existingRecord?.check_in?.slice(0, 5) ||
        "",

      checkOut:
        existingRecord?.check_out?.slice(0, 5) ||
        "",

      notes:
        existingRecord?.notes ||
        "",
    });

    setShowAttendanceForm(true);
  }

  function closeAttendanceForm() {
    if (saving) {
      return;
    }

    setShowAttendanceForm(false);
  }

  /*
   * Set current time for check-in.
   */
  function setCheckInNow() {
    setAttendanceForm((current) => ({
      ...current,
      checkIn: getCurrentTime(),
    }));
  }

  /*
   * Set current time for check-out.
   */
  function setCheckOutNow() {
    setAttendanceForm((current) => ({
      ...current,
      checkOut: getCurrentTime(),
    }));
  }

  /*
   * Optional convenience:
   *
   * If status changes to Present and no
   * check-in exists, we don't automatically
   * mark the time.
   *
   * HR explicitly chooses "Now".
   */
  function handleAttendanceStatusChange(status) {
    setAttendanceForm((current) => ({
      ...current,
      status,
    }));
  }

  async function handleSaveAttendance(event) {
    event.preventDefault();

    clearMessages();

    if (!attendanceForm.employeeId) {
      setError("Please select an employee.");
      return;
    }

    try {
      setSaving(true);

      await attendanceLeaveService.saveAttendance({
        employeeId:
          attendanceForm.employeeId,

        attendanceDate:
          selectedDate,

        status:
          attendanceForm.status,

        checkIn:
          attendanceForm.checkIn ||
          null,

        checkOut:
          attendanceForm.checkOut ||
          null,

        notes:
          attendanceForm.notes ||
          null,
      });

      setSuccess(
        "Attendance record saved successfully."
      );

      setShowAttendanceForm(false);

      await loadData();
    } catch (err) {
      console.error(
        "Save attendance error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save attendance."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LEAVE FORM
  ========================================================= */

  function openLeaveForm() {
    clearMessages();

    setLeaveForm({
      employeeId:
        employees[0]?.id || "",

      leaveType: "Annual Leave",

      startDate: selectedDate,

      endDate: selectedDate,

      reason: "",
    });

    setShowLeaveForm(true);
  }

  function closeLeaveForm() {
    if (saving) {
      return;
    }

    setShowLeaveForm(false);
  }

  async function handleCreateLeave(event) {
    event.preventDefault();

    clearMessages();

    if (!leaveForm.employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (
      !leaveForm.startDate ||
      !leaveForm.endDate
    ) {
      setError(
        "Please select both leave dates."
      );
      return;
    }

    if (
      leaveForm.endDate <
      leaveForm.startDate
    ) {
      setError(
        "End date cannot be before start date."
      );
      return;
    }

    try {
      setSaving(true);

      await attendanceLeaveService.createLeaveRequest({
        employeeId:
          leaveForm.employeeId,

        leaveType:
          leaveForm.leaveType,

        startDate:
          leaveForm.startDate,

        endDate:
          leaveForm.endDate,

        reason:
          leaveForm.reason ||
          null,
      });

      setSuccess(
        "Leave request created successfully."
      );

      setShowLeaveForm(false);

      await loadData();
    } catch (err) {
      console.error(
        "Create leave request error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not create leave request."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     BALANCE FORM
  ========================================================= */

  function openBalanceForm() {
    clearMessages();

    setBalanceForm({
      employeeId:
        employees[0]?.id || "",

      leaveType: "Annual Leave",

      allocated: "",

      carriedForward: "0",
    });

    setShowBalanceForm(true);
  }

  function closeBalanceForm() {
    if (saving) {
      return;
    }

    setShowBalanceForm(false);
  }

  async function handleSaveBalance(event) {
    event.preventDefault();

    clearMessages();

    if (!balanceForm.employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (balanceForm.allocated === "") {
      setError(
        "Please enter the allocated leave."
      );
      return;
    }

    try {
      setSaving(true);

      await attendanceLeaveService.saveLeaveBalance({
        employeeId:
          balanceForm.employeeId,

        leaveType:
          balanceForm.leaveType,

        allocated: Number(
          balanceForm.allocated
        ),

        carriedForward: Number(
          balanceForm.carriedForward || 0
        ),
      });

      setSuccess(
        "Leave balance saved successfully."
      );

      setShowBalanceForm(false);

      await loadData();
    } catch (err) {
      console.error(
        "Save leave balance error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not save leave balance."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LEAVE REQUEST ACTIONS
  ========================================================= */

  async function handleLeaveAction(
    requestId,
    action
  ) {
    clearMessages();

    try {
      setSaving(true);

      if (action === "approve") {
        await attendanceLeaveService.approveLeaveRequest(
          requestId
        );

        setSuccess(
          "Leave request approved."
        );
      }

      if (action === "reject") {
        await attendanceLeaveService.rejectLeaveRequest(
          requestId
        );

        setSuccess(
          "Leave request rejected."
        );
      }

      if (action === "cancel") {
        await attendanceLeaveService.cancelLeaveRequest(
          requestId
        );

        setSuccess(
          "Leave request cancelled."
        );
      }

      await loadData();
    } catch (err) {
      console.error(
        "Leave request action error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not update leave request."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0 space-y-6">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <CalendarDays size={18} />

            Attendance & Leave
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Attendance & Leave Tracker
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Manage employee attendance, leave
            balances, and leave requests from one
            centralized workspace.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh
          </button>

          <button
            type="button"
            onClick={openLeaveForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b514d]"
          >
            <Plus size={16} />

            New Leave Request
          </button>
        </div>
      </div>

      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <XCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>

          <button
            type="button"
            onClick={() => setSuccess("")}
            className="ml-auto shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          label="Employees"
          value={
            summary?.total_employees ??
            employees.length
          }
          icon={Users}
        />

        <SummaryCard
          label="Present"
          value={summary?.present ?? 0}
          icon={Check}
        />

        <SummaryCard
          label="Absent"
          value={summary?.absent ?? 0}
          icon={XCircle}
        />

        <SummaryCard
          label="On Leave"
          value={summary?.on_leave ?? 0}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Not Marked"
          value={summary?.not_marked ?? 0}
          icon={Clock3}
        />
      </div>

      {/* =====================================================
          SECTION NAVIGATION
      ===================================================== */}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <div className="flex min-w-max">
          <SectionButton
            active={
              activeSection === "attendance"
            }
            onClick={() =>
              setActiveSection("attendance")
            }
            icon={Clock3}
            label="Attendance"
          />

          <SectionButton
            active={
              activeSection === "balances"
            }
            onClick={() =>
              setActiveSection("balances")
            }
            icon={CalendarDays}
            label="Leave Balances"
          />

          <SectionButton
            active={
              activeSection === "requests"
            }
            onClick={() =>
              setActiveSection("requests")
            }
            icon={FileText}
            label="Leave Requests"
          />
        </div>
      </div>

      {/* =====================================================
          ATTENDANCE SECTION
      ===================================================== */}

      {activeSection === "attendance" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Daily Attendance
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Mark and review attendance for{" "}
                {formatDate(selectedDate)}.
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
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search employees..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0f5f5a] sm:w-56"
                />
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  setSelectedDate(
                    event.target.value
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f5f5a]"
              />

              <button
                type="button"
                onClick={() =>
                  openAttendanceForm()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0b514d]"
              >
                <Plus size={16} />

                Mark Attendance
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Check-in
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Check-out
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No employees found.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(
                      (employee) => {
                        const record =
                          attendanceMap[
                            employee.id
                          ];

                        return (
                          <tr
                            key={employee.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-900">
                                {employee.full_name}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {employee.email}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                              {employee.department ||
                                "—"}
                            </td>

                            <td className="px-5 py-4">
                              {record ? (
                                <span
                                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                    record.status
                                  )}`}
                                >
                                  {record.status}
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                                  Not Marked
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                {record?.check_in ? (
                                  <>
                                    <Clock3
                                      size={15}
                                      className="text-[#0f5f5a]"
                                    />

                                    {formatTime(
                                      record.check_in
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                {record?.check_out ? (
                                  <>
                                    <Clock3
                                      size={15}
                                      className="text-[#0f5f5a]"
                                    />

                                    {formatTime(
                                      record.check_out
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-400">
                                    —
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  openAttendanceForm(
                                    employee.id
                                  )
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                {record
                                  ? "Edit"
                                  : "Mark"}
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          LEAVE BALANCES
      ===================================================== */}

      {activeSection === "balances" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Leave Balances
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Configure and review employee leave
                allocations.
              </p>
            </div>

            <button
              type="button"
              onClick={openBalanceForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0b514d]"
            >
              <Plus size={16} />

              Set Leave Balance
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Leave Type
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Allocated
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Carried Forward
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Used
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remaining
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leaveBalances.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No leave balances have
                        been configured yet.
                      </td>
                    </tr>
                  ) : (
                    leaveBalances.map(
                      (balance) => {
                        const allocated =
                          Number(
                            balance.allocated || 0
                          );

                        const carried =
                          Number(
                            balance.carried_forward ||
                              0
                          );

                        const used =
                          Number(
                            balance.used || 0
                          );

                        const remaining =
                          Math.max(
                            0,
                            allocated +
                              carried -
                              used
                          );

                        return (
                          <tr
                            key={balance.id}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="px-5 py-4">
                              <div className="font-medium text-slate-900">
                                {balance
                                  .employees
                                  ?.full_name ||
                                  "Unknown Employee"}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {balance
                                  .employees
                                  ?.department ||
                                  "—"}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-700">
                              {balance.leave_type}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-700">
                              {allocated}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-700">
                              {carried}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-700">
                              {used}
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-semibold text-[#0f5f5a]">
                                {remaining}
                              </span>
                            </td>
                          </tr>
                        );
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          LEAVE REQUESTS
      ===================================================== */}

      {activeSection === "requests" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Leave Requests
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Review employee leave requests and
                record HR decisions.
              </p>
            </div>

            <button
              type="button"
              onClick={openLeaveForm}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0b514d]"
            >
              <Plus size={16} />

              New Leave Request
            </button>
          </div>

          {loading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Leave Type
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Period
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Days
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leaveRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-5 py-12 text-center text-sm text-slate-500"
                      >
                        No leave requests found.
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map(
                      (request) => (
                        <tr
                          key={request.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {request
                                .employees
                                ?.full_name ||
                                "Unknown Employee"}
                            </div>

                            <div className="mt-0.5 text-xs text-slate-500">
                              {request
                                .employees
                                ?.department ||
                                "—"}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {request.leave_type}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-600">
                            <div>
                              {formatDate(
                                request.start_date
                              )}
                            </div>

                            <div className="text-xs text-slate-400">
                              to{" "}
                              {formatDate(
                                request.end_date
                              )}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-700">
                            {request.total_days}
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getLeaveStatusClass(
                                request.status
                              )}`}
                            >
                              {request.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right">
                            {request.status ===
                            "Pending" ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    handleLeaveAction(
                                      request.id,
                                      "approve"
                                    )
                                  }
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    handleLeaveAction(
                                      request.id,
                                      "reject"
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                No action
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =====================================================
          ATTENDANCE MODAL
      ===================================================== */}

      {showAttendanceForm && (
        <Modal
          title="Mark Attendance"
          onClose={closeAttendanceForm}
        >
          <form
            onSubmit={handleSaveAttendance}
            className="space-y-5"
          >
            <FormField label="Employee">
              <select
                value={
                  attendanceForm.employeeId
                }
                onChange={(event) =>
                  setAttendanceForm(
                    (current) => ({
                      ...current,
                      employeeId:
                        event.target.value,
                    })
                  )
                }
                className="form-input"
                required
              >
                <option value="">
                  Select employee
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.full_name}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Date">
              <input
                type="date"
                value={selectedDate}
                disabled
                className="form-input bg-slate-50"
              />
            </FormField>

            <FormField label="Attendance Status">
              <select
                value={
                  attendanceForm.status
                }
                onChange={(event) =>
                  handleAttendanceStatusChange(
                    event.target.value
                  )
                }
                className="form-input"
              >
                {ATTENDANCE_STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </FormField>

            {/* =================================================
                CHECK-IN / CHECK-OUT
            ================================================= */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Check-in">
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={
                      attendanceForm.checkIn
                    }
                    onChange={(event) =>
                      setAttendanceForm(
                        (current) => ({
                          ...current,
                          checkIn:
                            event.target.value,
                        })
                      )
                    }
                    className="form-input min-w-0 flex-1"
                  />

                  <button
                    type="button"
                    onClick={setCheckInNow}
                    className="shrink-0 rounded-xl border border-[#0f5f5a] px-3 text-sm font-medium text-[#0f5f5a] transition hover:bg-[#0f5f5a] hover:text-white"
                  >
                    Now
                  </button>
                </div>

                {attendanceForm.checkIn && (
                  <p className="mt-2 text-xs text-slate-500">
                    Check-in:{" "}
                    {formatTime(
                      attendanceForm.checkIn
                    )}
                  </p>
                )}
              </FormField>

              <FormField label="Check-out">
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={
                      attendanceForm.checkOut
                    }
                    onChange={(event) =>
                      setAttendanceForm(
                        (current) => ({
                          ...current,
                          checkOut:
                            event.target.value,
                        })
                      )
                    }
                    className="form-input min-w-0 flex-1"
                  />

                  <button
                    type="button"
                    onClick={setCheckOutNow}
                    className="shrink-0 rounded-xl border border-[#0f5f5a] px-3 text-sm font-medium text-[#0f5f5a] transition hover:bg-[#0f5f5a] hover:text-white"
                  >
                    Now
                  </button>
                </div>

                {attendanceForm.checkOut && (
                  <p className="mt-2 text-xs text-slate-500">
                    Check-out:{" "}
                    {formatTime(
                      attendanceForm.checkOut
                    )}
                  </p>
                )}
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                value={
                  attendanceForm.notes
                }
                onChange={(event) =>
                  setAttendanceForm(
                    (current) => ({
                      ...current,
                      notes:
                        event.target.value,
                    })
                  )
                }
                rows="3"
                placeholder="Optional attendance note..."
                className="form-input resize-none"
              />
            </FormField>

            <ModalActions
              onCancel={closeAttendanceForm}
              saving={saving}
              submitLabel="Save Attendance"
            />
          </form>
        </Modal>
      )}

      {/* =====================================================
          LEAVE REQUEST MODAL
      ===================================================== */}

      {showLeaveForm && (
        <Modal
          title="Create Leave Request"
          onClose={closeLeaveForm}
        >
          <form
            onSubmit={handleCreateLeave}
            className="space-y-5"
          >
            <FormField label="Employee">
              <select
                value={
                  leaveForm.employeeId
                }
                onChange={(event) =>
                  setLeaveForm(
                    (current) => ({
                      ...current,
                      employeeId:
                        event.target.value,
                    })
                  )
                }
                className="form-input"
                required
              >
                <option value="">
                  Select employee
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.full_name}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Leave Type">
              <select
                value={
                  leaveForm.leaveType
                }
                onChange={(event) =>
                  setLeaveForm(
                    (current) => ({
                      ...current,
                      leaveType:
                        event.target.value,
                    })
                  )
                }
                className="form-input"
              >
                {LEAVE_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Start Date">
                <input
                  type="date"
                  value={
                    leaveForm.startDate
                  }
                  onChange={(event) =>
                    setLeaveForm(
                      (current) => ({
                        ...current,
                        startDate:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="End Date">
                <input
                  type="date"
                  value={
                    leaveForm.endDate
                  }
                  onChange={(event) =>
                    setLeaveForm(
                      (current) => ({
                        ...current,
                        endDate:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input"
                  required
                />
              </FormField>
            </div>

            <FormField label="Reason">
              <textarea
                value={leaveForm.reason}
                onChange={(event) =>
                  setLeaveForm(
                    (current) => ({
                      ...current,
                      reason:
                        event.target.value,
                    })
                  )
                }
                rows="4"
                placeholder="Reason for leave..."
                className="form-input resize-none"
              />
            </FormField>

            <ModalActions
              onCancel={closeLeaveForm}
              saving={saving}
              submitLabel="Create Request"
            />
          </form>
        </Modal>
      )}

      {/* =====================================================
          LEAVE BALANCE MODAL
      ===================================================== */}

      {showBalanceForm && (
        <Modal
          title="Set Leave Balance"
          onClose={closeBalanceForm}
        >
          <form
            onSubmit={handleSaveBalance}
            className="space-y-5"
          >
            <FormField label="Employee">
              <select
                value={
                  balanceForm.employeeId
                }
                onChange={(event) =>
                  setBalanceForm(
                    (current) => ({
                      ...current,
                      employeeId:
                        event.target.value,
                    })
                  )
                }
                className="form-input"
                required
              >
                <option value="">
                  Select employee
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={employee.id}
                      value={employee.id}
                    >
                      {employee.full_name}
                      {employee.department
                        ? ` — ${employee.department}`
                        : ""}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="Leave Type">
              <select
                value={
                  balanceForm.leaveType
                }
                onChange={(event) =>
                  setBalanceForm(
                    (current) => ({
                      ...current,
                      leaveType:
                        event.target.value,
                    })
                  )
                }
                className="form-input"
              >
                {LEAVE_TYPES.map(
                  (type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Allocated Days">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    balanceForm.allocated
                  }
                  onChange={(event) =>
                    setBalanceForm(
                      (current) => ({
                        ...current,
                        allocated:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="e.g. 12"
                  className="form-input"
                  required
                />
              </FormField>

              <FormField label="Carried Forward">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={
                    balanceForm.carriedForward
                  }
                  onChange={(event) =>
                    setBalanceForm(
                      (current) => ({
                        ...current,
                        carriedForward:
                          event.target.value,
                      })
                    )
                  }
                  className="form-input"
                />
              </FormField>
            </div>

            <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Used leave is controlled by approved
              leave requests and cannot be manually
              overwritten here.
            </p>

            <ModalActions
              onCancel={closeBalanceForm}
              saving={saving}
              submitLabel="Save Balance"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-[#0f5f5a]">
          <Icon size={19} />
        </div>

        <span className="text-2xl font-semibold text-slate-900">
          {value}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-slate-500">
        {label}
      </p>
    </div>
  );
}

/* =========================================================
   SECTION BUTTON
========================================================= */

function SectionButton({
  active,
  onClick,
  icon: Icon,
  label,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-5 py-4 text-sm font-medium transition ${
        active
          ? "border-[#0f5f5a] text-[#0f5f5a]"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      <Icon size={17} />

      {label}
    </button>
  );
}

/* =========================================================
   LOADING STATE
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2
          size={18}
          className="animate-spin"
        />

        Loading...
      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function FormField({
  label,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>

      {children}
    </label>
  );
}

/* =========================================================
   MODAL
========================================================= */

function Modal({
  title,
  onClose,
  children,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {title}
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL ACTIONS
========================================================= */

function ModalActions({
  onCancel,
  saving,
  submitLabel,
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0b514d] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving && (
          <Loader2
            size={16}
            className="animate-spin"
          />
        )}

        {submitLabel}
      </button>
    </div>
  );
}