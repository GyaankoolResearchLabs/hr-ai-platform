import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import axios from "axios";

import {
  supabase,
} from "../../lib/supabaseClient";

import toast from "react-hot-toast";

import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  CalendarDays,
  Users,
  ClipboardCheck,
  Pencil,
  Trash2,
  X,
  Check,
  Play,
  CircleCheck,
  AlertCircle,
  ChevronRight,
  Star,
  Save,
  Send,
  ShieldCheck,
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

api.interceptors.request.use(
  async (config) => {
    const {
      data: { session } = {},
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers =
        config.headers || {};

      config.headers.Authorization =
        `Bearer ${session.access_token}`;
    }

    return config;
  },
);

/* =========================================================
   HELPERS
========================================================= */

function employeeId(employee) {
  return (
    employee?.id ||
    employee?.employee_id ||
    employee?.employeeId ||
    null
  );
}

function employeeName(employee) {
  return (
    employee?.full_name ||
    employee?.name ||
    `${employee?.first_name || ""} ${
      employee?.last_name || ""
    }`.trim() ||
    "Unnamed employee"
  );
}

function employeeTitle(employee) {
  return (
    employee?.title ||
    employee?.designation ||
    employee?.job_title ||
    "Employee"
  );
}

function employeeDepartment(employee) {
  return (
    employee?.department ||
    employee?.department_name ||
    "No department"
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(`${value}T00:00:00`);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function statusLabel(status) {
  return (
    {
      draft: "Draft",
      active: "Active",
      completed: "Completed",
      cancelled: "Cancelled",
      pending: "Pending",
      in_progress: "In progress",
      submitted: "Submitted",
      acknowledged: "Acknowledged",
    }[status] ||
    status ||
    "Unknown"
  );
}

function statusClass(status) {
  const map = {
    draft:
      "border-ink-200 bg-ink-50 text-ink-600",

    active:
      "border-blue-200 bg-blue-50 text-blue-700",

    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",

    cancelled:
      "border-red-200 bg-red-50 text-red-700",

    in_progress:
      "border-blue-200 bg-blue-50 text-blue-700",

    submitted:
      "border-amber-200 bg-amber-50 text-amber-700",

    acknowledged:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    map[status] ||
    "border-ink-200 bg-ink-50 text-ink-600"
  );
}

function reviewTypeLabel(type) {
  return (
    {
      annual: "Annual review",
      mid_year: "Mid-year review",
      quarterly: "Quarterly review",
      probation: "Probation review",
      custom: "Custom review",
    }[type] ||
    type ||
    "Review"
  );
}

const EMPTY_FORM = {
  title: "",
  description: "",
  reviewType: "annual",
  startDate: "",
  dueDate: "",
  employeeIds: [],
};

/* =========================================================
   COMPONENT
========================================================= */

export default function ReviewCycleManager() {
  const navigate =
    useNavigate();

  const [
    employees,
    setEmployees,
  ] = useState([]);

  const [
    cycles,
    setCycles,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingCycle,
    setEditingCycle,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(EMPTY_FORM);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    selectedCycle,
    setSelectedCycle,
  ] = useState(null);

  const [
    loadingDetails,
    setLoadingDetails,
  ] = useState(false);

  const [
    deleteId,
    setDeleteId,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    workingReviewId,
    setWorkingReviewId,
  ] = useState(null);

  const [
    reviewDraft,
    setReviewDraft,
  ] = useState({
    rating: "",
    comments: "",
  });

  const [
    reviewSaving,
    setReviewSaving,
  ] = useState(false);

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function loadData(
    showRefresh = false,
  ) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        employeeResponse,
        cycleResponse,
      ] = await Promise.all([
        api.get("/employees"),
        api.get("/review-cycles"),
      ]);

      const employeeData =
        Array.isArray(
          employeeResponse?.data,
        )
          ? employeeResponse.data
          : employeeResponse?.data
              ?.employees || [];

      const cycleData =
        cycleResponse?.data?.cycles ||
        [];

      setEmployees(
        Array.isArray(employeeData)
          ? employeeData
          : [],
      );

      setCycles(
        Array.isArray(cycleData)
          ? cycleData
          : [],
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Load failed:",
        err,
      );

      setError(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Unable to load review cycles.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     METRICS
  ========================================================= */

  const metrics =
    useMemo(() => {
      const total =
        cycles.length;

      const active =
        cycles.filter(
          (cycle) =>
            cycle.status ===
            "active",
        ).length;

      const completed =
        cycles.filter(
          (cycle) =>
            cycle.status ===
            "completed",
        ).length;

      const reviewTotal =
        cycles.reduce(
          (sum, cycle) =>
            sum +
            Number(
              cycle.review_count ||
                cycle.total_reviews ||
                0,
            ),
          0,
        );

      const acknowledged =
        cycles.reduce(
          (sum, cycle) =>
            sum +
            Number(
              cycle.acknowledged_count ||
                0,
            ),
          0,
        );

      return {
        total,
        active,
        completed,

        completion:
          reviewTotal > 0
            ? Math.round(
                (acknowledged /
                  reviewTotal) *
                  100,
              )
            : 0,
      };
    }, [cycles]);

  /* =========================================================
     FILTER
  ========================================================= */

  const filteredCycles =
    useMemo(() => {
      const value =
        search
          .trim()
          .toLowerCase();

      return cycles.filter(
        (cycle) => {
          const matchesSearch =
            !value ||
            String(
              cycle.title || "",
            )
              .toLowerCase()
              .includes(value) ||
            String(
              cycle.description ||
                "",
            )
              .toLowerCase()
              .includes(value) ||
            reviewTypeLabel(
              cycle.review_type,
            )
              .toLowerCase()
              .includes(value);

          const matchesStatus =
            statusFilter ===
              "all" ||
            cycle.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        },
      );
    }, [
      cycles,
      search,
      statusFilter,
    ]);

  /* =========================================================
     CREATE FORM
  ========================================================= */

  function openCreateForm() {
    setEditingCycle(null);

    setForm({
      ...EMPTY_FORM,

      employeeIds:
        employees
          .map(employeeId)
          .filter(Boolean),
    });

    setShowForm(true);
  }

  /* =========================================================
     EDIT FORM
  ========================================================= */

  function openEditForm(cycle) {
    setEditingCycle(cycle);

    setForm({
      title:
        cycle?.title || "",

      description:
        cycle?.description || "",

      reviewType:
        cycle?.review_type ||
        "annual",

      startDate:
        cycle?.start_date || "",

      dueDate:
        cycle?.due_date || "",

      employeeIds: [],
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setShowForm(false);
    setEditingCycle(null);
    setForm(EMPTY_FORM);
  }

  /* =========================================================
     EMPLOYEE SELECTION
  ========================================================= */

  function toggleEmployee(id) {
    setForm(
      (current) => ({
        ...current,

        employeeIds:
          current.employeeIds.includes(
            id,
          )
            ? current.employeeIds.filter(
                (item) =>
                  item !== id,
              )
            : [
                ...current.employeeIds,
                id,
              ],
      }),
    );
  }

  function toggleAllEmployees() {
    const ids =
      employees
        .map(employeeId)
        .filter(Boolean);

    const allSelected =
      form.employeeIds.length ===
        ids.length &&
      ids.length > 0;

    setForm(
      (current) => ({
        ...current,

        employeeIds:
          allSelected
            ? []
            : ids,
      }),
    );
  }

  /* =========================================================
     SAVE CYCLE
  ========================================================= */

  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    if (
      !form.title.trim()
    ) {
      toast.error(
        "Review cycle title is required.",
      );

      return;
    }

    if (
      !form.startDate ||
      !form.dueDate
    ) {
      toast.error(
        "Start and due dates are required.",
      );

      return;
    }

    if (
      form.dueDate <
      form.startDate
    ) {
      toast.error(
        "Due date cannot be before the start date.",
      );

      return;
    }

    if (
      !editingCycle &&
      !form.employeeIds.length
    ) {
      toast.error(
        "Select at least one employee.",
      );

      return;
    }

    try {
      setSaving(true);

      if (
        editingCycle?.id
      ) {
        await api.patch(
          `/review-cycles/${editingCycle.id}`,
          {
            title:
              form.title.trim(),

            description:
              form.description.trim(),

            review_type:
              form.reviewType,

            start_date:
              form.startDate,

            due_date:
              form.dueDate,
          },
        );

        toast.success(
          "Review cycle updated.",
        );
      } else {
        await api.post(
          "/review-cycles",
          {
            title:
              form.title.trim(),

            description:
              form.description.trim(),

            reviewType:
              form.reviewType,

            startDate:
              form.startDate,

            dueDate:
              form.dueDate,

            employeeIds:
              form.employeeIds,
          },
        );

        toast.success(
          "Review cycle created.",
        );
      }

      closeForm();

      await loadData(true);
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Save failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          err?.message ||
          "Failed to save review cycle.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     OPEN CYCLE
  ========================================================= */

  async function openCycle(
    cycle,
  ) {
    try {
      setLoadingDetails(true);

      const response =
        await api.get(
          `/review-cycles/${cycle.id}`,
        );

      setSelectedCycle(
        response?.data?.cycle ||
          null,
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Open failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to load review cycle.",
      );
    } finally {
      setLoadingDetails(false);
    }
  }

  /* =========================================================
     REFRESH SELECTED CYCLE
  ========================================================= */

  async function refreshSelectedCycle() {
    if (
      !selectedCycle?.id
    ) {
      return;
    }

    const response =
      await api.get(
        `/review-cycles/${selectedCycle.id}`,
      );

    setSelectedCycle(
      response?.data?.cycle ||
        null,
    );
  }

  /* =========================================================
     START CYCLE

     IMPORTANT:
     This ONLY changes draft -> active.
     It NEVER completes anything.
  ========================================================= */

  async function startCycle(
    cycle,
  ) {
    try {
      const response =
        await api.patch(
          `/review-cycles/${cycle.id}`,
          {
            status: "active",
          },
        );

      const updated =
        response?.data?.cycle;

      if (updated) {
        setCycles(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                cycle.id
                  ? updated
                  : item,
            ),
        );

        if (
          selectedCycle?.id ===
          cycle.id
        ) {
          setSelectedCycle(
            updated,
          );
        }
      }

      toast.success(
        "Review cycle started. Employee reviews are now ready to work on.",
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Start failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to start review cycle.",
      );
    }
  }

  /* =========================================================
     COMPLETE CYCLE

     Frontend guard + backend guard.
  ========================================================= */

  async function completeCycle(
    cycle,
  ) {
    const reviewCount =
      Number(
        cycle.review_count ||
          cycle.total_reviews ||
          0,
      );

    const acknowledgedCount =
      Number(
        cycle.acknowledged_count ||
          0,
      );

    if (
      reviewCount === 0
    ) {
      toast.error(
        "This cycle has no employee reviews.",
      );

      return;
    }

    if (
      acknowledgedCount !==
      reviewCount
    ) {
      toast.error(
        `Complete is locked. ${reviewCount - acknowledgedCount} employee review(s) are still pending.`,
      );

      return;
    }

    try {
      const response =
        await api.patch(
          `/review-cycles/${cycle.id}`,
          {
            status:
              "completed",
          },
        );

      const updated =
        response?.data?.cycle;

      if (updated) {
        setCycles(
          (current) =>
            current.map(
              (item) =>
                item.id ===
                cycle.id
                  ? updated
                  : item,
            ),
        );

        if (
          selectedCycle?.id ===
          cycle.id
        ) {
          setSelectedCycle(
            updated,
          );
        }
      }

      toast.success(
        "Review cycle completed.",
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Complete failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to complete review cycle.",
      );
    }
  }

  /* =========================================================
     START EMPLOYEE REVIEW
  ========================================================= */

  async function startReview(
    review,
  ) {
    if (
      !selectedCycle?.id
    ) {
      return;
    }

    try {
      setReviewSaving(true);

      const response =
        await api.patch(
          `/review-cycles/${selectedCycle.id}/reviews/${review.id}`,
          {
            status:
              "in_progress",
          },
        );

      const updated =
        response?.data?.review;

      setWorkingReviewId(
        review.id,
      );

      setReviewDraft({
        rating:
          updated?.rating ??
          review.rating ??
          "",

        comments:
          updated?.comments ??
          review.comments ??
          "",
      });

      await refreshSelectedCycle();
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Start review failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Could not start the employee review.",
      );
    } finally {
      setReviewSaving(false);
    }
  }

  /* =========================================================
     OPEN EXISTING REVIEW
  ========================================================= */

  function openExistingReview(
    review,
  ) {
    setWorkingReviewId(
      review.id,
    );

    setReviewDraft({
      rating:
        review.rating ??
        "",

      comments:
        review.comments ??
        "",
    });
  }

  /* =========================================================
     SAVE REVIEW DRAFT
  ========================================================= */

  async function saveReviewDraft() {
    if (
      !workingReviewId ||
      !selectedCycle?.id
    ) {
      return;
    }

    try {
      setReviewSaving(true);

      await api.patch(
        `/review-cycles/${selectedCycle.id}/reviews/${workingReviewId}`,
        {
          rating:
            reviewDraft.rating ===
            ""
              ? null
              : Number(
                  reviewDraft.rating,
                ),

          comments:
            reviewDraft.comments,
        },
      );

      await refreshSelectedCycle();
      await loadData(true);

      toast.success(
        "Review draft saved.",
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Save review failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to save review draft.",
      );
    } finally {
      setReviewSaving(false);
    }
  }

  /* =========================================================
     SUBMIT REVIEW
  ========================================================= */

  async function submitReview() {
    if (
      !workingReviewId ||
      !selectedCycle?.id
    ) {
      return;
    }

    if (
      reviewDraft.rating ===
      ""
    ) {
      toast.error(
        "Select a rating before submitting.",
      );

      return;
    }

    if (
      !reviewDraft.comments.trim()
    ) {
      toast.error(
        "Add review comments before submitting.",
      );

      return;
    }

    try {
      setReviewSaving(true);

      await api.patch(
        `/review-cycles/${selectedCycle.id}/reviews/${workingReviewId}`,
        {
          status:
            "submitted",

          rating:
            Number(
              reviewDraft.rating,
            ),

          comments:
            reviewDraft.comments,
        },
      );

      await refreshSelectedCycle();
      await loadData(true);

      setWorkingReviewId(
        null,
      );

      toast.success(
        "Employee review submitted.",
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Submit review failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to submit review.",
      );
    } finally {
      setReviewSaving(false);
    }
  }

  /* =========================================================
     ACKNOWLEDGE REVIEW
  ========================================================= */

  async function acknowledgeReview(
    review,
  ) {
    if (
      !selectedCycle?.id
    ) {
      return;
    }

    try {
      setReviewSaving(true);

      await api.patch(
        `/review-cycles/${selectedCycle.id}/reviews/${review.id}`,
        {
          status:
            "acknowledged",
        },
      );

      await refreshSelectedCycle();
      await loadData(true);

      toast.success(
        `${employeeName(
          review.employee,
        )}'s review acknowledged.`,
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Acknowledge failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to acknowledge review.",
      );
    } finally {
      setReviewSaving(false);
    }
  }

  /* =========================================================
     DELETE
  ========================================================= */

  async function handleDelete() {
    if (!deleteId) {
      return;
    }

    try {
      setDeleting(true);

      await api.delete(
        `/review-cycles/${deleteId}`,
      );

      setCycles(
        (current) =>
          current.filter(
            (cycle) =>
              cycle.id !==
              deleteId,
          ),
      );

      if (
        selectedCycle?.id ===
        deleteId
      ) {
        setSelectedCycle(
          null,
        );
      }

      setDeleteId(null);

      toast.success(
        "Review cycle deleted.",
      );
    } catch (err) {
      console.error(
        "[ReviewCycleManager] Delete failed:",
        err,
      );

      toast.error(
        err?.response?.data
          ?.message ||
          "Failed to delete review cycle.",
      );
    } finally {
      setDeleting(false);
    }
  }

  /* =========================================================
     SELECTED REVIEW
  ========================================================= */

  const workingReview =
    selectedCycle?.reviews?.find(
      (review) =>
        review.id ===
        workingReviewId,
    ) || null;

  const allAcknowledged =
    Boolean(
      selectedCycle &&
        selectedCycle.reviews?.length >
          0 &&
        selectedCycle.reviews.every(
          (review) =>
            review.status ===
              "acknowledged" ||
            review.status ===
              "completed",
        ),
    );

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-w-0">
      {/* =====================================================
          BACK
      ===================================================== */}

      <button
        type="button"
        onClick={() =>
          navigate(-1)
        }
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <ClipboardCheck className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              Review Cycle Manager
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              Run structured performance
              reviews from start to
              acknowledgement.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              loadData(true)
            }
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
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
            onClick={
              openCreateForm
            }
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />

            New review cycle
          </button>
        </div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />

          {error}
        </div>
      )}

      {/* =====================================================
          METRICS
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            CalendarDays,
            "Review cycles",
            metrics.total,
          ],

          [
            Play,
            "Active",
            metrics.active,
          ],

          [
            CircleCheck,
            "Completed",
            metrics.completed,
          ],

          [
            ClipboardCheck,
            "Review completion",
            `${metrics.completion}%`,
          ],
        ].map(
          ([
            Icon,
            label,
            value,
          ]) => (
            <div
              key={label}
              className="card p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    {label}
                  </p>

                  <p className="mt-1 text-2xl font-semibold text-ink-900">
                    {loading
                      ? "—"
                      : value}
                  </p>
                </div>
              </div>
            </div>
          ),
        )}
      </div>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <div className="card mb-6 p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search review cycles..."
              className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <select
            value={
              statusFilter
            }
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            className="rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="all">
              All statuses
            </option>

            <option value="draft">
              Draft
            </option>

            <option value="active">
              Active
            </option>

            <option value="completed">
              Completed
            </option>
          </select>
        </div>
      </div>

      {/* =====================================================
          CYCLES
      ===================================================== */}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              Review cycles
            </h2>

            <p className="mt-0.5 text-sm text-ink-500">
              Structured, time-bound
              performance reviews.
            </p>
          </div>

          <span className="text-sm text-ink-400">
            {loading
              ? "Loading..."
              : `${filteredCycles.length} shown`}
          </span>
        </div>

        {loading ? (
          <div className="px-5 py-16 text-center text-sm text-ink-500">
            Loading review cycles...
          </div>
        ) : filteredCycles.length ===
          0 ? (
          <div className="px-5 py-16 text-center">
            <ClipboardCheck className="mx-auto h-9 w-9 text-ink-300" />

            <p className="mt-3 text-sm font-medium text-ink-700">
              {cycles.length
                ? "No matching review cycles"
                : "No review cycles yet"}
            </p>

            <p className="mt-1 text-sm text-ink-400">
              {cycles.length
                ? "Try changing your search or filter."
                : "Create your first review cycle to begin."}
            </p>

            {!cycles.length && (
              <button
                type="button"
                onClick={
                  openCreateForm
                }
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />

                Create first cycle
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {filteredCycles.map(
              (cycle) => {
                const reviewCount =
                  Number(
                    cycle.review_count ||
                      cycle.total_reviews ||
                      0,
                  );

                const acknowledgedCount =
                  Number(
                    cycle.acknowledged_count ||
                      0,
                  );

                const completionPercent =
                  reviewCount > 0
                    ? Math.round(
                        (acknowledgedCount /
                          reviewCount) *
                          100,
                      )
                    : 0;

                const canComplete =
                  cycle.status ===
                    "active" &&
                  reviewCount >
                    0 &&
                  acknowledgedCount ===
                    reviewCount;

                return (
                  <div
                    key={cycle.id}
                    className="p-5 hover:bg-ink-50/30"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <button
                        type="button"
                        onClick={() =>
                          openCycle(
                            cycle,
                          )
                        }
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                              cycle.status,
                            )}`}
                          >
                            {statusLabel(
                              cycle.status,
                            )}
                          </span>

                          <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                            {reviewTypeLabel(
                              cycle.review_type,
                            )}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-ink-900">
                          {cycle.title}
                        </h3>

                        {cycle.description && (
                          <p className="mt-1 max-w-3xl text-sm text-ink-500">
                            {
                              cycle.description
                            }
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-500">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />

                            {formatDate(
                              cycle.start_date,
                            )}

                            {" — "}

                            {formatDate(
                              cycle.due_date,
                            )}
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <Users className="h-4 w-4" />

                            {reviewCount} employees
                          </span>

                          <span className="inline-flex items-center gap-2">
                            <Check className="h-4 w-4" />

                            {
                              completionPercent
                            }
                            % acknowledged
                          </span>
                        </div>
                      </button>

                      <div className="flex flex-wrap items-center gap-2">
                        {cycle.status ===
                          "draft" && (
                          <button
                            type="button"
                            onClick={() =>
                              startCycle(
                                cycle,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                          >
                            <Play className="h-4 w-4" />

                            Start
                          </button>
                        )}

                        {cycle.status ===
                          "active" && (
                          <button
                            type="button"
                            disabled={
                              !canComplete
                            }
                            onClick={() =>
                              completeCycle(
                                cycle,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Check className="h-4 w-4" />

                            Complete
                          </button>
                        )}

                        {cycle.status ===
                          "draft" && (
                          <button
                            type="button"
                            onClick={() =>
                              openEditForm(
                                cycle,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                          >
                            <Pencil className="h-4 w-4" />

                            Edit
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setDeleteId(
                              cycle.id,
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />

                          Delete
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openCycle(
                              cycle,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
                        >
                          Open

                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-canvas p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                            Review progress
                          </p>

                          <p className="mt-1 text-sm font-semibold text-ink-800">
                            {
                              acknowledgedCount
                            }{" "}
                            of{" "}
                            {
                              reviewCount
                            }{" "}
                            acknowledged
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-ink-500">
                          <span>
                            Pending:{" "}
                            {cycle.pending_count ||
                              0}
                          </span>

                          <span>
                            In progress:{" "}
                            {cycle.in_progress_count ||
                              0}
                          </span>

                          <span>
                            Submitted:{" "}
                            {cycle.submitted_count ||
                              0}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-brand-600 transition-all"
                          style={{
                            width: `${completionPercent}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  {editingCycle
                    ? "Edit review cycle"
                    : "Create review cycle"}
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Define the period and
                  choose who will be
                  reviewed.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5 p-6"
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Review cycle name
                  </label>

                  <input
                    value={
                      form.title
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,
                        title:
                          event.target
                            .value,
                      })
                    }
                    placeholder="e.g. Q3 Performance Review"
                    required
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Review type
                  </label>

                  <select
                    value={
                      form.reviewType
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,
                        reviewType:
                          event.target
                            .value,
                      })
                    }
                    className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="annual">
                      Annual
                    </option>

                    <option value="mid_year">
                      Mid-year
                    </option>

                    <option value="quarterly">
                      Quarterly
                    </option>

                    <option value="probation">
                      Probation
                    </option>

                    <option value="custom">
                      Custom
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Start date
                  </label>

                  <input
                    type="date"
                    value={
                      form.startDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,
                        startDate:
                          event.target
                            .value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Due date
                  </label>

                  <input
                    type="date"
                    value={
                      form.dueDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,
                        dueDate:
                          event.target
                            .value,
                      })
                    }
                    required
                    className="w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Description
                  </label>

                  <textarea
                    rows={3}
                    value={
                      form.description
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,
                        description:
                          event.target
                            .value,
                      })
                    }
                    placeholder="What does this review cycle cover?"
                    className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              {!editingCycle && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-ink-700">
                      Employees
                    </label>

                    <button
                      type="button"
                      onClick={
                        toggleAllEmployees
                      }
                      className="text-sm font-medium text-brand-700"
                    >
                      {form.employeeIds
                        .length ===
                      employees.length
                        ? "Clear all"
                        : "Select all"}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-xl border border-ink-200">
                    {employees.length ? (
                      employees.map(
                        (
                          employee,
                        ) => {
                          const id =
                            employeeId(
                              employee,
                            );

                          const checked =
                            form.employeeIds.includes(
                              id,
                            );

                          return (
                            <label
                              key={id}
                              className="flex cursor-pointer items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0 hover:bg-ink-50"
                            >
                              <input
                                type="checkbox"
                                checked={
                                  checked
                                }
                                onChange={() =>
                                  toggleEmployee(
                                    id,
                                  )
                                }
                                className="h-4 w-4"
                              />

                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold">
                                {employeeName(
                                  employee,
                                )
                                  .charAt(
                                    0,
                                  )
                                  .toUpperCase()}
                              </div>

                              <div>
                                <p className="text-sm font-medium text-ink-800">
                                  {employeeName(
                                    employee,
                                  )}
                                </p>

                                <p className="text-xs text-ink-400">
                                  {employeeTitle(
                                    employee,
                                  )}{" "}
                                  ·{" "}
                                  {employeeDepartment(
                                    employee,
                                  )}
                                </p>
                              </div>
                            </label>
                          );
                        },
                      )
                    ) : (
                      <div className="px-4 py-8 text-center text-sm text-ink-400">
                        No employees
                        found.
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-ink-400">
                    {
                      form.employeeIds
                        .length
                    }{" "}
                    selected.
                  </p>
                </div>
              )}

              {editingCycle && (
                <div className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
                  This cycle is already
                  configured. Employee
                  membership is preserved.
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                <button
                  type="button"
                  onClick={
                    closeForm
                  }
                  disabled={saving}
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}

                  {editingCycle
                    ? "Save changes"
                    : "Create cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          CYCLE DETAILS
      ===================================================== */}

      {(selectedCycle ||
        loadingDetails) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            {loadingDetails ? (
              <div className="px-6 py-16 text-center text-sm text-ink-500">
                Loading review cycle...
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between border-b border-ink-100 px-6 py-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink-900">
                        {
                          selectedCycle.title
                        }
                      </h2>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                          selectedCycle.status,
                        )}`}
                      >
                        {statusLabel(
                          selectedCycle.status,
                        )}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-ink-500">
                      {reviewTypeLabel(
                        selectedCycle.review_type,
                      )}{" "}
                      ·{" "}
                      {formatDate(
                        selectedCycle.start_date,
                      )}{" "}
                      —{" "}
                      {formatDate(
                        selectedCycle.due_date,
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCycle(
                        null,
                      );

                      setWorkingReviewId(
                        null,
                      );
                    }}
                    className="rounded-lg p-2 text-ink-400 hover:bg-ink-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-6">
                  {selectedCycle.status ===
                    "draft" && (
                    <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          This cycle has
                          not started
                        </p>

                        <p className="mt-0.5 text-xs text-blue-700">
                          Starting it unlocks
                          the employee
                          review workflow.
                          It will not
                          complete any
                          reviews.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          startCycle(
                            selectedCycle,
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        <Play className="h-4 w-4" />

                        Start cycle
                      </button>
                    </div>
                  )}

                  {selectedCycle.description && (
                    <div className="mb-5 rounded-xl bg-canvas p-4 text-sm text-ink-600">
                      {
                        selectedCycle.description
                      }
                    </div>
                  )}

                  <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase text-ink-400">
                        Employees
                      </p>

                      <p className="mt-1 text-xl font-semibold">
                        {selectedCycle.review_count ||
                          0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase text-ink-400">
                        Pending
                      </p>

                      <p className="mt-1 text-xl font-semibold">
                        {selectedCycle.pending_count ||
                          0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase text-ink-400">
                        Submitted
                      </p>

                      <p className="mt-1 text-xl font-semibold">
                        {selectedCycle.submitted_count ||
                          0}
                      </p>
                    </div>

                    <div className="rounded-xl border border-ink-100 p-4">
                      <p className="text-xs uppercase text-ink-400">
                        Acknowledged
                      </p>

                      <p className="mt-1 text-xl font-semibold">
                        {selectedCycle.acknowledged_count ||
                          0}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6 h-2 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Number(
                            selectedCycle.completion_percent ||
                              0,
                          ),
                        )}%`,
                      }}
                    />
                  </div>

                  {/* =================================================
                      EMPLOYEE REVIEWS
                  ================================================= */}

                  <div className="overflow-hidden rounded-xl border border-ink-100">
                    <div className="border-b border-ink-100 bg-ink-50/50 px-4 py-3">
                      <h3 className="text-sm font-semibold text-ink-900">
                        Employee reviews
                      </h3>

                      <p className="mt-0.5 text-xs text-ink-500">
                        Each employee follows
                        Pending → In progress
                        → Submitted →
                        Acknowledged.
                      </p>
                    </div>

                    <div className="divide-y divide-ink-100">
                      {(
                        selectedCycle.reviews ||
                        []
                      ).map(
                        (review) => {
                          const employee =
                            review.employee;

                          const isWorking =
                            workingReviewId ===
                            review.id;

                          return (
                            <div
                              key={
                                review.id
                              }
                              className="px-4 py-5"
                            >
                              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold">
                                    {employeeName(
                                      employee,
                                    )
                                      .charAt(
                                        0,
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <div>
                                    <p className="text-sm font-semibold text-ink-900">
                                      {employeeName(
                                        employee,
                                      )}
                                    </p>

                                    <p className="text-xs text-ink-400">
                                      {employeeTitle(
                                        employee,
                                      )}{" "}
                                      ·{" "}
                                      {employeeDepartment(
                                        employee,
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                                      review.status,
                                    )}`}
                                  >
                                    {statusLabel(
                                      review.status,
                                    )}
                                  </span>

                                  {selectedCycle.status ===
                                    "active" &&
                                    review.status ===
                                      "pending" && (
                                      <button
                                        type="button"
                                        disabled={
                                          reviewSaving
                                        }
                                        onClick={() =>
                                          startReview(
                                            review,
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white"
                                      >
                                        <Play className="h-3.5 w-3.5" />

                                        Start review
                                      </button>
                                    )}

                                  {selectedCycle.status ===
                                    "active" &&
                                    review.status ===
                                      "in_progress" && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openExistingReview(
                                            review,
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-medium text-brand-700"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />

                                        Continue review
                                      </button>
                                    )}

                                  {selectedCycle.status ===
                                    "active" &&
                                    review.status ===
                                      "submitted" && (
                                      <button
                                        type="button"
                                        disabled={
                                          reviewSaving
                                        }
                                        onClick={() =>
                                          acknowledgeReview(
                                            review,
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-700"
                                      >
                                        <ShieldCheck className="h-3.5 w-3.5" />

                                        Acknowledge
                                      </button>
                                    )}
                                </div>
                              </div>

                              {(review.status ===
                                "submitted" ||
                                review.status ===
                                  "acknowledged" ||
                                review.status ===
                                  "completed") && (
                                <div className="mt-4 rounded-xl bg-canvas p-4">
                                  <div className="flex items-center gap-2 text-sm font-medium text-ink-800">
                                    <Star className="h-4 w-4 text-amber-500" />

                                    Rating:{" "}
                                    {review.rating ??
                                      "Not rated"}
                                    /5
                                  </div>

                                  {review.comments && (
                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
                                      {
                                        review.comments
                                      }
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* =================================================
                                  REVIEW WORKSPACE
                              ================================================= */}

                              {isWorking && (
                                <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/40 p-5">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-ink-900">
                                        Review workspace
                                      </p>

                                      <p className="mt-0.5 text-xs text-ink-500">
                                        Save a draft while
                                        working, then
                                        submit when the
                                        review is complete.
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        setWorkingReviewId(
                                          null,
                                        )
                                      }
                                      className="rounded-lg p-1.5 text-ink-400 hover:bg-white"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                                    <div>
                                      <label className="mb-1.5 block text-sm font-medium text-ink-700">
                                        Rating
                                      </label>

                                      <select
                                        value={
                                          reviewDraft.rating
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          setReviewDraft(
                                            {
                                              ...reviewDraft,
                                              rating:
                                                event
                                                  .target
                                                  .value,
                                            },
                                          )
                                        }
                                        className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm"
                                      >
                                        <option value="">
                                          Select
                                        </option>

                                        {[1, 2, 3, 4, 5].map(
                                          (
                                            number,
                                          ) => (
                                            <option
                                              key={
                                                number
                                              }
                                              value={
                                                number
                                              }
                                            >
                                              {
                                                number
                                              }{" "}
                                              / 5
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="mb-1.5 block text-sm font-medium text-ink-700">
                                        Manager feedback
                                      </label>

                                      <textarea
                                        rows={
                                          5
                                        }
                                        value={
                                          reviewDraft.comments
                                        }
                                        onChange={(
                                          event,
                                        ) =>
                                          setReviewDraft(
                                            {
                                              ...reviewDraft,
                                              comments:
                                                event
                                                  .target
                                                  .value,
                                            },
                                          )
                                        }
                                        placeholder="Document performance, strengths, improvement areas and next steps..."
                                        className="w-full resize-none rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-4 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        reviewSaving
                                      }
                                      onClick={
                                        saveReviewDraft
                                      }
                                      className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700"
                                    >
                                      <Save className="h-4 w-4" />

                                      Save draft
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        reviewSaving
                                      }
                                      onClick={
                                        submitReview
                                      }
                                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white"
                                    >
                                      <Send className="h-4 w-4" />

                                      Submit review
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  {/* =================================================
                      COMPLETE CYCLE
                  ================================================= */}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-ink-500">
                      {allAcknowledged
                        ? "All employee reviews are acknowledged. The cycle can now be completed."
                        : selectedCycle.status ===
                            "active"
                          ? `${
                              selectedCycle.acknowledged_count ||
                              0
                            } of ${
                              selectedCycle.review_count ||
                              0
                            } reviews acknowledged.`
                          : "Start the cycle to begin the review workflow."}
                    </p>

                    <div className="flex gap-2">
                      {selectedCycle.status ===
                        "active" && (
                        <button
                          type="button"
                          disabled={
                            !allAcknowledged
                          }
                          onClick={() =>
                            completeCycle(
                              selectedCycle,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check className="h-4 w-4" />

                          Complete cycle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          DELETE MODAL
      ===================================================== */}

      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-5 w-5" />
            </div>

            <h2 className="mt-4 text-lg font-semibold text-ink-900">
              Delete this review
              cycle?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              This permanently removes
              the cycle and its employee
              review records.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() =>
                  setDeleteId(null)
                }
                className="rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={deleting}
                onClick={
                  handleDelete
                }
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white"
              >
                {deleting && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}

                Delete cycle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}