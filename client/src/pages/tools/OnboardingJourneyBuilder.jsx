import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabaseClient";

import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock3,
  Users,
  CalendarDays,
  Route,
  RefreshCw,
  X,
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

/*
 * Always attach the current Supabase access token.
 */
api.interceptors.request.use(async (config) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers.Authorization =
        `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.error(
      "[Onboarding] Could not get auth session:",
      error
    );
  }

  config.headers["Content-Type"] =
    config.headers["Content-Type"] ||
    "application/json";

  return config;
});

/* =========================================================
   DEFAULT TASKS
========================================================= */

const DEFAULT_TASKS = [
  {
    title: "Collect employee documents",
    description:
      "Collect required documents before the employee's first day.",
    category: "Documents",
  },
  {
    title: "Create employee profile",
    description:
      "Prepare the employee's HR profile and basic information.",
    category: "HR Setup",
  },
  {
    title: "Prepare IT access",
    description:
      "Ensure required accounts and system access are ready.",
    category: "IT",
  },
  {
    title: "Prepare equipment",
    description:
      "Assign and prepare laptop, accessories, and other equipment.",
    category: "Equipment",
  },
];

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
  const fullName =
    employee?.full_name ||
    employee?.fullName ||
    employee?.name;

  if (fullName) {
    return fullName;
  }

  const combinedName =
    `${employee?.firstName || ""} ${
      employee?.lastName || ""
    }`.trim();

  return (
    combinedName ||
    employee?.email ||
    "Unnamed employee"
  );
}

function getOrganizationId(employee) {
  return (
    employee?.organization_id ||
    employee?.organizationId ||
    null
  );
}

function formatDate(date) {
  if (!date) {
    return "Not set";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getJourneyStatusClass(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";

    case "in_progress":
      return "bg-blue-50 text-blue-700";

    case "cancelled":
      return "bg-red-50 text-red-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function getTaskStatusClass(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700";

    case "in_progress":
      return "bg-blue-50 text-blue-700";

    case "skipped":
      return "bg-gray-100 text-gray-500";

    default:
      return "bg-amber-50 text-amber-700";
  }
}

function getTasks(journey) {
  return (
    journey?.onboarding_journey_tasks ||
    journey?.onboarding_tasks ||
    journey?.tasks ||
    []
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function OnboardingJourneyBuilder() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [journeys, setJourneys] = useState([]);

  const [organizationId, setOrganizationId] =
    useState("");

  const [selectedJourney, setSelectedJourney] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingJourney, setLoadingJourney] =
    useState(false);
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] =
    useState(false);

  const [showTaskForm, setShowTaskForm] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newJourney, setNewJourney] =
    useState({
      employeeId: "",
      joiningDate: "",
    });

  const [newTask, setNewTask] =
    useState({
      title: "",
      description: "",
      category: "General",
      dueDate: "",
    });

  /* =========================================================
     API ERROR MESSAGE
  ========================================================= */

  function getErrorMessage(error, fallback) {
    return (
      error?.response?.data?.message ||
      error?.message ||
      fallback
    );
  }

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
        Array.isArray(list) ? list : [];

      setEmployees(normalized);

      /*
       * Employees come from the current organization.
       * The employee API returns organization_id.
       */
      const firstEmployee =
        normalized.find(
          (employee) =>
            getOrganizationId(employee)
        );

      const detectedOrganizationId =
        getOrganizationId(firstEmployee);

      if (detectedOrganizationId) {
        setOrganizationId(
          String(detectedOrganizationId)
        );
      }

      return normalized;
    } catch (error) {
      console.error(
        "[Onboarding] Failed to load employees:",
        error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Unable to load employees."
        )
      );
    }
  }

  /* =========================================================
     LOAD JOURNEYS
  ========================================================= */

  async function loadJourneys(
    currentOrganizationId = organizationId,
    preserveSelection = true
  ) {
    if (!currentOrganizationId) {
      setJourneys([]);
      return;
    }

    try {
      const response =
        await api.get(
          "/onboarding/journeys",
          {
            params: {
              organizationId:
                currentOrganizationId,
            },
          }
        );

      const list =
        response?.data?.journeys ||
        response?.data?.data ||
        [];

      const normalized =
        Array.isArray(list) ? list : [];

      setJourneys(normalized);

      if (
        preserveSelection &&
        selectedJourney?.id
      ) {
        const refreshed =
          normalized.find(
            (journey) =>
              String(journey.id) ===
              String(selectedJourney.id)
          );

        if (refreshed) {
          setSelectedJourney(refreshed);
        }
      }

      return normalized;
    } catch (error) {
      console.error(
        "[Onboarding] Failed to load journeys:",
        error
      );

      throw new Error(
        getErrorMessage(
          error,
          "Unable to load onboarding journeys."
        )
      );
    }
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
        /*
         * IMPORTANT:
         * Load employees first so we can obtain
         * organization_id before loading journeys.
         */
        const employeeList =
          await loadEmployees();

        if (!mounted) {
          return;
        }

        const firstEmployee =
          employeeList.find(
            (employee) =>
              getOrganizationId(employee)
          );

        const detectedOrganizationId =
          getOrganizationId(firstEmployee);

        if (!detectedOrganizationId) {
          throw new Error(
            "Organization ID could not be determined from the employee data."
          );
        }

        setOrganizationId(
          String(detectedOrganizationId)
        );

        await loadJourneys(
          String(detectedOrganizationId),
          false
        );
      } catch (error) {
        console.error(
          "[Onboarding] Initialization failed:",
          error
        );

        if (mounted) {
          setError(
            error?.message ||
              "Unable to load onboarding data."
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
     REAL-TIME REFRESH
  ========================================================= */

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const interval =
      setInterval(async () => {
        try {
          await loadJourneys(
            organizationId,
            true
          );
        } catch (error) {
          console.error(
            "[Onboarding] Background refresh failed:",
            error
          );
        }
      }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [
    organizationId,
    selectedJourney?.id,
  ]);

  /* =========================================================
     OPEN JOURNEY
  ========================================================= */

  async function openJourney(journey) {
    if (!journey?.id) {
      return;
    }

    setLoadingJourney(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await api.get(
          `/onboarding/journeys/${journey.id}`,
          {
            params: {
              organizationId,
            },
          }
        );

      const openedJourney =
        response?.data?.journey ||
        journey;

      setSelectedJourney(
        openedJourney
      );
    } catch (error) {
      console.error(
        "[Onboarding] Failed to open journey:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Unable to open onboarding journey."
        )
      );
    } finally {
      setLoadingJourney(false);
    }
  }

  /* =========================================================
     CREATE JOURNEY
  ========================================================= */

  async function handleCreateJourney(event) {
    event.preventDefault();

    if (!newJourney.employeeId) {
      setError("Please select an employee.");
      return;
    }

    if (!newJourney.joiningDate) {
      setError("Please select a joining date.");
      return;
    }

    if (!organizationId) {
      setError(
        "Organization ID is not available. Refresh the page and try again."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await api.post(
          "/onboarding/journeys",
          {
            organizationId,
            employeeId:
              newJourney.employeeId,
            joiningDate:
              newJourney.joiningDate,
          }
        );

      const journey =
        response?.data?.journey;

      if (!journey?.id) {
        throw new Error(
          "Journey was created but the server did not return a journey ID."
        );
      }

      /*
       * Automatically create the four
       * standard onboarding tasks.
       */
      for (const task of DEFAULT_TASKS) {
        try {
          await api.post(
            `/onboarding/journeys/${journey.id}/tasks`,
            {
              organizationId,
              title: task.title,
              description:
                task.description,
              category: task.category,
            }
          );
        } catch (taskError) {
          console.error(
            "[Onboarding] Default task creation failed:",
            taskError
          );
        }
      }

      setShowCreate(false);

      setNewJourney({
        employeeId: "",
        joiningDate: "",
      });

      setSuccess(
        "Onboarding journey created successfully."
      );

      await loadJourneys(
        organizationId,
        false
      );

      /*
       * Open the newly created journey.
       */
      await openJourney(journey);
    } catch (error) {
      console.error(
        "[Onboarding] Create journey failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to create onboarding journey."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     UPDATE JOURNEY STATUS
  ========================================================= */

  async function updateJourneyStatus(status) {
    if (!selectedJourney?.id) {
      return;
    }

    if (!organizationId) {
      setError(
        "Organization ID is not available."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await api.patch(
          `/onboarding/journeys/${selectedJourney.id}/status`,
          {
            organizationId,
            status,
          }
        );

      const updatedJourney =
        response?.data?.journey;

      if (updatedJourney) {
        setSelectedJourney(
          updatedJourney
        );
      } else {
        await openJourney(
          selectedJourney
        );
      }

      await loadJourneys(
        organizationId,
        true
      );

      setSuccess(
        status === "completed"
          ? "Journey completed successfully."
          : "Journey started successfully."
      );
    } catch (error) {
      console.error(
        "[Onboarding] Status update failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to update journey status."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     CREATE TASK
  ========================================================= */

  async function handleCreateTask(event) {
    event.preventDefault();

    if (!selectedJourney?.id) {
      return;
    }

    if (!newTask.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!organizationId) {
      setError(
        "Organization ID is not available."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.post(
        `/onboarding/journeys/${selectedJourney.id}/tasks`,
        {
          organizationId,
          title:
            newTask.title.trim(),
          description:
            newTask.description.trim(),
          category:
            newTask.category,
          dueDate:
            newTask.dueDate || null,
        }
      );

      setNewTask({
        title: "",
        description: "",
        category: "General",
        dueDate: "",
      });

      setShowTaskForm(false);

      await openJourney(
        selectedJourney
      );

      setSuccess(
        "Onboarding task added successfully."
      );
    } catch (error) {
      console.error(
        "[Onboarding] Create task failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to create onboarding task."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     UPDATE TASK
  ========================================================= */

  async function updateTask(
    taskId,
    updates
  ) {
    if (!taskId) {
      return;
    }

    if (!organizationId) {
      setError(
        "Organization ID is not available."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.patch(
        `/onboarding/tasks/${taskId}`,
        {
          organizationId,
          ...updates,
        }
      );

      await openJourney(
        selectedJourney
      );

      setSuccess(
        "Task updated successfully."
      );
    } catch (error) {
      console.error(
        "[Onboarding] Task update failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to update task."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     DELETE TASK
  ========================================================= */

  async function deleteTask(taskId) {
    if (!taskId) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this onboarding task?"
      );

    if (!confirmed) {
      return;
    }

    if (!organizationId) {
      setError(
        "Organization ID is not available."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await api.delete(
        `/onboarding/tasks/${taskId}`,
        {
          data: {
            organizationId,
          },
        }
      );

      await openJourney(
        selectedJourney
      );

      setSuccess(
        "Task deleted successfully."
      );
    } catch (error) {
      console.error(
        "[Onboarding] Task deletion failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Failed to delete task."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     CALCULATED DATA
  ========================================================= */

  const tasks = useMemo(
    () =>
      getTasks(selectedJourney),
    [selectedJourney]
  );

  const completedTasks =
    tasks.filter(
      (task) =>
        task?.status === "completed"
    ).length;

  const progress =
    tasks.length === 0
      ? 0
      : Math.round(
          (completedTasks /
            tasks.length) *
            100
        );

  const selectedEmployee =
    employees.find(
      (employee) =>
        String(
          getEmployeeId(employee)
        ) ===
        String(
          selectedJourney?.employee_id ||
            selectedJourney?.employeeId
        )
    );

  /* =========================================================
     REFRESH EVERYTHING
  ========================================================= */

  async function refreshData() {
    setError("");

    try {
      const employeeList =
        await loadEmployees();

      const firstEmployee =
        employeeList.find(
          (employee) =>
            getOrganizationId(employee)
        );

      const detectedOrganizationId =
        getOrganizationId(
          firstEmployee
        );

      if (!detectedOrganizationId) {
        throw new Error(
          "Organization ID could not be determined."
        );
      }

      setOrganizationId(
        String(detectedOrganizationId)
      );

      await loadJourneys(
        String(detectedOrganizationId),
        Boolean(selectedJourney)
      );
    } catch (error) {
      console.error(
        "[Onboarding] Refresh failed:",
        error
      );

      setError(
        getErrorMessage(
          error,
          "Unable to refresh onboarding data."
        )
      );
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-full min-w-0 bg-canvas px-6 py-8">
      <div className="mx-auto max-w-6xl">

        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() => {
            if (selectedJourney) {
              setSelectedJourney(null);
              setError("");
              setSuccess("");
              return;
            }

            navigate(-1);
          }}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />

          {selectedJourney
            ? "Back to journeys"
            : "Back"}
        </button>

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <Route className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-ink-900">
                  Onboarding Journey Builder
                </h1>

                <p className="mt-1 text-sm text-ink-500">
                  Build and track consistent onboarding journeys for new hires.
                </p>
              </div>
            </div>
          </div>

          {!selectedJourney && (
            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setShowCreate(true);
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              New journey
            </button>
          )}
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

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

        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{success}</span>

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

        {/* =================================================
            JOURNEY LIST
        ================================================= */}

        {!selectedJourney && (
          <>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Onboarding Journeys
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Create and track structured onboarding journeys for each new hire.
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={refreshData}
                className="flex items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="card p-10 text-center text-sm text-ink-500">
                Loading onboarding journeys...
              </div>
            ) : journeys.length === 0 ? (
              <div className="card p-10 text-center">
                <Route className="mx-auto h-10 w-10 text-ink-300" />

                <h3 className="mt-4 text-base font-semibold text-ink-900">
                  No onboarding journeys yet
                </h3>

                <p className="mt-1 text-sm text-ink-500">
                  Create a journey for a new hire to start tracking their onboarding.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(true)
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Create journey
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {journeys.map(
                  (journey) => {
                    const journeyTasks =
                      getTasks(journey);

                    const completed =
                      journeyTasks.filter(
                        (task) =>
                          task?.status ===
                          "completed"
                      ).length;

                    const journeyProgress =
                      journeyTasks.length ===
                      0
                        ? 0
                        : Math.round(
                            (completed /
                              journeyTasks.length) *
                              100
                          );

                    const employee =
                      employees.find(
                        (item) =>
                          String(
                            getEmployeeId(
                              item
                            )
                          ) ===
                          String(
                            journey.employee_id ||
                              journey.employeeId
                          )
                      );

                    return (
                      <button
                        key={journey.id}
                        type="button"
                        onClick={() =>
                          openJourney(
                            journey
                          )
                        }
                        className="card text-left transition hover:-translate-y-0.5 hover:shadow-md"
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
                                  {formatDate(
                                    journey.joining_date ||
                                      journey.joiningDate
                                  )}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${getJourneyStatusClass(
                                journey.status
                              )}`}
                            >
                              {(
                                journey.status ||
                                "not_started"
                              ).replace(
                                "_",
                                " "
                              )}
                            </span>
                          </div>

                          <div className="mt-5">
                            <div className="mb-2 flex justify-between text-xs">
                              <span className="text-ink-500">
                                Progress
                              </span>

                              <span className="font-medium text-ink-700">
                                {
                                  journeyProgress
                                }
                                %
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

                          <div className="mt-4 flex items-center gap-4 text-xs text-ink-500">
                            <span>
                              {completed} /{" "}
                              {
                                journeyTasks.length
                              }{" "}
                              tasks completed
                            </span>

                            <span>
                              View journey →
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </>
        )}

        {/* =================================================
            JOURNEY DETAILS
        ================================================= */}

        {selectedJourney && (
          <>
            {loadingJourney ? (
              <div className="card p-10 text-center text-sm text-ink-500">
                Loading journey...
              </div>
            ) : (
              <>
                {/* EMPLOYEE HEADER */}

                <div className="card mb-5 p-6">
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
                            {formatDate(
                              selectedJourney.joining_date ||
                                selectedJourney.joiningDate
                            )}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${getJourneyStatusClass(
                              selectedJourney.status
                            )}`}
                          >
                            {(
                              selectedJourney.status ||
                              "not_started"
                            ).replace(
                              "_",
                              " "
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedJourney.status !==
                        "in_progress" &&
                        selectedJourney.status !==
                          "completed" && (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              updateJourneyStatus(
                                "in_progress"
                              )
                            }
                            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                          >
                            Start journey
                          </button>
                        )}

                      {selectedJourney.status ===
                        "in_progress" && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            updateJourneyStatus(
                              "completed"
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Complete journey
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          openJourney(
                            selectedJourney
                          )
                        }
                        className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                {/* PROGRESS */}

                <div className="card mb-5 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-ink-900">
                        Onboarding progress
                      </h3>

                      <p className="mt-1 text-sm text-ink-500">
                        {completedTasks} of{" "}
                        {tasks.length}{" "}
                        tasks completed
                      </p>
                    </div>

                    <span className="text-2xl font-semibold text-brand-700">
                      {progress}%
                    </span>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>

                {/* TASKS */}

                <div className="card p-6">
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-ink-900">
                        Onboarding tasks
                      </h3>

                      <p className="mt-1 text-sm text-ink-500">
                        Track every preparation step before the employee joins.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowTaskForm(true)
                      }
                      disabled={saving}
                      className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add task
                    </button>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-ink-200 p-8 text-center">
                      <p className="text-sm text-ink-500">
                        No tasks have been added yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map(
                        (task) => (
                          <div
                            key={task.id}
                            className="rounded-xl border border-ink-100 bg-white p-4"
                          >
                            <div className="flex items-start gap-4">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  updateTask(
                                    task.id,
                                    {
                                      status:
                                        task.status ===
                                        "completed"
                                          ? "pending"
                                          : "completed",
                                    }
                                  )
                                }
                                className="mt-0.5 shrink-0"
                                title={
                                  task.status ===
                                  "completed"
                                    ? "Mark as pending"
                                    : "Mark as completed"
                                }
                              >
                                {task.status ===
                                "completed" ? (
                                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                ) : (
                                  <Circle className="h-6 w-6 text-ink-300" />
                                )}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4
                                    className={`font-medium ${
                                      task.status ===
                                      "completed"
                                        ? "text-ink-400 line-through"
                                        : "text-ink-900"
                                    }`}
                                  >
                                    {task.title}
                                  </h4>

                                  <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-500">
                                    {task.category ||
                                      "General"}
                                  </span>

                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusClass(
                                      task.status
                                    )}`}
                                  >
                                    {(
                                      task.status ||
                                      "pending"
                                    ).replace(
                                      "_",
                                      " "
                                    )}
                                  </span>
                                </div>

                                {task.description && (
                                  <p className="mt-1 text-sm text-ink-500">
                                    {
                                      task.description
                                    }
                                  </p>
                                )}

                                {(task.due_date ||
                                  task.dueDate) && (
                                  <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                                    <Clock3 className="h-3.5 w-3.5" />

                                    Due{" "}
                                    {formatDate(
                                      task.due_date ||
                                        task.dueDate
                                    )}
                                  </p>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  deleteTask(
                                    task.id
                                  )
                                }
                                className="shrink-0 rounded-lg p-2 text-ink-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                title="Delete task"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* =================================================
            CREATE JOURNEY MODAL
        ================================================= */}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">
                    Create onboarding journey
                  </h2>

                  <p className="mt-1 text-sm text-ink-500">
                    Set up onboarding preparation for a new hire.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(false)
                  }
                  className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={
                  handleCreateJourney
                }
                className="space-y-5 p-6"
              >
                {/* EMPLOYEE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Employee
                  </label>

                  <select
                    required
                    value={
                      newJourney.employeeId
                    }
                    onChange={(event) =>
                      setNewJourney(
                        (current) => ({
                          ...current,
                          employeeId:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">
                      Select employee
                    </option>

                    {employees.map(
                      (employee) => (
                        <option
                          key={getEmployeeId(
                            employee
                          )}
                          value={getEmployeeId(
                            employee
                          )}
                        >
                          {getEmployeeName(
                            employee
                          )}
                        </option>
                      )
                    )}
                  </select>

                  {employees.length ===
                    0 && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      No employees were returned from the employee API.
                    </p>
                  )}
                </div>

                {/* JOINING DATE */}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Joining date
                  </label>

                  <input
                    type="date"
                    required
                    value={
                      newJourney.joiningDate
                    }
                    onChange={(event) =>
                      setNewJourney(
                        (current) => ({
                          ...current,
                          joiningDate:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                {/* DEFAULT TASKS */}

                <div className="rounded-lg bg-canvas p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    Included automatically
                  </p>

                  <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
                    {DEFAULT_TASKS.map(
                      (task) => (
                        <li
                          key={task.title}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle2 className="h-4 w-4 text-brand-600" />
                          {task.title}
                        </li>
                      )
                    )}
                  </ul>
                </div>

                {/* BUTTONS */}

                <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                  <button
                    type="button"
                    onClick={() =>
                      setShowCreate(false)
                    }
                    className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving ||
                      !newJourney.employeeId ||
                      !newJourney.joiningDate ||
                      !organizationId
                    }
                    className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving
                      ? "Creating..."
                      : "Create journey"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =================================================
            ADD TASK MODAL
        ================================================= */}

        {showTaskForm &&
          selectedJourney && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink-900">
                      Add onboarding task
                    </h2>

                    <p className="mt-1 text-sm text-ink-500">
                      Add another preparation step to this journey.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowTaskForm(false)
                    }
                    className="rounded-lg p-2 text-ink-400 hover:bg-ink-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form
                  onSubmit={
                    handleCreateTask
                  }
                  className="space-y-5 p-6"
                >
                  {/* TITLE */}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Task title
                    </label>

                    <input
                      required
                      value={newTask.title}
                      onChange={(event) =>
                        setNewTask(
                          (current) => ({
                            ...current,
                            title:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="e.g. Schedule welcome meeting"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>

                  {/* DESCRIPTION */}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-ink-700">
                      Description
                    </label>

                    <textarea
                      rows={3}
                      value={
                        newTask.description
                      }
                      onChange={(event) =>
                        setNewTask(
                          (current) => ({
                            ...current,
                            description:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder="Describe what needs to be completed."
                      className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                    />
                  </div>

                  {/* CATEGORY + DATE */}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ink-700">
                        Category
                      </label>

                      <select
                        value={
                          newTask.category
                        }
                        onChange={(event) =>
                          setNewTask(
                            (current) => ({
                              ...current,
                              category:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                      >
                        <option>
                          General
                        </option>

                        <option>
                          Documents
                        </option>

                        <option>
                          HR Setup
                        </option>

                        <option>
                          IT
                        </option>

                        <option>
                          Equipment
                        </option>

                        <option>
                          Training
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-ink-700">
                        Due date
                      </label>

                      <input
                        type="date"
                        value={
                          newTask.dueDate
                        }
                        onChange={(event) =>
                          setNewTask(
                            (current) => ({
                              ...current,
                              dueDate:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  {/* BUTTONS */}

                  <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                    <button
                      type="button"
                      onClick={() =>
                        setShowTaskForm(false)
                      }
                      className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={
                        saving ||
                        !newTask.title.trim()
                      }
                      className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving
                        ? "Adding..."
                        : "Add task"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}