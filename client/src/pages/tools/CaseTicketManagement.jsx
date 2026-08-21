import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowLeft,
  Plus,
  Search,
  Ticket,
  Clock,
  User,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

const STATUS_OPTIONS = [
  "open",
  "in_progress",
  "pending",
  "resolved",
  "closed",
];

const PRIORITY_OPTIONS = [
  "low",
  "medium",
  "high",
  "urgent",
];

const CATEGORY_OPTIONS = [
  "Payroll",
  "Leave",
  "Attendance",
  "Benefits",
  "Onboarding",
  "Performance",
  "Employee Relations",
  "Compliance",
  "Other",
];

function formatStatus(status) {
  return status
    ?.replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString();
}

function statusClass(status) {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700";

    case "in_progress":
      return "bg-amber-50 text-amber-700";

    case "pending":
      return "bg-purple-50 text-purple-700";

    case "resolved":
      return "bg-emerald-50 text-emerald-700";

    case "closed":
      return "bg-ink-100 text-ink-600";

    default:
      return "bg-ink-50 text-ink-500";
  }
}

function priorityClass(priority) {
  switch (priority) {
    case "urgent":
      return "bg-red-50 text-red-700";

    case "high":
      return "bg-orange-50 text-orange-700";

    case "medium":
      return "bg-amber-50 text-amber-700";

    case "low":
      return "bg-emerald-50 text-emerald-700";

    default:
      return "bg-ink-50 text-ink-500";
  }
}

export default function CaseTicketManagement() {
  const navigate = useNavigate();

  const { session } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [priorityFilter, setPriorityFilter] =
    useState("all");

  const [showCreate, setShowCreate] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    employeeName: "",
    employeeEmail: "",
    category: "Other",
    priority: "medium",
    assignedTo: "",
    dueDate: "",
  });

  const authHeaders = useMemo(() => {
    return {
      Authorization: `Bearer ${session?.access_token}`,
    };
  }, [session]);

  const loadTickets = async () => {
    if (!session?.access_token) {
      return;
    }

    try {
      setError("");

      const response = await axios.get(
        `${API_BASE_URL}/hr-cases`,
        {
          headers: authHeaders,
        }
      );

      setTickets(response.data || []);
    } catch (err) {
      console.error(
        "[Case Management] Failed to load:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to load HR cases."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();

    /*
     * Keep the dashboard current without
     * requiring a page refresh.
     */
    const interval = setInterval(
      loadTickets,
      5000
    );

    return () => clearInterval(interval);
  }, [session?.access_token]);

  const filteredTickets = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        ticket.title
          ?.toLowerCase()
          .includes(query) ||
        ticket.employee_name
          ?.toLowerCase()
          .includes(query) ||
        ticket.employee_email
          ?.toLowerCase()
          .includes(query) ||
        ticket.ticket_number
          ?.toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        ticket.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    tickets,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!form.title.trim()) {
      setError("Case title is required.");
      return;
    }

    if (!form.employeeName.trim()) {
      setError("Employee name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_BASE_URL}/hr-cases`,
        {
          title: form.title.trim(),
          description:
            form.description.trim(),
          employeeName:
            form.employeeName.trim(),
          employeeEmail:
            form.employeeEmail.trim(),
          category: form.category,
          priority: form.priority,
          assignedTo:
            form.assignedTo.trim(),
          dueDate:
            form.dueDate || null,
        },
        {
          headers: authHeaders,
        }
      );

      setTickets((current) => [
        response.data,
        ...current,
      ]);

      setForm({
        title: "",
        description: "",
        employeeName: "",
        employeeEmail: "",
        category: "Other",
        priority: "medium",
        assignedTo: "",
        dueDate: "",
      });

      setShowCreate(false);
    } catch (err) {
      console.error(
        "[Case Management] Create failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to create case."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (
    ticket,
    status
  ) => {
    try {
      const response = await axios.patch(
        `${API_BASE_URL}/hr-cases/${ticket.id}`,
        {
          status,
        },
        {
          headers: authHeaders,
        }
      );

      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id
            ? response.data
            : item
        )
      );
    } catch (err) {
      console.error(
        "[Case Management] Status update failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to update case."
      );
    }
  };

  const deleteTicket = async (ticket) => {
    const confirmed = window.confirm(
      `Delete ${ticket.ticket_number || "this case"}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(
        `${API_BASE_URL}/hr-cases/${ticket.id}`,
        {
          headers: authHeaders,
        }
      );

      setTickets((current) =>
        current.filter(
          (item) => item.id !== ticket.id
        )
      );
    } catch (err) {
      console.error(
        "[Case Management] Delete failed:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to delete case."
      );
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">

        {/* HEADER */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-4 flex items-center gap-2 text-sm text-ink-500 hover:text-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Ticket className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-ink-900">
                  Case & Ticket Management
                </h1>

                <p className="mt-1 text-sm text-ink-500">
                  Track employee HR requests with clear ownership and SLA visibility.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setShowCreate(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            New case
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* STATS */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            ["Total", tickets.length],
            [
              "Open",
              tickets.filter(
                (t) => t.status === "open"
              ).length,
            ],
            [
              "In progress",
              tickets.filter(
                (t) =>
                  t.status === "in_progress"
              ).length,
            ],
            [
              "Pending",
              tickets.filter(
                (t) => t.status === "pending"
              ).length,
            ],
            [
              "Resolved",
              tickets.filter(
                (t) =>
                  t.status === "resolved" ||
                  t.status === "closed"
              ).length,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-ink-100 bg-white p-4"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                {label}
              </p>

              <p className="mt-2 text-2xl font-semibold text-ink-900">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-ink-100 bg-white p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search cases, employees or ticket numbers..."
              className="w-full rounded-lg border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
          >
            <option value="all">
              All statuses
            </option>

            {STATUS_OPTIONS.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatStatus(status)}
                </option>
              )
            )}
          </select>

          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value
              )
            }
            className="rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
          >
            <option value="all">
              All priorities
            </option>

            {PRIORITY_OPTIONS.map(
              (priority) => (
                <option
                  key={priority}
                  value={priority}
                >
                  {formatStatus(priority)}
                </option>
              )
            )}
          </select>
        </div>

        {/* CASES */}
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
              <Ticket className="h-10 w-10 text-ink-300" />

              <h3 className="mt-4 text-sm font-semibold text-ink-800">
                No HR cases found
              </h3>

              <p className="mt-1 text-sm text-ink-400">
                Create your first case to start tracking employee requests.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(true)
                }
                className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white"
              >
                Create case
              </button>
            </div>
          ) : (
            <div className="divide-y divide-ink-100">
              {filteredTickets.map(
                (ticket) => (
                  <div
                    key={ticket.id}
                    className="p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-ink-400">
                            {ticket.ticket_number}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                              ticket.status
                            )}`}
                          >
                            {formatStatus(
                              ticket.status
                            )}
                          </span>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass(
                              ticket.priority
                            )}`}
                          >
                            {formatStatus(
                              ticket.priority
                            )}
                          </span>
                        </div>

                        <h3 className="mt-2 text-base font-semibold text-ink-900">
                          {ticket.title}
                        </h3>

                        {ticket.description && (
                          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-500">
                            {ticket.description}
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-500">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {ticket.employee_name}
                          </span>

                          <span>
                            {ticket.category}
                          </span>

                          {ticket.assigned_to && (
                            <span>
                              Owner:{" "}
                              {ticket.assigned_to}
                            </span>
                          )}

                          {ticket.due_date && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              Due{" "}
                              {formatDate(
                                ticket.due_date
                              )}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={
                            ticket.status
                          }
                          onChange={(event) =>
                            updateStatus(
                              ticket,
                              event.target.value
                            )
                          }
                          className="rounded-lg border border-ink-200 px-3 py-2 text-xs"
                        >
                          {STATUS_OPTIONS.map(
                            (status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {formatStatus(
                                  status
                                )}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          onClick={() =>
                            deleteTicket(
                              ticket
                            )
                          }
                          className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
                          title="Delete case"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-ink-900">
                  Create HR case
                </h2>

                <p className="mt-1 text-sm text-ink-500">
                  Record an employee request and assign ownership.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowCreate(false)
                }
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="space-y-5 p-6"
            >
              <div>
                <label className="text-sm font-medium text-ink-700">
                  Case title
                </label>

                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title:
                        event.target.value,
                    })
                  }
                  placeholder="Example: Salary slip not received"
                  className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description:
                        event.target.value,
                    })
                  }
                  rows={4}
                  placeholder="Describe the employee request..."
                  className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Employee name
                  </label>

                  <input
                    value={form.employeeName}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        employeeName:
                          event.target.value,
                      })
                    }
                    placeholder="Employee name"
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Employee email
                  </label>

                  <input
                    type="email"
                    value={form.employeeEmail}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        employeeEmail:
                          event.target.value,
                      })
                    }
                    placeholder="employee@company.com"
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Category
                  </label>

                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category:
                          event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  >
                    {CATEGORY_OPTIONS.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Priority
                  </label>

                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority:
                          event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  >
                    {PRIORITY_OPTIONS.map(
                      (priority) => (
                        <option
                          key={priority}
                          value={priority}
                        >
                          {formatStatus(
                            priority
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Assigned owner
                  </label>

                  <input
                    value={form.assignedTo}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        assignedTo:
                          event.target.value,
                      })
                    }
                    placeholder="HR manager / owner"
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-700">
                    Due date
                  </label>

                  <input
                    type="datetime-local"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        dueDate:
                          event.target.value,
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-ink-200 px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowCreate(false)
                  }
                  className="rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  Create case
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}