import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FilePlus2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import api from "../../services/api";

const EMPTY_FORM = {
  requirement_id: "",
  title: "",
  due_date: "",
  status: "upcoming",
  notes: "",
};

const EMPTY_REQUIREMENT_FORM = {
  name: "",
  description: "",
  jurisdiction: "",
  authority: "",
  compliance_type: "",
  frequency: "",
  alert_days_before: "7",
  status: "active",
};

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getDeadlineStatus(deadline) {
  if (deadline.status === "completed") {
    return "completed";
  }

  if (!deadline.due_date) {
    return deadline.status || "upcoming";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${deadline.due_date}T00:00:00`);

  if (Number.isNaN(dueDate.getTime())) {
    return deadline.status || "upcoming";
  }

  if (dueDate < today) {
    return "overdue";
  }

  if (dueDate.getTime() === today.getTime()) {
    return "due";
  }

  return deadline.status || "upcoming";
}

function getStatusClasses(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "overdue":
      return "border-red-200 bg-red-50 text-red-700";

    case "due":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
}

function getStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return "Completed";

    case "overdue":
      return "Overdue";

    case "due":
      return "Due today";

    default:
      return "Upcoming";
  }
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-500">
          {label}
        </p>

        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 text-gray-600">
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold text-gray-950">
        {value}
      </p>
    </div>
  );
}

export default function ComplianceCalendar() {
  const navigate = useNavigate();

  const [deadlines, setDeadlines] = useState([]);

  const [requirements, setRequirements] = useState([]);

  const [requirementsLoading, setRequirementsLoading] =
    useState(false);

  const [totals, setTotals] = useState({
    total: 0,
    upcoming: 0,
    overdue: 0,
    completed: 0,
  });

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("");

  const [showCreate, setShowCreate] = useState(false);

  const [showRequirementCreate, setShowRequirementCreate] =
    useState(false);

  const [editingDeadline, setEditingDeadline] =
    useState(null);

  const [saving, setSaving] = useState(false);

  const [creatingRequirement, setCreatingRequirement] =
    useState(false);

  const [form, setForm] = useState(EMPTY_FORM);

  const [requirementForm, setRequirementForm] = useState(
    EMPTY_REQUIREMENT_FORM,
  );

  const [actionId, setActionId] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | LOAD REQUIREMENTS
  |--------------------------------------------------------------------------
  */

  async function loadRequirements() {
    try {
      setRequirementsLoading(true);

      const response = await api.get(
        "/compliance-calendar/requirements",
      );

      const data = response?.data || {};

      setRequirements(
        Array.isArray(data.requirements)
          ? data.requirements
          : [],
      );
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Load requirements error:",
        err,
      );

      setRequirements([]);

      setError(
        err?.response?.data?.message ||
          "Failed to load compliance requirements.",
      );
    } finally {
      setRequirementsLoading(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | LOAD DEADLINES
  |--------------------------------------------------------------------------
  */

  async function loadDeadlines(showRefresh = false) {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(
        "/compliance-calendar",
      );

      const data = response?.data || {};

      const loadedDeadlines = Array.isArray(
        data.deadlines,
      )
        ? data.deadlines
        : [];

      setDeadlines(loadedDeadlines);

      try {
        const statsResponse = await api.get(
          "/compliance-calendar/stats",
        );

        const statsData =
          statsResponse?.data?.stats || {};

        setTotals({
          total: Number(statsData.total || 0),
          upcoming: Number(
            statsData.upcoming || 0,
          ),
          overdue: Number(
            statsData.overdue || 0,
          ),
          completed: Number(
            statsData.completed || 0,
          ),
        });
      } catch (statsError) {
        console.error(
          "[ComplianceCalendar] Stats error:",
          statsError,
        );

        const calculated = calculateTotals(
          loadedDeadlines,
        );

        setTotals(calculated);
      }
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Load error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to load compliance deadlines.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function calculateTotals(items) {
    let upcoming = 0;
    let overdue = 0;
    let completed = 0;

    items.forEach((deadline) => {
      const status =
        getDeadlineStatus(deadline);

      if (status === "completed") {
        completed += 1;
      } else if (status === "overdue") {
        overdue += 1;
      } else {
        upcoming += 1;
      }
    });

    return {
      total: items.length,
      upcoming,
      overdue,
      completed,
    };
  }

  useEffect(() => {
    loadDeadlines();
    loadRequirements();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredDeadlines = useMemo(() => {
    const query = search.trim().toLowerCase();

    return deadlines.filter((deadline) => {
      const effectiveStatus =
        getDeadlineStatus(deadline);

      const requirement = requirements.find(
        (item) =>
          String(item.id) ===
          String(deadline.requirement_id),
      );

      const requirementName =
        requirement?.name ||
        deadline.requirement_id ||
        "";

      const matchesSearch =
        !query ||
        String(deadline.title || "")
          .toLowerCase()
          .includes(query) ||
        String(requirementName)
          .toLowerCase()
          .includes(query) ||
        String(deadline.requirement_id || "")
          .toLowerCase()
          .includes(query) ||
        String(deadline.notes || "")
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        !statusFilter ||
        effectiveStatus === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    deadlines,
    requirements,
    search,
    statusFilter,
  ]);

  /*
  |--------------------------------------------------------------------------
  | FORM
  |--------------------------------------------------------------------------
  */

  function handleFormChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openCreate() {
    setEditingDeadline(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowCreate(true);

    if (requirements.length === 0) {
      loadRequirements();
    }
  }

  function openEdit(deadline) {
    setEditingDeadline(deadline);

    setForm({
      requirement_id:
        deadline.requirement_id || "",
      title:
        deadline.title || "",
      due_date:
        deadline.due_date || "",
      status:
        deadline.status === "completed"
          ? "completed"
          : "upcoming",
      notes:
        deadline.notes || "",
    });

    setError("");
    setShowCreate(true);
  }

  function closeModal() {
    if (saving) {
      return;
    }

    setShowCreate(false);
    setEditingDeadline(null);
    setForm(EMPTY_FORM);
  }

  function handleRequirementFormChange(event) {
    const {
      name,
      value,
    } = event.target;

    setRequirementForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openRequirementCreate() {
    setRequirementForm(EMPTY_REQUIREMENT_FORM);
    setError("");
    setShowRequirementCreate(true);
  }

  function closeRequirementCreate() {
    if (creatingRequirement) {
      return;
    }

    setShowRequirementCreate(false);
    setRequirementForm(EMPTY_REQUIREMENT_FORM);
  }

  async function handleRequirementSubmit(event) {
    event.preventDefault();

    if (creatingRequirement) {
      return;
    }

    setError("");

    if (!requirementForm.name.trim()) {
      setError(
        "Compliance requirement name is required.",
      );
      return;
    }

    try {
      setCreatingRequirement(true);

      const payload = {
        name: requirementForm.name.trim(),
        description:
          requirementForm.description.trim() || null,
        jurisdiction:
          requirementForm.jurisdiction.trim() || null,
        authority:
          requirementForm.authority.trim() || null,
        compliance_type:
          requirementForm.compliance_type.trim() || null,
        frequency:
          requirementForm.frequency.trim() || null,
        alert_days_before: Number(
          requirementForm.alert_days_before || 7,
        ),
        status:
          requirementForm.status || "active",
      };

      const response = await api.post(
        "/compliance-calendar/requirements",
        payload,
      );

      const createdRequirement =
        response?.data?.requirement;

      await loadRequirements();

      if (createdRequirement?.id) {
        setForm((previous) => ({
          ...previous,
          requirement_id: createdRequirement.id,
        }));
      }

      setShowRequirementCreate(false);
      setRequirementForm(EMPTY_REQUIREMENT_FORM);
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Create requirement error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to create compliance requirement.",
      );
    } finally {
      setCreatingRequirement(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | CREATE / UPDATE
  |--------------------------------------------------------------------------
  */

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setError("");

    if (!form.requirement_id.trim()) {
      setError(
        "Compliance requirement is required.",
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Deadline title is required.",
      );
      return;
    }

    if (!form.due_date) {
      setError(
        "Due date is required.",
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        requirement_id:
          form.requirement_id.trim(),

        title:
          form.title.trim(),

        due_date:
          form.due_date,

        status:
          form.status,

        notes:
          form.notes.trim() || null,
      };

      if (editingDeadline) {
        await api.put(
          `/compliance-calendar/${editingDeadline.id}`,
          payload,
        );
      } else {
        await api.post(
          "/compliance-calendar",
          payload,
        );
      }

      closeModal();

      await loadDeadlines(true);
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Save error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to save compliance deadline.",
      );
    } finally {
      setSaving(false);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | COMPLETE
  |--------------------------------------------------------------------------
  */

  async function handleComplete(deadline) {
    if (actionId) {
      return;
    }

    try {
      setActionId(deadline.id);
      setError("");

      await api.patch(
        `/compliance-calendar/${deadline.id}/complete`,
      );

      await loadDeadlines(true);
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Complete error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to complete compliance deadline.",
      );
    } finally {
      setActionId(null);
    }
  }

  /*
  |--------------------------------------------------------------------------
  | DELETE
  |--------------------------------------------------------------------------
  */

  async function handleDelete(deadline) {
    if (actionId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${deadline.title}"? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionId(deadline.id);
      setError("");

      await api.delete(
        `/compliance-calendar/${deadline.id}`,
      );

      await loadDeadlines(true);
    } catch (err) {
      console.error(
        "[ComplianceCalendar] Delete error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to delete compliance deadline.",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-w-0">
      {/* =====================================================
          BACK
      ===================================================== */}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />

        Back
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <CalendarDays
              className="h-6 w-6"
              strokeWidth={1.75}
            />
          </span>

          <div>
            <h1 className="text-2xl font-semibold text-gray-950">
              Compliance Calendar & Alerts
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Track statutory compliance
              deadlines and prevent missed
              filings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              loadDeadlines(true)
            }
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />

            New Deadline
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto shrink-0 text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Deadlines"
          value={totals.total}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Upcoming"
          value={totals.upcoming}
          icon={Clock3}
        />

        <SummaryCard
          label="Overdue"
          value={totals.overdue}
          icon={AlertCircle}
        />

        <SummaryCard
          label="Completed"
          value={totals.completed}
          icon={CheckCircle2}
        />
      </div>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search deadline, requirement or notes..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="">
              All statuses
            </option>

            <option value="upcoming">
              Upcoming
            </option>

            <option value="due">
              Due today
            </option>

            <option value="overdue">
              Overdue
            </option>

            <option value="completed">
              Completed
            </option>
          </select>
        </div>
      </div>

      {/* =====================================================
          DEADLINE LIST
      ===================================================== */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : filteredDeadlines.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <FilePlus2 className="h-10 w-10 text-gray-300" />

            <h3 className="mt-3 text-sm font-semibold text-gray-800">
              No compliance deadlines found
            </h3>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create your first compliance
              deadline to start tracking
              statutory obligations.
            </p>

            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />

              Create Deadline
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Requirement
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Deadline
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Due Date
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Notes
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredDeadlines.map(
                  (deadline) => {
                    const status =
                      getDeadlineStatus(
                        deadline,
                      );

                    const isActionRunning =
                      actionId ===
                      deadline.id;

                    return (
                      <tr
                        key={deadline.id}
                        className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-gray-900">
                            {requirements.find(
                              (requirement) =>
                                String(requirement.id) ===
                                String(deadline.requirement_id),
                            )?.name ||
                              deadline.requirement_id ||
                              "—"}
                          </p>

                          {deadline.requirement_id &&
                            requirements.find(
                              (requirement) =>
                                String(requirement.id) ===
                                String(deadline.requirement_id),
                            ) && (
                              <p className="mt-1 break-all text-xs text-gray-400">
                                {deadline.requirement_id}
                              </p>
                            )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-gray-900">
                            {deadline.title}
                          </p>

                          {deadline.created_at && (
                            <p className="mt-1 text-xs text-gray-400">
                              Created{" "}
                              {formatDate(
                                deadline.created_at,
                              )}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-gray-700">
                            {formatDate(
                              deadline.due_date,
                            )}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                              status,
                            )}`}
                          >
                            {getStatusLabel(
                              status,
                            )}
                          </span>
                        </td>

                        <td className="max-w-xs px-5 py-4">
                          <p className="truncate text-sm text-gray-600">
                            {deadline.notes ||
                              "—"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  deadline,
                                )
                              }
                              disabled={
                                isActionRunning
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />

                              Edit
                            </button>

                            {status !==
                              "completed" && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleComplete(
                                    deadline,
                                  )
                                }
                                disabled={
                                  isActionRunning
                                }
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isActionRunning ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}

                                Complete
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  deadline,
                                )
                              }
                              disabled={
                                isActionRunning
                              }
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />

                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">
                  {editingDeadline
                    ? "Edit Compliance Deadline"
                    : "New Compliance Deadline"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the statutory deadline
                  details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Compliance Requirement
                  </label>

                  {!editingDeadline && (
                    <button
                      type="button"
                      onClick={openRequirementCreate}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="h-4 w-4" />
                      Create Requirement
                    </button>
                  )}
                </div>

                <select
                  name="requirement_id"
                  value={form.requirement_id}
                  onChange={handleFormChange}
                  disabled={
                    Boolean(editingDeadline) ||
                    requirementsLoading
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-gray-50"
                >
                  <option value="">
                    {requirementsLoading
                      ? "Loading requirements..."
                      : requirements.length === 0
                        ? "No requirements found — create one"
                        : "Select a compliance requirement"}
                  </option>

                  {requirements.map((requirement) => (
                    <option
                      key={requirement.id}
                      value={requirement.id}
                    >
                      {requirement.name}
                    </option>
                  ))}
                </select>

                {requirements.length === 0 && !requirementsLoading && (
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-xs text-amber-800">
                      You need to create a compliance requirement before creating a deadline.
                    </p>

                    <button
                      type="button"
                      onClick={openRequirementCreate}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create your first requirement
                    </button>
                  </div>
                )}

                <p className="mt-1 text-xs text-gray-400">
                  Select an existing compliance requirement from your organization.
                </p>

                {form.requirement_id &&
                  (() => {
                    const selectedRequirement =
                      requirements.find(
                        (requirement) =>
                          String(requirement.id) ===
                          String(form.requirement_id),
                      );

                    if (!selectedRequirement) {
                      return null;
                    }

                    return (
                      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Requirement Details
                        </p>

                        <p className="mt-1 text-sm font-medium text-gray-800">
                          {selectedRequirement.name}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          {selectedRequirement.authority && (
                            <span>
                              Authority: {selectedRequirement.authority}
                            </span>
                          )}

                          {selectedRequirement.jurisdiction && (
                            <span>
                              Jurisdiction: {selectedRequirement.jurisdiction}
                            </span>
                          )}

                          {selectedRequirement.frequency && (
                            <span>
                              Frequency: {selectedRequirement.frequency}
                            </span>
                          )}
                        </div>

                        {selectedRequirement.description && (
                          <p className="mt-2 text-xs leading-5 text-gray-500">
                            {selectedRequirement.description}
                          </p>
                        )}
                      </div>
                    );
                  })()}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Deadline Title
                </label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={
                    handleFormChange
                  }
                  placeholder="e.g. Monthly statutory filing"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Due Date
                  </label>

                  <input
                    type="date"
                    name="due_date"
                    value={
                      form.due_date
                    }
                    onChange={
                      handleFormChange
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      form.status
                    }
                    onChange={
                      handleFormChange
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="upcoming">
                      Upcoming
                    </option>

                    <option value="completed">
                      Completed
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={
                    handleFormChange
                  }
                  rows={4}
                  placeholder="Add any relevant compliance notes..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {editingDeadline
                    ? "Update Deadline"
                    : "Create Deadline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          CREATE REQUIREMENT MODAL
      ===================================================== */}

      {showRequirementCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-950">
                  Create Compliance Requirement
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Define the statutory requirement you need to track.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRequirementCreate}
                disabled={creatingRequirement}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleRequirementSubmit}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Requirement Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={requirementForm.name}
                  onChange={handleRequirementFormChange}
                  placeholder="e.g. GST Return Filing"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={requirementForm.description}
                  onChange={handleRequirementFormChange}
                  rows={3}
                  placeholder="Describe the statutory compliance requirement..."
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Jurisdiction
                  </label>

                  <input
                    type="text"
                    name="jurisdiction"
                    value={requirementForm.jurisdiction}
                    onChange={handleRequirementFormChange}
                    placeholder="e.g. India"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Authority
                  </label>

                  <input
                    type="text"
                    name="authority"
                    value={requirementForm.authority}
                    onChange={handleRequirementFormChange}
                    placeholder="e.g. GST Department"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Compliance Type
                  </label>

                  <input
                    type="text"
                    name="compliance_type"
                    value={requirementForm.compliance_type}
                    onChange={handleRequirementFormChange}
                    placeholder="e.g. Tax Filing"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Frequency
                  </label>

                  <select
                    name="frequency"
                    value={requirementForm.frequency}
                    onChange={handleRequirementFormChange}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Select frequency
                    </option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-yearly</option>
                    <option value="yearly">Yearly</option>
                    <option value="one-time">One-time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Alert Days Before
                  </label>

                  <input
                    type="number"
                    name="alert_days_before"
                    min="0"
                    value={requirementForm.alert_days_before}
                    onChange={handleRequirementFormChange}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />

                  <p className="mt-1 text-xs text-gray-400">
                    Number of days before the deadline to trigger an alert.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={requirementForm.status}
                    onChange={handleRequirementFormChange}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
                <button
                  type="button"
                  onClick={closeRequirementCreate}
                  disabled={creatingRequirement}
                  className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingRequirement}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingRequirement ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Requirement
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}