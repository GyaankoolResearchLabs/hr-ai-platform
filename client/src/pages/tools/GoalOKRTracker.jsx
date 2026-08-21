import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../../lib/supabaseClient";
import toast from "react-hot-toast";

import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Target,
  Users,
  TrendingUp,
  CalendarDays,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  AlertCircle,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers = config.headers || {};
    config.headers.Authorization =
      `Bearer ${session.access_token}`;
  }

  return config;
});

function getEmployeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    employee?.employeeId ||
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
    employee?.designation ||
    employee?.job_title ||
    "—"
  );
}

function getEmployeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "—"
  );
}

function formatDate(value) {
  if (!value) return "—";

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

function getStatusLabel(status) {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "at_risk":
      return "At risk";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "Not started";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "in_progress":
      return "bg-blue-50 text-blue-700 border-blue-200";

    case "at_risk":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-ink-50 text-ink-600 border-ink-200";
  }
}

const EMPTY_FORM = {
  employeeId: "",
  title: "",
  description: "",
  type: "goal",
  category: "",
  startDate: "",
  dueDate: "",
  targetValue: "",
  unit: "",
  progress: 0,
  status: "not_started",
};

export default function GoalOKRTracker() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [goals, setGoals] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadData(showRefreshState = false) {
    try {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [employeesResponse, goalsResponse] =
        await Promise.all([
          api.get("/employees"),
          api.get("/goal-okr"),
        ]);

      const employeeData =
        Array.isArray(employeesResponse?.data)
          ? employeesResponse.data
          : employeesResponse?.data?.employees || [];

      const goalData =
        Array.isArray(goalsResponse?.data)
          ? goalsResponse.data
          : goalsResponse?.data?.goals || [];

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : []
      );

      setGoals(
        Array.isArray(goalData)
          ? goalData
          : []
      );
    } catch (err) {
      console.error(
        "[GoalOKRTracker] Failed to load data:",
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Unable to load goals and OKRs."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const employeeMap = useMemo(() => {
    return new Map(
      employees.map((employee) => [
        String(getEmployeeId(employee)),
        employee,
      ])
    );
  }, [employees]);

  const enrichedGoals = useMemo(() => {
    return goals.map((goal) => {
      const employeeId =
        goal?.employee_id ||
        goal?.employeeId ||
        goal?.owner_id ||
        goal?.ownerId;

      const employee = employeeMap.get(
        String(employeeId)
      );

      return {
        ...goal,
        employee,
      };
    });
  }, [goals, employeeMap]);

  const filteredGoals = useMemo(() => {
    const value = search.trim().toLowerCase();

    return enrichedGoals.filter((goal) => {
      const employeeName = getEmployeeName(
        goal.employee
      ).toLowerCase();

      const department = getEmployeeDepartment(
        goal.employee
      ).toLowerCase();

      const title =
        String(goal.title || "").toLowerCase();

      const description =
        String(goal.description || "").toLowerCase();

      const matchesSearch =
        !value ||
        employeeName.includes(value) ||
        department.includes(value) ||
        title.includes(value) ||
        description.includes(value);

      const matchesStatus =
        statusFilter === "all" ||
        goal.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [
    enrichedGoals,
    search,
    statusFilter,
  ]);

  const metrics = useMemo(() => {
    const total = goals.length;

    const completed = goals.filter(
      (goal) => goal.status === "completed"
    ).length;

    const inProgress = goals.filter(
      (goal) => goal.status === "in_progress"
    ).length;

    const atRisk = goals.filter(
      (goal) => goal.status === "at_risk"
    ).length;

    const averageProgress =
      total === 0
        ? 0
        : Math.round(
            goals.reduce(
              (sum, goal) =>
                sum +
                Number(goal.progress || 0),
              0
            ) / total
          );

    return {
      total,
      completed,
      inProgress,
      atRisk,
      averageProgress,
    };
  }, [goals]);

  function openCreateForm() {
    setEditingGoal(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(goal) {
    setEditingGoal(goal);

    setForm({
      employeeId:
        goal?.employee_id ||
        goal?.employeeId ||
        goal?.owner_id ||
        goal?.ownerId ||
        "",
      title: goal?.title || "",
      description:
        goal?.description || "",
      type:
        goal?.type ||
        "goal",
      category:
        goal?.category || "",
      startDate:
        goal?.start_date ||
        goal?.startDate ||
        "",
      dueDate:
        goal?.due_date ||
        goal?.dueDate ||
        "",
      targetValue:
        goal?.target_value ??
        goal?.targetValue ??
        "",
      unit:
        goal?.unit || "",
      progress:
        Number(goal?.progress || 0),
      status:
        goal?.status ||
        "not_started",
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingGoal(null);
    setForm(EMPTY_FORM);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.employeeId) {
      toast.error(
        "Select an employee."
      );
      return;
    }

    if (!form.title.trim()) {
      toast.error(
        "Goal title is required."
      );
      return;
    }

    if (
      form.dueDate &&
      form.startDate &&
      form.dueDate < form.startDate
    ) {
      toast.error(
        "Due date cannot be before the start date."
      );
      return;
    }

    const progress = Math.min(
      100,
      Math.max(
        0,
        Number(form.progress || 0)
      )
    );

    try {
      setSaving(true);

      const payload = {
        employeeId: form.employeeId,
        title: form.title.trim(),
        description:
          form.description.trim(),
        type: form.type,
        category:
          form.category.trim(),
        startDate:
          form.startDate || null,
        dueDate:
          form.dueDate || null,
        targetValue:
          form.targetValue === ""
            ? null
            : Number(form.targetValue),
        unit:
          form.unit.trim(),
        progress,
        status: form.status,
      };

      if (editingGoal?.id) {
        const response = await api.patch(
          `/goal-okr/${editingGoal.id}`,
          payload
        );

        const updatedGoal =
          response?.data?.goal;

        if (updatedGoal) {
          setGoals((current) =>
            current.map((goal) =>
              goal.id === editingGoal.id
                ? updatedGoal
                : goal
            )
          );
        }

        toast.success(
          "Goal updated successfully."
        );
      } else {
        const response = await api.post(
          "/goal-okr",
          payload
        );

        const createdGoal =
          response?.data?.goal;

        if (createdGoal) {
          setGoals((current) => [
            createdGoal,
            ...current,
          ]);
        }

        toast.success(
          "Goal created successfully."
        );
      }

      closeForm();
    } catch (err) {
      console.error(
        "[GoalOKRTracker] Save failed:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save goal."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateProgress(goal, value) {
    const progress = Math.min(
      100,
      Math.max(0, Number(value))
    );

    let status =
      goal.status || "not_started";

    if (progress === 100) {
      status = "completed";
    } else if (
      progress > 0 &&
      status === "not_started"
    ) {
      status = "in_progress";
    }

    try {
      const response = await api.patch(
        `/goal-okr/${goal.id}`,
        {
          progress,
          status,
        }
      );

      const updatedGoal =
        response?.data?.goal;

      if (updatedGoal) {
        setGoals((current) =>
          current.map((item) =>
            item.id === goal.id
              ? updatedGoal
              : item
          )
        );
      }

      toast.success(
        "Progress updated."
      );
    } catch (err) {
      console.error(
        "[GoalOKRTracker] Progress update failed:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to update progress."
      );
    }
  }

  async function updateStatus(goal, status) {
    try {
      const response = await api.patch(
        `/goal-okr/${goal.id}`,
        {
          status,
        }
      );

      const updatedGoal =
        response?.data?.goal;

      if (updatedGoal) {
        setGoals((current) =>
          current.map((item) =>
            item.id === goal.id
              ? updatedGoal
              : item
          )
        );
      }

      toast.success(
        "Status updated."
      );
    } catch (err) {
      console.error(
        "[GoalOKRTracker] Status update failed:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to update status."
      );
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    try {
      setDeleting(true);

      await api.delete(
        `/goal-okr/${deleteId}`
      );

      setGoals((current) =>
        current.filter(
          (goal) =>
            goal.id !== deleteId
        )
      );

      setDeleteId(null);

      toast.success(
        "Goal deleted successfully."
      );
    } catch (err) {
      console.error(
        "[GoalOKRTracker] Delete failed:",
        err
      );

      toast.error(
        err?.response?.data?.message ||
          "Failed to delete goal."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Target className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              Goal & OKR Tracker
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              Set shared goals, assign ownership,
              and track progress continuously.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={
              loading || refreshing
            }
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-50"
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

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            New goal
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Target className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Total goals
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : metrics.total}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <TrendingUp className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Average progress
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : `${metrics.averageProgress}%`}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Check className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Completed
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : metrics.completed}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Users className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Employees with goals
              </p>

              <p className="mt-1 text-2xl font-semibold text-ink-900">
                {loading
                  ? "—"
                  : new Set(
                      goals
                        .map(
                          (goal) =>
                            goal.employee_id ||
                            goal.employeeId
                        )
                        .filter(Boolean)
                    ).size}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search goals, employees, departments..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="w-full appearance-none rounded-lg border border-ink-200 bg-white py-2.5 pl-3 pr-9 text-sm text-ink-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 lg:w-44"
            >
              <option value="all">
                All statuses
              </option>
              <option value="not_started">
                Not started
              </option>
              <option value="in_progress">
                In progress
              </option>
              <option value="at_risk">
                At risk
              </option>
              <option value="completed">
                Completed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Goals & OKRs
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Organization goals backed by
                real employee records.
              </p>
            </div>

            <span className="text-sm text-ink-400">
              {loading
                ? "Loading..."
                : `${filteredGoals.length} shown`}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-500">
            Loading goals...
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Target className="mx-auto h-9 w-9 text-ink-300" />

            <p className="mt-3 text-sm font-medium text-ink-700">
              {goals.length === 0
                ? "No goals or OKRs yet"
                : "No matching goals"}
            </p>

            <p className="mt-1 text-sm text-ink-400">
              {goals.length === 0
                ? "Create the first goal for an employee."
                : "Try changing your search or status filter."}
            </p>

            {goals.length === 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                Create first goal
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {filteredGoals.map((goal) => {
              const progress = Math.min(
                100,
                Math.max(
                  0,
                  Number(
                    goal.progress || 0
                  )
                )
              );

              const employee =
                goal.employee;

              return (
                <div
                  key={goal.id}
                  className="p-5 transition hover:bg-ink-50/40"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700">
                          {goal.type === "okr"
                            ? "OKR"
                            : "Goal"}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                            goal.status
                          )}`}
                        >
                          {getStatusLabel(
                            goal.status
                          )}
                        </span>
                      </div>

                      <h3 className="mt-3 text-base font-semibold text-ink-900">
                        {goal.title}
                      </h3>

                      {goal.description && (
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">
                          {goal.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                            {getEmployeeName(
                              employee
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <p className="font-medium text-ink-800">
                              {getEmployeeName(
                                employee
                              )}
                            </p>

                            <p className="text-xs text-ink-400">
                              {getEmployeeTitle(
                                employee
                              )}{" "}
                              ·{" "}
                              {getEmployeeDepartment(
                                employee
                              )}
                            </p>
                          </div>
                        </div>

                        {(goal.start_date ||
                          goal.startDate) && (
                          <div className="flex items-center gap-2 text-ink-500">
                            <CalendarDays className="h-4 w-4" />

                            <span>
                              {formatDate(
                                goal.start_date ||
                                  goal.startDate
                              )}
                            </span>
                          </div>
                        )}

                        {(goal.due_date ||
                          goal.dueDate) && (
                          <div className="flex items-center gap-2 text-ink-500">
                            <CalendarDays className="h-4 w-4" />

                            <span>
                              Due{" "}
                              {formatDate(
                                goal.due_date ||
                                  goal.dueDate
                              )}
                            </span>
                          </div>
                        )}

                        {goal.category && (
                          <span className="text-ink-500">
                            {goal.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(goal)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDeleteId(
                            goal.id
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl bg-canvas p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                          Progress
                        </p>

                        <p className="mt-1 text-sm font-semibold text-ink-800">
                          {progress}%
                          {goal.target_value != null &&
                            ` of ${goal.target_value}${
                              goal.unit
                                ? ` ${goal.unit}`
                                : ""
                            }`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={progress}
                          onChange={(event) =>
                            updateProgress(
                              goal,
                              event.target.value
                            )
                          }
                          className="w-20 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-right text-sm outline-none focus:border-brand-500"
                        />

                        <span className="text-sm text-ink-400">
                          %
                        </span>

                        <select
                          value={
                            goal.status ||
                            "not_started"
                          }
                          onChange={(event) =>
                            updateStatus(
                              goal,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-500"
                        >
                          <option value="not_started">
                            Not started
                          </option>
                          <option value="in_progress">
                            In progress
                          </option>
                          <option value="at_risk">
                            At risk
                          </option>
                          <option value="completed">
                            Completed
                          </option>
                          <option value="cancelled">
                            Cancelled
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-600 transition-all"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {editingGoal
                    ? "Edit goal"
                    : "Create goal"}
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Set a measurable goal and assign
                  clear ownership.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Employee
                  </label>

                  <select
                    value={form.employeeId}
                    onChange={(event) =>
                      updateForm(
                        "employeeId",
                        event.target.value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
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

                        return (
                          <option
                            key={id}
                            value={id}
                          >
                            {getEmployeeName(
                              employee
                            )}{" "}
                            —{" "}
                            {getEmployeeTitle(
                              employee
                            )}
                          </option>
                        );
                      }
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Type
                  </label>

                  <select
                    value={form.type}
                    onChange={(event) =>
                      updateForm(
                        "type",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="goal">
                      Goal
                    </option>
                    <option value="okr">
                      OKR
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Category
                  </label>

                  <input
                    type="text"
                    value={form.category}
                    onChange={(event) =>
                      updateForm(
                        "category",
                        event.target.value
                      )
                    }
                    placeholder="e.g. Sales, Product, Operations"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Goal title
                  </label>

                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      updateForm(
                        "title",
                        event.target.value
                      )
                    }
                    placeholder="What should be achieved?"
                    required
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Description
                  </label>

                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Describe the expected outcome and success criteria..."
                    className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Start date
                  </label>

                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      updateForm(
                        "startDate",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Due date
                  </label>

                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      updateForm(
                        "dueDate",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Target value
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.targetValue}
                    onChange={(event) =>
                      updateForm(
                        "targetValue",
                        event.target.value
                      )
                    }
                    placeholder="e.g. 100"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Unit
                  </label>

                  <input
                    type="text"
                    value={form.unit}
                    onChange={(event) =>
                      updateForm(
                        "unit",
                        event.target.value
                      )
                    }
                    placeholder="e.g. customers, %, projects"
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Starting progress
                  </label>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(event) =>
                      updateForm(
                        "progress",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Status
                  </label>

                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value
                      )
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="not_started">
                      Not started
                    </option>
                    <option value="in_progress">
                      In progress
                    </option>
                    <option value="at_risk">
                      At risk
                    </option>
                    <option value="completed">
                      Completed
                    </option>
                    <option value="cancelled">
                      Cancelled
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}

                  {editingGoal
                    ? "Save changes"
                    : "Create goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-ink-900">
              Delete this goal?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              This permanently removes the goal
              and its recorded progress from the
              organization.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setDeleteId(null)
                }
                disabled={deleting}
                className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}

                Delete goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}