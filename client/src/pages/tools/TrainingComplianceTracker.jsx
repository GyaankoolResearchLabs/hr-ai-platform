import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Download,
  Filter,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        config.headers =
          config.headers || {};

        config.headers.Authorization =
          `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error(
        "[TrainingCompliance] Auth token error:",
        error
      );
    }

    return config;
  }
);

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function getId(value) {
  return (
    value?.id ||
    value?._id ||
    value?.employee_id ||
    value?.employeeId ||
    null
  );
}

function getEmployeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    `${employee?.first_name || ""} ${
      employee?.last_name || ""
    }`.trim() ||
    "Unnamed employee"
  );
}

function getEmployeeTitle(employee) {
  return (
    employee?.title ||
    employee?.job_title ||
    employee?.designation ||
    "Employee"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "No department"
  );
}

function getCourseId(course) {
  return (
    course?.id ||
    course?._id ||
    course?.course_id ||
    course?.courseId ||
    null
  );
}

function getCourseTitle(course) {
  return (
    course?.title ||
    course?.course_title ||
    course?.courseTitle ||
    course?.name ||
    "Untitled training"
  );
}

function getAssignmentEmployeeId(
  assignment
) {
  return (
    assignment?.employee_id ||
    assignment?.employeeId ||
    assignment?.employee?.id ||
    assignment?.employee?._id ||
    null
  );
}

function getAssignmentCourseId(
  assignment
) {
  return (
    assignment?.course_id ||
    assignment?.courseId ||
    assignment?.course?.id ||
    assignment?.course?._id ||
    null
  );
}

function getAssignmentDueDate(
  assignment
) {
  return (
    assignment?.due_date ||
    assignment?.dueDate ||
    null
  );
}

function getProgressEmployeeId(
  progress
) {
  return (
    progress?.employee_id ||
    progress?.employeeId ||
    progress?.employee?.id ||
    null
  );
}

function getProgressCourseId(
  progress
) {
  return (
    progress?.course_id ||
    progress?.courseId ||
    progress?.course?.id ||
    null
  );
}

function getProgressValue(progress) {
  const value =
    progress?.progress_percentage ??
    progress?.progress_percent ??
    progress?.progress ??
    progress?.completion_percentage ??
    progress?.completionPercent ??
    0;

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(number)
    )
  );
}

function getCompletedAt(progress) {
  return (
    progress?.completed_at ||
    progress?.completedAt ||
    progress?.completion_date ||
    null
  );
}

function extractRows(
  payload,
  key
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    Array.isArray(payload?.[key])
  ) {
    return payload[key];
  }

  if (
    Array.isArray(payload?.data)
  ) {
    return payload.data;
  }

  return [];
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
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

function todayString() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

function isPast(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  date.setHours(
    23,
    59,
    59,
    999
  );

  return date < new Date();
}

function normalizeStatus(
  assignment,
  progress
) {
  const progressValue =
    getProgressValue(progress);

  const completedAt =
    getCompletedAt(progress) ||
    assignment?.completed_at ||
    assignment?.completedAt ||
    null;

  if (
    progressValue >= 100 ||
    completedAt
  ) {
    return "completed";
  }

  const dueDate =
    getAssignmentDueDate(
      assignment
    );

  if (
    dueDate &&
    isPast(dueDate)
  ) {
    return "overdue";
  }

  if (progressValue > 0) {
    return "in_progress";
  }

  return "not_started";
}

function formatStatus(status) {
  return {
    completed: "Completed",
    in_progress: "In progress",
    overdue: "Overdue",
    not_started: "Not started",
  }[status] || "Not started";
}

function statusClass(status) {
  return {
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    in_progress:
      "border-blue-200 bg-blue-50 text-blue-700",

    overdue:
      "border-red-200 bg-red-50 text-red-700",

    not_started:
      "border-amber-200 bg-amber-50 text-amber-700",
  }[status] ||
    "border-slate-200 bg-slate-50 text-slate-600";
}

function csvEscape(value) {
  const text = String(
    value ?? ""
  );

  return `"${text.replace(
    /"/g,
    '""'
  )}"`;
}

/*
|--------------------------------------------------------------------------
| COMPONENT
|--------------------------------------------------------------------------
*/

export default function TrainingComplianceTracker() {
  const navigate = useNavigate();

  const [employees, setEmployees] =
    useState([]);

  const [courses, setCourses] =
    useState([]);

  const [assignments, setAssignments] =
    useState([]);

  const [progressRows, setProgressRows] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState("");

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [activeView, setActiveView] =
    useState("overview");

  const [search, setSearch] =
    useState("");

  const [departmentFilter, setDepartmentFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [courseFilter, setCourseFilter] =
    useState("all");

  const [
    expandedEmployeeId,
    setExpandedEmployeeId,
  ] = useState(null);

  const [
    showAssignModal,
    setShowAssignModal,
  ] = useState(false);

  const [
    assignmentEmployeeId,
    setAssignmentEmployeeId,
  ] = useState("");

  const [
    assignmentCourseId,
    setAssignmentCourseId,
  ] = useState("");

  const [
    assignmentDueDate,
    setAssignmentDueDate,
  ] = useState("");

  const [
    assignmentSearch,
    setAssignmentSearch,
  ] = useState("");

  const [
    courseSearch,
    setCourseSearch,
  ] = useState("");

  /*
  |--------------------------------------------------------------------------
  | LOAD DATA
  |--------------------------------------------------------------------------
  */

  async function loadData(
    showRefresh = false
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setNotice("");

      const response =
        await api.get(
          "/training-compliance"
        );

      const data =
        response?.data || {};

      setEmployees(
        Array.isArray(
          data.employees
        )
          ? data.employees
          : []
      );

      setCourses(
        Array.isArray(
          data.courses
        )
          ? data.courses
          : []
      );

      setAssignments(
        Array.isArray(
          data.assignments
        )
          ? data.assignments
          : []
      );

      setProgressRows(
        Array.isArray(
          data.progress
        )
          ? data.progress
          : []
      );
    } catch (err) {
      console.error(
        "[TrainingCompliance] Load failed:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Could not load training compliance data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | MAPS
  |--------------------------------------------------------------------------
  */

  const employeeMap =
    useMemo(() => {
      const map = new Map();

      employees.forEach(
        (employee) => {
          const id =
            getId(employee);

          if (id) {
            map.set(
              String(id),
              employee
            );
          }
        }
      );

      return map;
    }, [employees]);

  const courseMap =
    useMemo(() => {
      const map = new Map();

      courses.forEach(
        (course) => {
          const id =
            getCourseId(course);

          if (id) {
            map.set(
              String(id),
              course
            );
          }
        }
      );

      return map;
    }, [courses]);

  const progressMap =
    useMemo(() => {
      const map = new Map();

      progressRows.forEach(
        (progress) => {
          const employeeId =
            getProgressEmployeeId(
              progress
            );

          const courseId =
            getProgressCourseId(
              progress
            );

          if (
            !employeeId ||
            !courseId
          ) {
            return;
          }

          map.set(
            `${employeeId}:${courseId}`,
            progress
          );
        }
      );

      return map;
    }, [progressRows]);

  /*
  |--------------------------------------------------------------------------
  | NORMALIZED RECORDS
  |--------------------------------------------------------------------------
  */

  const records =
    useMemo(() => {
      return assignments
        .map((assignment) => {
          const employeeId =
            getAssignmentEmployeeId(
              assignment
            );

          const courseId =
            getAssignmentCourseId(
              assignment
            );

          if (
            !employeeId ||
            !courseId
          ) {
            return null;
          }

          const employee =
            employeeMap.get(
              String(employeeId)
            ) ||
            assignment?.employee ||
            null;

          const course =
            courseMap.get(
              String(courseId)
            ) ||
            assignment?.course ||
            null;

          if (
            !employee ||
            !course
          ) {
            return null;
          }

          const progress =
            progressMap.get(
              `${employeeId}:${courseId}`
            ) || null;

          return {
            id:
              assignment?.id ||
              assignment?._id ||
              `${employeeId}-${courseId}`,

            employeeId,

            courseId,

            employee,

            course,

            employeeName:
              getEmployeeName(
                employee
              ),

            department:
              getEmployeeDepartment(
                employee
              ),

            title:
              getEmployeeTitle(
                employee
              ),

            courseTitle:
              getCourseTitle(
                course
              ),

            progress:
              getProgressValue(
                progress ||
                  assignment
              ),

            status:
              normalizeStatus(
                assignment,
                progress
              ),

            dueDate:
              getAssignmentDueDate(
                assignment
              ),

            completedAt:
              getCompletedAt(
                progress
              ) ||
              assignment?.completed_at ||
              assignment?.completedAt ||
              null,

            assignedAt:
              assignment?.assigned_at ||
              assignment?.assignedAt ||
              assignment?.created_at ||
              assignment?.createdAt ||
              null,

            /*
             * IMPORTANT:
             * All assignments are mandatory because the current
             * database does not contain is_mandatory.
             */
            mandatory: true,

            assignment,

            progressRow: progress,
          };
        })
        .filter(Boolean);
    }, [
      assignments,
      employeeMap,
      courseMap,
      progressMap,
    ]);

  /*
  |--------------------------------------------------------------------------
  | FILTERS
  |--------------------------------------------------------------------------
  */

  const departments =
    useMemo(() => {
      return [
        ...new Set(
          employees
            .map(
              getEmployeeDepartment
            )
            .filter(Boolean)
        ),
      ].sort();
    }, [employees]);

  const filteredRecords =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          if (
            departmentFilter !==
              "all" &&
            record.department !==
              departmentFilter
          ) {
            return false;
          }

          if (
            statusFilter !==
              "all" &&
            record.status !==
              statusFilter
          ) {
            return false;
          }

          if (
            courseFilter !==
              "all" &&
            String(
              record.courseId
            ) !==
              String(courseFilter)
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            record.employeeName
              .toLowerCase()
              .includes(query) ||

            record.department
              .toLowerCase()
              .includes(query) ||

            record.title
              .toLowerCase()
              .includes(query) ||

            record.courseTitle
              .toLowerCase()
              .includes(query)
          );
        }
      );
    }, [
      records,
      search,
      departmentFilter,
      statusFilter,
      courseFilter,
    ]);

  /*
  |--------------------------------------------------------------------------
  | EMPLOYEE SUMMARY
  |--------------------------------------------------------------------------
  */

  const employeeCompliance =
    useMemo(() => {
      return employees
        .map((employee) => {
          const employeeId =
            getId(employee);

          const employeeRecords =
            records.filter(
              (record) =>
                String(
                  record.employeeId
                ) ===
                String(employeeId)
            );

          const completed =
            employeeRecords.filter(
              (record) =>
                record.status ===
                "completed"
            ).length;

          const inProgress =
            employeeRecords.filter(
              (record) =>
                record.status ===
                "in_progress"
            ).length;

          const overdue =
            employeeRecords.filter(
              (record) =>
                record.status ===
                "overdue"
            ).length;

          const total =
            employeeRecords.length;

          const rate =
            total > 0
              ? Math.round(
                  employeeRecords.reduce(
                    (
                      sum,
                      record
                    ) =>
                      sum +
                      record.progress,
                    0
                  ) / total
                )
              : 0;

          return {
            employee,

            employeeId,

            records:
              employeeRecords,

            completed,

            inProgress,

            overdue,

            total,

            rate,
          };
        })
        .filter((item) => {
          const query =
            search
              .trim()
              .toLowerCase();

          if (!query) {
            return true;
          }

          return (
            getEmployeeName(
              item.employee
            )
              .toLowerCase()
              .includes(query) ||

            getEmployeeDepartment(
              item.employee
            )
              .toLowerCase()
              .includes(query) ||

            getEmployeeTitle(
              item.employee
            )
              .toLowerCase()
              .includes(query)
          );
        });
    }, [
      employees,
      records,
      search,
    ]);

  /*
  |--------------------------------------------------------------------------
  | STATS
  |--------------------------------------------------------------------------
  */

  const stats =
    useMemo(() => {
      const completed =
        records.filter(
          (record) =>
            record.status ===
            "completed"
        ).length;

      const inProgress =
        records.filter(
          (record) =>
            record.status ===
            "in_progress"
        ).length;

      const overdue =
        records.filter(
          (record) =>
            record.status ===
            "overdue"
        ).length;

      const employeesWithTraining =
        new Set(
          records.map(
            (record) =>
              String(
                record.employeeId
              )
          )
        ).size;

      return {
        employeesWithTraining,

        completed,

        inProgress,

        overdue,

        total:
          records.length,
      };
    }, [records]);

  /*
  |--------------------------------------------------------------------------
  | MODAL SEARCH
  |--------------------------------------------------------------------------
  */

  const filteredAssignmentEmployees =
    useMemo(() => {
      const query =
        assignmentSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return employees;
      }

      return employees.filter(
        (employee) =>
          getEmployeeName(
            employee
          )
            .toLowerCase()
            .includes(query) ||

          getEmployeeTitle(
            employee
          )
            .toLowerCase()
            .includes(query) ||

          getEmployeeDepartment(
            employee
          )
            .toLowerCase()
            .includes(query) ||

          String(
            employee?.email ||
              ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      employees,
      assignmentSearch,
    ]);

  const filteredAssignmentCourses =
    useMemo(() => {
      const query =
        courseSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return courses;
      }

      return courses.filter(
        (course) =>
          getCourseTitle(
            course
          )
            .toLowerCase()
            .includes(query) ||

          String(
            course?.description ||
              ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      courses,
      courseSearch,
    ]);

  /*
  |--------------------------------------------------------------------------
  | ACTIONS
  |--------------------------------------------------------------------------
  */

  function openAssignModal(
    employeeId = ""
  ) {
    setError("");
    setNotice("");

    setAssignmentEmployeeId(
      employeeId
        ? String(employeeId)
        : ""
    );

    setAssignmentCourseId("");

    setAssignmentDueDate("");

    setAssignmentSearch("");

    setCourseSearch("");

    setShowAssignModal(true);
  }

  function closeAssignModal() {
    if (saving) {
      return;
    }

    setShowAssignModal(false);
  }

  function clearFilters() {
    setSearch("");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setCourseFilter("all");
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  async function createAssignment() {
    if (!assignmentEmployeeId) {
      setError(
        "Select an employee first."
      );
      return;
    }

    if (!assignmentCourseId) {
      setError(
        "Select a training course first."
      );
      return;
    }

    const duplicate =
      assignments.some(
        (assignment) =>
          String(
            getAssignmentEmployeeId(
              assignment
            )
          ) ===
            String(
              assignmentEmployeeId
            ) &&
          String(
            getAssignmentCourseId(
              assignment
            )
          ) ===
            String(
              assignmentCourseId
            )
      );

    if (duplicate) {
      setError(
        "This course is already assigned to this employee."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const response =
        await api.post(
          "/training-compliance/assignments",
          {
            employee_id:
              assignmentEmployeeId,

            course_id:
              assignmentCourseId,

            due_date:
              assignmentDueDate ||
              null,
          }
        );

      const created =
        response?.data
          ?.assignment;

      if (!created) {
        throw new Error(
          "The server did not return the created assignment."
        );
      }

      setAssignments(
        (current) => [
          created,
          ...current,
        ]
      );

      setNotice(
        "Training assigned successfully."
      );

      setShowAssignModal(false);

      setAssignmentEmployeeId(
        ""
      );

      setAssignmentCourseId(
        ""
      );

      setAssignmentDueDate("");

      setActiveView(
        "records"
      );
    } catch (err) {
      console.error(
        "[TrainingCompliance] Assignment failed:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Could not assign this training."
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE ASSIGNMENT
  |--------------------------------------------------------------------------
  */

  async function deleteAssignment(
    assignmentId
  ) {
    if (!assignmentId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Remove this training assignment?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        String(assignmentId)
      );

      setError("");
      setNotice("");

      await api.delete(
        `/training-compliance/assignments/${assignmentId}`
      );

      setAssignments(
        (current) =>
          current.filter(
            (assignment) =>
              String(
                assignment?.id ||
                  assignment?._id
              ) !==
              String(assignmentId)
          )
      );

      setNotice(
        "Training assignment removed."
      );
    } catch (err) {
      console.error(
        "[TrainingCompliance] Delete failed:",
        err
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Could not remove the training assignment."
      );
    } finally {
      setDeletingId("");
    }
  }

  /*
  |--------------------------------------------------------------------------
  | EXPORT
  |--------------------------------------------------------------------------
  */

  function exportAuditReport() {
    const headers = [
      "Employee",
      "Email",
      "Department",
      "Role",
      "Training",
      "Mandatory",
      "Status",
      "Progress",
      "Assigned On",
      "Due Date",
      "Completed On",
    ];

    const rows =
      filteredRecords.map(
        (record) => ({
          Employee:
            record.employeeName,

          Email:
            record.employee?.email ||
            "",

          Department:
            record.department,

          Role:
            record.title,

          Training:
            record.courseTitle,

          Mandatory:
            "Yes",

          Status:
            formatStatus(
              record.status
            ),

          Progress:
            `${record.progress}%`,

          "Assigned On":
            formatDate(
              record.assignedAt
            ),

          "Due Date":
            formatDate(
              record.dueDate
            ),

          "Completed On":
            formatDate(
              record.completedAt
            ),
        })
      );

    const csv = [
      headers
        .map(csvEscape)
        .join(","),

      ...rows.map(
        (row) =>
          headers
            .map(
              (header) =>
                csvEscape(
                  row[header]
                )
            )
            .join(",")
      ),
    ].join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8;",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `training-compliance-report-${todayString()}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
      url
    );

    setNotice(
      "Compliance report exported successfully."
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SMALL COMPONENTS
  |--------------------------------------------------------------------------
  */

  function StatusBadge({
    status,
  }) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
          status
        )}`}
      >
        {formatStatus(status)}
      </span>
    );
  }

  function ProgressBar({
    value,
  }) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all duration-300"
            style={{
              width: `${value}%`,
            }}
          />
        </div>

        <span className="w-10 text-right text-xs font-semibold text-slate-600">
          {value}%
        </span>
      </div>
    );
  }

  function StatCard({
    label,
    value,
    detail,
    icon: Icon,
    onClick,
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {label}
            </p>

            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {value}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {detail}
            </p>
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <Icon size={19} />
          </div>
        </div>
      </button>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <div className="min-h-full bg-[#f5f7f7] p-6">
        <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
            <Loader2
              size={18}
              className="animate-spin"
            />

            Loading training compliance data...
          </div>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RENDER
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-w-0 bg-[#f5f7f7] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">

        {/* HEADER */}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              navigate(-1)
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft
              size={16}
            />

            Back
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                loadData(true)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={
                exportAuditReport
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              <Download
                size={16}
              />

              Export report
            </button>
          </div>
        </div>

        {/* TITLE */}

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
            <ShieldCheck
              size={25}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Training Compliance Tracker
              </h1>

              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                L&D
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500 sm:text-base">
              Track employee training completion and identify compliance gaps before audits.
            </p>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                Something went wrong
              </p>

              <p className="mt-1 break-words">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="rounded-md p-1 hover:bg-red-100"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* SUCCESS */}

        {notice && (
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
            />

            <span>
              {notice}
            </span>

            <button
              type="button"
              className="ml-auto rounded-md p-1 hover:bg-emerald-100"
              onClick={() =>
                setNotice("")
              }
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* STATS */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Employees"
            value={
              stats.employeesWithTraining
            }
            detail="Employees with assigned training"
            icon={Users}
            onClick={() => {
              setActiveView(
                "employees"
              );
              setSearch("");
            }}
          />

          <StatCard
            label="Completed"
            value={
              stats.completed
            }
            detail="Training requirements completed"
            icon={CheckCircle2}
            onClick={() => {
              setActiveView(
                "records"
              );
              setStatusFilter(
                "completed"
              );
            }}
          />

          <StatCard
            label="In progress"
            value={
              stats.inProgress
            }
            detail="Training currently underway"
            icon={BarChart3}
            onClick={() => {
              setActiveView(
                "records"
              );
              setStatusFilter(
                "in_progress"
              );
            }}
          />

          <StatCard
            label="Non-compliant"
            value={
              stats.overdue
            }
            detail="Employees with overdue training"
            icon={AlertCircle}
            onClick={() => {
              setActiveView(
                "records"
              );
              setStatusFilter(
                "overdue"
              );
            }}
          />
        </div>

        {/* TABS */}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {[
            [
              "overview",
              "Overview",
              BarChart3,
            ],
            [
              "records",
              "Training records",
              ClipboardCheck,
            ],
            [
              "employees",
              "Employees",
              Users,
            ],
            [
              "training",
              "Training programs",
              GraduationCap,
            ],
          ].map(
            ([
              value,
              label,
              Icon,
            ]) => (
              <button
                type="button"
                key={value}
                onClick={() =>
                  setActiveView(
                    value
                  )
                }
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  activeView ===
                  value
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon
                  size={16}
                />

                {label}
              </button>
            )
          )}

          <button
            type="button"
            onClick={() =>
              openAssignModal()
            }
            className="ml-auto inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Plus
              size={16}
            />

            Assign training
          </button>
        </div>

        {/* OVERVIEW */}

        {activeView ===
          "overview" && (
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Compliance by employee
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      See who is compliant and who needs attention.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveView(
                        "employees"
                      )
                    }
                    className="text-sm font-medium text-teal-700 hover:text-teal-800"
                  >
                    View all employees
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {employeeCompliance
                  .slice(0, 8)
                  .map(
                    (item) => (
                      <button
                        type="button"
                        key={String(
                          item.employeeId
                        )}
                        onClick={() => {
                          setActiveView(
                            "employees"
                          );

                          setSearch(
                            ""
                          );

                          setExpandedEmployeeId(
                            item.employeeId
                          );
                        }}
                        className="flex w-full flex-col gap-3 px-5 py-4 text-left hover:bg-slate-50 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {getEmployeeName(
                              item.employee
                            )
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {getEmployeeName(
                                item.employee
                              )}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {getEmployeeTitle(
                                item.employee
                              )}{" "}
                              ·{" "}
                              {getEmployeeDepartment(
                                item.employee
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="w-full sm:w-56">
                          <ProgressBar
                            value={
                              item.rate
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3 sm:w-32 sm:justify-end">
                          <span className="text-xs text-slate-500">
                            {item.completed}/
                            {item.total}{" "}
                            complete
                          </span>

                          {item.overdue >
                            0 && (
                            <span className="text-xs font-semibold text-red-600">
                              {item.overdue}{" "}
                              overdue
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  )}

                {employeeCompliance.length ===
                  0 && (
                  <div className="px-6 py-16 text-center">
                    <Users
                      className="mx-auto text-slate-300"
                      size={34}
                    />

                    <p className="mt-4 text-sm font-semibold text-slate-700">
                      No employee training assignments yet
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Use Assign training to start compliance tracking.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        openAssignModal()
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      <Plus
                        size={16}
                      />

                      Assign training
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ATTENTION */}

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  Attention required
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Training that needs HR or manager follow-up.
                </p>
              </div>

              <div className="space-y-3 p-5">
                {records
                  .filter(
                    (record) =>
                      record.status ===
                        "overdue" ||
                      record.status ===
                        "not_started"
                  )
                  .slice(0, 7)
                  .map(
                    (record) => (
                      <button
                        type="button"
                        key={String(
                          record.id
                        )}
                        onClick={() => {
                          setActiveView(
                            "records"
                          );

                          setSearch(
                            record.employeeName
                          );
                        }}
                        className="w-full rounded-xl border border-slate-200 p-4 text-left hover:border-slate-300 hover:bg-slate-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {
                                record.courseTitle
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              {
                                record.employeeName
                              }{" "}
                              ·{" "}
                              {
                                record.department
                              }
                            </p>
                          </div>

                          <StatusBadge
                            status={
                              record.status
                            }
                          />
                        </div>

                        <div className="mt-3">
                          <ProgressBar
                            value={
                              record.progress
                            }
                          />
                        </div>

                        {record.dueDate && (
                          <p className="mt-2 text-xs text-slate-500">
                            Due{" "}
                            {formatDate(
                              record.dueDate
                            )}
                          </p>
                        )}
                      </button>
                    )
                  )}

                {records.filter(
                  (record) =>
                    record.status ===
                      "overdue" ||
                    record.status ===
                      "not_started"
                ).length ===
                  0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                    <CheckCircle2
                      className="mx-auto text-emerald-600"
                      size={30}
                    />

                    <p className="mt-3 text-sm font-semibold text-emerald-800">
                      No immediate compliance issues
                    </p>

                    <p className="mt-1 text-xs text-emerald-700">
                      All assigned mandatory training is on track.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* RECORDS */}

        {activeView ===
          "records" && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Employee training status
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Completion records and compliance information.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[220px]">
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      size={16}
                    />

                    <input
                      value={
                        search
                      }
                      onChange={(
                        event
                      ) =>
                        setSearch(
                          event.target
                            .value
                        )
                      }
                      placeholder="Search employees..."
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                    />
                  </div>

                  <select
                    value={
                      departmentFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setDepartmentFilter(
                        event.target
                          .value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-teal-500"
                  >
                    <option value="all">
                      All departments
                    </option>

                    {departments.map(
                      (
                        department
                      ) => (
                        <option
                          key={
                            department
                          }
                          value={
                            department
                          }
                        >
                          {
                            department
                          }
                        </option>
                      )
                    )}
                  </select>

                  <select
                    value={
                      statusFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setStatusFilter(
                        event.target
                          .value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-teal-500"
                  >
                    <option value="all">
                      All statuses
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="in_progress">
                      In progress
                    </option>

                    <option value="overdue">
                      Overdue
                    </option>

                    <option value="not_started">
                      Not started
                    </option>
                  </select>

                  <select
                    value={
                      courseFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setCourseFilter(
                        event.target
                          .value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600 outline-none focus:border-teal-500"
                  >
                    <option value="all">
                      All courses
                    </option>

                    {courses.map(
                      (course) => {
                        const id =
                          getCourseId(
                            course
                          );

                        return (
                          <option
                            key={String(
                              id
                            )}
                            value={String(
                              id
                            )}
                          >
                            {getCourseTitle(
                              course
                            )}
                          </option>
                        );
                      }
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Filter
                      size={15}
                    />

                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">
                      Employee
                    </th>

                    <th className="px-5 py-3">
                      Course
                    </th>

                    <th className="px-5 py-3">
                      Status
                    </th>

                    <th className="px-5 py-3">
                      Due date
                    </th>

                    <th className="px-5 py-3">
                      Progress
                    </th>

                    <th className="px-5 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(
                    (record) => (
                      <tr
                        key={String(
                          record.id
                        )}
                        className="border-b border-slate-50 hover:bg-slate-50/50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                              {record.employeeName
                                .charAt(
                                  0
                                )
                                .toUpperCase()}
                            </div>

                            <div>
                              <p className="font-semibold text-slate-800">
                                {
                                  record.employeeName
                                }
                              </p>

                              <p className="text-xs text-slate-500">
                                {
                                  record.department
                                }{" "}
                                ·{" "}
                                {
                                  record.title
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-800">
                            {
                              record.courseTitle
                            }
                          </p>

                          <p className="mt-1 text-[11px] font-semibold text-teal-700">
                            Mandatory
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            status={
                              record.status
                            }
                          />
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {record.dueDate
                            ? formatDate(
                                record.dueDate
                              )
                            : "No due date"}
                        </td>

                        <td className="w-[220px] px-5 py-4">
                          <ProgressBar
                            value={
                              record.progress
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveView(
                                  "employees"
                                );

                                setExpandedEmployeeId(
                                  record.employeeId
                                );
                              }}
                              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                String(
                                  record.id
                                )
                              }
                              onClick={() =>
                                deleteAssignment(
                                  record.id
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId ===
                              String(
                                record.id
                              ) ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                />
                              )}

                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {filteredRecords.length ===
                0 && (
                <div className="px-6 py-16 text-center">
                  <ClipboardCheck
                    className="mx-auto text-slate-300"
                    size={34}
                  />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    No training records found
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Assign training to employees or adjust the filters.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      openAssignModal()
                    }
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    <Plus
                      size={16}
                    />

                    Assign training
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* EMPLOYEES */}

        {activeView ===
          "employees" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Employee compliance
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Open an employee to see every assigned training requirement.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search employees..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {employeeCompliance.map(
                (item) => {
                  const expanded =
                    String(
                      expandedEmployeeId
                    ) ===
                    String(
                      item.employeeId
                    );

                  return (
                    <div
                      key={String(
                        item.employeeId
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEmployeeId(
                            expanded
                              ? null
                              : item.employeeId
                          )
                        }
                        className="flex w-full flex-col gap-4 px-5 py-5 text-left hover:bg-slate-50 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                            {getEmployeeName(
                              item.employee
                            )
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {getEmployeeName(
                                item.employee
                              )}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {getEmployeeTitle(
                                item.employee
                              )}{" "}
                              ·{" "}
                              {getEmployeeDepartment(
                                item.employee
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="w-full sm:w-60">
                          <ProgressBar
                            value={
                              item.rate
                            }
                          />
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 sm:w-40 sm:justify-end">
                          <span>
                            {item.completed}/
                            {item.total}
                          </span>

                          {item.overdue >
                            0 && (
                            <span className="font-semibold text-red-600">
                              {
                                item.overdue
                              }{" "}
                              overdue
                            </span>
                          )}

                          {expanded ? (
                            <ChevronUp
                              size={16}
                            />
                          ) : (
                            <ChevronDown
                              size={16}
                            />
                          )}
                        </div>
                      </button>

                      {expanded && (
                        <div className="bg-slate-50/60 px-5 pb-5">
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Training requirements
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  openAssignModal(
                                    item.employeeId
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700"
                              >
                                <Plus
                                  size={14}
                                />

                                Assign training
                              </button>
                            </div>

                            {item.records.length >
                            0 ? (
                              <div className="divide-y divide-slate-100">
                                {item.records.map(
                                  (
                                    record
                                  ) => (
                                    <div
                                      key={String(
                                        record.id
                                      )}
                                      className="grid gap-3 px-4 py-4 md:grid-cols-[1.5fr_0.8fr_1fr_auto] md:items-center"
                                    >
                                      <div>
                                        <p className="text-sm font-medium text-slate-800">
                                          {
                                            record.courseTitle
                                          }
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                          Assigned{" "}
                                          {formatDate(
                                            record.assignedAt
                                          )}
                                        </p>
                                      </div>

                                      <ProgressBar
                                        value={
                                          record.progress
                                        }
                                      />

                                      <div className="text-xs text-slate-500">
                                        {record.dueDate
                                          ? `Due ${formatDate(
                                              record.dueDate
                                            )}`
                                          : "No due date"}
                                      </div>

                                      <div className="flex items-center justify-end gap-2">
                                        <StatusBadge
                                          status={
                                            record.status
                                          }
                                        />

                                        <button
                                          type="button"
                                          disabled={
                                            deletingId ===
                                            String(
                                              record.id
                                            )
                                          }
                                          onClick={() =>
                                            deleteAssignment(
                                              record.id
                                            )
                                          }
                                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                          title="Remove assignment"
                                        >
                                          {deletingId ===
                                          String(
                                            record.id
                                          ) ? (
                                            <Loader2
                                              size={14}
                                              className="animate-spin"
                                            />
                                          ) : (
                                            <Trash2
                                              size={14}
                                            />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="px-5 py-8 text-center">
                                <GraduationCap
                                  className="mx-auto text-slate-300"
                                  size={30}
                                />

                                <p className="mt-3 text-sm font-semibold text-slate-700">
                                  No training assigned
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  Assign training to begin compliance tracking.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
              )}

              {employeeCompliance.length ===
                0 && (
                <div className="px-6 py-16 text-center">
                  <UserRound
                    className="mx-auto text-slate-300"
                    size={34}
                  />

                  <p className="mt-4 text-sm font-semibold text-slate-700">
                    No employees found
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TRAINING PROGRAMS */}

        {activeView ===
          "training" && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Training programs
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Courses available in your organization.
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search training..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              {courses
                .filter(
                  (course) => {
                    const query =
                      search
                        .trim()
                        .toLowerCase();

                    if (!query) {
                      return true;
                    }

                    return (
                      getCourseTitle(
                        course
                      )
                        .toLowerCase()
                        .includes(
                          query
                        ) ||

                      String(
                        course?.description ||
                          ""
                      )
                        .toLowerCase()
                        .includes(
                          query
                        )
                    );
                  }
                )
                .map(
                  (course) => {
                    const courseId =
                      getCourseId(
                        course
                      );

                    const courseRecords =
                      records.filter(
                        (record) =>
                          String(
                            record.courseId
                          ) ===
                          String(
                            courseId
                          )
                      );

                    const completed =
                      courseRecords.filter(
                        (record) =>
                          record.status ===
                          "completed"
                      ).length;

                    const overdue =
                      courseRecords.filter(
                        (record) =>
                          record.status ===
                          "overdue"
                      ).length;

                    return (
                      <div
                        key={String(
                          courseId
                        )}
                        className="rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                            <GraduationCap
                              size={19}
                            />
                          </div>

                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {course?.status ||
                              "Active"}
                          </span>
                        </div>

                        <h3 className="mt-4 line-clamp-2 text-base font-semibold text-slate-900">
                          {getCourseTitle(
                            course
                          )}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                          {course?.description ||
                            "No course description available."}
                        </p>

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-lg font-semibold text-slate-900">
                              {
                                courseRecords.length
                              }
                            </p>

                            <p className="text-[11px] text-slate-500">
                              Assigned
                            </p>
                          </div>

                          <div className="rounded-xl bg-emerald-50 p-3">
                            <p className="text-lg font-semibold text-emerald-700">
                              {
                                completed
                              }
                            </p>

                            <p className="text-[11px] text-emerald-700">
                              Completed
                            </p>
                          </div>

                          <div className="rounded-xl bg-red-50 p-3">
                            <p className="text-lg font-semibold text-red-700">
                              {
                                overdue
                              }
                            </p>

                            <p className="text-[11px] text-red-700">
                              Overdue
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCourseFilter(
                              String(
                                courseId
                              )
                            );

                            setActiveView(
                              "records"
                            );
                          }}
                          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                        >
                          View compliance
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openAssignModal()
                          }
                          className="mt-2 w-full rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
                        >
                          Assign this course
                        </button>
                      </div>
                    );
                  }
                )}
            </div>

            {courses.length ===
              0 && (
              <div className="px-6 py-16 text-center">
                <GraduationCap
                  className="mx-auto text-slate-300"
                  size={34}
                />

                <p className="mt-4 text-sm font-semibold text-slate-700">
                  No learning courses available
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Create a course first, then assign it here.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {/* ASSIGN MODAL */}

      {showAssignModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeAssignModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Assign training
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Select an employee, course and optional due date.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeAssignModal
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              >
                <X
                  size={18}
                />
              </button>
            </div>

            <div className="space-y-6 p-5">

              {/* EMPLOYEE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Employee
                </label>

                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />

                  <input
                    value={
                      assignmentSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setAssignmentSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search employees..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredAssignmentEmployees.map(
                    (employee) => {
                      const employeeId =
                        getId(
                          employee
                        );

                      const selected =
                        String(
                          employeeId
                        ) ===
                        String(
                          assignmentEmployeeId
                        );

                      return (
                        <button
                          type="button"
                          key={String(
                            employeeId
                          )}
                          onClick={() =>
                            setAssignmentEmployeeId(
                              String(
                                employeeId
                              )
                            )
                          }
                          className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${
                            selected
                              ? "bg-teal-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {getEmployeeName(
                              employee
                            )
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {getEmployeeName(
                                employee
                              )}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {getEmployeeTitle(
                                employee
                              )}{" "}
                              ·{" "}
                              {getEmployeeDepartment(
                                employee
                              )}
                            </p>
                          </div>

                          {selected && (
                            <CheckCircle2
                              className="text-teal-600"
                              size={18}
                            />
                          )}
                        </button>
                      );
                    }
                  )}

                  {filteredAssignmentEmployees.length ===
                    0 && (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No employees found.
                    </div>
                  )}
                </div>
              </div>

              {/* COURSE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Training course
                </label>

                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />

                  <input
                    value={
                      courseSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setCourseSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search courses..."
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredAssignmentCourses.map(
                    (course) => {
                      const courseId =
                        getCourseId(
                          course
                        );

                      const selected =
                        String(
                          courseId
                        ) ===
                        String(
                          assignmentCourseId
                        );

                      return (
                        <button
                          type="button"
                          key={String(
                            courseId
                          )}
                          onClick={() =>
                            setAssignmentCourseId(
                              String(
                                courseId
                              )
                            )
                          }
                          className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 ${
                            selected
                              ? "bg-teal-50"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                            <GraduationCap
                              size={17}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {getCourseTitle(
                                course
                              )}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                              {course?.difficulty ||
                                "Training"}
                            </p>
                          </div>

                          {selected && (
                            <CheckCircle2
                              className="text-teal-600"
                              size={18}
                            />
                          )}
                        </button>
                      );
                    }
                  )}

                  {filteredAssignmentCourses.length ===
                    0 && (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No courses found.
                    </div>
                  )}
                </div>
              </div>

              {/* DUE DATE */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Due date
                </label>

                <div className="relative">
                  <CalendarDays
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />

                  <input
                    type="date"
                    min={
                      todayString()
                    }
                    value={
                      assignmentDueDate
                    }
                    onChange={(
                      event
                    ) =>
                      setAssignmentDueDate(
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Optional. Leave blank if the training has no deadline.
                </p>
              </div>

              {/* ACTIONS */}

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={
                    closeAssignModal
                  }
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    createAssignment
                  }
                  disabled={
                    saving ||
                    !assignmentEmployeeId ||
                    !assignmentCourseId
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus
                      size={16}
                    />
                  )}

                  {saving
                    ? "Assigning..."
                    : "Assign training"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}