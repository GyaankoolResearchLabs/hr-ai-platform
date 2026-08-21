import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

import {
  ArrowLeft,
  ClipboardCheck,
  UserPlus,
  Laptop,
  FileText,
  Package,
  CheckCircle2,
  Clock3,
  Circle,
  AlertCircle,
  CalendarDays,
  Users,
  X,
  RefreshCw,
  Trash2,
  Plus,
} from "lucide-react";

/* =========================================================
   API
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

/* =========================================================
   ORGANIZATION / AUTH
========================================================= */

async function resolveOrganizationId() {
  const keys = [
    "organizationId",
    "organization_id",
  ];

  for (const key of keys) {
    const value = localStorage.getItem(key);

    if (value) {
      return value;
    }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const metadata =
      session?.user?.user_metadata || {};

    return (
      metadata.organizationId ||
      metadata.organization_id ||
      null
    );
  } catch {
    return null;
  }
}

/*
 * Automatically attach:
 * - Supabase access token
 * - organizationId
 *
 * to every request.
 */
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
    } catch {
      // Authentication header is optional
      // if the current API doesn't require it.
    }

    const organizationId =
      await resolveOrganizationId();

    if (organizationId) {
      config.params = {
        ...(config.params || {}),
        organizationId,
      };

      if (
        config.data &&
        typeof config.data === "object" &&
        !(config.data instanceof FormData)
      ) {
        config.data = {
          ...config.data,
          organizationId,
        };
      }
    }

    return config;
  }
);

/* =========================================================
   HELPERS
========================================================= */

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?._id ||
    employee?.employee_id
  );
}

function getEmployeeName(employee) {
  const combinedName =
    `${employee?.firstName || ""} ${
      employee?.lastName || ""
    }`.trim();

  return (
    employee?.full_name ||
    employee?.fullName ||
    employee?.name ||
    combinedName ||
    employee?.email ||
    "Unnamed employee"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    employee?.departmentName ||
    "Not assigned"
  );
}

function getEmployeeRole(employee) {
  return (
    employee?.position ||
    employee?.job_title ||
    employee?.jobTitle ||
    employee?.role ||
    "Not assigned"
  );
}

function getEmployeeJoiningDate(employee) {
  return (
    employee?.joining_date ||
    employee?.joiningDate ||
    employee?.date_of_joining ||
    employee?.dateOfJoining ||
    employee?.start_date ||
    employee?.startDate ||
    ""
  );
}

function formatDate(date) {
  if (!date) {
    return "Not set";
  }

  try {
    return new Date(
      `${String(date).slice(0, 10)}T00:00:00`
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "Not set";
  }
}

function formatDateLong(date) {
  if (!date) {
    return "Not set";
  }

  try {
    return new Date(
      `${String(date).slice(0, 10)}T00:00:00`
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "Not set";
  }
}

function normalizeTaskStatus(status) {
  if (status === "completed") {
    return "completed";
  }

  if (status === "in_progress") {
    return "in_progress";
  }

  if (status === "blocked") {
    return "blocked";
  }

  /*
   * Backend uses "pending".
   * UI uses "not_started".
   */
  return "not_started";
}

function getBackendTaskStatus(status) {
  if (status === "completed") {
    return "completed";
  }

  if (status === "in_progress") {
    return "in_progress";
  }

  if (status === "blocked") {
    return "pending";
  }

  return "pending";
}

function getTaskStatusLabel(status) {
  const normalized =
    normalizeTaskStatus(status);

  if (normalized === "completed") {
    return "Completed";
  }

  if (normalized === "in_progress") {
    return "In progress";
  }

  if (normalized === "blocked") {
    return "Blocked";
  }

  return "Not started";
}

function getTaskStatusClass(status) {
  const normalized =
    normalizeTaskStatus(status);

  if (normalized === "completed") {
    return "bg-brand-50 text-brand-700";
  }

  if (normalized === "in_progress") {
    return "bg-amber-50 text-amber-700";
  }

  if (normalized === "blocked") {
    return "bg-red-50 text-red-700";
  }

  return "bg-ink-50 text-ink-600";
}

function getTaskStatusIcon(status) {
  const normalized =
    normalizeTaskStatus(status);

  if (normalized === "completed") {
    return CheckCircle2;
  }

  if (normalized === "in_progress") {
    return Clock3;
  }

  if (normalized === "blocked") {
    return AlertCircle;
  }

  return Circle;
}

function getTaskIcon(task) {
  const category =
    String(task?.category || "")
      .toLowerCase();

  if (
    category.includes("document")
  ) {
    return FileText;
  }

  if (
    category.includes("it") ||
    category.includes("access")
  ) {
    return Laptop;
  }

  if (
    category.includes("equipment") ||
    category.includes("asset")
  ) {
    return Package;
  }

  if (
    category.includes("people") ||
    category.includes("buddy") ||
    category.includes("manager")
  ) {
    return Users;
  }

  return ClipboardCheck;
}

function getTaskDueDate(task) {
  return (
    task?.due_date ||
    task?.dueDate ||
    null
  );
}

function getDueState(task) {
  const status =
    normalizeTaskStatus(task?.status);

  if (status === "completed") {
    return "completed";
  }

  const dueDate =
    getTaskDueDate(task);

  if (!dueDate) {
    return "none";
  }

  const today = new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const due = new Date(
    `${String(dueDate).slice(0, 10)}T00:00:00`
  );

  if (due < today) {
    return "overdue";
  }

  const difference = Math.ceil(
    (due.getTime() -
      today.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (difference <= 2) {
    return "due_soon";
  }

  return "upcoming";
}

/* =========================================================
   COMPONENT
========================================================= */

export default function PreboardingWorkflow() {
  const navigate = useNavigate();

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [employees, setEmployees] =
    useState([]);

  const [journeys, setJourneys] =
    useState([]);

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState("");

  const [selectedJourney, setSelectedJourney] =
    useState(null);

  /* -------------------------------------------------------
     UI STATE
  ------------------------------------------------------- */

  const [loading, setLoading] =
    useState(true);

  const [loadingJourney, setLoadingJourney] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const [selectedTask, setSelectedTask] =
    useState(null);

  const [showEmployeePicker, setShowEmployeePicker] =
    useState(false);

  const [showCreateJourney, setShowCreateJourney] =
    useState(false);

  const [newJoiningDate, setNewJoiningDate] =
    useState("");

  /* =========================================================
     LOAD EMPLOYEES
  ========================================================= */

  async function loadEmployees() {
    try {
      const response =
        await api.get("/employees");

      const list =
        response?.data?.employees ||
        response?.data?.data ||
        response?.data ||
        [];

      const normalized =
        Array.isArray(list)
          ? list
          : [];

      setEmployees(normalized);

      /*
       * Save organization ID from employee
       * response when available.
       */
      const organizationId =
        normalized[0]?.organization_id ||
        normalized[0]?.organizationId;

      if (organizationId) {
        localStorage.setItem(
          "organizationId",
          organizationId
        );
      }

      return normalized;
    } catch (err) {
      console.error(
        "[Preboarding] Failed to load employees:",
        err
      );

      throw new Error(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load employees."
      );
    }
  }

  /* =========================================================
     LOAD JOURNEYS
  ========================================================= */

  async function loadJourneys() {
    try {
      const organizationId =
        await resolveOrganizationId();

      if (!organizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      const response =
        await api.get(
          "/onboarding/journeys",
          {
            params: {
              organizationId,
            },
          }
        );

      const list =
        response?.data?.journeys ||
        [];

      const normalized =
        Array.isArray(list)
          ? list
          : [];

      setJourneys(normalized);

      return normalized;
    } catch (err) {
      console.error(
        "[Preboarding] Failed to load journeys:",
        err
      );

      throw new Error(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load onboarding journeys."
      );
    }
  }

  /* =========================================================
     LOAD SINGLE JOURNEY
  ========================================================= */

  async function loadJourney(journey) {
    if (!journey?.id) {
      return null;
    }

    setLoadingJourney(true);
    setError("");

    try {
      const response =
        await api.get(
          `/onboarding/journeys/${journey.id}`
        );

      const loadedJourney =
        response?.data?.journey ||
        journey;

      /*
       * IMPORTANT:
       *
       * The tasks here come directly from
       * Supabase through the backend.
       *
       * Therefore completed tasks remain
       * completed after leaving and returning.
       */
      setSelectedJourney(
        loadedJourney
      );

      return loadedJourney;
    } catch (err) {
      console.error(
        "[Preboarding] Failed to load journey:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load onboarding journey."
      );

      return null;
    } finally {
      setLoadingJourney(false);
    }
  }

  /* =========================================================
     FIND JOURNEY FOR EMPLOYEE
  ========================================================= */

  function findJourneyForEmployee(
    employeeId,
    journeyList = journeys
  ) {
    if (!employeeId) {
      return null;
    }

    return (
      journeyList.find(
        (journey) =>
          String(
            journey?.employee_id ||
              journey?.employeeId
          ) ===
          String(employeeId)
      ) || null
    );
  }

  /* =========================================================
     SELECT EMPLOYEE
  ========================================================= */

  async function selectEmployee(
    employeeId,
    journeyList = journeys
  ) {
    if (!employeeId) {
      return;
    }

    setSelectedEmployeeId(
      employeeId
    );

    setError("");
    setSuccess("");

    const journey =
      findJourneyForEmployee(
        employeeId,
        journeyList
      );

    if (journey) {
      await loadJourney(journey);

      setShowEmployeePicker(false);

      return;
    }

    /*
     * Employee has no onboarding journey yet.
     */
    setSelectedJourney(null);

    const employee =
      employees.find(
        (item) =>
          String(
            getEmployeeId(item)
          ) ===
          String(employeeId)
      );

    const joiningDate =
      getEmployeeJoiningDate(
        employee
      );

    setNewJoiningDate(
      joiningDate
        ? String(joiningDate).slice(
            0,
            10
          )
        : ""
    );

    setShowEmployeePicker(false);
    setShowCreateJourney(true);
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const loadedEmployees =
          await loadEmployees();

        const loadedJourneys =
          await loadJourneys();

        if (!mounted) {
          return;
        }

        /*
         * Automatically select the first
         * employee who already has a journey.
         */
        const firstJourney =
          loadedJourneys[0];

        if (firstJourney) {
          const employeeId =
            firstJourney.employee_id ||
            firstJourney.employeeId;

          setSelectedEmployeeId(
            employeeId || ""
          );

          await loadJourney(
            firstJourney
          );
        } else if (
          loadedEmployees.length > 0
        ) {
          /*
           * No journey exists yet.
           * Select first employee and allow
           * creation.
           */
          const firstEmployee =
            loadedEmployees[0];

          const firstEmployeeId =
            getEmployeeId(
              firstEmployee
            );

          setSelectedEmployeeId(
            firstEmployeeId || ""
          );
        }
      } catch (err) {
        if (mounted) {
          setError(
            err?.message ||
              "Unable to load pre-boarding data."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     REFRESH CURRENT JOURNEY
  ========================================================= */

  async function refreshCurrentJourney() {
    if (!selectedJourney?.id) {
      return;
    }

    await loadJourney(
      selectedJourney
    );

    /*
     * Also refresh the journey list so
     * its progress/status stays current.
     */
    try {
      await loadJourneys();
    } catch {
      // Main journey was already refreshed.
    }
  }

  /* =========================================================
     CREATE JOURNEY
  ========================================================= */

  async function createJourneyForEmployee(
    event
  ) {
    event?.preventDefault();

    if (
      !selectedEmployeeId ||
      !newJoiningDate
    ) {
      setError(
        "Please select an employee and joining date."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      /*
       * First check whether a journey
       * already exists.
       *
       * This prevents duplicate journeys.
       */
      const currentJourneys =
        await loadJourneys();

      const existingJourney =
        findJourneyForEmployee(
          selectedEmployeeId,
          currentJourneys
        );

      if (existingJourney) {
        setShowCreateJourney(false);

        await loadJourney(
          existingJourney
        );

        setSuccess(
          "This employee already has an onboarding journey."
        );

        return;
      }

      const organizationId =
        await resolveOrganizationId();

      if (!organizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      const response =
        await api.post(
          "/onboarding/journeys",
          {
            organizationId,
            employeeId:
              selectedEmployeeId,
            joiningDate:
              newJoiningDate,
          }
        );

      const journey =
        response?.data?.journey;

      if (!journey?.id) {
        throw new Error(
          "Onboarding journey was created but no journey ID was returned."
        );
      }

      /*
       * IMPORTANT:
       *
       * The backend already creates the
       * default six onboarding tasks.
       *
       * DO NOT create them again here.
       */
      setShowCreateJourney(false);

      setNewJoiningDate("");

      /*
       * Refresh journeys from database.
       */
      const updatedJourneys =
        await loadJourneys();

      const createdJourney =
        updatedJourneys.find(
          (item) =>
            String(item.id) ===
            String(journey.id)
        ) || journey;

      setSelectedEmployeeId(
        selectedEmployeeId
      );

      await loadJourney(
        createdJourney
      );

      setSuccess(
        "Pre-boarding workflow created successfully."
      );
    } catch (err) {
      console.error(
        "[Preboarding] Create journey failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to create onboarding workflow."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     UPDATE TASK STATUS
  ========================================================= */

  async function updateTaskStatus(
    task,
    status
  ) {
    if (
      !task?.id ||
      !selectedJourney?.id
    ) {
      return;
    }

    const backendStatus =
      getBackendTaskStatus(status);

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const organizationId =
        await resolveOrganizationId();

      if (!organizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      /*
       * THIS IS THE IMPORTANT FIX.
       *
       * The old component only changed
       * React state.
       *
       * This request permanently saves
       * the task status in Supabase.
       */
      await api.patch(
        `/onboarding/tasks/${task.id}`,
        {
          organizationId,
          status: backendStatus,
        }
      );

      /*
       * Reload the journey from backend.
       *
       * This guarantees that the displayed
       * progress is calculated from persisted
       * database data.
       */
      const refreshed =
        await loadJourney(
          selectedJourney
        );

      if (refreshed) {
        setSuccess(
          backendStatus === "completed"
            ? "Task completed successfully."
            : "Task status updated successfully."
        );
      }
    } catch (err) {
      console.error(
        "[Preboarding] Task update failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update task."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     DELETE TASK
  ========================================================= */

  async function deleteTask(
    taskId
  ) {
    if (
      !taskId ||
      !selectedJourney?.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this onboarding task?"
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const organizationId =
        await resolveOrganizationId();

      if (!organizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      await api.delete(
        `/onboarding/tasks/${taskId}`,
        {
          data: {
            organizationId,
          },
        }
      );

      await refreshCurrentJourney();

      setSelectedTask(null);

      setSuccess(
        "Task deleted successfully."
      );
    } catch (err) {
      console.error(
        "[Preboarding] Task deletion failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to delete task."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     JOURNEY STATUS
  ========================================================= */

  async function updateJourneyStatus(
    status
  ) {
    if (!selectedJourney?.id) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const organizationId =
        await resolveOrganizationId();

      if (!organizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      const response =
        await api.patch(
          `/onboarding/journeys/${selectedJourney.id}/status`,
          {
            organizationId,
            status,
          }
        );

      const journey =
        response?.data?.journey;

      if (journey) {
        setSelectedJourney(
          journey
        );
      } else {
        await refreshCurrentJourney();
      }

      await loadJourneys();

      setSuccess(
        status === "completed"
          ? "Onboarding completed successfully."
          : "Onboarding journey updated successfully."
      );
    } catch (err) {
      console.error(
        "[Preboarding] Journey status update failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to update onboarding journey."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     TASK DATA
  ========================================================= */

  const tasks = useMemo(() => {
    if (!selectedJourney) {
      return [];
    }

    return (
      selectedJourney
        ?.onboarding_journey_tasks ||
      selectedJourney?.tasks ||
      []
    );
  }, [selectedJourney]);

  /* =========================================================
     STATISTICS
  ========================================================= */

  const statistics = useMemo(() => {
    const total =
      tasks.length;

    const completed =
      tasks.filter(
        (task) =>
          normalizeTaskStatus(
            task.status
          ) === "completed"
      ).length;

    const inProgress =
      tasks.filter(
        (task) =>
          normalizeTaskStatus(
            task.status
          ) === "in_progress"
      ).length;

    const blocked =
      tasks.filter(
        (task) =>
          normalizeTaskStatus(
            task.status
          ) === "blocked"
      ).length;

    const overdue =
      tasks.filter(
        (task) =>
          getDueState(task) ===
          "overdue"
      ).length;

    const progress =
      total === 0
        ? 0
        : Math.round(
            (completed /
              total) *
              100
          );

    return {
      total,
      completed,
      inProgress,
      blocked,
      overdue,
      progress,
    };
  }, [tasks]);

  /* =========================================================
     FILTERED TASKS
  ========================================================= */

  const filteredTasks =
    useMemo(() => {
      if (filter === "all") {
        return tasks;
      }

      if (filter === "overdue") {
        return tasks.filter(
          (task) =>
            getDueState(task) ===
            "overdue"
        );
      }

      return tasks.filter(
        (task) =>
          normalizeTaskStatus(
            task.status
          ) === filter
      );
    }, [tasks, filter]);

  /* =========================================================
     SELECTED EMPLOYEE
  ========================================================= */

  const selectedEmployee =
    employees.find(
      (employee) =>
        String(
          getEmployeeId(employee)
        ) ===
        String(
          selectedEmployeeId
        )
    );

  /* =========================================================
     READINESS MESSAGE
  ========================================================= */

  function getReadinessMessage() {
    if (
      statistics.progress === 100
    ) {
      return "Ready for Day 1";
    }

    if (
      statistics.blocked > 0
    ) {
      return "Action required";
    }

    if (
      statistics.overdue > 0
    ) {
      return "Overdue actions need attention";
    }

    if (
      statistics.progress >= 75
    ) {
      return "Almost ready";
    }

    if (
      statistics.progress >= 50
    ) {
      return "On track";
    }

    return "Preparation in progress";
  }

  /* =========================================================
     OPEN ANOTHER CANDIDATE
  ========================================================= */

  async function handleAnotherCandidate() {
    setError("");
    setSuccess("");

    try {
      await loadEmployees();
      await loadJourneys();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load employees."
      );
    }

    setShowEmployeePicker(true);
  }

  /* =========================================================
     BACK
  ========================================================= */

  function handleBack() {
    if (selectedJourney) {
      setSelectedJourney(null);
      setSelectedTask(null);
      setError("");
      setSuccess("");

      return;
    }

    navigate(-1);
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="text-sm text-ink-500">
            Loading pre-boarding workflow...
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen min-w-0 bg-canvas px-6 py-8">
      <div className="mx-auto max-w-6xl">

        {/* =====================================================
            BACK
        ===================================================== */}

        <button
          type="button"
          onClick={handleBack}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />

          {selectedJourney
            ? "Back"
            : "Back"}
        </button>

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="mb-8">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-ink-900">
                Pre-boarding Checklist & Workflow
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Everything ready before day one
              </p>
            </div>
          </div>

          <p className="max-w-3xl text-sm leading-6 text-ink-600">
            Prepare new hires before their first day by
            tracking documents, employee setup, IT access,
            equipment, and other onboarding requirements.
          </p>
        </div>

        {/* =====================================================
            ERRORS
        ===================================================== */}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================================
            SUCCESS
        ===================================================== */}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>
              {success}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =====================================================
            NO EMPLOYEES
        ===================================================== */}

        {employees.length === 0 ? (
          <div className="rounded-xl border border-ink-100 bg-white p-10 text-center shadow-sm">
            <Users className="mx-auto h-10 w-10 text-ink-300" />

            <h2 className="mt-4 text-lg font-semibold text-ink-900">
              No employees available
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Add an employee first before creating a
              pre-boarding workflow.
            </p>
          </div>
        ) : !selectedJourney ? (
          <>
            {/* =================================================
                EMPLOYEE SELECTOR
            ================================================= */}

            <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-brand-700" />

                  <h2 className="text-sm font-semibold text-ink-900">
                    New hire
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    handleAnotherCandidate
                  }
                  className="flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Another candidate
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-500">
                    Employee
                  </label>

                  <select
                    value={
                      selectedEmployeeId
                    }
                    onChange={async (
                      event
                    ) => {
                      await selectEmployee(
                        event.target.value
                      );
                    }}
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none transition focus:border-brand-500"
                  >
                    <option value="">
                      Select employee
                    </option>

                    {employees.map(
                      (employee) => {
                        const id =
                          getEmployeeId(
                            employee
                          );

                        const hasJourney =
                          Boolean(
                            findJourneyForEmployee(
                              id
                            )
                          );

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {getEmployeeName(
                              employee
                            )}
                            {hasJourney
                              ? " — onboarding exists"
                              : " — new"}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-500">
                    Joining date
                  </label>

                  <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
                    <CalendarDays className="h-4 w-4 text-ink-400" />

                    {formatDateLong(
                      getEmployeeJoiningDate(
                        selectedEmployee
                      )
                    )}
                  </div>
                </div>
              </div>

              {selectedEmployee && (
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-sm">
                  <div>
                    <span className="text-ink-400">
                      Department
                    </span>{" "}
                    <span className="font-medium text-ink-700">
                      {getEmployeeDepartment(
                        selectedEmployee
                      )}
                    </span>
                  </div>

                  <div>
                    <span className="text-ink-400">
                      Position
                    </span>{" "}
                    <span className="font-medium text-ink-700">
                      {getEmployeeRole(
                        selectedEmployee
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* =================================================
                EXISTING JOURNEYS
            ================================================= */}

            <div className="mb-4">
              <h2 className="text-base font-semibold text-ink-900">
                Pre-boarding workflows
              </h2>

              <p className="mt-1 text-sm text-ink-500">
                Select an employee to continue their
                saved onboarding workflow.
              </p>
            </div>

            {journeys.length === 0 ? (
              <div className="rounded-xl border border-ink-100 bg-white p-10 text-center shadow-sm">
                <ClipboardCheck className="mx-auto h-10 w-10 text-ink-300" />

                <h3 className="mt-4 text-base font-semibold text-ink-900">
                  No pre-boarding workflows yet
                </h3>

                <p className="mt-1 text-sm text-ink-500">
                  Select an employee and create their
                  onboarding checklist.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (
                      !selectedEmployeeId
                    ) {
                      setShowEmployeePicker(
                        true
                      );

                      return;
                    }

                    const employee =
                      employees.find(
                        (item) =>
                          String(
                            getEmployeeId(
                              item
                            )
                          ) ===
                          String(
                            selectedEmployeeId
                          )
                      );

                    setNewJoiningDate(
                      getEmployeeJoiningDate(
                        employee
                      )
                        ? String(
                            getEmployeeJoiningDate(
                              employee
                            )
                          ).slice(
                            0,
                            10
                          )
                        : ""
                    );

                    setShowCreateJourney(
                      true
                    );
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Create workflow
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {journeys.map(
                  (journey) => {
                    const journeyTasks =
                      journey?.onboarding_journey_tasks ||
                      journey?.tasks ||
                      [];

                    const completed =
                      journeyTasks.filter(
                        (task) =>
                          normalizeTaskStatus(
                            task.status
                          ) ===
                          "completed"
                      ).length;

                    const journeyProgress =
                      journeyTasks.length
                        ? Math.round(
                            (completed /
                              journeyTasks.length) *
                              100
                          )
                        : 0;

                    const employee =
                      employees.find(
                        (item) =>
                          String(
                            getEmployeeId(
                              item
                            )
                          ) ===
                          String(
                            journey?.employee_id ||
                              journey?.employeeId
                          )
                      );

                    return (
                      <button
                        key={
                          journey.id
                        }
                        type="button"
                        onClick={async () => {
                          setSelectedEmployeeId(
                            journey?.employee_id ||
                              journey?.employeeId ||
                              ""
                          );

                          await loadJourney(
                            journey
                          );
                        }}
                        className="rounded-xl border border-ink-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
                      >
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                                <Users className="h-5 w-5" />
                              </div>

                              <div>
                                <h3 className="font-semibold text-ink-900">
                                  {getEmployeeName(
                                    employee
                                  )}
                                </h3>

                                <p className="text-xs text-ink-400">
                                  Joining{" "}
                                  {formatDateLong(
                                    journey?.joining_date ||
                                      journey?.joiningDate
                                  )}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTaskStatusClass(
                                journey?.status ===
                                  "completed"
                                  ? "completed"
                                  : journey?.status ===
                                      "in_progress"
                                  ? "in_progress"
                                  : "not_started"
                              )}`}
                            >
                              {journey?.status ===
                              "completed"
                                ? "completed"
                                : journey?.status ===
                                    "in_progress"
                                ? "in progress"
                                : "not started"}
                            </span>
                          </div>

                          <div className="mt-5">
                            <div className="mb-2 flex justify-between text-xs">
                              <span className="text-ink-500">
                                Progress
                              </span>

                              <span className="font-medium text-ink-700">
                                {journeyProgress}%
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-brand-600 transition-all"
                                style={{
                                  width: `${journeyProgress}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="mt-4 text-xs text-ink-500">
                            {completed} /{" "}
                            {
                              journeyTasks.length
                            }{" "}
                            tasks completed
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* =================================================
                EMPLOYEE HEADER
            ================================================= */}

            <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Users className="h-6 w-6" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold text-ink-900">
                      {getEmployeeName(
                        selectedEmployee
                      )}
                    </h2>

                    <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-ink-500">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />

                        Joining{" "}
                        {formatDateLong(
                          selectedJourney?.joining_date ||
                            selectedJourney?.joiningDate ||
                            getEmployeeJoiningDate(
                              selectedEmployee
                            )
                        )}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTaskStatusClass(
                          selectedJourney?.status
                        )}`}
                      >
                        {selectedJourney?.status ===
                        "completed"
                          ? "completed"
                          : selectedJourney?.status ===
                              "in_progress"
                          ? "in progress"
                          : "not started"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {/* -----------------------------------------
                      ANOTHER CANDIDATE
                  ----------------------------------------- */}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={
                      handleAnotherCandidate
                    }
                    className="flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Another candidate
                  </button>

                  {/* -----------------------------------------
                      COMPLETE JOURNEY
                  ----------------------------------------- */}

                  {selectedJourney?.status !==
                    "completed" &&
                    statistics.progress ===
                      100 && (
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          updateJourneyStatus(
                            "completed"
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Complete onboarding
                      </button>
                    )}

                  {/* -----------------------------------------
                      REFRESH
                  ----------------------------------------- */}

                  <button
                    type="button"
                    disabled={saving}
                    onClick={
                      refreshCurrentJourney
                    }
                    className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            {/* =================================================
                LOADING JOURNEY
            ================================================= */}

            {loadingJourney ? (
              <div className="rounded-xl border border-ink-100 bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-ink-500">
                  Loading saved onboarding progress...
                </p>
              </div>
            ) : (
              <>
                {/* =============================================
                    PROGRESS
                ============================================= */}

                <div className="mb-6 rounded-xl border border-ink-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                        Day 1 readiness
                      </p>

                      <h2 className="mt-1 text-lg font-semibold text-ink-900">
                        {getReadinessMessage()}
                      </h2>

                      <p className="mt-1 text-sm text-ink-500">
                        {
                          statistics.completed
                        }{" "}
                        of{" "}
                        {
                          statistics.total
                        }{" "}
                        tasks completed
                      </p>
                    </div>

                    <div className="text-left md:text-right">
                      <div className="text-3xl font-semibold text-brand-700">
                        {
                          statistics.progress
                        }
                        %
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-300"
                      style={{
                        width: `${statistics.progress}%`,
                      }}
                    />
                  </div>

                  {/* -----------------------------------------
                      STATS
                  ----------------------------------------- */}

                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">
                        Completed
                      </p>

                      <p className="mt-1 text-lg font-semibold text-ink-900">
                        {
                          statistics.completed
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">
                        In progress
                      </p>

                      <p className="mt-1 text-lg font-semibold text-ink-900">
                        {
                          statistics.inProgress
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">
                        Overdue
                      </p>

                      <p className="mt-1 text-lg font-semibold text-ink-900">
                        {
                          statistics.overdue
                        }
                      </p>
                    </div>

                    <div className="rounded-lg bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">
                        Total tasks
                      </p>

                      <p className="mt-1 text-lg font-semibold text-ink-900">
                        {
                          statistics.total
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* =============================================
                    TASK HEADER
                ============================================= */}

                <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-ink-900">
                      Onboarding tasks
                    </h2>

                    <p className="mt-1 text-sm text-ink-500">
                      Track every requirement before
                      the employee joins.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      [
                        "all",
                        "All",
                      ],
                      [
                        "not_started",
                        "Not started",
                      ],
                      [
                        "in_progress",
                        "In progress",
                      ],
                      [
                        "completed",
                        "Completed",
                      ],
                      [
                        "overdue",
                        "Overdue",
                      ],
                    ].map(
                      ([
                        value,
                        label,
                      ]) => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            setFilter(
                              value
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                            filter ===
                            value
                              ? "bg-brand-600 text-white"
                              : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
                          }`}
                        >
                          {label}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* =============================================
                    TASK LIST
                ============================================= */}

                <div className="space-y-3">
                  {filteredTasks.length ===
                  0 ? (
                    <div className="rounded-xl border border-ink-100 bg-white p-10 text-center shadow-sm">
                      <CheckCircle2 className="mx-auto h-8 w-8 text-ink-300" />

                      <p className="mt-3 text-sm font-medium text-ink-700">
                        No tasks found
                      </p>

                      <p className="mt-1 text-sm text-ink-400">
                        There are no tasks matching
                        this filter.
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map(
                      (task) => {
                        const TaskIcon =
                          getTaskIcon(
                            task
                          );

                        const StatusIcon =
                          getTaskStatusIcon(
                            task.status
                          );

                        const normalizedStatus =
                          normalizeTaskStatus(
                            task.status
                          );

                        const dueState =
                          getDueState(
                            task
                          );

                        return (
                          <div
                            key={
                              task.id
                            }
                            className="rounded-xl border border-ink-100 bg-white p-5 shadow-sm transition hover:border-brand-200"
                          >
                            <div className="flex flex-col gap-4 md:flex-row md:items-center">
                              {/* --------------------------------
                                  ICON
                              -------------------------------- */}

                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                  normalizedStatus ===
                                  "completed"
                                    ? "bg-brand-50 text-brand-700"
                                    : "bg-ink-50 text-ink-500"
                                }`}
                              >
                                <TaskIcon className="h-5 w-5" />
                              </div>

                              {/* --------------------------------
                                  CONTENT
                              -------------------------------- */}

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3
                                    className={`text-sm font-semibold ${
                                      normalizedStatus ===
                                      "completed"
                                        ? "text-ink-400 line-through"
                                        : "text-ink-900"
                                    }`}
                                  >
                                    {
                                      task.title
                                    }
                                  </h3>

                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getTaskStatusClass(
                                      task.status
                                    )}`}
                                  >
                                    <StatusIcon className="h-3 w-3" />

                                    {getTaskStatusLabel(
                                      task.status
                                    )}
                                  </span>

                                  {dueState ===
                                    "overdue" && (
                                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                                      Overdue
                                    </span>
                                  )}
                                </div>

                                {task.description && (
                                  <p className="mt-1 text-sm text-ink-500">
                                    {
                                      task.description
                                    }
                                  </p>
                                )}

                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-400">
                                  <span>
                                    Category:{" "}
                                    <span className="font-medium text-ink-600">
                                      {
                                        task.category ||
                                        "General"
                                      }
                                    </span>
                                  </span>

                                  {getTaskDueDate(
                                    task
                                  ) && (
                                    <span className="flex items-center gap-1">
                                      <Clock3 className="h-3.5 w-3.5" />

                                      Due{" "}
                                      {formatDateLong(
                                        getTaskDueDate(
                                          task
                                        )
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* --------------------------------
                                  STATUS
                              -------------------------------- */}

                              <div className="flex items-center gap-2">
                                <select
                                  value={
                                    normalizedStatus
                                  }
                                  disabled={
                                    saving
                                  }
                                  onChange={async (
                                    event
                                  ) => {
                                    await updateTaskStatus(
                                      task,
                                      event
                                        .target
                                        .value
                                    );
                                  }}
                                  className="rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs font-medium text-ink-700 outline-none focus:border-brand-500 disabled:opacity-50"
                                >
                                  <option value="not_started">
                                    Not started
                                  </option>

                                  <option value="in_progress">
                                    In progress
                                  </option>

                                  <option value="completed">
                                    Completed
                                  </option>

                                  <option value="blocked">
                                    Blocked
                                  </option>
                                </select>

                                <button
                                  type="button"
                                  disabled={
                                    saving
                                  }
                                  onClick={() =>
                                    setSelectedTask(
                                      task
                                    )
                                  }
                                  className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
                                >
                                  View
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    saving
                                  }
                                  onClick={() =>
                                    deleteTask(
                                      task.id
                                    )
                                  }
                                  className="rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                  title="Delete task"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* =====================================================
            EMPLOYEE PICKER MODAL
        ===================================================== */}

        {showEmployeePicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    Select another candidate
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Choose an employee to continue or
                    start their pre-boarding workflow.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowEmployeePicker(
                      false
                    )
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2 p-6">
                {employees.map(
                  (employee) => {
                    const id =
                      getEmployeeId(
                        employee
                      );

                    const journey =
                      findJourneyForEmployee(
                        id
                      );

                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() =>
                          selectEmployee(
                            id
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg border border-ink-200 bg-white p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        <div>
                          <p className="font-medium text-ink-900">
                            {getEmployeeName(
                              employee
                            )}
                          </p>

                          <p className="mt-1 text-xs text-ink-500">
                            {getEmployeeDepartment(
                              employee
                            )}{" "}
                            ·{" "}
                            {getEmployeeRole(
                              employee
                            )}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            journey
                              ? "bg-brand-50 text-brand-700"
                              : "bg-ink-50 text-ink-600"
                          }`}
                        >
                          {journey
                            ? "Existing workflow"
                            : "New candidate"}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================
            CREATE JOURNEY MODAL
        ===================================================== */}

        {showCreateJourney && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    Start pre-boarding
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Create the onboarding checklist for this
                    candidate.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreateJourney(
                      false
                    )
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={
                  createJourneyForEmployee
                }
                className="space-y-5 p-6"
              >
                <div className="rounded-lg bg-canvas p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    Employee
                  </p>

                  <p className="mt-1 text-base font-semibold text-ink-900">
                    {getEmployeeName(
                      selectedEmployee
                    )}
                  </p>

                  <p className="mt-1 text-sm text-ink-500">
                    {getEmployeeDepartment(
                      selectedEmployee
                    )}{" "}
                    ·{" "}
                    {getEmployeeRole(
                      selectedEmployee
                    )}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Joining date
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      newJoiningDate
                    }
                    onChange={(event) =>
                      setNewJoiningDate(
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="rounded-lg bg-brand-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                    Checklist included
                  </p>

                  <ul className="mt-2 space-y-2 text-sm text-ink-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Employee documents
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Employment paperwork
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Employee system access
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Workstation and equipment
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Orientation
                    </li>

                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-600" />
                      Manager or buddy assignment
                    </li>
                  </ul>
                </div>

                <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreateJourney(
                        false
                      )
                    }
                    className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !selectedEmployeeId ||
                      !newJoiningDate
                    }
                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Creating..."
                      : "Start pre-boarding"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =====================================================
            TASK DETAILS MODAL
        ===================================================== */}

        {selectedTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
              <div className="flex items-start justify-between border-b border-ink-100 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    {(() => {
                      const Icon =
                        getTaskIcon(
                          selectedTask
                        );

                      return (
                        <Icon className="h-5 w-5" />
                      );
                    })()}
                  </div>

                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">
                      {
                        selectedTask.title
                      }
                    </h2>

                    <p className="mt-1 text-sm text-ink-500">
                      Onboarding task details
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedTask(
                      null
                    )
                  }
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-xs font-medium text-ink-400">
                    Description
                  </p>

                  <p className="mt-1 text-sm leading-6 text-ink-700">
                    {selectedTask.description ||
                      "No description provided."}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-ink-400">
                      Category
                    </p>

                    <p className="mt-1 text-sm font-medium text-ink-800">
                      {selectedTask.category ||
                        "General"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-ink-400">
                      Due date
                    </p>

                    <p className="mt-1 text-sm font-medium text-ink-800">
                      {formatDateLong(
                        getTaskDueDate(
                          selectedTask
                        )
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-ink-400">
                    Status
                  </label>

                  <select
                    value={normalizeTaskStatus(
                      selectedTask.status
                    )}
                    disabled={
                      saving
                    }
                    onChange={async (
                      event
                    ) => {
                      await updateTaskStatus(
                        selectedTask,
                        event.target.value
                      );

                      /*
                       * Refresh modal task from
                       * latest journey after save.
                       */
                      const updatedTask =
                        tasks.find(
                          (task) =>
                            String(
                              task.id
                            ) ===
                            String(
                              selectedTask.id
                            )
                        );

                      if (
                        updatedTask
                      ) {
                        setSelectedTask(
                          updatedTask
                        );
                      }
                    }}
                    className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 outline-none focus:border-brand-500"
                  >
                    <option value="not_started">
                      Not started
                    </option>

                    <option value="in_progress">
                      In progress
                    </option>

                    <option value="completed">
                      Completed
                    </option>

                    <option value="blocked">
                      Blocked
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between border-t border-ink-100 p-5">
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    deleteTask(
                      selectedTask.id
                    )
                  }
                  className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete task
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedTask(
                      null
                    )
                  }
                  className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}