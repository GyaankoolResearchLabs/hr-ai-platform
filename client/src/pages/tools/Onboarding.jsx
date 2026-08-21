import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  Users,
  ClipboardCheck,
  Clock3,
  CheckCircle2,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  UserPlus,
  CalendarDays,
  BriefcaseBusiness,
  ChevronDown,
} from "lucide-react";
import api from "../../lib/api";

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const EMPLOYEE_STATUS_OPTIONS = [
  { value: "preboarding", label: "Pre-boarding" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const EMPTY_FORM = {
  employee_name: "",
  employee_email: "",
  job_title: "",
  department: "",
  joining_date: "",
  manager_name: "",
  status: "preboarding",
  notes: "",
};

function formatDate(date) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusLabel(status) {
  const found = EMPLOYEE_STATUS_OPTIONS.find(
    (option) => option.value === status
  );

  return found?.label || status || "Pre-boarding";
}

function getTaskStatusLabel(status) {
  const found = STATUS_OPTIONS.find((option) => option.value === status);

  return found?.label || status || "Not started";
}

function normalizeOnboarding(item) {
  return {
    id: item.id,
    employee_name:
      item.employee_name ||
      item.employeeName ||
      item.name ||
      "Unnamed employee",
    employee_email:
      item.employee_email ||
      item.employeeEmail ||
      item.email ||
      "",
    job_title: item.job_title || item.jobTitle || "",
    department: item.department || "",
    joining_date:
      item.joining_date ||
      item.joiningDate ||
      item.start_date ||
      item.startDate ||
      null,
    manager_name:
      item.manager_name ||
      item.managerName ||
      item.manager ||
      "",
    status: item.status || "preboarding",
    notes: item.notes || "",
    tasks: Array.isArray(item.tasks) ? item.tasks : [],
    created_at: item.created_at || item.createdAt || null,
    updated_at: item.updated_at || item.updatedAt || null,
  };
}

export default function Onboarding() {
  const [onboardings, setOnboardings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [selectedOnboarding, setSelectedOnboarding] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    due_date: "",
    status: "not_started",
  });

  const [openMenu, setOpenMenu] = useState(null);

  const loadOnboardings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/onboarding");

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data ||
          response.data?.onboardings ||
          response.data?.records ||
          [];

      setOnboardings(data.map(normalizeOnboarding));
    } catch (err) {
      console.error("[Onboarding] Failed to load:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to load onboarding records."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOnboardings();
  }, []);

  const filteredOnboardings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return onboardings.filter((item) => {
      const matchesSearch =
        !query ||
        item.employee_name.toLowerCase().includes(query) ||
        item.employee_email.toLowerCase().includes(query) ||
        item.job_title.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [onboardings, search, statusFilter]);

  const stats = useMemo(() => {
    const total = onboardings.length;

    const preboarding = onboardings.filter(
      (item) => item.status === "preboarding"
    ).length;

    const active = onboardings.filter(
      (item) => item.status === "active"
    ).length;

    const completed = onboardings.filter(
      (item) => item.status === "completed"
    ).length;

    return {
      total,
      preboarding,
      active,
      completed,
    };
  }, [onboardings]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const openCreateModal = () => {
    setError("");
    setSuccess("");
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (item) => {
    setError("");
    setSuccess("");

    setEditingId(item.id);

    setForm({
      employee_name: item.employee_name || "",
      employee_email: item.employee_email || "",
      job_title: item.job_title || "",
      department: item.department || "",
      joining_date: item.joining_date
        ? String(item.joining_date).slice(0, 10)
        : "",
      manager_name: item.manager_name || "",
      status: item.status || "preboarding",
      notes: item.notes || "",
    });

    setOpenMenu(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (saving) return;

    setShowCreateModal(false);
    resetForm();
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCreateOrUpdate = async (event) => {
    event.preventDefault();

    if (!form.employee_name.trim()) {
      setError("Employee name is required.");
      return;
    }

    if (!form.employee_email.trim()) {
      setError("Employee email is required.");
      return;
    }

    if (!form.job_title.trim()) {
      setError("Job title is required.");
      return;
    }

    if (!form.joining_date) {
      setError("Joining date is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        employee_name: form.employee_name.trim(),
        employee_email: form.employee_email.trim(),
        job_title: form.job_title.trim(),
        department: form.department.trim(),
        joining_date: form.joining_date,
        manager_name: form.manager_name.trim(),
        status: form.status,
        notes: form.notes.trim(),
      };

      if (editingId) {
        await api.put(`/onboarding/${editingId}`, payload);

        setSuccess("Onboarding record updated successfully.");
      } else {
        await api.post("/onboarding", payload);

        setSuccess("Onboarding record created successfully.");
      }

      setShowCreateModal(false);
      resetForm();

      await loadOnboardings();
    } catch (err) {
      console.error("[Onboarding] Create/update failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to save onboarding record."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setOpenMenu(null);

    const confirmed = window.confirm(
      "Are you sure you want to delete this onboarding record?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/onboarding/${id}`);

      setSuccess("Onboarding record deleted successfully.");

      if (selectedOnboarding?.id === id) {
        setSelectedOnboarding(null);
        setShowDetailsModal(false);
      }

      await loadOnboardings();
    } catch (err) {
      console.error("[Onboarding] Delete failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete onboarding record."
      );
    }
  };

  const openDetails = (item) => {
    setSelectedOnboarding(item);
    setShowDetailsModal(true);
    setOpenMenu(null);
  };

  const openAddTask = (item) => {
    setSelectedOnboarding(item);

    setTaskForm({
      title: "",
      description: "",
      due_date: "",
      status: "not_started",
    });

    setOpenMenu(null);
    setShowTaskModal(true);
  };

  const handleTaskChange = (event) => {
    const { name, value } = event.target;

    setTaskForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAddTask = async (event) => {
    event.preventDefault();

    if (!selectedOnboarding) return;

    if (!taskForm.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.post(`/onboarding/${selectedOnboarding.id}/tasks`, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        due_date: taskForm.due_date || null,
        status: taskForm.status,
      });

      setShowTaskModal(false);

      setSuccess("Onboarding task added successfully.");

      await loadOnboardings();

      const refreshed = await api.get(
        `/onboarding/${selectedOnboarding.id}`
      );

      const refreshedData = normalizeOnboarding(
        refreshed.data?.data || refreshed.data
      );

      setSelectedOnboarding(refreshedData);
      setShowDetailsModal(true);
    } catch (err) {
      console.error("[Onboarding] Add task failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to add onboarding task."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTaskStatusChange = async (task, status) => {
    if (!selectedOnboarding) return;

    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/onboarding/${selectedOnboarding.id}/tasks/${task.id}`,
        {
          status,
        }
      );

      const refreshed = await api.get(
        `/onboarding/${selectedOnboarding.id}`
      );

      const refreshedData = normalizeOnboarding(
        refreshed.data?.data || refreshed.data
      );

      setSelectedOnboarding(refreshedData);

      setOnboardings((current) =>
        current.map((item) =>
          item.id === refreshedData.id ? refreshedData : item
        )
      );

      setSuccess("Task status updated.");
    } catch (err) {
      console.error("[Onboarding] Task update failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to update task."
      );
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!selectedOnboarding) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this onboarding task?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(
        `/onboarding/${selectedOnboarding.id}/tasks/${taskId}`
      );

      const refreshed = await api.get(
        `/onboarding/${selectedOnboarding.id}`
      );

      const refreshedData = normalizeOnboarding(
        refreshed.data?.data || refreshed.data
      );

      setSelectedOnboarding(refreshedData);

      setOnboardings((current) =>
        current.map((item) =>
          item.id === refreshedData.id ? refreshedData : item
        )
      );

      setSuccess("Task deleted successfully.");
    } catch (err) {
      console.error("[Onboarding] Delete task failed:", err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Failed to delete task."
      );
    }
  };

  const getTaskProgress = (tasks = []) => {
    if (!tasks.length) return 0;

    const completed = tasks.filter(
      (task) => task.status === "completed"
    ).length;

    return Math.round((completed / tasks.length) * 100);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <BriefcaseBusiness size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Onboarding
                </h1>

                <p className="mt-1 text-sm text-slate-500 sm:text-base">
                  Manage new-hire onboarding from pre-boarding through the
                  first 90 days.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadOnboardings}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
            >
              <Plus size={18} />
              New onboarding
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <span>{success}</span>

            <button
              type="button"
              onClick={() => setSuccess("")}
              className="ml-4 text-emerald-500 hover:text-emerald-700"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="TOTAL ONBOARDINGS"
            value={stats.total}
            icon={<Users size={19} />}
          />

          <StatCard
            label="PRE-BOARDING"
            value={stats.preboarding}
            icon={<Clock3 size={19} />}
          />

          <StatCard
            label="ACTIVE"
            value={stats.active}
            icon={<UserPlus size={19} />}
          />

          <StatCard
            label="COMPLETED"
            value={stats.completed}
            icon={<CheckCircle2 size={19} />}
          />
        </div>

        {/* Main Card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  New hires
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Track onboarding progress and complete required tasks.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    type="text"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search employees..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-64"
                  />
                </div>

                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 sm:w-44"
                  >
                    <option value="all">All statuses</option>
                    {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <RefreshCw size={18} className="animate-spin" />
                Loading onboarding records...
              </div>
            </div>
          ) : filteredOnboardings.length === 0 ? (
            <EmptyState onCreate={openCreateModal} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredOnboardings.map((item) => {
                const progress = getTaskProgress(item.tasks);

                return (
                  <div
                    key={item.id}
                    className="px-5 py-5 transition hover:bg-slate-50/70 sm:px-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">
                            {item.employee_name}
                          </h3>

                          <StatusBadge status={item.status} />
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                          {item.job_title && (
                            <span>{item.job_title}</span>
                          )}

                          {item.department && (
                            <span>{item.department}</span>
                          )}

                          {item.employee_email && (
                            <span>{item.employee_email}</span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={15} />
                            Joining {formatDate(item.joining_date)}
                          </span>

                          {item.manager_name && (
                            <span>
                              Manager:{" "}
                              <span className="font-medium text-slate-700">
                                {item.manager_name}
                              </span>
                            </span>
                          )}

                          <span>
                            {item.tasks.length}{" "}
                            {item.tasks.length === 1 ? "task" : "tasks"}
                          </span>
                        </div>

                        {item.tasks.length > 0 && (
                          <div className="mt-4 max-w-xl">
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-500">
                                Onboarding progress
                              </span>

                              <span className="font-semibold text-slate-700">
                                {progress}%
                              </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-teal-600 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDetails(item)}
                          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenu(
                                openMenu === item.id ? null : item.id
                              )
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {openMenu === item.id && (
                            <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              <button
                                type="button"
                                onClick={() => openAddTask(item)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <ClipboardCheck size={16} />
                                Add task
                              </button>

                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil size={16} />
                                Edit onboarding
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <Modal
          title={editingId ? "Edit onboarding" : "Create onboarding"}
          subtitle={
            editingId
              ? "Update the new hire's onboarding information."
              : "Create an onboarding record for a new hire."
          }
          onClose={closeCreateModal}
        >
          <form onSubmit={handleCreateOrUpdate}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Employee name"
                name="employee_name"
                value={form.employee_name}
                onChange={handleFormChange}
                placeholder="Enter employee name"
                required
              />

              <FormField
                label="Employee email"
                name="employee_email"
                type="email"
                value={form.employee_email}
                onChange={handleFormChange}
                placeholder="employee@company.com"
                required
              />

              <FormField
                label="Job title"
                name="job_title"
                value={form.job_title}
                onChange={handleFormChange}
                placeholder="e.g. Software Engineer"
                required
              />

              <FormField
                label="Department"
                name="department"
                value={form.department}
                onChange={handleFormChange}
                placeholder="e.g. Engineering"
              />

              <FormField
                label="Joining date"
                name="joining_date"
                type="date"
                value={form.joining_date}
                onChange={handleFormChange}
                required
              />

              <FormField
                label="Manager"
                name="manager_name"
                value={form.manager_name}
                onChange={handleFormChange}
                placeholder="Manager name"
              />

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={form.status}
                  onChange={handleFormChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {EMPLOYEE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  placeholder="Add any onboarding notes..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            </div>

            <ModalFooter
              onCancel={closeCreateModal}
              loading={saving}
              submitText={editingId ? "Update onboarding" : "Create onboarding"}
            />
          </form>
        </Modal>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedOnboarding && (
        <Modal
          title={selectedOnboarding.employee_name}
          subtitle="Onboarding details and task progress."
          onClose={() => setShowDetailsModal(false)}
          wide
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailBox
                label="Job title"
                value={selectedOnboarding.job_title || "-"}
              />

              <DetailBox
                label="Department"
                value={selectedOnboarding.department || "-"}
              />

              <DetailBox
                label="Joining date"
                value={formatDate(selectedOnboarding.joining_date)}
              />

              <DetailBox
                label="Status"
                value={getStatusLabel(selectedOnboarding.status)}
              />
            </div>

            {selectedOnboarding.manager_name && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Manager
                </p>

                <p className="mt-1 text-sm font-medium text-slate-800">
                  {selectedOnboarding.manager_name}
                </p>
              </div>
            )}

            {selectedOnboarding.notes && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Notes
                </p>

                <div className="mt-2 rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {selectedOnboarding.notes}
                </div>
              </div>
            )}

            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Onboarding tasks
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Complete the required tasks for this new hire.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openAddTask(selectedOnboarding)}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                >
                  <Plus size={16} />
                  Add task
                </button>
              </div>

              {selectedOnboarding.tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
                  <ClipboardCheck
                    size={28}
                    className="mx-auto text-slate-400"
                  />

                  <p className="mt-3 text-sm font-medium text-slate-700">
                    No onboarding tasks yet
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Add tasks such as laptop setup, documentation, orientation,
                    or training.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedOnboarding.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="font-medium text-slate-900">
                            {task.title}
                          </h4>

                          {task.description && (
                            <p className="mt-1 text-sm leading-5 text-slate-500">
                              {task.description}
                            </p>
                          )}

                          {task.due_date && (
                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                              <CalendarDays size={14} />
                              Due {formatDate(task.due_date)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={task.status || "not_started"}
                            onChange={(event) =>
                              handleTaskStatusChange(
                                task,
                                event.target.value
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-teal-500"
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-500 transition hover:bg-red-50"
                            title="Delete task"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 text-xs font-medium text-slate-400">
                        {getTaskStatusLabel(task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add Task Modal */}
      {showTaskModal && selectedOnboarding && (
        <Modal
          title="Add onboarding task"
          subtitle={`Create a task for ${selectedOnboarding.employee_name}.`}
          onClose={() => setShowTaskModal(false)}
        >
          <form onSubmit={handleAddTask}>
            <div className="space-y-4">
              <FormField
                label="Task title"
                name="title"
                value={taskForm.title}
                onChange={handleTaskChange}
                placeholder="e.g. Prepare laptop and access"
                required
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={taskForm.description}
                  onChange={handleTaskChange}
                  rows={4}
                  placeholder="Describe what needs to be completed..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>

              <FormField
                label="Due date"
                name="due_date"
                type="date"
                value={taskForm.due_date}
                onChange={handleTaskChange}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={taskForm.status}
                  onChange={handleTaskChange}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <ModalFooter
              onCancel={() => setShowTaskModal(false)}
              loading={saving}
              submitText="Add task"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-400">
          {label}
        </p>

        <div className="text-slate-400">{icon}</div>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    preboarding:
      "border-amber-200 bg-amber-50 text-amber-700",
    active:
      "border-blue-200 bg-blue-50 text-blue-700",
    completed:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
        styles[status] ||
        "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Users size={25} />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-800">
        No onboarding records yet
      </h3>

      <p className="mt-1 max-w-md text-sm text-slate-500">
        Create your first onboarding record to start managing a new
        employee's pre-boarding and first 90 days.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        <Plus size={17} />
        Create onboarding
      </button>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  );
}

function DetailBox({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]">
      <div
        className={`max-h-[90vh] w-full overflow-hidden rounded-xl bg-white shadow-2xl ${
          wide ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-90px)] overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalFooter({
  onCancel,
  loading,
  submitText,
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={loading}
        className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <RefreshCw size={15} className="animate-spin" />
        )}

        {loading ? "Saving..." : submitText}
      </button>
    </div>
  );
}