import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  Edit3,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import {
  archiveContinuousFeedback,
  createContinuousFeedback,
  deleteContinuousFeedback,
  getContinuousFeedback,
  updateContinuousFeedback,
} from "../../services/continuousFeedbackService";

import api from "../../services/api";

const INITIAL_FORM = {
  employeeId: "",
  feedbackType: "general",
  category: "",
  title: "",
  feedback: "",
  visibility: "shared",
};

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function getTypeLabel(type) {
  if (type === "recognition") {
    return "Recognition";
  }

  if (type === "developmental") {
    return "Developmental";
  }

  return "General";
}

function getTypeClass(type) {
  if (type === "recognition") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (type === "developmental") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-slate-50 text-slate-600 border-slate-200";
}

export default function ContinuousFeedback() {
  const navigate = useNavigate();

  const [feedbackRows, setFeedbackRows] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [employeesLoading, setEmployeesLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("active");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [showModal, setShowModal] =
    useState(false);

  const [editingId, setEditingId] =
    useState(null);

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [saving, setSaving] =
    useState(false);

  const [actionId, setActionId] =
    useState(null);

  /* =======================================================
     LOAD EMPLOYEES
  ======================================================= */

  const loadEmployees = useCallback(
    async () => {
      try {
        setEmployeesLoading(true);

        const response = await api.get(
          "/employees",
        );

        const list =
          response?.data?.employees ||
          response?.data?.data ||
          (Array.isArray(response?.data)
            ? response.data
            : []);

        setEmployees(list);
      } catch (err) {
        console.error(
          "[ContinuousFeedback] Employee load failed:",
          err,
        );

        setEmployees([]);
      } finally {
        setEmployeesLoading(false);
      }
    },
    [],
  );

  /* =======================================================
     LOAD FEEDBACK
  ======================================================= */

  const loadFeedback = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const response =
          await getContinuousFeedback({
            status: statusFilter,
            feedbackType: typeFilter,
          });

        setFeedbackRows(
          response?.feedback || [],
        );
      } catch (err) {
        console.error(
          "[ContinuousFeedback] Load failed:",
          err,
        );

        setError(
          err?.response?.data?.message ||
            "Failed to load feedback.",
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, typeFilter],
  );

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  /* =======================================================
     SEARCH
  ======================================================= */

  const filteredFeedback =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      if (!query) {
        return feedbackRows;
      }

      return feedbackRows.filter(
        (item) => {
          const employeeName =
            item?.employee?.full_name ||
            "";

          const department =
            item?.employee?.department ||
            "";

          return [
            item.title,
            item.feedback,
            item.category,
            getTypeLabel(
              item.feedback_type,
            ),
            employeeName,
            department,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query),
            );
        },
      );
    }, [feedbackRows, search]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(() => {
    const total =
      feedbackRows.length;

    const recognition =
      feedbackRows.filter(
        (item) =>
          item.feedback_type ===
          "recognition",
      ).length;

    const developmental =
      feedbackRows.filter(
        (item) =>
          item.feedback_type ===
          "developmental",
      ).length;

    const employeesWithFeedback =
      new Set(
        feedbackRows.map(
          (item) =>
            item.employee_id,
        ),
      ).size;

    return {
      total,
      recognition,
      developmental,
      employeesWithFeedback,
    };
  }, [feedbackRows]);

  /* =======================================================
     FORM
  ======================================================= */

  function openCreateModal() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingId(item.id);

    setForm({
      employeeId:
        item.employee_id || "",
      feedbackType:
        item.feedback_type ||
        "general",
      category:
        item.category || "",
      title:
        item.title || "",
      feedback:
        item.feedback || "",
      visibility:
        item.visibility || "shared",
    });

    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
  }

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  /* =======================================================
     SAVE
  ======================================================= */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.employeeId) {
      setError(
        "Please select an employee.",
      );
      return;
    }

    if (!form.title.trim()) {
      setError(
        "Please enter a feedback title.",
      );
      return;
    }

    if (!form.feedback.trim()) {
      setError(
        "Please enter the feedback.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        employeeId:
          form.employeeId,
        feedbackType:
          form.feedbackType,
        category:
          form.category,
        title:
          form.title,
        feedback:
          form.feedback,
        visibility:
          form.visibility,
      };

      if (editingId) {
        await updateContinuousFeedback(
          editingId,
          payload,
        );
      } else {
        await createContinuousFeedback(
          payload,
        );
      }

      closeModal();

      await loadFeedback();
    } catch (err) {
      console.error(
        "[ContinuousFeedback] Save failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to save feedback.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* =======================================================
     ARCHIVE
  ======================================================= */

  async function handleArchive(id) {
    const confirmed =
      window.confirm(
        "Archive this feedback?",
      );

    if (!confirmed) return;

    try {
      setActionId(id);
      setError("");

      await archiveContinuousFeedback(
        id,
      );

      await loadFeedback();
    } catch (err) {
      console.error(
        "[ContinuousFeedback] Archive failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to archive feedback.",
      );
    } finally {
      setActionId(null);
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(id) {
    const confirmed =
      window.confirm(
        "Delete this feedback permanently?",
      );

    if (!confirmed) return;

    try {
      setActionId(id);
      setError("");

      await deleteContinuousFeedback(
        id,
      );

      await loadFeedback();
    } catch (err) {
      console.error(
        "[ContinuousFeedback] Delete failed:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Failed to delete feedback.",
      );
    } finally {
      setActionId(null);
    }
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-full bg-[#f5f8f7] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-[1180px] min-w-0">

        {/* BACK */}

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={17} />
          Back
        </button>

        {/* HEADER */}

        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#167d74] shadow-sm ring-1 ring-slate-200">
                <MessageSquare
                  size={22}
                />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Continuous Feedback
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Capture meaningful feedback outside formal review cycles.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadFeedback}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
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
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#167d74] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#126c64]"
            >
              <Plus size={17} />
              Give feedback
            </button>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* STATS */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={
              <MessageSquare
                size={19}
              />
            }
            label="TOTAL FEEDBACK"
            value={stats.total}
          />

          <StatCard
            icon={
              <CheckCircle2
                size={19}
              />
            }
            label="RECOGNITION"
            value={
              stats.recognition
            }
          />

          <StatCard
            icon={
              <UserRound
                size={19}
              />
            }
            label="DEVELOPMENTAL"
            value={
              stats.developmental
            }
          />

          <StatCard
            icon={
              <UserRound
                size={19}
              />
            }
            label="EMPLOYEES WITH FEEDBACK"
            value={
              stats.employeesWithFeedback
            }
          />
        </div>

        {/* FILTERS */}

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_190px_190px]">

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search feedback, employees, departments..."
                className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#167d74] focus:ring-2 focus:ring-[#167d74]/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#167d74]"
            >
              <option value="active">
                Active feedback
              </option>

              <option value="archived">
                Archived
              </option>

              <option value="all">
                All statuses
              </option>
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value,
                )
              }
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#167d74]"
            >
              <option value="all">
                All types
              </option>

              <option value="general">
                General
              </option>

              <option value="recognition">
                Recognition
              </option>

              <option value="developmental">
                Developmental
              </option>
            </select>

          </div>
        </div>

        {/* FEEDBACK LIST */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Feedback
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Real-time employee feedback and recognition.
                </p>
              </div>

              <span className="text-sm text-slate-400">
                {filteredFeedback.length} shown
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <RefreshCw
                size={24}
                className="animate-spin text-[#167d74]"
              />
            </div>
          ) : filteredFeedback.length ===
            0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef7f5] text-[#167d74]">
                <MessageSquare
                  size={25}
                />
              </div>

              <h3 className="text-base font-semibold text-slate-900">
                No feedback yet
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                Start capturing meaningful feedback for your employees.
              </p>

              <button
                type="button"
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#167d74] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#126c64]"
              >
                <Plus size={17} />
                Give first feedback
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFeedback.map(
                (item) => (
                  <FeedbackRow
                    key={item.id}
                    item={item}
                    actionId={actionId}
                    onEdit={
                      openEditModal
                    }
                    onArchive={
                      handleArchive
                    }
                    onDelete={
                      handleDelete
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId
                    ? "Edit feedback"
                    : "Give feedback"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Capture feedback while it is still fresh.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5 p-6"
            >

              {/* EMPLOYEE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Employee
                </label>

                <select
                  name="employeeId"
                  value={
                    form.employeeId
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    employeesLoading
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#167d74] focus:ring-2 focus:ring-[#167d74]/10"
                >
                  <option value="">
                    {employeesLoading
                      ? "Loading employees..."
                      : "Select employee"}
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
                          employee.full_name
                        }
                        {employee.department
                          ? ` — ${employee.department}`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {/* TYPE + CATEGORY */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Feedback type
                  </label>

                  <select
                    name="feedbackType"
                    value={
                      form.feedbackType
                    }
                    onChange={
                      handleChange
                    }
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#167d74]"
                  >
                    <option value="general">
                      General
                    </option>

                    <option value="recognition">
                      Recognition
                    </option>

                    <option value="developmental">
                      Developmental
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Category
                  </label>

                  <input
                    name="category"
                    value={
                      form.category
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. Communication"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#167d74] focus:ring-2 focus:ring-[#167d74]/10"
                  />
                </div>
              </div>

              {/* TITLE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Title
                </label>

                <input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Give the feedback a clear title"
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#167d74] focus:ring-2 focus:ring-[#167d74]/10"
                />
              </div>

              {/* FEEDBACK */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Feedback
                </label>

                <textarea
                  name="feedback"
                  value={
                    form.feedback
                  }
                  onChange={
                    handleChange
                  }
                  rows={6}
                  placeholder="Describe what happened, what went well, or what could improve..."
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-[#167d74] focus:ring-2 focus:ring-[#167d74]/10"
                />
              </div>

              {/* VISIBILITY */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Visibility
                </label>

                <select
                  name="visibility"
                  value={
                    form.visibility
                  }
                  onChange={
                    handleChange
                  }
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#167d74]"
                >
                  <option value="shared">
                    Shared
                  </option>

                  <option value="private">
                    Private
                  </option>
                </select>

                <p className="mt-1.5 text-xs text-slate-400">
                  Shared feedback is visible in the organization's feedback records.
                </p>
              </div>

              {/* ACTIONS */}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-[#167d74] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#126c64] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <RefreshCw
                      size={16}
                      className="animate-spin"
                    />
                  )}

                  {editingId
                    ? "Save changes"
                    : "Give feedback"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef7f5] text-[#167d74]">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   FEEDBACK ROW
========================================================= */

function FeedbackRow({
  item,
  actionId,
  onEdit,
  onArchive,
  onDelete,
}) {
  const employee =
    item.employee;

  const busy =
    actionId === item.id;

  return (
    <div className="p-5 transition hover:bg-slate-50/60">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">

        <div className="min-w-0 flex-1">

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getTypeClass(
                item.feedback_type,
              )}`}
            >
              {getTypeLabel(
                item.feedback_type,
              )}
            </span>

            {item.category && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                {item.category}
              </span>
            )}

            <span className="text-xs text-slate-400">
              {formatDate(
                item.created_at,
              )}
            </span>
          </div>

          <h3 className="text-base font-semibold text-slate-900">
            {item.title}
          </h3>

          <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
            <UserRound size={15} />

            <span>
              {employee?.full_name ||
                "Unknown employee"}
            </span>

            {employee?.department && (
              <>
                <span>
                  ·
                </span>

                <span>
                  {
                    employee.department
                  }
                </span>
              </>
            )}
          </div>

          <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {item.feedback}
          </p>

          <div className="mt-4 text-xs text-slate-400">
            Visibility:{" "}
            <span className="font-medium text-slate-500">
              {item.visibility ===
              "private"
                ? "Private"
                : "Shared"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              onEdit(item)
            }
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Edit3 size={15} />
            Edit
          </button>

          {item.status ===
            "active" && (
            <button
              type="button"
              onClick={() =>
                onArchive(item.id)
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Archive size={15} />
              Archive
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onDelete(item.id)
            }
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}