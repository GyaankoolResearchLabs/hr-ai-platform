import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";

const EMPTY_FORM = {
  name: "",
  review_year: new Date().getFullYear(),
  start_date: "",
  end_date: "",
  effective_date: "",
  status: "draft",
  description: "",
};

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClasses(status) {
  switch (String(status || "").toLowerCase()) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "completed":
      return "bg-blue-50 text-blue-700";
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function normalizeCycle(cycle) {
  return {
    ...cycle,
    id: cycle.id,
    name: cycle.name || "",
    review_year: cycle.review_year || "",
    start_date: cycle.start_date || "",
    end_date: cycle.end_date || "",
    effective_date: cycle.effective_date || "",
    status: cycle.status || "draft",
    description: cycle.description || "",
    employee_count: Number(cycle.employee_count || 0),
  };
}

export default function CompReviewCycleManager() {
  const navigate = useNavigate();

  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadCycles = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/comp-review-cycles");
      const rows = Array.isArray(response.data)
        ? response.data
        : response.data?.cycles || [];

      setCycles(rows.map(normalizeCycle));
    } catch (err) {
      console.error("Load compensation review cycles error:", err);
      setError(
        err.response?.data?.message ||
          "Could not load compensation review cycles.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  const filteredCycles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cycles.filter((cycle) => {
      const matchesSearch =
        !query ||
        cycle.name.toLowerCase().includes(query) ||
        String(cycle.review_year).includes(query) ||
        cycle.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        String(cycle.status).toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [cycles, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: cycles.length,
      active: cycles.filter((c) => c.status === "active").length,
      draft: cycles.filter((c) => c.status === "draft").length,
      completed: cycles.filter((c) => c.status === "completed").length,
    };
  }, [cycles]);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      review_year: new Date().getFullYear(),
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEdit = (cycle) => {
    setEditingId(cycle.id);
    setForm({
      name: cycle.name || "",
      review_year: cycle.review_year || new Date().getFullYear(),
      start_date: cycle.start_date
        ? String(cycle.start_date).slice(0, 10)
        : "",
      end_date: cycle.end_date
        ? String(cycle.end_date).slice(0, 10)
        : "",
      effective_date: cycle.effective_date
        ? String(cycle.effective_date).slice(0, 10)
        : "",
      status: cycle.status || "draft",
      description: cycle.description || "",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.name.trim()) return "Cycle name is required.";
    if (!form.review_year) return "Review year is required.";
    if (!form.start_date) return "Start date is required.";
    if (!form.end_date) return "End date is required.";

    if (form.end_date < form.start_date) {
      return "End date must be on or after the start date.";
    }

    if (
      form.effective_date &&
      form.effective_date < form.end_date
    ) {
      return "Effective date should be on or after the review end date.";
    }

    return "";
  };

  const saveCycle = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: form.name.trim(),
        review_year: Number(form.review_year),
        start_date: form.start_date,
        end_date: form.end_date,
        effective_date: form.effective_date || null,
        status: form.status,
        description: form.description.trim() || null,
      };

      if (editingId) {
        await api.put(
          `/comp-review-cycles/${editingId}`,
          payload,
        );
        setSuccess("Compensation review cycle updated.");
      } else {
        await api.post("/comp-review-cycles", payload);
        setSuccess("Compensation review cycle created.");
      }

      closeModal();
      await loadCycles();
    } catch (err) {
      console.error("Save compensation review cycle error:", err);
      setError(
        err.response?.data?.message ||
          "Could not save the compensation review cycle.",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteCycle = async (cycle) => {
    const confirmed = window.confirm(
      `Delete "${cycle.name}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/comp-review-cycles/${cycle.id}`);

      setSuccess("Compensation review cycle deleted.");
      await loadCycles();
    } catch (err) {
      console.error("Delete compensation review cycle error:", err);
      setError(
        err.response?.data?.message ||
          "Could not delete the compensation review cycle.",
      );
    }
  };

  const updateStatus = async (cycle, status) => {
    try {
      setError("");
      setSuccess("");

      await api.patch(`/comp-review-cycles/${cycle.id}/status`, {
        status,
      });

      setSuccess(`Cycle marked as ${status}.`);
      await loadCycles();
    } catch (err) {
      console.error("Update compensation review cycle status error:", err);
      setError(
        err.response?.data?.message ||
          "Could not update the cycle status.",
      );
    }
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">
            Annual Cycles
          </p>
          <h1 className="text-2xl font-semibold text-slate-950">
            Comp Review Cycle Manager
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create structured, auditable compensation review and increment
            cycles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadCycles}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Add review cycle
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Total cycles
            </span>
            <CalendarDays className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-semibold text-slate-950">
            {stats.total}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Review cycles configured
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Active
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-semibold text-slate-950">
            {stats.active}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Currently running cycles
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Draft
            </span>
            <Clock3 className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-slate-950">
            {stats.draft}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Awaiting launch
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Completed
            </span>
            <Users className="h-4 w-4 text-slate-500" />
          </div>
          <p className="text-2xl font-semibold text-slate-950">
            {stats.completed}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Historical cycles
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search review cycles..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-950">
            Compensation review cycles
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Structured annual review periods stored in your HR database.
          </p>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            Loading review cycles...
          </div>
        ) : filteredCycles.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="font-medium text-slate-700">
              No review cycles found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create your first compensation review cycle to get started.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Add review cycle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Cycle
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Review year
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Review period
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Effective date
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Employees
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredCycles.map((cycle) => (
                  <tr
                    key={cycle.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {cycle.name}
                      </div>
                      {cycle.description && (
                        <div className="mt-1 max-w-xs truncate text-xs text-slate-500">
                          {cycle.description}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {cycle.review_year || "—"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      <div>{formatDate(cycle.start_date)}</div>
                      <div className="text-xs text-slate-400">
                        to {formatDate(cycle.end_date)}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {formatDate(cycle.effective_date)}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-700">
                      {cycle.employee_count}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                          cycle.status,
                        )}`}
                      >
                        {cycle.status}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        {cycle.status === "draft" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateStatus(cycle, "active")
                            }
                            title="Activate cycle"
                            className="rounded-md p-2 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}

                        {cycle.status === "active" && (
                          <button
                            type="button"
                            onClick={() =>
                              updateStatus(cycle, "completed")
                            }
                            title="Complete cycle"
                            className="rounded-md p-2 text-blue-600 transition hover:bg-blue-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openEdit(cycle)}
                          title="Edit cycle"
                          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteCycle(cycle)}
                          title="Delete cycle"
                          className="rounded-md p-2 text-red-500 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {editingId
                    ? "Edit review cycle"
                    : "Create review cycle"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Define the annual compensation review period and effective
                  date.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveCycle} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Cycle name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  placeholder="e.g. FY 2026 Annual Compensation Review"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Review year
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={form.review_year}
                    onChange={(event) =>
                      updateField("review_year", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Review start date
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(event) =>
                      updateField("start_date", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Review end date
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(event) =>
                      updateField("end_date", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Compensation effective date
                </label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(event) =>
                    updateField("effective_date", event.target.value)
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  The date approved compensation changes take effect.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  placeholder="Describe the purpose, scope or review rules for this cycle..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Save changes" : "Create review cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}