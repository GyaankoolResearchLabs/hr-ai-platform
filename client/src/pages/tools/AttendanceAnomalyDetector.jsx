import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Users,
  X,
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

const DEFAULT_SETTINGS = {
  lateThreshold: "10:00",
  maxWorkingHours: 12,
  minWorkingHours: 4,
};

const DISMISSED_ANOMALIES_STORAGE_KEY =
  "attendance_anomaly_detector_dismissed";

/* =========================================================
   DATE HELPERS
========================================================= */

function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const text = String(value).slice(0, 5);

  const parts = text.split(":");

  if (parts.length !== 2) {
    return text;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return text;
  }

  const period = hours >= 12 ? "PM" : "AM";

  const displayHours =
    hours % 12 === 0
      ? 12
      : hours % 12;

  return `${String(displayHours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

function timeToMinutes(value) {
  if (!value) {
    return null;
  }

  const parts = String(value)
    .slice(0, 5)
    .split(":");

  if (parts.length !== 2) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function calculateWorkingHours(
  checkIn,
  checkOut
) {
  const start =
    timeToMinutes(checkIn);

  const end =
    timeToMinutes(checkOut);

  if (
    start === null ||
    end === null
  ) {
    return null;
  }

  let difference = end - start;

  /*
   * Handles overnight shifts.
   */
  if (difference < 0) {
    difference += 24 * 60;
  }

  return difference / 60;
}

function isPastDate(dateValue) {
  if (!dateValue) {
    return false;
  }

  return dateValue < getToday();
}

/* =========================================================
   SETTINGS HELPERS
========================================================= */

function loadSavedSettings() {
  try {
    const saved =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );

    if (!saved) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    console.error(
      "Could not load anomaly detector settings:",
      error
    );

    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );
  } catch (error) {
    console.error(
      "Could not save anomaly detector settings:",
      error
    );
  }
}

/* =========================================================
   SEVERITY
========================================================= */

function severityClass(severity) {
  switch (severity) {
    case SEVERITY.HIGH:
      return "border-red-200 bg-red-50 text-red-700";

    case SEVERITY.MEDIUM:
      return "border-amber-200 bg-amber-50 text-amber-700";

    case SEVERITY.LOW:
      return "border-blue-200 bg-blue-50 text-blue-700";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

/* =========================================================
   ANOMALY ENGINE
========================================================= */

function detectAnomalies(
  attendanceRecords,
  employees,
  leaveRequests,
  settings
) {
  const anomalies = [];

  const employeeMap = {};

  for (const employee of employees) {
    employeeMap[employee.id] = employee;
  }

  const lateThresholdMinutes =
    timeToMinutes(
      settings.lateThreshold
    );

  const maxWorkingHours =
    Number(settings.maxWorkingHours);

  const minWorkingHours =
    Number(settings.minWorkingHours);

  /* =======================================================
     DUPLICATE ATTENDANCE RECORDS
  ======================================================= */

  const duplicateMap = {};

  for (const record of attendanceRecords) {
    const key = `${record.employee_id}_${record.attendance_date}`;

    if (!duplicateMap[key]) {
      duplicateMap[key] = [];
    }

    duplicateMap[key].push(record);
  }

  for (const key of Object.keys(
    duplicateMap
  )) {
    const records =
      duplicateMap[key];

    if (records.length <= 1) {
      continue;
    }

    for (const record of records) {
      const employee =
        employeeMap[record.employee_id];

      anomalies.push({
        id: `duplicate-${record.id}-${key}`,
        employeeId:
          record.employee_id,
        employeeName:
          employee?.full_name ||
          "Unknown Employee",
        department:
          employee?.department ||
          "—",
        date:
          record.attendance_date,
        type: "Duplicate Attendance",
        reason:
          "More than one attendance record exists for the same employee and date.",
        severity:
          SEVERITY.HIGH,
        record,
      });
    }
  }

  /* =======================================================
     RECORD-LEVEL ANOMALIES
  ======================================================= */

  for (const record of attendanceRecords) {
    const employee =
      employeeMap[record.employee_id];

    const employeeName =
      employee?.full_name ||
      "Unknown Employee";

    const department =
      employee?.department ||
      "—";

    const date =
      record.attendance_date;

    /* -------------------------------------------------------
       MISSING CHECK-OUT
    ------------------------------------------------------- */

    if (
      record.check_in &&
      !record.check_out &&
      isPastDate(date) &&
      (
        record.status === "Present" ||
        record.status === "Work From Home"
      )
    ) {
      anomalies.push({
        id: `missing-checkout-${record.id}`,
        employeeId:
          record.employee_id,
        employeeName,
        department,
        date,
        type: "Missing Check-out",
        reason:
          "The employee has a check-in time but no check-out time.",
        severity:
          SEVERITY.HIGH,
        record,
      });
    }

    /* -------------------------------------------------------
       CHECK-OUT WITHOUT CHECK-IN
    ------------------------------------------------------- */

    if (
      !record.check_in &&
      record.check_out
    ) {
      anomalies.push({
        id: `checkout-without-checkin-${record.id}`,
        employeeId:
          record.employee_id,
        employeeName,
        department,
        date,
        type:
          "Check-out Without Check-in",
        reason:
          "A check-out time exists without a corresponding check-in.",
        severity:
          SEVERITY.HIGH,
        record,
      });
    }

    /* -------------------------------------------------------
       LONG WORKING HOURS
    ------------------------------------------------------- */

    const workingHours =
      calculateWorkingHours(
        record.check_in,
        record.check_out
      );

    if (
      workingHours !== null &&
      Number.isFinite(maxWorkingHours) &&
      workingHours >
        maxWorkingHours
    ) {
      anomalies.push({
        id: `long-hours-${record.id}`,
        employeeId:
          record.employee_id,
        employeeName,
        department,
        date,
        type:
          "Unusually Long Workday",
        reason:
          `Recorded working time is ${workingHours.toFixed(
            1
          )} hours, exceeding the ${maxWorkingHours}-hour review threshold.`,
        severity:
          SEVERITY.MEDIUM,
        record,
        workingHours,
      });
    }

    /* -------------------------------------------------------
       SHORT WORKING HOURS
    ------------------------------------------------------- */

    if (
      workingHours !== null &&
      Number.isFinite(minWorkingHours) &&
      workingHours <
        minWorkingHours &&
      record.status === "Present"
    ) {
      anomalies.push({
        id: `short-hours-${record.id}`,
        employeeId:
          record.employee_id,
        employeeName,
        department,
        date,
        type:
          "Unusually Short Workday",
        reason:
          `Recorded working time is only ${workingHours.toFixed(
            1
          )} hours.`,
        severity:
          SEVERITY.MEDIUM,
        record,
        workingHours,
      });
    }

    /* -------------------------------------------------------
       LATE ARRIVAL
    ------------------------------------------------------- */

    const checkInMinutes =
      timeToMinutes(
        record.check_in
      );

    if (
      checkInMinutes !== null &&
      lateThresholdMinutes !== null &&
      checkInMinutes >
        lateThresholdMinutes
    ) {
      anomalies.push({
        id: `late-${record.id}`,
        employeeId:
          record.employee_id,
        employeeName,
        department,
        date,
        type: "Late Arrival",
        reason:
          `Check-in was recorded at ${formatTime(
            record.check_in
          )}, after the ${formatTime(
            settings.lateThreshold
          )} review threshold.`,
        severity:
          SEVERITY.LOW,
        record,
      });
    }

    /* -------------------------------------------------------
       ABSENT WITHOUT APPROVED LEAVE
    ------------------------------------------------------- */

    if (
      record.status === "Absent"
    ) {
      const approvedLeave =
        leaveRequests.some(
          (request) =>
            request.employee_id ===
              record.employee_id &&
            request.status ===
              "Approved" &&
            date >=
              request.start_date &&
            date <=
              request.end_date
        );

      if (!approvedLeave) {
        anomalies.push({
          id: `absence-${record.id}`,
          employeeId:
            record.employee_id,
          employeeName,
          department,
          date,
          type:
            "Unexplained Absence",
          reason:
            "The employee is marked absent and no approved leave request covers this date.",
          severity:
            SEVERITY.MEDIUM,
          record,
        });
      }
    }
  }

  /* =======================================================
     REPEATED LATE ARRIVALS
  ======================================================= */

  const lateByEmployee = {};

  for (const anomaly of anomalies) {
    if (
      anomaly.type !==
      "Late Arrival"
    ) {
      continue;
    }

    if (
      !lateByEmployee[
        anomaly.employeeId
      ]
    ) {
      lateByEmployee[
        anomaly.employeeId
      ] = [];
    }

    lateByEmployee[
      anomaly.employeeId
    ].push(anomaly);
  }

  for (const employeeId of Object.keys(
    lateByEmployee
  )) {
    const lateRecords =
      lateByEmployee[employeeId];

    if (lateRecords.length < 3) {
      continue;
    }

    const employee =
      employeeMap[employeeId];

    anomalies.push({
      id: `repeated-late-${employeeId}`,
      employeeId,
      employeeName:
        employee?.full_name ||
        "Unknown Employee",
      department:
        employee?.department ||
        "—",
      date:
        lateRecords[
          lateRecords.length - 1
        ]?.date,
      type:
        "Repeated Late Arrivals",
      reason:
        `${lateRecords.length} late arrivals were detected in the available attendance history.`,
      severity:
        SEVERITY.MEDIUM,
      record:
        lateRecords[
          lateRecords.length - 1
        ]?.record,
    });
  }

  /* =======================================================
     SORT
  ======================================================= */

  const severityRank = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  return anomalies.sort(
    (a, b) => {
      const severityDifference =
        severityRank[a.severity] -
        severityRank[b.severity];

      if (
        severityDifference !== 0
      ) {
        return severityDifference;
      }

      return String(
        b.date
      ).localeCompare(
        String(a.date)
      );
    }
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function AttendanceAnomalyDetector() {
  const navigate = useNavigate();

  const [employees, setEmployees] =
    useState([]);

  const [attendance, setAttendance] =
    useState([]);

  const [leaveRequests, setLeaveRequests] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [severityFilter, setSeverityFilter] =
    useState("All");

  const [selectedAnomaly, setSelectedAnomaly] =
    useState(null);
   const [dismissedAnomalies, setDismissedAnomalies] =
  useState(() => {
    try {
      const saved = localStorage.getItem(
        DISMISSED_ANOMALIES_STORAGE_KEY
      );

      return saved
        ? JSON.parse(saved)
        : [];
    } catch (error) {
      console.error(
        "Could not load dismissed anomalies:",
        error
      );

      return [];
    }
  });
  /* =========================================================
     DETECTION SETTINGS
  ========================================================= */

  const [settings, setSettings] =
    useState(() =>
      loadSavedSettings()
    );

  const [draftSettings, setDraftSettings] =
    useState(() =>
      loadSavedSettings()
    );

  const [showSettings, setShowSettings] =
    useState(false);

  const [settingsSaved, setSettingsSaved] =
    useState(false);

  /* =========================================================
     LOAD DATA
  ========================================================= */
  function handleDismissAnomaly(anomaly) {
  if (!anomaly?.id) {
    return;
  }

  setDismissedAnomalies((current) => {
    if (current.includes(anomaly.id)) {
      return current;
    }

    const updated = [
      ...current,
      anomaly.id,
    ];

    localStorage.setItem(
      DISMISSED_ANOMALIES_STORAGE_KEY,
      JSON.stringify(updated)
    );

    return updated;
  });

  if (
    selectedAnomaly?.id === anomaly.id
  ) {
    setSelectedAnomaly(null);
  }
}
  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [
        employeeData,
        attendanceData,
        leaveData,
      ] = await Promise.all([
        employeeService.list(),

        /*
         * Correct service method:
         * getAttendance()
         */
        attendanceLeaveService.getAttendance(),

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

      setLeaveRequests(
        Array.isArray(leaveData)
          ? leaveData
          : []
      );
    } catch (err) {
      console.error(
        "Attendance anomaly detector error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not analyze attendance records."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     SETTINGS
  ========================================================= */

  function handleSaveSettings() {
    const threshold =
      timeToMinutes(
        draftSettings.lateThreshold
      );

    const maxHours = Number(
      draftSettings.maxWorkingHours
    );

    const minHours = Number(
      draftSettings.minWorkingHours
    );

    if (threshold === null) {
      setError(
        "Please enter a valid late arrival time."
      );
      return;
    }

    if (
      !Number.isFinite(maxHours) ||
      maxHours <= 0
    ) {
      setError(
        "Maximum working hours must be greater than 0."
      );
      return;
    }

    if (
      !Number.isFinite(minHours) ||
      minHours < 0
    ) {
      setError(
        "Minimum working hours cannot be negative."
      );
      return;
    }

    if (minHours >= maxHours) {
      setError(
        "Minimum working hours must be less than maximum working hours."
      );
      return;
    }

    const newSettings = {
      lateThreshold:
        draftSettings.lateThreshold,
      maxWorkingHours:
        maxHours,
      minWorkingHours:
        minHours,
    };

    setSettings(newSettings);
    saveSettings(newSettings);

    setSettingsSaved(true);
    setError("");

    setTimeout(() => {
      setSettingsSaved(false);
    }, 2500);
  }

  function handleResetSettings() {
    setDraftSettings(
      DEFAULT_SETTINGS
    );

    setSettings(
      DEFAULT_SETTINGS
    );

    saveSettings(
      DEFAULT_SETTINGS
    );

    setSettingsSaved(true);
    setError("");

    setTimeout(() => {
      setSettingsSaved(false);
    }, 2500);
  }

  /* =========================================================
     DETECT ANOMALIES
  ========================================================= */

 const anomalies = useMemo(() => {
  const detected = detectAnomalies(
    attendance,
    employees,
    leaveRequests,
    settings
  );

  return detected.filter(
    (anomaly) =>
      !dismissedAnomalies.includes(
        anomaly.id
      )
  );
}, [
  attendance,
  employees,
  leaveRequests,
  settings,
  dismissedAnomalies,
]);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredAnomalies =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return anomalies.filter(
        (anomaly) => {
          const matchesSearch =
            !query ||
            anomaly.employeeName
              .toLowerCase()
              .includes(query) ||
            anomaly.department
              .toLowerCase()
              .includes(query) ||
            anomaly.type
              .toLowerCase()
              .includes(query) ||
            anomaly.reason
              .toLowerCase()
              .includes(query);

          const matchesSeverity =
            severityFilter ===
              "All" ||
            anomaly.severity ===
              severityFilter;

          return (
            matchesSearch &&
            matchesSeverity
          );
        }
      );
    }, [
      anomalies,
      search,
      severityFilter,
    ]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const highCount =
    anomalies.filter(
      (item) =>
        item.severity === "High"
    ).length;

  const mediumCount =
    anomalies.filter(
      (item) =>
        item.severity === "Medium"
    ).length;

  const lowCount =
    anomalies.filter(
      (item) =>
        item.severity === "Low"
    ).length;

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
            onClick={() =>
              navigate(-1)
            }
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
            <CalendarDays size={18} />

            Attendance & Leave
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Attendance Anomaly Detector
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Find unusual attendance records
            that may require HR review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setShowSettings(
                (value) => !value
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Settings2 size={16} />
            Detection Settings
          </button>

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
        </div>
      </div>

      {/* =====================================================
          DETECTION SETTINGS
      ===================================================== */}

      {showSettings && (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Detection Settings
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Configure when attendance records
                  should be flagged for HR review.
                </p>
              </div>

              <Settings2
                size={20}
                className="text-[#0f5f5a]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-3">
            {/* Late Arrival */}

            <div>
              <label className="text-sm font-medium text-slate-800">
                Late arrival threshold
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Employees checking in after this
                time are flagged as late.
              </p>

              <input
                type="time"
                value={
                  draftSettings.lateThreshold
                }
                onChange={(event) =>
                  setDraftSettings(
                    (current) => ({
                      ...current,
                      lateThreshold:
                        event.target.value,
                    })
                  )
                }
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f5f5a] focus:ring-1 focus:ring-[#0f5f5a]"
              />

              <p className="mt-2 text-xs text-slate-400">
                Current:{" "}
                {formatTime(
                  settings.lateThreshold
                )}
              </p>
            </div>

            {/* Maximum Hours */}

            <div>
              <label className="text-sm font-medium text-slate-800">
                Maximum working hours
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Workdays exceeding this duration
                are flagged.
              </p>

              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={
                  draftSettings.maxWorkingHours
                }
                onChange={(event) =>
                  setDraftSettings(
                    (current) => ({
                      ...current,
                      maxWorkingHours:
                        event.target.value,
                    })
                  )
                }
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f5f5a] focus:ring-1 focus:ring-[#0f5f5a]"
              />

              <p className="mt-2 text-xs text-slate-400">
                Current:{" "}
                {settings.maxWorkingHours}{" "}
                hours
              </p>
            </div>

            {/* Minimum Hours */}

            <div>
              <label className="text-sm font-medium text-slate-800">
                Minimum working hours
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Present employees working below
                this duration are flagged.
              </p>

              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={
                  draftSettings.minWorkingHours
                }
                onChange={(event) =>
                  setDraftSettings(
                    (current) => ({
                      ...current,
                      minWorkingHours:
                        event.target.value,
                    })
                  )
                }
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f5f5a] focus:ring-1 focus:ring-[#0f5f5a]"
              />

              <p className="mt-2 text-xs text-slate-400">
                Current:{" "}
                {settings.minWorkingHours}{" "}
                hours
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {settingsSaved && (
                <p className="text-sm font-medium text-emerald-600">
                  Detection settings saved.
                </p>
              )}

              {!settingsSaved && (
                <p className="text-xs text-slate-400">
                  Settings are saved in this
                  browser and applied immediately
                  to anomaly detection.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={
                  handleResetSettings
                }
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Reset defaults
              </button>

              <button
                type="button"
                onClick={
                  handleSaveSettings
                }
                className="rounded-xl bg-[#0f5f5a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0b514d]"
              >
                Save Settings
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
            className="ml-auto"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Records Analyzed"
          value={attendance.length}
          icon={Users}
        />

        <SummaryCard
          label="High Severity"
          value={highCount}
          icon={ShieldAlert}
        />

        <SummaryCard
          label="Medium Severity"
          value={mediumCount}
          icon={AlertTriangle}
        />

        <SummaryCard
          label="Low Severity"
          value={lowCount}
          icon={Clock3}
        />
      </div>

      {/* =====================================================
          CURRENT RULES
      ===================================================== */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0f5f5a]/10 text-[#0f5f5a]">
              <ShieldAlert size={20} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                What is being checked?
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                The detector reviews attendance
                history for missing check-outs,
                unusual working hours, late
                arrivals, duplicate records and
                unexplained absences.
              </p>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Late arrival rule
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              After{" "}
              {formatTime(
                settings.lateThreshold
              )}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Detected Anomalies
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Review records that may require
              human attention.
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
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#0f5f5a] sm:w-60"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0f5f5a]"
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

        {loading ? (
          <LoadingState />
        ) : filteredAnomalies.length ===
          0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Employee
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Anomaly
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Severity
                  </th>

                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Details
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredAnomalies.map(
                  (anomaly) => (
                    <tr
                      key={anomaly.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {
                            anomaly.employeeName
                          }
                        </div>

                        <div className="mt-0.5 text-xs text-slate-500">
                          {
                            anomaly.department
                          }
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(
                          anomaly.date
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-slate-800">
                          {anomaly.type}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${severityClass(
                            anomaly.severity
                          )}`}
                        >
                          {
                            anomaly.severity
                          }
                        </span>
                      </td>

                      <td className="max-w-md px-5 py-4">
                        <p className="text-sm leading-5 text-slate-600">
                          {
                            anomaly.reason
                          }
                        </p>
                      </td>

                      <td className="px-5 py-4 text-right">
  <div className="flex items-center justify-end gap-2">
    {/* REVIEW */}
    <button
      type="button"
      onClick={() =>
        setSelectedAnomaly(anomaly)
      }
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Eye size={14} />
      Review
    </button>

    {/* DISMISS */}
    <button
      type="button"
      onClick={() =>
        handleDismissAnomaly(anomaly)
      }
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
      title="Dismiss this anomaly without changing attendance data"
    >
      <CheckCircle2 size={14} />
      Dismiss
    </button>
  </div>
</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* =====================================================
          REVIEW MODAL
      ===================================================== */}

      {selectedAnomaly && (
        <ReviewModal
          anomaly={selectedAnomaly}
          lateThreshold={
            settings.lateThreshold
          }
          onClose={() =>
            setSelectedAnomaly(null)
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
   LOADING
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-[260px] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2
          size={18}
          className="animate-spin"
        />

        Analyzing attendance...
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY
========================================================= */

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={24} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900">
        No anomalies detected
      </h3>

      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
        The available attendance records
        currently do not contain patterns that
        meet the configured anomaly thresholds.
      </p>
    </div>
  );
}

/* =========================================================
   REVIEW MODAL
========================================================= */

function ReviewModal({
  anomaly,
  lateThreshold,
  onClose,
}) {
  const record =
    anomaly.record;

  const workingHours =
    calculateWorkingHours(
      record?.check_in,
      record?.check_out
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Review Attendance Anomaly
            </h3>

            <p className="mt-0.5 text-sm text-slate-500">
              {anomaly.employeeName}
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

        <div className="space-y-5 p-5">
          {/* Severity */}

          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Severity
              </p>

              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${severityClass(
                  anomaly.severity
                )}`}
              >
                {anomaly.severity}
              </span>
            </div>

            <AlertTriangle
              size={22}
              className="text-slate-400"
            />
          </div>

          {/* Problem */}

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Detected anomaly
            </p>

            <p className="mt-1 text-base font-semibold text-slate-900">
              {anomaly.type}
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {anomaly.reason}
            </p>

            {anomaly.type ===
              "Late Arrival" && (
              <p className="mt-2 text-xs text-slate-400">
                Current configured threshold:{" "}
                {formatTime(
                  lateThreshold
                )}
              </p>
            )}
          </div>

          {/* Attendance details */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailItem
              label="Employee"
              value={
                anomaly.employeeName
              }
            />

            <DetailItem
              label="Department"
              value={
                anomaly.department
              }
            />

            <DetailItem
              label="Date"
              value={formatDate(
                anomaly.date
              )}
            />

            <DetailItem
              label="Status"
              value={
                record?.status ||
                "—"
              }
            />

            <DetailItem
              label="Check-in"
              value={formatTime(
                record?.check_in
              )}
            />

            <DetailItem
              label="Check-out"
              value={formatTime(
                record?.check_out
              )}
            />

            {workingHours !==
              null && (
              <DetailItem
                label="Working time"
                value={`${workingHours.toFixed(
                  1
                )} hours`}
              />
            )}
          </div>

          {/* Notes */}

          {record?.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Attendance notes
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {record.notes}
              </p>
            </div>
          )}

          {/* HR instruction */}

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">
              HR review required
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-700">
              This detector only identifies
              unusual records. It does not
              automatically change attendance
              data or make an HR decision.
            </p>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DETAIL ITEM
========================================================= */

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}