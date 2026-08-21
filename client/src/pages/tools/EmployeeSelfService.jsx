import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  RefreshCw,
  X,
  Trash2,
  Pencil,
  Send,
  Loader2,
} from "lucide-react";

import api from "../../lib/api";

/* =========================================================
   CONSTANTS
========================================================= */

const REQUEST_TYPES = [
  "Employment Letter",
  "ID / Personal Details Change",
  "Bank Details Update",
  "Leave / Attendance",
  "Payroll",
  "Benefits",
  "Documents",
  "Other",
];

const PRIORITIES = [
  {
    value: "low",
    label: "Low",
  },
  {
    value: "normal",
    label: "Normal",
  },
  {
    value: "high",
    label: "High",
  },
];

const STATUS_CONFIG = {
  open: {
    label: "Open",
    className:
      "bg-blue-50 text-blue-700 border-blue-100",
  },

  in_progress: {
    label: "In Progress",
    className:
      "bg-amber-50 text-amber-700 border-amber-100",
  },

  "in progress": {
    label: "In Progress",
    className:
      "bg-amber-50 text-amber-700 border-amber-100",
  },

  pending: {
    label: "Pending",
    className:
      "bg-gray-100 text-gray-700 border-gray-200",
  },

  resolved: {
    label: "Resolved",
    className:
      "bg-green-50 text-green-700 border-green-100",
  },

  closed: {
    label: "Closed",
    className:
      "bg-gray-100 text-gray-600 border-gray-200",
  },
};

const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    className:
      "bg-gray-50 text-gray-600 border-gray-200",
  },

  normal: {
    label: "Normal",
    className:
      "bg-blue-50 text-blue-700 border-blue-100",
  },

  high: {
    label: "High",
    className:
      "bg-red-50 text-red-700 border-red-100",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeStatus(status) {
  return String(status || "open")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}

function getStatusConfig(status) {
  const normalized = normalizeStatus(status);

  return (
    STATUS_CONFIG[normalized] || {
      label:
        normalized.charAt(0).toUpperCase() +
        normalized.slice(1),
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    }
  );
}

function normalizePriority(priority) {
  const normalized = String(
    priority || "normal"
  )
    .trim()
    .toLowerCase();

  if (
    normalized === "low" ||
    normalized === "normal" ||
    normalized === "high"
  ) {
    return normalized;
  }

  return "normal";
}

function getPriorityConfig(priority) {
  return (
    PRIORITY_CONFIG[
      normalizePriority(priority)
    ] || PRIORITY_CONFIG.normal
  );
}

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

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRequestNumber(request) {
  if (request?.ticket_number) {
    return request.ticket_number;
  }

  if (request?.ticketNumber) {
    return request.ticketNumber;
  }

  if (request?.id) {
    return `REQ-${String(request.id)
      .slice(0, 8)
      .toUpperCase()}`;
  }

  return "HR Request";
}

function getRequestType(request) {
  return (
    request?.request_type ||
    request?.requestType ||
    "HR Request"
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function EmployeeSelfService() {
  /* =======================================================
     STATE
  ======================================================= */

  const [requests, setRequests] = useState([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [editingRequest, setEditingRequest] =
    useState(null);

  const [selectedRequest, setSelectedRequest] =
    useState(null);

  const [deletingId, setDeletingId] =
    useState(null);

  const [form, setForm] = useState({
    requestType: "",
    subject: "",
    description: "",
    priority: "normal",
  });

  /* =======================================================
     LOAD REQUESTS
  ======================================================= */

  async function loadRequests(
    showRefreshState = false
  ) {
    try {
      setError("");

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await api.get(
        "/employee-self-service"
      );

      const data = response?.data;

      const loadedRequests = Array.isArray(data)
        ? data
        : Array.isArray(data?.requests)
        ? data.requests
        : [];

      setRequests(loadedRequests);
    } catch (err) {
      console.error(
        "[EmployeeSelfService] Failed to load requests:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load employee requests.";

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadRequests();
  }, []);

  /* =======================================================
     FORM HELPERS
  ======================================================= */

  function resetForm() {
    setForm({
      requestType: "",
      subject: "",
      description: "",
      priority: "normal",
    });
  }

  function openCreateForm() {
    setEditingRequest(null);

    resetForm();

    setError("");
    setSuccess("");

    setShowForm(true);
  }

  function openEditForm(request) {
    if (!request?.id) return;

    setEditingRequest(request);

    setForm({
      requestType: getRequestType(request),

      subject: request?.subject || "",

      description:
        request?.description || "",

      priority: normalizePriority(
        request?.priority
      ),
    });

    setError("");
    setSuccess("");

    setShowForm(true);
  }

  function closeForm() {
    if (submitting) return;

    setShowForm(false);
    setEditingRequest(null);

    resetForm();
  }

  function handleInputChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  /* =======================================================
     CREATE / UPDATE
  ======================================================= */

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!editingRequest && !form.requestType.trim()) {
      setError("Please select a request type.");
      return;
    }

    if (!form.subject.trim()) {
      setError("Please enter a subject.");
      return;
    }

    if (!form.description.trim()) {
      setError("Please describe your request.");
      return;
    }

    if (!form.priority) {
      setError("Please select a priority.");
      return;
    }

    try {
      setSubmitting(true);

      /* ===================================================
         UPDATE EXISTING REQUEST
      =================================================== */

      if (editingRequest?.id) {
        const response = await api.patch(
          `/employee-self-service/${editingRequest.id}`,
          {
            subject: form.subject.trim(),

            description:
              form.description.trim(),

            priority: normalizePriority(
              form.priority
            ),
          }
        );

        const updatedRequest =
          response?.data;

        if (updatedRequest) {
          setRequests((previous) =>
            previous.map((request) =>
              request.id ===
              editingRequest.id
                ? updatedRequest
                : request
            )
          );

          if (
            selectedRequest?.id ===
            editingRequest.id
          ) {
            setSelectedRequest(
              updatedRequest
            );
          }
        }

        setSuccess(
          "HR request updated successfully."
        );
      }

      /* ===================================================
         CREATE NEW REQUEST
      =================================================== */

      else {
        const response = await api.post(
          "/employee-self-service",
          {
            requestType:
              form.requestType.trim(),

            subject:
              form.subject.trim(),

            description:
              form.description.trim(),

            priority: normalizePriority(
              form.priority
            ),
          }
        );

        const createdRequest =
          response?.data;

        if (createdRequest) {
          setRequests((previous) => [
            createdRequest,
            ...previous,
          ]);
        }

        setSuccess(
          "HR request submitted successfully."
        );
      }

      setShowForm(false);
      setEditingRequest(null);

      resetForm();
    } catch (err) {
      console.error(
        "[EmployeeSelfService] Failed to create/update request:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to submit HR request.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete(request) {
    if (!request?.id) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this request?"
    );

    if (!confirmed) return;

    try {
      setDeletingId(request.id);

      setError("");
      setSuccess("");

      await api.delete(
        `/employee-self-service/${request.id}`
      );

      setRequests((previous) =>
        previous.filter(
          (item) =>
            item.id !== request.id
        )
      );

      if (
        selectedRequest?.id ===
        request.id
      ) {
        setSelectedRequest(null);
      }

      setSuccess(
        "HR request deleted successfully."
      );
    } catch (err) {
      console.error(
        "[EmployeeSelfService] Failed to delete request:",
        err
      );

      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to delete request.";

      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  /* =======================================================
     STATISTICS
  ======================================================= */

  const stats = useMemo(() => {
    const total = requests.length;

    const open = requests.filter(
      (request) =>
        normalizeStatus(
          request?.status
        ) === "open"
    ).length;

    const inProgress = requests.filter(
      (request) =>
        normalizeStatus(
          request?.status
        ) === "in_progress"
    ).length;

    const resolved = requests.filter(
      (request) => {
        const status =
          normalizeStatus(
            request?.status
          );

        return (
          status === "resolved" ||
          status === "closed"
        );
      }
    ).length;

    return {
      total,
      open,
      inProgress,
      resolved,
    };
  }, [requests]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex items-start justify-between gap-4">

          <div>
            <button
              type="button"
              onClick={() =>
                window.history.back()
              }
              className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="flex items-start gap-3">

              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <FileText size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  Employee Self-Service
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Submit and track common HR
                  requests without opening a
                  ticket.
                </p>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={() =>
                loadRequests(true)
              }
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
            >
              <Plus size={17} />
              New request
            </button>

          </div>
        </div>

        {/* =================================================
            SUCCESS
        ================================================= */}

        {success && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">

            <span>{success}</span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              className="text-green-700 hover:text-green-900"
            >
              <X size={17} />
            </button>

          </div>
        )}

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

            <span>{error}</span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              className="text-red-700 hover:text-red-900"
            >
              <X size={17} />
            </button>

          </div>
        )}

        {/* =================================================
            STAT CARDS
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="TOTAL REQUESTS"
            value={stats.total}
            icon={
              <FileText size={18} />
            }
          />

          <StatCard
            label="OPEN"
            value={stats.open}
            icon={
              <Clock3 size={18} />
            }
          />

          <StatCard
            label="IN PROGRESS"
            value={stats.inProgress}
            icon={
              <Clock3 size={18} />
            }
          />

          <StatCard
            label="RESOLVED"
            value={stats.resolved}
            icon={
              <CheckCircle2 size={18} />
            }
          />

        </div>

        {/* =================================================
            REQUESTS SECTION
        ================================================= */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">

            <div>
              <h2 className="text-base font-semibold text-slate-900">
                My requests
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Track the status of requests
                submitted to HR.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {requests.length}{" "}
              {requests.length === 1
                ? "request"
                : "requests"}
            </span>

          </div>

          {/* =================================================
              LOADING
          ================================================= */}

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center">

              <div className="flex items-center gap-3 text-sm text-slate-500">

                <Loader2
                  size={20}
                  className="animate-spin"
                />

                Loading your requests...

              </div>

            </div>
          ) : requests.length === 0 ? (

            /* ===============================================
               EMPTY STATE
            =============================================== */

            <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FileText size={24} />
              </div>

              <h3 className="text-base font-semibold text-slate-800">
                No requests yet
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-500">
                Submit your first HR request
                and track its progress here.
              </p>

              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                <Plus size={17} />
                Create request
              </button>

            </div>

          ) : (

            /* ===============================================
               REQUEST LIST
            =============================================== */

            <div className="divide-y divide-slate-100">

              {requests.map((request) => {

                const status =
                  getStatusConfig(
                    request.status
                  );

                const priority =
                  getPriorityConfig(
                    request.priority
                  );

                const isOpen =
                  normalizeStatus(
                    request.status
                  ) === "open";

                return (
                  <div
                    key={request.id}
                    className="p-5 transition hover:bg-slate-50"
                  >

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                      <div className="min-w-0 flex-1">

                        <div className="mb-2 flex flex-wrap items-center gap-2">

                          <span className="text-xs font-semibold text-slate-400">
                            {getRequestNumber(
                              request
                            )}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priority.className}`}
                          >
                            Priority:{" "}
                            {priority.label}
                          </span>

                        </div>

                        <h3 className="text-base font-semibold text-slate-900">
                          {request.subject ||
                            "Untitled request"}
                        </h3>

                        <p className="mt-1 text-sm font-medium text-teal-700">
                          {getRequestType(
                            request
                          )}
                        </p>

                        <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {request.description ||
                            "No description provided."}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">

                          <span>
                            Created{" "}
                            {formatDate(
                              request.created_at
                            )}
                          </span>

                          {request.updated_at && (
                            <span>
                              Updated{" "}
                              {formatDate(
                                request.updated_at
                              )}
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="flex shrink-0 items-center gap-2">

                        {/* VIEW */}

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedRequest(
                              request
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          View
                        </button>

                        {/* EDIT + DELETE */}

                        {isOpen && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openEditForm(
                                  request
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil
                                size={14}
                              />

                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(
                                  request
                                )
                              }
                              disabled={
                                deletingId ===
                                request.id
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId ===
                              request.id ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                />
                              ) : (
                                <Trash2
                                  size={14}
                                />
                              )}

                              Delete
                            </button>
                          </>
                        )}

                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>
      </div>

      {/* =====================================================
          CREATE / EDIT MODAL
      ===================================================== */}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white shadow-xl">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingRequest
                    ? "Edit HR request"
                    : "Create HR request"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingRequest
                    ? "Update the details of your open request."
                    : "Submit a request to your HR team."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={submitting}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >

              {/* REQUEST TYPE */}

              {!editingRequest && (
                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Request type
                  </label>

                  <select
                    name="requestType"
                    value={form.requestType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >

                    <option value="">
                      Select request type
                    </option>

                    {REQUEST_TYPES.map(
                      (type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {type}
                        </option>
                      )
                    )}

                  </select>

                </div>
              )}

              {/* SHOW REQUEST TYPE WHEN EDITING */}

              {editingRequest && (
                <div>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Request type
                  </label>

                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    {getRequestType(
                      editingRequest
                    )}
                  </div>

                  <p className="mt-1.5 text-xs text-slate-400">
                    Request type cannot be changed after submission.
                  </p>

                </div>
              )}

              {/* SUBJECT */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Subject
                </label>

                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleInputChange}
                  placeholder="What do you need help with?"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />

              </div>

              {/* PRIORITY */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Priority
                </label>

                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                >

                  {PRIORITIES.map(
                    (priority) => (
                      <option
                        key={priority.value}
                        value={priority.value}
                      >
                        {priority.label}
                      </option>
                    )
                  )}

                </select>

                <p className="mt-1.5 text-xs text-slate-400">
                  Select how urgent this HR request is.
                </p>

              </div>

              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  rows={6}
                  placeholder="Describe your request in detail..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />

              </div>

              {/* FORM ACTIONS */}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={closeForm}
                  disabled={submitting}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {submitting ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />

                      Saving...
                    </>
                  ) : (
                    <>
                      <Send size={16} />

                      {editingRequest
                        ? "Update request"
                        : "Submit request"}
                    </>
                  )}

                </button>

              </div>

            </form>

          </div>
        </div>
      )}

      {/* =====================================================
          VIEW REQUEST MODAL
      ===================================================== */}

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">

            {/* VIEW HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">

              <div>

                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {getRequestNumber(
                    selectedRequest
                  )}
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedRequest.subject ||
                    "HR Request"}
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(null)
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>

            </div>

            {/* VIEW CONTENT */}

            <div className="space-y-5 p-6">

              {/* STATUS + TYPE + PRIORITY */}

              <div className="flex flex-wrap gap-2">

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    getStatusConfig(
                      selectedRequest.status
                    ).className
                  }`}
                >
                  {
                    getStatusConfig(
                      selectedRequest.status
                    ).label
                  }
                </span>

                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
                  {getRequestType(
                    selectedRequest
                  )}
                </span>

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    getPriorityConfig(
                      selectedRequest.priority
                    ).className
                  }`}
                >
                  Priority:{" "}
                  {
                    getPriorityConfig(
                      selectedRequest.priority
                    ).label
                  }
                </span>

              </div>

              {/* SUBJECT */}

              <div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Subject
                </p>

                <p className="text-sm font-medium text-slate-800">
                  {selectedRequest.subject ||
                    "No subject provided."}
                </p>

              </div>

              {/* DESCRIPTION */}

              <div>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </p>

                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {selectedRequest.description ||
                    "No description provided."}
                </p>

              </div>

              {/* HR NOTES */}

              {selectedRequest.hr_notes && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
                    HR Notes
                  </p>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-blue-900">
                    {selectedRequest.hr_notes}
                  </p>

                </div>
              )}

              {/* REQUEST INFORMATION */}

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Request type
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {getRequestType(
                      selectedRequest
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Priority
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {
                      getPriorityConfig(
                        selectedRequest.priority
                      ).label
                    }
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      getStatusConfig(
                        selectedRequest.status
                      ).label
                    }
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      selectedRequest.created_at
                    )}
                  </p>

                </div>

                <div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Last updated
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {formatDateTime(
                      selectedRequest.updated_at
                    )}
                  </p>

                </div>

              </div>

            </div>

            {/* VIEW FOOTER */}

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">

              {normalizeStatus(
                selectedRequest.status
              ) === "open" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(
                        null
                      );

                      openEditForm(
                        selectedRequest
                      );
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRequest(
                        null
                      );

                      handleDelete(
                        selectedRequest
                      );
                    }}
                    disabled={
                      deletingId ===
                      selectedRequest.id
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    {deletingId ===
                    selectedRequest.id ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}

                    Delete
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(null)
                }
                className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                Close
              </button>

            </div>

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
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <p className="text-xs font-semibold tracking-wide text-slate-400">
          {label}
        </p>

        <div className="text-slate-400">
          {icon}
        </div>

      </div>

      <p className="mt-4 text-2xl font-semibold text-slate-900">
        {value}
      </p>

    </div>
  );
}