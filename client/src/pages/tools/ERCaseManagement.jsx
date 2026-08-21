import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  MessageSquare,
  X,
  ShieldAlert,
  Clock3,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../lib/api";

const EMPTY_FORM = {
  case_number: "",
  employee_id: "",
  case_type: "grievance",
  title: "",
  description: "",
  priority: "normal",
  status: "open",
  opened_at: "",
  target_date: "",
  owner_name: "",
  resolution: "",
  notes: "",
};

const CASE_TYPES = [
  { value: "grievance", label: "Grievance" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "misconduct", label: "Misconduct" },
  { value: "workplace_conflict", label: "Workplace Conflict" },
  { value: "attendance", label: "Attendance" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "investigation", label: "Investigation" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status) {
  return (
    STATUSES.find((item) => item.value === status)?.label ||
    status ||
    "Open"
  );
}

function caseTypeLabel(type) {
  return (
    CASE_TYPES.find((item) => item.value === type)?.label ||
    type ||
    "Other"
  );
}

function priorityLabel(priority) {
  return (
    PRIORITIES.find((item) => item.value === priority)?.label ||
    priority ||
    "Normal"
  );
}

function statusClasses(status) {
  switch (status) {
    case "resolved":
      return "bg-emerald-50 text-emerald-700";
    case "closed":
      return "bg-slate-100 text-slate-700";
    case "investigation":
      return "bg-purple-50 text-purple-700";
    case "under_review":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-blue-50 text-blue-700";
  }
}

function priorityClasses(priority) {
  switch (priority) {
    case "critical":
      return "bg-red-50 text-red-700";
    case "high":
      return "bg-orange-50 text-orange-700";
    case "low":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-blue-50 text-blue-700";
  }
}

function employeeName(employee) {
  if (!employee) return "Unknown employee";

  return (
    employee.full_name ||
    employee.name ||
    employee.employee_name ||
    employee.email ||
    "Unknown employee"
  );
}

function toDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

export default function ERCaseManagement() {
  const navigate = useNavigate();

  const [cases, setCases] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingEmployees, setLoadingEmployees] =
    useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [typeFilter, setTypeFilter] =
    useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  async function loadCases() {
    try {
      setLoading(true);

      const response = await api.get(
        "/employee-relations-cases",
      );

      const data = response?.data;

      if (Array.isArray(data)) {
        setCases(data);
      } else if (Array.isArray(data?.cases)) {
        setCases(data.cases);
      } else {
        setCases([]);
      }
    } catch (error) {
      console.error(
        "[ERCaseManagement] Load cases error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not load employee relations cases",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      setLoadingEmployees(true);

      const response = await api.get(
        "/employees",
      );

      const data = response?.data;

      if (Array.isArray(data)) {
        setEmployees(data);
      } else if (
        Array.isArray(data?.employees)
      ) {
        setEmployees(data.employees);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error(
        "[ERCaseManagement] Load employees error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not load employees",
      );
    } finally {
      setLoadingEmployees(false);
    }
  }

  useEffect(() => {
    loadCases();
    loadEmployees();
  }, []);

  const stats = useMemo(() => {
    const openCases = cases.filter(
      (item) =>
        item.status === "open" ||
        item.status === "under_review" ||
        item.status === "investigation",
    ).length;

    const criticalCases = cases.filter(
      (item) =>
        item.priority === "critical" &&
        item.status !== "closed" &&
        item.status !== "resolved",
    ).length;

    const resolvedCases = cases.filter(
      (item) =>
        item.status === "resolved" ||
        item.status === "closed",
    ).length;

    return {
      total: cases.length,
      open: openCases,
      critical: criticalCases,
      resolved: resolvedCases,
    };
  }, [cases]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return cases.filter((item) => {
      const matchesSearch =
        !query ||
        String(
          item.case_number || "",
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.title || "",
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.description || "",
        )
          .toLowerCase()
          .includes(query) ||
        String(
          item.employee?.full_name ||
            item.employee?.name ||
            item.employee_name ||
            "",
        )
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        item.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        item.case_type === typeFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType
      );
    });
  }, [
    cases,
    search,
    statusFilter,
    typeFilter,
  ]);

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

  function openCreate() {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      opened_at: new Date()
        .toISOString()
        .slice(0, 10),
    });

    setShowForm(true);
  }

  function openEdit(item) {
    setEditingId(item.id);

    setForm({
      case_number:
        item.case_number || "",
      employee_id:
        item.employee_id || "",
      case_type:
        item.case_type || "grievance",
      title:
        item.title || "",
      description:
        item.description || "",
      priority:
        item.priority || "normal",
      status:
        item.status || "open",
      opened_at:
        toDateInput(item.opened_at),
      target_date:
        toDateInput(item.target_date),
      owner_name:
        item.owner_name || "",
      resolution:
        item.resolution || "",
      notes:
        item.notes || "",
    });

    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.employee_id) {
      toast.error("Select an employee");
      return;
    }

    if (!form.title.trim()) {
      toast.error("Case title is required");
      return;
    }

    if (!form.description.trim()) {
      toast.error(
        "Case description is required",
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        case_number:
          form.case_number.trim() || null,
        employee_id:
          form.employee_id,
        case_type:
          form.case_type,
        title:
          form.title.trim(),
        description:
          form.description.trim(),
        priority:
          form.priority,
        status:
          form.status,
        opened_at:
          form.opened_at || null,
        target_date:
          form.target_date || null,
        owner_name:
          form.owner_name.trim() || null,
        resolution:
          form.resolution.trim() || null,
        notes:
          form.notes.trim() || null,
      };

      if (editingId) {
        await api.put(
          `/employee-relations-cases/${editingId}`,
          payload,
        );

        toast.success(
          "Case updated successfully",
        );
      } else {
        await api.post(
          "/employee-relations-cases",
          payload,
        );

        toast.success(
          "Case created successfully",
        );
      }

      closeForm();
      await loadCases();
    } catch (error) {
      console.error(
        "[ERCaseManagement] Save case error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not save case",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm(
      `Delete case ${
        item.case_number ||
        item.title ||
        "this case"
      }? This action cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(
        `/employee-relations-cases/${item.id}`,
      );

      toast.success(
        "Case deleted successfully",
      );

      await loadCases();
    } catch (error) {
      console.error(
        "[ERCaseManagement] Delete case error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not delete case",
      );
    }
  }

  async function updateStatus(
    item,
    nextStatus,
  ) {
    try {
      await api.patch(
        `/employee-relations-cases/${item.id}/status`,
        {
          status: nextStatus,
        },
      );

      toast.success(
        `Case marked as ${statusLabel(
          nextStatus,
        )}`,
      );

      await loadCases();
    } catch (error) {
      console.error(
        "[ERCaseManagement] Status update error:",
        error,
      );

      toast.error(
        error.response?.data?.message ||
          "Could not update case status",
      );
    }
  }

  return (
    <div className="min-h-full bg-[#f5f8f7]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <ArrowLeft
                size={16}
              />
              Back
            </button>

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-teal-700">
                <MessageSquare
                  size={16}
                />
                Employee Relations
              </div>

              <h1 className="text-2xl font-semibold text-slate-900">
                ER Case Management
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Consistent, documented handling
                of grievances and employee
                relations cases.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadCases}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-800"
            >
              <Plus size={17} />
              Add case
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Total cases
            </p>

            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {stats.total}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              All recorded ER cases
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Open cases
              </p>

              <Clock3
                size={17}
                className="text-blue-600"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold text-blue-700">
              {stats.open}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Require ongoing action
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Critical
              </p>

              <ShieldAlert
                size={17}
                className="text-red-600"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold text-red-600">
              {stats.critical}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              High-risk unresolved cases
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Resolved
              </p>

              <CheckCircle2
                size={17}
                className="text-emerald-600"
              />
            </div>

            <p className="mt-2 text-2xl font-semibold text-emerald-700">
              {stats.resolved}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Resolved or closed
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_190px_190px]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search case number, employee, title..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value,
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">
                All statuses
              </option>

              {STATUSES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value,
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-teal-600"
            >
              <option value="all">
                All case types
              </option>

              {CASE_TYPES.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Employee relations cases
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredCases.length} of{" "}
              {cases.length} cases shown
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Loading cases...
            </div>
          ) : filteredCases.length ===
            0 ? (
            <div className="px-6 py-14 text-center">
              <MessageSquare
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 text-sm font-medium text-slate-700">
                No cases found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Create your first employee
                relations case to begin
                tracking.
              </p>

              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800"
              >
                <Plus size={16} />
                Add case
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Case
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Employee
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Type
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Priority
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Opened
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                      Target
                    </th>

                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCases.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                      >
                        <td className="px-5 py-4">
                          <div className="max-w-[260px]">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.case_number ||
                                `CASE-${String(
                                  item.id,
                                ).slice(
                                  0,
                                  8,
                                )}`}
                            </p>

                            <p className="mt-1 truncate text-sm text-slate-600">
                              {item.title}
                            </p>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-800">
                            {employeeName(
                              item.employee,
                            ) ||
                              item.employee_name ||
                              "—"}
                          </p>

                          {item.employee
                            ?.email && (
                            <p className="mt-1 text-xs text-slate-400">
                              {
                                item
                                  .employee
                                  .email
                              }
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {caseTypeLabel(
                            item.case_type,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${priorityClasses(
                              item.priority,
                            )}`}
                          >
                            {priorityLabel(
                              item.priority,
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <select
                            value={
                              item.status ||
                              "open"
                            }
                            onChange={(
                              event,
                            ) =>
                              updateStatus(
                                item,
                                event
                                  .target
                                  .value,
                              )
                            }
                            className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${statusClasses(
                              item.status,
                            )}`}
                          >
                            {STATUSES.map(
                              (
                                status,
                              ) => (
                                <option
                                  key={
                                    status.value
                                  }
                                  value={
                                    status.value
                                  }
                                >
                                  {
                                    status.label
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            item.opened_at,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            {item.target_date &&
                              new Date(
                                item.target_date,
                              ) <
                                new Date() &&
                              item.status !==
                                "resolved" &&
                              item.status !==
                                "closed" && (
                                <AlertTriangle
                                  size={15}
                                  className="text-red-500"
                                />
                              )}

                            {formatDate(
                              item.target_date,
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  item,
                                )
                              }
                              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                              title="Edit case"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  item,
                                )
                              }
                              className="rounded-lg p-2 text-red-500 transition hover:bg-red-50"
                              title="Delete case"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingId
                    ? "Edit ER case"
                    : "Create ER case"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Record the case details and
                  maintain a consistent audit
                  trail.
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={19} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto px-6 py-6"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Case number
                  </label>

                  <input
                    name="case_number"
                    value={
                      form.case_number
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Employee
                    <span className="text-red-500">
                      {" "}
                      *
                    </span>
                  </label>

                  <select
                    name="employee_id"
                    value={
                      form.employee_id
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      loadingEmployees
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">
                      {loadingEmployees
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
                          {employeeName(
                            employee,
                          )}
                          {employee.email
                            ? ` — ${employee.email}`
                            : ""}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Case type
                  </label>

                  <select
                    name="case_type"
                    value={
                      form.case_type
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                  >
                    {CASE_TYPES.map(
                      (item) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Priority
                  </label>

                  <select
                    name="priority"
                    value={
                      form.priority
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                  >
                    {PRIORITIES.map(
                      (item) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Case title
                    <span className="text-red-500">
                      {" "}
                      *
                    </span>
                  </label>

                  <input
                    name="title"
                    value={form.title}
                    onChange={
                      handleChange
                    }
                    placeholder="Example: Workplace conduct grievance"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                    <span className="text-red-500">
                      {" "}
                      *
                    </span>
                  </label>

                  <textarea
                    name="description"
                    value={
                      form.description
                    }
                    onChange={
                      handleChange
                    }
                    rows={4}
                    placeholder="Describe the reported issue, facts currently known, and relevant context."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Status
                  </label>

                  <select
                    name="status"
                    value={
                      form.status
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                  >
                    {STATUSES.map(
                      (item) => (
                        <option
                          key={
                            item.value
                          }
                          value={
                            item.value
                          }
                        >
                          {item.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Case owner
                  </label>

                  <input
                    name="owner_name"
                    value={
                      form.owner_name
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="HR owner / case manager"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Opened date
                  </label>

                  <input
                    type="date"
                    name="opened_at"
                    value={
                      form.opened_at
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Target resolution date
                  </label>

                  <input
                    type="date"
                    name="target_date"
                    value={
                      form.target_date
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Resolution
                  </label>

                  <textarea
                    name="resolution"
                    value={
                      form.resolution
                    }
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Document the resolution when the case is resolved."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Internal notes
                  </label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={
                      handleChange
                    }
                    rows={3}
                    placeholder="Internal HR notes and follow-up information."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  {saving && (
                    <RefreshCw
                      size={15}
                      className="animate-spin"
                    />
                  )}

                  {editingId
                    ? "Save changes"
                    : "Create case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}