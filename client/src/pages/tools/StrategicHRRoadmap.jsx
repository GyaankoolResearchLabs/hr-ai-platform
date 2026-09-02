import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Edit3,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  toast,
} from "react-hot-toast";

import api from "../../services/api";

import {
  getStrategicRoadmapItems,
  createStrategicRoadmapItem,
  updateStrategicRoadmapItem,
  deleteStrategicRoadmapItem,
} from "../../services/strategicHrRoadmapService";

/* =========================================================
   OPTIONS
========================================================= */

const STATUS_OPTIONS = [
  {
    value: "planned",
    label: "Planned",
  },
  {
    value: "in_progress",
    label: "In progress",
  },
  {
    value: "on_track",
    label: "On track",
  },
  {
    value: "at_risk",
    label: "At risk",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "cancelled",
    label: "Cancelled",
  },
];

const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "high",
    label: "High",
  },
  {
    value: "critical",
    label: "Critical",
  },
];

/* =========================================================
   EMPTY FORM
========================================================= */

const EMPTY_FORM = {
  title: "",
  description: "",
  businessOutcome: "",
  kpiName: "",
  baselineValue: "",
  targetValue: "",
  unit: "%",
  ownerEmployeeId: "",
  priority: "medium",
  status: "planned",
  progress: 0,
  startDate: "",
  targetDate: "",
  notes: "",
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return value;
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

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    }
  );
}

function getStatusLabel(status) {
  return (
    STATUS_OPTIONS.find(
      (option) =>
        option.value === status
    )?.label ||
    status ||
    "Planned"
  );
}

function getPriorityLabel(priority) {
  return (
    PRIORITY_OPTIONS.find(
      (option) =>
        option.value === priority
    )?.label ||
    priority ||
    "Medium"
  );
}

function getStatusClasses(status) {
  const classes = {
    planned:
      "border-ink-200 bg-ink-50 text-ink-600",

    in_progress:
      "border-blue-100 bg-blue-50 text-blue-700",

    on_track:
      "border-emerald-100 bg-emerald-50 text-emerald-700",

    at_risk:
      "border-amber-100 bg-amber-50 text-amber-700",

    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-800",

    cancelled:
      "border-red-100 bg-red-50 text-red-700",
  };

  return (
    classes[status] ||
    classes.planned
  );
}

function getPriorityClasses(priority) {
  const classes = {
    low:
      "border-ink-200 bg-ink-50 text-ink-600",

    medium:
      "border-blue-100 bg-blue-50 text-blue-700",

    high:
      "border-amber-100 bg-amber-50 text-amber-700",

    critical:
      "border-red-100 bg-red-50 text-red-700",
  };

  return (
    classes[priority] ||
    classes.medium
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {value}
          </p>

          <p className="mt-1 text-xs text-ink-500">
            {description}
          </p>
        </div>

        <div className="rounded-xl bg-ink-50 p-2.5 text-ink-500">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL
========================================================= */

function Modal({
  open,
  title,
  children,
  onClose,
  saving = false,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-6 py-4">

          <h2 className="text-lg font-semibold text-ink-950">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

        <div className="p-6">
          {children}
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   FORM FIELD
========================================================= */

function Field({
  label,
  required = false,
  hint,
  children,
}) {
  return (
    <label className="block">

      <span className="text-sm font-medium text-ink-700">
        {label}

        {required && (
          <span className="text-red-500">
            {" "}*
          </span>
        )}
      </span>

      {children}

      {hint && (
        <span className="mt-1 block text-xs text-ink-400">
          {hint}
        </span>
      )}

    </label>
  );
}

/* =========================================================
   INPUT
========================================================= */

function Input({
  className = "",
  ...props
}) {
  return (
    <input
      {...props}
      className={`mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
    />
  );
}

/* =========================================================
   SELECT
========================================================= */

function Select({
  children,
  className = "",
  ...props
}) {
  return (
    <div className="relative mt-1.5">

      <select
        {...props}
        className={`w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${className}`}
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-ink-400" />

    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function StrategicHRRoadmap() {
  const navigate =
    useNavigate();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    employeesLoading,
    setEmployeesLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("all");

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState(null);

  const [
    selectedItem,
    setSelectedItem,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);

  /* =======================================================
     LOAD ROADMAP
  ======================================================= */

  async function loadItems() {
    try {
      setLoading(true);

      const data =
        await getStrategicRoadmapItems();

      setItems(
        Array.isArray(data)
          ? data
          : []
      );
    } catch (error) {
      console.error(
        "[StrategicHRRoadmap] Load failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to load strategic HR roadmap."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     LOAD EMPLOYEES
  ======================================================= */

  async function loadEmployees() {
    try {
      setEmployeesLoading(true);

      const response =
        await api.get(
          "/employees"
        );

      const data =
        response?.data;

      setEmployees(
        Array.isArray(data)
          ? data
          : Array.isArray(
              data?.employees
            )
          ? data.employees
          : []
      );
    } catch (error) {
      console.error(
        "[StrategicHRRoadmap] Employee load failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to load employees."
      );
    } finally {
      setEmployeesLoading(false);
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadItems();
    loadEmployees();
  }, []);

  /* =======================================================
     SUMMARY
  ======================================================= */

  const summary =
    useMemo(() => {
      const total =
        items.length;

      const onTrack =
        items.filter(
          (item) =>
            item.status ===
              "on_track" ||
            item.status ===
              "in_progress"
        ).length;

      const atRisk =
        items.filter(
          (item) =>
            item.status ===
            "at_risk"
        ).length;

      const completed =
        items.filter(
          (item) =>
            item.status ===
            "completed"
        ).length;

      const averageProgress =
        total > 0
          ? Math.round(
              items.reduce(
                (
                  sum,
                  item
                ) =>
                  sum +
                  Number(
                    item.progress ||
                      0
                  ),
                0
              ) / total
            )
          : 0;

      return {
        total,
        onTrack,
        atRisk,
        completed,
        averageProgress,
      };
    }, [items]);

  /* =======================================================
     FILTERED ITEMS
  ======================================================= */

  const filteredItems =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          const searchable = [
            item.title,
            item.description,
            item.business_outcome,
            item.kpi_name,
            item.unit,
            item.owner?.full_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            searchable.includes(
              query
            );

          const matchesStatus =
            statusFilter ===
              "all" ||
            item.status ===
              statusFilter;

          const matchesPriority =
            priorityFilter ===
              "all" ||
            item.priority ===
              priorityFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority
          );
        }
      );
    }, [
      items,
      search,
      statusFilter,
      priorityFilter,
    ]);

  /* =======================================================
     FORM CHANGE
  ======================================================= */

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  /* =======================================================
     CREATE MODAL
  ======================================================= */

  function openCreateModal() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });

    setShowModal(true);
  }

  /* =======================================================
     EDIT MODAL
  ======================================================= */

  function openEditModal(item) {
    setEditingId(
      item.id
    );

    setForm({
      title:
        item.title ||
        "",

      description:
        item.description ||
        "",

      businessOutcome:
        item.business_outcome ||
        "",

      kpiName:
        item.kpi_name ||
        "",

      baselineValue:
        item.baseline_value ??
        "",

      targetValue:
        item.target_value ??
        "",

      unit:
        item.unit ||
        "%",

      ownerEmployeeId:
        item.owner_employee_id ||
        "",

      priority:
        item.priority ||
        "medium",

      status:
        item.status ||
        "planned",

      progress:
        Number(
          item.progress ||
            0
        ),

      startDate:
        item.start_date ||
        "",

      targetDate:
        item.target_date ||
        "",

      notes:
        item.notes ||
        "",
    });

    setSelectedItem(
      null
    );

    setShowModal(true);
  }

  /* =======================================================
     CLOSE MODAL
  ======================================================= */

  function closeModal() {
    if (saving) {
      return;
    }

    setShowModal(false);
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
    });
  }

  /* =======================================================
     SUBMIT
  ======================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      !form.title.trim()
    ) {
      toast.error(
        "Strategic priority title is required."
      );

      return;
    }

    if (
      !form.businessOutcome.trim()
    ) {
      toast.error(
        "Business outcome is required."
      );

      return;
    }

    if (
      !form.kpiName.trim()
    ) {
      toast.error(
        "KPI name is required."
      );

      return;
    }

    const progress =
      Number(
        form.progress
      );

    if (
      !Number.isFinite(
        progress
      ) ||
      progress < 0 ||
      progress > 100
    ) {
      toast.error(
        "Progress must be between 0 and 100."
      );

      return;
    }

    if (
      form.startDate &&
      form.targetDate &&
      form.targetDate <
        form.startDate
    ) {
      toast.error(
        "Target date cannot be before the start date."
      );

      return;
    }

    const baselineValue =
      form.baselineValue ===
      ""
        ? null
        : Number(
            form.baselineValue
          );

    const targetValue =
      form.targetValue ===
      ""
        ? null
        : Number(
            form.targetValue
          );

    if (
      baselineValue !==
        null &&
      !Number.isFinite(
        baselineValue
      )
    ) {
      toast.error(
        "Baseline value must be a valid number."
      );

      return;
    }

    if (
      targetValue !==
        null &&
      !Number.isFinite(
        targetValue
      )
    ) {
      toast.error(
        "Target value must be a valid number."
      );

      return;
    }

    const payload = {
      title:
        form.title.trim(),

      description:
        form.description.trim(),

      businessOutcome:
        form.businessOutcome.trim(),

      kpiName:
        form.kpiName.trim(),

      baselineValue,

      targetValue,

      unit:
        form.unit.trim(),

      ownerEmployeeId:
        form.ownerEmployeeId ||
        null,

      priority:
        form.priority,

      status:
        progress === 100
          ? "completed"
          : form.status,

      progress,

      startDate:
        form.startDate ||
        null,

      targetDate:
        form.targetDate ||
        null,

      notes:
        form.notes.trim(),
    };

    try {
      setSaving(true);

      if (editingId) {
        const updated =
          await updateStrategicRoadmapItem(
            editingId,
            payload
          );

        setItems(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                editingId
                  ? updated
                  : item
            )
        );

        toast.success(
          "Strategic priority updated."
        );
      } else {
        const created =
          await createStrategicRoadmapItem(
            payload
          );

        setItems(
          (current) => [
            created,
            ...current,
          ]
        );

        toast.success(
          "Strategic priority created."
        );
      }

      setShowModal(false);
      setEditingId(null);

      setForm({
        ...EMPTY_FORM,
      });
    } catch (error) {
      console.error(
        "[StrategicHRRoadmap] Save failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to save strategic priority."
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(
    item
  ) {
    const confirmed =
      window.confirm(
        `Delete "${item.title}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        item.id
      );

      await deleteStrategicRoadmapItem(
        item.id
      );

      setItems(
        (current) =>
          current.filter(
            (entry) =>
              entry.id !==
              item.id
          )
      );

      if (
        selectedItem?.id ===
        item.id
      ) {
        setSelectedItem(
          null
        );
      }

      toast.success(
        "Strategic priority deleted."
      );
    } catch (error) {
      console.error(
        "[StrategicHRRoadmap] Delete failed:",
        error
      );

      toast.error(
        error?.response?.data?.message ||
          "Failed to delete strategic priority."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-ink-50/30">

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-start gap-3">

            <button
              type="button"
              onClick={() =>
                navigate(-1)
              }
              className="mt-0.5 rounded-lg p-2 text-ink-500 transition hover:bg-white hover:text-ink-900"
              title="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>

              <div className="flex items-center gap-2">

                <div className="rounded-lg bg-brand-50 p-2 text-brand-700">
                  <Target className="h-5 w-5" />
                </div>

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Strategic HR
                </p>

              </div>

              <h1 className="mt-2 text-2xl font-semibold text-ink-950">
                Strategic HR Roadmap
              </h1>

              <p className="mt-1 max-w-2xl text-sm text-ink-500">
                Connect HR priorities to measurable business outcomes, KPIs, owners, and target dates.
              </p>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={
                openCreateModal
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />

              Add priority
            </button>

          </div>

        </div>

        {/* =================================================
            SUMMARY
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <SummaryCard
            label="Priorities"
            value={summary.total}
            description="Strategic initiatives"
            icon={Flag}
          />

          <SummaryCard
            label="On track"
            value={summary.onTrack}
            description="Moving forward"
            icon={TrendingUp}
          />

          <SummaryCard
            label="At risk"
            value={summary.atRisk}
            description="Need attention"
            icon={CircleAlert}
          />

          <SummaryCard
            label="Completed"
            value={summary.completed}
            description="Business outcomes delivered"
            icon={CheckCircle2}
          />

          <SummaryCard
            label="Avg. progress"
            value={`${summary.averageProgress}%`}
            description="Across all priorities"
            icon={Target}
          />

        </div>

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div className="mt-6 card p-4">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">

            <div className="relative flex-1">

              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search priorities, outcomes, KPIs, or owners..."
                className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />

            </div>

            <div className="relative lg:w-48">

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >

                <option value="all">
                  All statuses
                </option>

                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-ink-400" />

            </div>

            <div className="relative lg:w-48">

              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(
                    event.target.value
                  )
                }
                className="w-full appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 pr-9 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >

                <option value="all">
                  All priorities
                </option>

                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}

              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-ink-400" />

            </div>

          </div>

        </div>

        {/* =================================================
            ROADMAP CONTENT
        ================================================= */}

        <div className="mt-6">

          {loading ? (
            <div className="card flex min-h-64 items-center justify-center p-8">

              <div className="flex items-center gap-2 text-sm text-ink-500">

                <Loader2 className="h-5 w-5 animate-spin" />

                Loading strategic roadmap...

              </div>

            </div>
          ) : filteredItems.length === 0 ? (

            <div className="card p-10 text-center">

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-ink-400">

                <Target className="h-6 w-6" />

              </div>

              <h2 className="mt-4 text-base font-semibold text-ink-900">

                {items.length === 0
                  ? "No strategic priorities yet"
                  : "No priorities match your filters"}

              </h2>

              <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">

                {items.length === 0
                  ? "Create the first priority and connect it to a measurable business outcome."
                  : "Try changing your search or filters."}

              </p>

              {items.length === 0 && (
                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />

                  Add first priority
                </button>
              )}

            </div>

          ) : (

            <div className="space-y-4">

              {filteredItems.map(
                (item) => {

                  const progress =
                    Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          item.progress ||
                            0
                        )
                      )
                    );

                  return (
                    <div
                      key={item.id}
                      className="card overflow-hidden"
                    >

                      <div className="p-5 sm:p-6">

                        {/* ===============================
                            CARD HEADER
                        =============================== */}

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-center gap-2">

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                                  item.priority
                                )}`}
                              >
                                {getPriorityLabel(
                                  item.priority
                                )}{" "}
                                priority
                              </span>

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                                  item.status
                                )}`}
                              >
                                {getStatusLabel(
                                  item.status
                                )}
                              </span>

                            </div>

                            <h2 className="mt-3 text-lg font-semibold text-ink-950">
                              {item.title}
                            </h2>

                            {item.description && (
                              <p className="mt-1 text-sm text-ink-500">
                                {
                                  item.description
                                }
                              </p>
                            )}

                          </div>

                          <div className="flex shrink-0 items-center gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedItem(
                                  item
                                )
                              }
                              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(
                                  item
                                )
                              }
                              className="rounded-lg p-2 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                              title="Edit priority"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  item
                                )
                              }
                              disabled={
                                deletingId ===
                                item.id
                              }
                              className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                              title="Delete priority"
                            >
                              {deletingId ===
                              item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>

                          </div>

                        </div>

                        {/* ===============================
                            BUSINESS OUTCOME + KPI
                        =============================== */}

                        <div className="mt-5 grid gap-4 md:grid-cols-2">

                          <div className="rounded-xl bg-ink-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                              Business outcome
                            </p>

                            <p className="mt-1.5 text-sm font-medium leading-6 text-ink-900">
                              {
                                item.business_outcome
                              }
                            </p>

                          </div>

                          <div className="rounded-xl bg-ink-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                              KPI
                            </p>

                            <p className="mt-1.5 text-sm font-medium text-ink-900">
                              {
                                item.kpi_name
                              }
                            </p>

                            {(item.baseline_value !==
                              null ||
                              item.target_value !==
                                null) && (
                              <p className="mt-1 text-xs text-ink-500">

                                Baseline{" "}
                                {formatNumber(
                                  item.baseline_value
                                )}{" "}
                                {
                                  item.unit ||
                                  ""
                                }

                                {" → "}

                                Target{" "}
                                {formatNumber(
                                  item.target_value
                                )}{" "}
                                {
                                  item.unit ||
                                  ""
                                }

                              </p>
                            )}

                          </div>

                        </div>

                        {/* ===============================
                            PROGRESS
                        =============================== */}

                        <div className="mt-5">

                          <div className="flex items-center justify-between gap-3 text-xs">

                            <span className="font-medium text-ink-600">
                              Progress
                            </span>

                            <span className="font-semibold text-ink-900">
                              {progress}%
                            </span>

                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">

                            <div
                              className="h-full rounded-full bg-brand-600 transition-all"
                              style={{
                                width: `${progress}%`,
                              }}
                            />

                          </div>

                        </div>

                        {/* ===============================
                            META
                        =============================== */}

                        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500">

                          <span className="inline-flex items-center gap-1.5">

                            <UserRound className="h-3.5 w-3.5" />

                            {
                              item.owner
                                ?.full_name ||
                              "Unassigned"
                            }

                          </span>

                          <span className="inline-flex items-center gap-1.5">

                            <CalendarDays className="h-3.5 w-3.5" />

                            {item.start_date
                              ? formatDate(
                                  item.start_date
                                )
                              : "No start date"}

                            {" → "}

                            {item.target_date
                              ? formatDate(
                                  item.target_date
                                )
                              : "No target date"}

                          </span>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>

          )}

        </div>

      </div>

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      <Modal
        open={showModal}
        title={
          editingId
            ? "Edit strategic priority"
            : "Create strategic priority"
        }
        onClose={
          closeModal
        }
        saving={saving}
      >

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-6"
        >

          <div className="grid gap-5 md:grid-cols-2">

            <div className="md:col-span-2">

              <Field
                label="Strategic priority"
                required
              >

                <Input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Improve employee retention"
                  required
                />

              </Field>

            </div>

            <div className="md:col-span-2">

              <Field label="Description">

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows={3}
                  placeholder="What HR initiative will deliver this priority?"
                  className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />

              </Field>

            </div>

            <Field
              label="Business outcome"
              required
              hint="State the measurable business result HR is trying to influence."
            >

              <Input
                name="businessOutcome"
                value={
                  form.businessOutcome
                }
                onChange={
                  handleChange
                }
                placeholder="e.g. Reduce annual employee turnover"
                required
              />

            </Field>

            <Field
              label="KPI name"
              required
              hint="Use a metric that can be tracked over time."
            >

              <Input
                name="kpiName"
                value={
                  form.kpiName
                }
                onChange={
                  handleChange
                }
                placeholder="e.g. Voluntary attrition rate"
                required
              />

            </Field>

            <Field label="Baseline value">

              <Input
                type="number"
                step="any"
                name="baselineValue"
                value={
                  form.baselineValue
                }
                onChange={
                  handleChange
                }
                placeholder="18"
              />

            </Field>

            <Field label="Target value">

              <Input
                type="number"
                step="any"
                name="targetValue"
                value={
                  form.targetValue
                }
                onChange={
                  handleChange
                }
                placeholder="12"
              />

            </Field>

            <Field label="Unit">

              <Input
                name="unit"
                value={
                  form.unit
                }
                onChange={
                  handleChange
                }
                placeholder="%, employees, days..."
              />

            </Field>

            <Field label="Owner">

              <Select
                name="ownerEmployeeId"
                value={
                  form.ownerEmployeeId
                }
                onChange={
                  handleChange
                }
                disabled={
                  employeesLoading
                }
              >

                <option value="">
                  Unassigned
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={
                        employee.id
                      }
                      value={
                        employee.id
                      }
                    >
                      {
                        employee.full_name ||
                        employee.name ||
                        employee.email ||
                        employee.id
                      }
                    </option>
                  )
                )}

              </Select>

            </Field>

            <Field label="Priority">

              <Select
                name="priority"
                value={
                  form.priority
                }
                onChange={
                  handleChange
                }
              >

                {PRIORITY_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}

              </Select>

            </Field>

            <Field label="Status">

              <Select
                name="status"
                value={
                  form.status
                }
                onChange={
                  handleChange
                }
              >

                {STATUS_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}

              </Select>

            </Field>

            <Field
              label="Progress"
              hint="Set 100% to automatically mark the priority completed."
            >

              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                name="progress"
                value={
                  form.progress
                }
                onChange={
                  handleChange
                }
              />

            </Field>

            <Field label="Start date">

              <Input
                type="date"
                name="startDate"
                value={
                  form.startDate
                }
                onChange={
                  handleChange
                }
              />

            </Field>

            <Field label="Target date">

              <Input
                type="date"
                name="targetDate"
                value={
                  form.targetDate
                }
                onChange={
                  handleChange
                }
              />

            </Field>

            <div className="md:col-span-2">

              <Field label="Notes">

                <textarea
                  name="notes"
                  value={
                    form.notes
                  }
                  onChange={
                    handleChange
                  }
                  rows={3}
                  placeholder="Dependencies, assumptions, or leadership notes..."
                  className="mt-1.5 w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />

              </Field>

            </div>

          </div>

          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">

            <button
              type="button"
              onClick={
                closeModal
              }
              disabled={
                saving
              }
              className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >

              {saving && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {editingId
                ? "Save changes"
                : "Create priority"}

            </button>

          </div>

        </form>

      </Modal>

      {/* =====================================================
          DETAIL MODAL
      ===================================================== */}

      {selectedItem && (
        <Modal
          open={
            Boolean(
              selectedItem
            )
          }
          title="Strategic priority details"
          onClose={() =>
            setSelectedItem(
              null
            )
          }
        >

          <div className="space-y-5">

            <div>

              <div className="flex flex-wrap gap-2">

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                    selectedItem.priority
                  )}`}
                >
                  {
                    getPriorityLabel(
                      selectedItem.priority
                    )
                  }{" "}
                  priority
                </span>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                    selectedItem.status
                  )}`}
                >
                  {
                    getStatusLabel(
                      selectedItem.status
                    )
                  }
                </span>

              </div>

              <h2 className="mt-3 text-xl font-semibold text-ink-950">
                {
                  selectedItem.title
                }
              </h2>

              {selectedItem.description && (
                <p className="mt-1 text-sm leading-6 text-ink-500">
                  {
                    selectedItem.description
                  }
                </p>
              )}

            </div>

            <div className="grid gap-4 md:grid-cols-2">

              <div className="rounded-xl bg-ink-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Business outcome
                </p>

                <p className="mt-1.5 text-sm leading-6 text-ink-900">
                  {
                    selectedItem.business_outcome
                  }
                </p>

              </div>

              <div className="rounded-xl bg-ink-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  KPI
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink-900">
                  {
                    selectedItem.kpi_name
                  }
                </p>

                <p className="mt-1 text-xs text-ink-500">

                  Baseline:{" "}
                  {
                    formatNumber(
                      selectedItem.baseline_value
                    )
                  }{" "}
                  {
                    selectedItem.unit ||
                    ""
                  }

                  {" · "}

                  Target:{" "}
                  {
                    formatNumber(
                      selectedItem.target_value
                    )
                  }{" "}
                  {
                    selectedItem.unit ||
                    ""
                  }

                </p>

              </div>

              <div className="rounded-xl bg-ink-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Owner
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink-900">
                  {
                    selectedItem
                      .owner
                      ?.full_name ||
                    "Unassigned"
                  }
                </p>

              </div>

              <div className="rounded-xl bg-ink-50 p-4">

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Timeline
                </p>

                <p className="mt-1.5 text-sm font-medium text-ink-900">

                  {formatDate(
                    selectedItem.start_date
                  )}

                  {" → "}

                  {formatDate(
                    selectedItem.target_date
                  )}

                </p>

              </div>

            </div>

            <div>

              <div className="flex items-center justify-between text-sm">

                <span className="font-medium text-ink-700">
                  Progress
                </span>

                <span className="font-semibold text-ink-950">
                  {
                    Number(
                      selectedItem.progress ||
                        0
                    )
                  }%
                </span>

              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-100">

                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Number(
                          selectedItem.progress ||
                            0
                        )
                      )
                    )}%`,
                  }}
                />

              </div>

            </div>

            {selectedItem.notes && (
              <div>

                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                  Notes
                </p>

                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink-700">
                  {
                    selectedItem.notes
                  }
                </p>

              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">

              <button
                type="button"
                onClick={() => {
                  setSelectedItem(
                    null
                  );

                  openEditModal(
                    selectedItem
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                <Edit3 className="h-4 w-4" />

                Edit
              </button>

              <button
                type="button"
                onClick={() =>
                  handleDelete(
                    selectedItem
                  )
                }
                disabled={
                  deletingId ===
                  selectedItem.id
                }
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />

                Delete
              </button>

            </div>

          </div>

        </Modal>
      )}

    </div>
  );
}