import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  CheckCircle2,
  X,
} from "lucide-react";

import api from "../../lib/api";

export default function HRRequestIntake() {
  const navigate = useNavigate();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General HR",
    priority: "normal",
  });

  /* =========================================================
     LOAD REQUESTS
  ========================================================= */

  const loadRequests = async () => {
    try {
      setLoading(true);

      const response = await api.get("/hr-requests");

      const data = response?.data;

      if (Array.isArray(data)) {
        setRequests(data);
      } else if (Array.isArray(data?.requests)) {
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error("Failed to load HR requests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  /* =========================================================
     REFRESH
  ========================================================= */

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadRequests();
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================================================
     CREATE REQUEST
  ========================================================= */

  const handleCreateRequest = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.description.trim()) {
      return;
    }

    try {
      const response = await api.post("/hr-requests", {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        priority: form.priority,
      });

      const createdRequest =
        response?.data?.request || response?.data;

      if (createdRequest) {
        setRequests((current) => [
          createdRequest,
          ...current,
        ]);
      } else {
        await loadRequests();
      }

      setForm({
        title: "",
        description: "",
        category: "General HR",
        priority: "normal",
      });

      setShowModal(false);

      setMessage("HR request created successfully.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Failed to create HR request:", error);

      setMessage(
        error?.response?.data?.message ||
          "Failed to create HR request."
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  /* =========================================================
     RESOLVE REQUEST
  ========================================================= */

  const handleResolve = async (request) => {
    try {
      await api.post(
        `/hr-requests/${request.id}/resolve`
      );

      setRequests((current) =>
        current.map((item) =>
          item.id === request.id
            ? {
                ...item,
                status: "resolved",
                resolved_at: new Date().toISOString(),
              }
            : item
        )
      );

      setMessage("HR request resolved successfully.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Failed to resolve HR request:", error);

      setMessage(
        error?.response?.data?.message ||
          "Failed to resolve HR request."
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  /* =========================================================
     DELETE REQUEST
  ========================================================= */

  const handleDelete = async (request) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this HR request?"
    );

    if (!confirmed) return;

    try {
      await api.delete(
        `/hr-requests/${request.id}`
      );

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id
        )
      );

      setMessage("HR request deleted successfully.");

      setTimeout(() => {
        setMessage("");
      }, 3000);
    } catch (error) {
      console.error("Failed to delete HR request:", error);

      setMessage(
        error?.response?.data?.message ||
          "Failed to delete HR request."
      );

      setTimeout(() => {
        setMessage("");
      }, 3000);
    }
  };

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredRequests = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return requests;
    }

    return requests.filter((request) => {
      return (
        request.title?.toLowerCase().includes(value) ||
        request.description
          ?.toLowerCase()
          .includes(value) ||
        request.category
          ?.toLowerCase()
          .includes(value) ||
        request.priority
          ?.toLowerCase()
          .includes(value) ||
        request.status
          ?.toLowerCase()
          .includes(value)
      );
    });
  }, [requests, search]);

  /* =========================================================
     COUNTS
  ========================================================= */

  const totalRequests = requests.length;

  const activeRequests = requests.filter(
    (request) =>
      request.status !== "resolved" &&
      request.status !== "closed"
  ).length;

  const resolvedRequests = requests.filter(
    (request) =>
      request.status === "resolved" ||
      request.status === "closed"
  ).length;

  const urgentActiveRequests = requests.filter(
    (request) =>
      request.priority === "urgent" &&
      request.status !== "resolved" &&
      request.status !== "closed"
  ).length;

  /* =========================================================
     DATE FORMAT
  ========================================================= */

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleString();
  };

  /* =========================================================
     STATUS
  ========================================================= */

  const isResolved = (request) =>
    request.status === "resolved" ||
    request.status === "closed";

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-w-0">

      {/* =====================================================
          BACK BUTTON
      ===================================================== */}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back 
      </button>

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-7 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ClipboardList
              className="h-5 w-5"
              strokeWidth={1.8}
            />
          </span>

          <div>
            <h1 className="font-display text-2xl font-semibold text-ink-950">
              HR Request Intake
            </h1>

            <p className="mt-1 text-sm text-ink-500">
              Capture and manage employee HR requests in one
              structured workflow.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          New HR request
        </button>
      </div>

      {/* =====================================================
          SUCCESS / ERROR MESSAGE
      ===================================================== */}

      {message && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ===================================================== */}

      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

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
            {urgentActiveRequests}
          </p>
        </div>

      </div>

      {/* =====================================================
          REQUEST TABLE
      ===================================================== */}

      <div className="card overflow-hidden">

        <div className="flex flex-col gap-4 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink-900">
              HR requests
            </h2>

            <p className="mt-1 text-sm text-ink-500">
              Track submitted HR requests and their current status.
            </p>
          </div>

          <div className="flex items-center gap-2">

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search requests..."
                className="h-9 w-56 rounded-lg border border-ink-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing ? "animate-spin" : ""
                }`}
              />
            </button>

          </div>
        </div>

        {/* ===================================================
            LOADING
        =================================================== */}

        {loading ? (
          <div className="p-10 text-center text-sm text-ink-500">
            Loading HR requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center">

            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />

            <h3 className="mt-3 text-sm font-semibold text-ink-900">
              No HR requests found
            </h3>

            <p className="mt-1 text-sm text-ink-500">
              {search
                ? "Try a different search term."
                : "Create a new HR request to get started."}
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[850px]">

              <thead>
                <tr className="border-b border-ink-100 bg-canvas text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Request
                  </th>

                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Category
                  </th>

                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Priority
                  </th>

                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Status
                  </th>

                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Created
                  </th>

                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-ink-100 last:border-0"
                  >

                    {/* REQUEST */}

                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-ink-900">
                        {request.title}
                      </p>

                      <p className="mt-1 max-w-xs text-xs text-ink-500">
                        {request.description}
                      </p>
                    </td>

                    {/* CATEGORY */}

                    <td className="px-4 py-4 text-sm text-ink-700">
                      {request.category || "General HR"}
                    </td>

                    {/* PRIORITY */}

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          request.priority === "urgent"
                            ? "bg-red-50 text-red-600"
                            : request.priority === "high"
                            ? "bg-orange-50 text-orange-600"
                            : request.priority === "low"
                            ? "bg-ink-50 text-ink-500"
                            : "bg-blue-50 text-blue-600"
                        }`}
                      >
                        {request.priority || "normal"}
                      </span>
                    </td>

                    {/* STATUS */}

                    <td className="px-4 py-4">

                      {isResolved(request) ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-600">
                          Active
                        </span>
                      )}

                    </td>

                    {/* CREATED */}

                    <td className="px-4 py-4 text-sm text-ink-500">
                      {formatDate(
                        request.created_at ||
                          request.createdAt
                      )}
                    </td>

                    {/* ACTIONS */}

                    <td className="px-4 py-4">

                      <div className="flex items-center gap-2">

                        {!isResolved(request) && (
                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(request)
                            }
                            className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-50"
                          >
                            Resolve
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleDelete(request)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 transition hover:bg-red-50"
                          title="Delete request"
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

      {/* =====================================================
          NEW REQUEST MODAL
      ===================================================== */}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">

          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">

              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  New HR request
                </h2>

                <p className="mt-1 text-xs text-ink-500">
                  Submit a new employee HR request.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>

            </div>

            <form
              onSubmit={handleCreateRequest}
              className="space-y-4 p-5"
            >

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Request title
                </label>

                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      title: event.target.value,
                    })
                  }
                  placeholder="e.g. Experience certificate"
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                  placeholder="Describe the HR request..."
                  rows={4}
                  className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Category
                  </label>

                  <select
                    value={form.category}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        category: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option>General HR</option>
                    <option>Payroll</option>
                    <option>Leave</option>
                    <option>Attendance</option>
                    <option>Documents</option>
                    <option>Benefits</option>
                    <option>Onboarding</option>
                    <option>Offboarding</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink-700">
                    Priority
                  </label>

                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        priority: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

              </div>

              <div className="flex justify-end gap-2 pt-2">

                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Create request
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}