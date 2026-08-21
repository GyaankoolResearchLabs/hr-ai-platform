import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Search,
  RefreshCw,
  Trash2,
  Clock3,
  UserRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import api from "../../lib/api";

export default function EmployeeRequestTracker() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * ---------------------------------------------------------
   * LOAD REQUESTS
   * ---------------------------------------------------------
   */

  const loadRequests = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await api.get("/hr-requests");

      const data = response?.data;

      if (Array.isArray(data)) {
        setRequests(data);
      } else if (Array.isArray(data?.requests)) {
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error("Failed to load HR requests:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load employee HR requests."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  /*
   * ---------------------------------------------------------
   * DELETE REQUEST
   * ---------------------------------------------------------
   */

  const handleDelete = async (requestId) => {
    if (!requestId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this HR request?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/hr-requests/${requestId}`);

      setRequests((current) =>
        current.filter(
          (request) =>
            request.id !== requestId &&
            request.request_id !== requestId
        )
      );

      setSuccess("HR request deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error("Failed to delete HR request:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to delete the HR request."
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * NORMALIZE REQUEST DATA
   * ---------------------------------------------------------
   */

  const normalizedRequests = useMemo(() => {
    return requests.map((request) => {
      const status = String(
        request.status || "pending"
      ).toLowerCase();

      return {
        ...request,

        id:
          request.id ||
          request.request_id,

        title:
          request.title ||
          request.subject ||
          request.request_title ||
          "HR Request",

        description:
          request.description ||
          request.details ||
          request.message ||
          "",

        category:
          request.category ||
          request.request_category ||
          "General HR",

        priority:
          request.priority ||
          "normal",

        status,

        owner:
          request.owner_name ||
          request.owner ||
          request.assigned_to_name ||
          request.assigned_to ||
          "Unassigned",

        createdAt:
          request.created_at ||
          request.createdAt ||
          request.created ||
          null,

        dueAt:
          request.due_at ||
          request.dueAt ||
          request.deadline ||
          null,
      };
    });
  }, [requests]);

  /*
   * ---------------------------------------------------------
   * FILTER
   * ---------------------------------------------------------
   */

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();

    return normalizedRequests.filter((request) => {
      const matchesSearch =
        !query ||
        request.title.toLowerCase().includes(query) ||
        request.description.toLowerCase().includes(query) ||
        request.category.toLowerCase().includes(query) ||
        request.owner.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        request.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [normalizedRequests, search, statusFilter]);

  /*
   * ---------------------------------------------------------
   * COUNTS
   * ---------------------------------------------------------
   */

  const totalRequests = normalizedRequests.length;

  const activeRequests = normalizedRequests.filter(
    (request) =>
      request.status === "pending" ||
      request.status === "open" ||
      request.status === "in_progress" ||
      request.status === "active"
  ).length;

  const resolvedRequests = normalizedRequests.filter(
    (request) =>
      request.status === "resolved" ||
      request.status === "completed" ||
      request.status === "closed"
  ).length;

  const urgentRequests = normalizedRequests.filter(
    (request) =>
      request.priority === "urgent" &&
      request.status !== "resolved" &&
      request.status !== "completed" &&
      request.status !== "closed"
  ).length;

  /*
   * ---------------------------------------------------------
   * FORMATTERS
   * ---------------------------------------------------------
   */

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "resolved":
        return "Resolved";

      case "completed":
        return "Completed";

      case "closed":
        return "Closed";

      case "in_progress":
        return "In progress";

      case "pending":
        return "Pending";

      case "open":
        return "Open";

      case "cancelled":
        return "Cancelled";

      default:
        return status
          .replaceAll("_", " ")
          .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
          );
    }
  };

  const getStatusClass = (status) => {
    if (
      status === "resolved" ||
      status === "completed" ||
      status === "closed"
    ) {
      return "bg-emerald-50 text-emerald-700";
    }

    if (
      status === "cancelled" ||
      status === "rejected"
    ) {
      return "bg-red-50 text-red-700";
    }

    if (status === "in_progress") {
      return "bg-blue-50 text-blue-700";
    }

    return "bg-amber-50 text-amber-700";
  };

  const getPriorityClass = (priority) => {
    switch (String(priority).toLowerCase()) {
      case "urgent":
        return "bg-red-50 text-red-700";

      case "high":
        return "bg-orange-50 text-orange-700";

      case "low":
        return "bg-slate-50 text-slate-600";

      default:
        return "bg-ink-50 text-ink-600";
    }
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-w-0">
      {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* IMPORTANT:
              Browser-style back navigation.
              This does NOT send the user to Dashboard.
          */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList
                className="h-5 w-5"
                strokeWidth={1.75}
              />
            </span>

            <div>
              <h1 className="font-display text-2xl font-semibold text-ink-950">
                Employee Request Tracker
              </h1>

              <p className="mt-1 text-sm text-ink-500">
                Track HR requests, ownership, deadlines, and
                status in one place.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadRequests(true)}
          disabled={refreshing}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          Refresh
        </button>
      </div>

      {/* ---------------------------------------------------
          SUCCESS
      --------------------------------------------------- */}

      {success && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* ---------------------------------------------------
          ERROR
      --------------------------------------------------- */}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---------------------------------------------------
          SUMMARY CARDS
      --------------------------------------------------- */}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Total requests
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {totalRequests}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Active
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {activeRequests}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Resolved
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {resolvedRequests}
          </p>
        </div>

        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            Urgent active
          </p>

          <p className="mt-2 text-2xl font-semibold text-ink-950">
            {urgentRequests}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------
          REQUEST TABLE
      --------------------------------------------------- */}

      <div className="card overflow-hidden">
        <div className="border-b border-ink-100 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                Employee requests
              </h2>

              <p className="mt-0.5 text-sm text-ink-500">
                Track submitted HR requests and their current
                status.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {/* SEARCH */}

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search requests..."
                  className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-800 outline-none transition placeholder:text-ink-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 sm:w-64"
                />
              </div>

              {/* STATUS FILTER */}

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="open">Open</option>
                <option value="in_progress">
                  In progress
                </option>
                <option value="resolved">Resolved</option>
                <option value="completed">
                  Completed
                </option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* LOADING */}

        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center px-5">
            <div className="text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-brand-600" />

              <p className="mt-3 text-sm text-ink-500">
                Loading employee requests...
              </p>
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          /* EMPTY */

          <div className="flex min-h-[260px] items-center justify-center px-5">
            <div className="max-w-sm text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-500">
                <ClipboardList className="h-5 w-5" />
              </span>

              <h3 className="mt-4 text-sm font-semibold text-ink-900">
                No HR requests found
              </h3>

              <p className="mt-1 text-sm text-ink-500">
                {search || statusFilter !== "all"
                  ? "Try changing your search or status filter."
                  : "Employee HR requests will appear here once they are submitted."}
              </p>
            </div>
          </div>
        ) : (
          /* DATA */

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-ink-50/60">
                <tr className="border-b border-ink-100">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Request
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Category
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Owner
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Priority
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Status
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Deadline
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Created
                  </th>

                  <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-ink-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-ink-100 last:border-b-0"
                  >
                    {/* REQUEST */}

                    <td className="px-5 py-4">
                      <div className="max-w-[260px]">
                        <p className="text-sm font-semibold text-ink-900">
                          {request.title}
                        </p>

                        {request.description && (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-500">
                            {request.description}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* CATEGORY */}

                    <td className="px-5 py-4">
                      <span className="text-sm text-ink-700">
                        {request.category}
                      </span>
                    </td>

                    {/* OWNER */}

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-50 text-ink-500">
                          <UserRound className="h-3.5 w-3.5" />
                        </span>

                        <span className="text-sm text-ink-700">
                          {request.owner}
                        </span>
                      </div>
                    </td>

                    {/* PRIORITY */}

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getPriorityClass(
                          request.priority
                        )}`}
                      >
                        {String(
                          request.priority
                        )
                          .replaceAll("_", " ")
                          .replace(/\b\w/g, (letter) =>
                            letter.toUpperCase()
                          )}
                      </span>
                    </td>

                    {/* STATUS */}

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          request.status
                        )}`}
                      >
                        {request.status ===
                          "resolved" ||
                        request.status ===
                          "completed" ||
                        request.status ===
                          "closed" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}

                        {getStatusLabel(
                          request.status
                        )}
                      </span>
                    </td>

                    {/* DEADLINE */}

                    <td className="px-5 py-4">
                      <span className="text-sm text-ink-600">
                        {formatDate(request.dueAt)}
                      </span>
                    </td>

                    {/* CREATED */}

                    <td className="px-5 py-4">
                      <span className="text-sm text-ink-600">
                        {formatDate(
                          request.createdAt
                        )}
                      </span>
                    </td>

                    {/* ACTIONS */}

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(request.id)
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50"
                        title="Delete request"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}