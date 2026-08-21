import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";

import api from "../../services/api";

export default function HREscalationManager() {
  const navigate = useNavigate();

  /* =========================================================
     STATE
  ========================================================= */

  const [overdueRequests, setOverdueRequests] = useState([]);
  const [escalations, setEscalations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);

  /* =========================================================
     LOAD OVERDUE REQUESTS
  ========================================================= */

  async function loadOverdueRequests() {
    const { data } = await api.get("/escalations/overdue");

    setOverdueRequests(
      Array.isArray(data?.requests)
        ? data.requests
        : [],
    );
  }

  /* =========================================================
     LOAD ESCALATIONS
  ========================================================= */

  async function loadEscalations() {
    const { data } = await api.get("/escalations");

    setEscalations(
      Array.isArray(data)
        ? data
        : [],
    );
  }

  /* =========================================================
     LOAD EVERYTHING
  ========================================================= */

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadOverdueRequests(),
        loadEscalations(),
      ]);
    } catch (err) {
      console.error(
        "Load escalation manager data error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not load escalation data.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     FIND ACTIVE ESCALATION
  ========================================================= */

  function getExistingEscalation(requestId) {
    return escalations.find(
      (escalation) =>
        escalation.approval_request_id ===
          requestId &&
        [
          "open",
          "acknowledged",
        ].includes(
          escalation.status,
        ),
    );
  }

  /* =========================================================
     FIND ALL ESCALATIONS FOR REQUEST
  ========================================================= */

  function getRequestEscalations(requestId) {
    return escalations.filter(
      (escalation) =>
        escalation.approval_request_id ===
        requestId,
    );
  }

  /* =========================================================
     SLA HELPERS
  ========================================================= */

  function getSlaHours(request) {
    const value = Number(
      request?.sla_hours,
    );

    if (
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    return null;
  }

  function getSlaMinutes(request) {
    const value = Number(
      request?.sla_minutes,
    );

    if (
      Number.isFinite(value) &&
      value >= 0
    ) {
      return value;
    }

    const hours =
      getSlaHours(request);

    if (
      hours !== null
    ) {
      return hours * 60;
    }

    return null;
  }

  function formatSla(request) {
    if (
      request?.sla_label &&
      typeof request.sla_label === "string"
    ) {
      return request.sla_label;
    }

    const minutes =
      getSlaMinutes(request);

    if (
      minutes === null
    ) {
      return "—";
    }

    if (minutes < 60) {
      if (minutes === 1) {
        return "1 minute";
      }

      return `${minutes} minutes`;
    }

    const hours =
      minutes / 60;

    if (
      Number.isInteger(hours)
    ) {
      return `${hours} hours`;
    }

    return `${hours.toFixed(1)} hours`;
  }

  function formatOverdue(request) {
    const explicitMinutes =
      Number(
        request?.overdue_minutes,
      );

    if (
      Number.isFinite(
        explicitMinutes,
      ) &&
      explicitMinutes >= 0
    ) {
      if (
        explicitMinutes < 60
      ) {
        if (
          explicitMinutes < 1
        ) {
          return "less than 1 minute";
        }

        if (
          explicitMinutes === 1
        ) {
          return "1 minute";
        }

        return `${Math.round(
          explicitMinutes,
        )} minutes`;
      }

      const hours =
        explicitMinutes / 60;

      return `${hours.toFixed(
        1,
      )} hours`;
    }

    const hours =
      Number(
        request?.overdue_hours,
      );

    if (
      Number.isFinite(hours)
    ) {
      if (
        hours < 1
      ) {
        const minutes =
          Math.max(
            1,
            Math.round(
              hours * 60,
            ),
          );

        return `${minutes} minute${
          minutes === 1
            ? ""
            : "s"
        }`;
      }

      return `${hours} hours`;
    }

    return "—";
  }

  /* =========================================================
     ESCALATE REQUEST
  ========================================================= */

  async function handleEscalate(
    request,
  ) {
    const confirmed =
      window.confirm(
        `Escalate "${request.title}"?\n\nThis request is overdue by ${formatOverdue(
          request,
        )} and will be routed to the organization's owner.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        request.id,
      );

      setError("");

      const slaLabel =
        formatSla(request);

      const overdueLabel =
        formatOverdue(request);

      await api.post(
        `/escalations/${request.id}/escalate`,
        {
          reason:
            `Approval request exceeded its ${slaLabel} SLA and is overdue by ${overdueLabel}.`,
        },
      );

      setSelectedRequest(null);

      await loadData();
    } catch (err) {
      console.error(
        "Escalate request error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not escalate this request.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =========================================================
     ACKNOWLEDGE ESCALATION
  ========================================================= */

  async function handleAcknowledge(
    escalation,
  ) {
    const confirmed =
      window.confirm(
        "Acknowledge this escalation?",
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        escalation.id,
      );

      setError("");

      await api.post(
        `/escalations/${escalation.id}/acknowledge`,
      );

      await loadData();
    } catch (err) {
      console.error(
        "Acknowledge escalation error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not acknowledge escalation.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =========================================================
     RESOLVE ESCALATION
  ========================================================= */

  async function handleResolve(
    escalation,
  ) {
    const confirmed =
      window.confirm(
        "Resolve this escalation?\n\nThe escalation will be marked as resolved.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        escalation.id,
      );

      setError("");

      await api.post(
        `/escalations/${escalation.id}/resolve`,
        {
          resolution_note:
            "Escalation resolved by HR administrator.",
        },
      );

      await loadData();
    } catch (err) {
      console.error(
        "Resolve escalation error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not resolve escalation.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =========================================================
     DELETE ESCALATION ONLY
  ========================================================= */

  async function handleDeleteEscalation(
    escalation,
  ) {
    const confirmed =
      window.confirm(
        "Delete this escalation record?\n\nThe original approval request will remain.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        escalation.id,
      );

      setError("");

      await api.delete(
        `/escalations/${escalation.id}`,
      );

      await loadData();
    } catch (err) {
      console.error(
        "Delete escalation error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not delete escalation.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =========================================================
     DELETE / CLEAN UP APPROVAL REQUEST
     
     IMPORTANT:
     The current backend exposes:
     
     POST /api/approvals/requests/:id/cancel
     
     It does not currently expose DELETE for approval requests.
     
     Therefore:
     1. Cancel the pending approval request.
     2. Delete all associated escalation records.
     3. Reload the page.
     
     Result:
     - Request disappears from overdue actions.
     - Escalation history is cleaned up.
  ========================================================= */

  async function handleDeleteRequest(
    request,
  ) {
    const requestEscalations =
      getRequestEscalations(
        request.id,
      );

    const confirmed =
      window.confirm(
        `Delete "${request.title}"?\n\nThis will remove it from the active HR approval workflow and delete its escalation history.\n\nThis action is intended for test-data cleanup.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(
        request.id,
      );

      setError("");

      /* -------------------------------------------------------
         STEP 1
         Cancel the pending approval request.
      ------------------------------------------------------- */

      await api.post(
        `/approvals/requests/${request.id}/cancel`,
        {
          comment:
            "Deleted from HR Escalation Manager during test-data cleanup.",
        },
      );

      /* -------------------------------------------------------
         STEP 2
         Delete associated escalation records.
         
         We do this after cancelling the request so the
         original request cannot remain pending.
      ------------------------------------------------------- */

      for (
        const escalation of
          requestEscalations
      ) {
        try {
          await api.delete(
            `/escalations/${escalation.id}`,
          );
        } catch (deleteError) {
          console.error(
            `Could not delete escalation ${escalation.id}:`,
            deleteError,
          );
        }
      }

      /* -------------------------------------------------------
         STEP 3
         Close details modal if open.
      ------------------------------------------------------- */

      setSelectedRequest(null);

      /* -------------------------------------------------------
         STEP 4
         Reload both sections.
      ------------------------------------------------------- */

      await loadData();
    } catch (err) {
      console.error(
        "Delete approval request error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not delete this approval request.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  /* =========================================================
     BACK
  ========================================================= */

  function handleBack() {
    navigate(
      "/app/categories/administrative-hr",
    );
  }

  /* =========================================================
     FORMAT DATE
  ========================================================= */

  function formatDate(
    value,
  ) {
    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return "—";
    }

    return date.toLocaleString();
  }

  /* =========================================================
     STATUS BADGE
  ========================================================= */

  function StatusBadge({
    status,
  }) {
    if (
      status === "open"
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
          <AlertTriangle
            size={13}
          />
          Open
        </span>
      );
    }

    if (
      status === "acknowledged"
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <Clock3
            size={13}
          />
          Acknowledged
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
        <CheckCircle2
          size={13}
        />
        Resolved
      </span>
    );
  }

  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <RefreshCw
              size={24}
              className="mx-auto animate-spin text-teal-700"
            />

            <p className="mt-3 text-sm text-slate-500">
              Checking HR requests for
              overdue actions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* =====================================================
            BACK
        ===================================================== */}

        <div>
          <button
            type="button"
            onClick={
              handleBack
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft
              size={16}
            />
            Back
          </button>
        </div>

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">
              Documents & HR Workflows
            </p>

            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              HR Escalation Manager
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Identify overdue HR approval
              actions and escalate them to
              the appropriate organization
              owner.
            </p>
          </div>

          <button
            type="button"
            onClick={
              loadData
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw
              size={16}
            />
            Refresh
          </button>
        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-medium">
                Something needs attention
              </p>

              <p className="mt-1">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            SUMMARY
        ===================================================== */}

        <div className="grid gap-4 md:grid-cols-3">

          {/* OVERDUE */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Overdue actions
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {
                    overdueRequests.length
                  }
                </p>
              </div>

              <div className="rounded-lg bg-red-50 p-3">
                <AlertTriangle
                  size={22}
                  className="text-red-600"
                />
              </div>
            </div>
          </div>

          {/* OPEN */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Open escalations
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {
                    escalations.filter(
                      (item) =>
                        item.status ===
                        "open",
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-3">
                <ShieldAlert
                  size={22}
                  className="text-amber-600"
                />
              </div>
            </div>
          </div>

          {/* RESOLVED */}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Resolved escalations
                </p>

                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {
                    escalations.filter(
                      (item) =>
                        item.status ===
                        "resolved",
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-lg bg-green-50 p-3">
                <CheckCircle2
                  size={22}
                  className="text-green-600"
                />
              </div>
            </div>
          </div>

        </div>

        {/* =====================================================
            OVERDUE REQUESTS
        ===================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Overdue HR actions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              These are real pending approval
              requests that have exceeded
              their configured SLA.
            </p>
          </div>

          {overdueRequests.length ===
          0 ? (
            <div className="p-10 text-center">
              <CheckCircle2
                size={32}
                className="mx-auto text-green-500"
              />

              <p className="mt-3 font-medium text-slate-800">
                No overdue HR actions
              </p>

              <p className="mt-1 text-sm text-slate-500">
                All currently pending
                approval requests are within
                their SLA.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {overdueRequests.map(
                (request) => {
                  const existing =
                    getExistingEscalation(
                      request.id,
                    );

                  const processing =
                    processingId ===
                    request.id;

                  return (
                    <div
                      key={
                        request.id
                      }
                      className="p-5"
                    >
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                        {/* REQUEST INFO */}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start gap-3">

                            <div className="mt-1 rounded-lg bg-red-50 p-2">
                              <Clock3
                                size={18}
                                className="text-red-600"
                              />
                            </div>

                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900">
                                {
                                  request.title
                                }
                              </h3>

                              <p className="mt-1 text-sm text-slate-500">
                                {
                                  request.description
                                }
                              </p>
                            </div>

                          </div>

                          {/* META */}

                          <div className="mt-4 flex flex-wrap gap-2">

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              {
                                request.request_type
                              }
                            </span>

                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                              Priority:{" "}
                              {
                                request.priority
                              }
                            </span>

                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                              Overdue by{" "}
                              {
                                formatOverdue(
                                  request,
                                )
                              }
                            </span>

                          </div>

                          {/* TIMING */}

                          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">

                            <div>
                              <p className="text-xs text-slate-400">
                                Created
                              </p>

                              <p className="mt-1 text-slate-700">
                                {
                                  formatDate(
                                    request.created_at,
                                  )
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">
                                SLA
                              </p>

                              <p className="mt-1 font-medium text-slate-700">
                                {
                                  formatSla(
                                    request,
                                  )
                                }
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400">
                                Due
                              </p>

                              <p className="mt-1 text-slate-700">
                                {
                                  formatDate(
                                    request.due_at,
                                  )
                                }
                              </p>
                            </div>

                          </div>

                        </div>

                        {/* ACTIONS */}

                        <div className="flex shrink-0 flex-col gap-2 lg:w-48">

                          {existing ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">

                              <p className="text-xs font-medium text-amber-800">
                                Already escalated
                              </p>

                              <div className="mt-2">
                                <StatusBadge
                                  status={
                                    existing.status
                                  }
                                />
                              </div>

                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={
                                processing
                              }
                              onClick={() =>
                                handleEscalate(
                                  request,
                                )
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              <ShieldAlert
                                size={16}
                              />

                              {processing
                                ? "Escalating..."
                                : "Escalate"}
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={
                              processing
                            }
                            onClick={() =>
                              setSelectedRequest(
                                request,
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            View details
                          </button>

                          {/* DELETE REQUEST */}

                          <button
                            type="button"
                            disabled={
                              processing
                            }
                            onClick={() =>
                              handleDeleteRequest(
                                request,
                              )
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2
                              size={16}
                            />

                            {processing
                              ? "Deleting..."
                              : "Delete request"}
                          </button>

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
            ESCALATION HISTORY
        ===================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Escalation history
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Real escalation records stored
              in Supabase. Delete is available
              for test cleanup.
            </p>
          </div>

          {escalations.length ===
          0 ? (
            <div className="p-10 text-center">
              <ShieldAlert
                size={30}
                className="mx-auto text-slate-400"
              />

              <p className="mt-3 font-medium text-slate-700">
                No escalations yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Overdue approval actions will
                appear here after escalation.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">

              {escalations.map(
                (escalation) => (
                  <div
                    key={
                      escalation.id
                    }
                    className="p-5"
                  >

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-3">

                          <StatusBadge
                            status={
                              escalation.status
                            }
                          />

                          <span className="text-xs text-slate-400">
                            Level{" "}
                            {
                              escalation.escalation_level
                            }
                          </span>

                        </div>

                        <p className="mt-2 font-medium text-slate-900">
                          {
                            escalation.reason
                          }
                        </p>

                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">

                          <span>
                            Created{" "}
                            {
                              formatDate(
                                escalation.created_at,
                              )
                            }
                          </span>

                          {escalation.acknowledged_at && (
                            <span>
                              Acknowledged{" "}
                              {
                                formatDate(
                                  escalation.acknowledged_at,
                                )
                              }
                            </span>
                          )}

                          {escalation.resolved_at && (
                            <span>
                              Resolved{" "}
                              {
                                formatDate(
                                  escalation.resolved_at,
                                )
                              }
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">

                        {escalation.status ===
                          "open" && (
                          <button
                            type="button"
                            disabled={
                              processingId ===
                              escalation.id
                            }
                            onClick={() =>
                              handleAcknowledge(
                                escalation,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <CheckCircle2
                              size={15}
                            />

                            Acknowledge
                          </button>
                        )}

                        {[
                          "open",
                          "acknowledged",
                        ].includes(
                          escalation.status,
                        ) && (
                          <button
                            type="button"
                            disabled={
                              processingId ===
                              escalation.id
                            }
                            onClick={() =>
                              handleResolve(
                                escalation,
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            <CheckCircle2
                              size={15}
                            />

                            Resolve
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={
                            processingId ===
                            escalation.id
                          }
                          onClick={() =>
                            handleDeleteEscalation(
                              escalation,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2
                            size={15}
                          />

                          Delete
                        </button>

                      </div>

                    </div>

                  </div>
                ),
              )}

            </div>
          )}

        </div>

        {/* =====================================================
            EXPLANATION
        ===================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white p-5">

          <div className="flex items-start gap-3">

            <div className="rounded-lg bg-teal-50 p-2">
              <UserRound
                size={18}
                className="text-teal-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                How escalation works
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600">
                The system checks pending approval
                requests against their SLA. When a
                request is genuinely overdue, it is
                presented here as an escalation
                candidate. Automatic escalation routes
                the issue to the organization's owner.
                Approval or rejection of the original
                HR request remains a human decision.
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* =======================================================
          REQUEST DETAILS MODAL
      ======================================================= */}

      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRequest(
                null,
              );
            }
          }}
        >

          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">

            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="text-sm font-medium text-teal-700">
                  Overdue HR action
                </p>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {
                    selectedRequest.title
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(
                    null,
                  )
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <XCircle
                  size={20}
                />
              </button>

            </div>

            <div className="mt-5 space-y-4">

              <div>
                <p className="text-xs text-slate-400">
                  Description
                </p>

                <p className="mt-1 text-sm text-slate-700">
                  {
                    selectedRequest.description
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <p className="text-xs text-slate-400">
                    Request type
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      selectedRequest.request_type
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Priority
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      selectedRequest.priority
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    SLA
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {
                      formatSla(
                        selectedRequest,
                      )
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Overdue
                  </p>

                  <p className="mt-1 text-sm font-medium text-red-600">
                    {
                      formatOverdue(
                        selectedRequest,
                      )
                    }
                  </p>
                </div>

              </div>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <p className="text-xs text-slate-400">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      formatDate(
                        selectedRequest.created_at,
                      )
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">
                    Due
                  </p>

                  <p className="mt-1 text-sm text-slate-700">
                    {
                      formatDate(
                        selectedRequest.due_at,
                      )
                    }
                  </p>
                </div>

              </div>

              <div className="rounded-lg bg-red-50 p-4">

                <div className="flex items-start gap-3">

                  <AlertTriangle
                    size={18}
                    className="mt-0.5 text-red-600"
                  />

                  <div>
                    <p className="text-sm font-medium text-red-800">
                      SLA exceeded
                    </p>

                    <p className="mt-1 text-xs leading-5 text-red-700">
                      This request has remained
                      pending beyond its configured
                      SLA. The system has identified
                      it as eligible for escalation.
                    </p>
                  </div>

                </div>

              </div>

            </div>

            {/* =================================================
                MODAL ACTIONS
            ================================================= */}

            <div className="mt-6 flex flex-wrap justify-end gap-3">

              <button
                type="button"
                onClick={() =>
                  setSelectedRequest(
                    null,
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>

              {!getExistingEscalation(
                selectedRequest.id,
              ) && (
                <button
                  type="button"
                  disabled={
                    processingId ===
                    selectedRequest.id
                  }
                  onClick={() =>
                    handleEscalate(
                      selectedRequest,
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <ShieldAlert
                    size={16}
                  />

                  {processingId ===
                  selectedRequest.id
                    ? "Escalating..."
                    : "Escalate"}
                </button>
              )}

              {/* DELETE FROM MODAL */}

              <button
                type="button"
                disabled={
                  processingId ===
                  selectedRequest.id
                }
                onClick={() =>
                  handleDeleteRequest(
                    selectedRequest,
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2
                  size={16}
                />

                {processingId ===
                selectedRequest.id
                  ? "Deleting..."
                  : "Delete request"}
              </button>

            </div>

          </div>

        </div>
      )}
    </div>
  );
}