import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";

import api from "../../services/api";

export default function ApprovalRouting() {
  const navigate = useNavigate();

  const [rules, setRules] = useState([]);
  const [requests, setRequests] = useState([]);

  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const [error, setError] = useState("");

  const [showRuleForm, setShowRuleForm] = useState(false);

  const [ruleName, setRuleName] =
    useState("Manager Approval Rule");

  const [requestType, setRequestType] =
    useState("employee-resignation");

  const [approverType, setApproverType] =
    useState("role");

  const [approverRole, setApproverRole] =
    useState("manager");

  const [savingRule, setSavingRule] =
    useState(false);

  const [creatingRequest, setCreatingRequest] =
    useState(false);

  const [processingDecision, setProcessingDecision] =
    useState(null);

  /* =========================================================
     CONFIRMATION STATE
  ========================================================= */

  const [confirmation, setConfirmation] =
    useState(null);

  /* =========================================================
     LOAD RULES
  ========================================================= */

  async function loadRules() {
    try {
      setLoadingRules(true);

      const { data } =
        await api.get("/approvals/rules");

      setRules(
        Array.isArray(data)
          ? data
          : [],
      );
    } catch (err) {
      console.error(
        "Load approval rules error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Could not load approval rules.",
      );
    } finally {
      setLoadingRules(false);
    }
  }

  /* =========================================================
     LOAD REQUESTS
  ========================================================= */

  async function loadRequests() {
    try {
      setLoadingRequests(true);

      const { data } =
        await api.get("/approvals/requests");

      setRequests(
        Array.isArray(data)
          ? data
          : [],
      );
    } catch (err) {
      console.error(
        "Load approval requests error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Could not load approval requests.",
      );
    } finally {
      setLoadingRequests(false);
    }
  }

  /* =========================================================
     LOAD PAGE DATA
  ========================================================= */

  async function loadData() {
    setError("");

    await Promise.all([
      loadRules(),
      loadRequests(),
    ]);
  }

  useEffect(() => {
    loadData();
  }, []);

  /* =========================================================
     CREATE APPROVAL RULE
  ========================================================= */

  async function handleCreateRule(event) {
    event.preventDefault();

    try {
      setSavingRule(true);
      setError("");

      if (!ruleName.trim()) {
        setError(
          "Rule name is required.",
        );
        return;
      }

      if (!requestType.trim()) {
        setError(
          "Request type is required.",
        );
        return;
      }

      const payload = {
        name: ruleName.trim(),
        request_type:
          requestType.trim(),

        approver_type:
          approverType,

        approver_role:
          approverType === "role"
            ? approverRole.trim()
            : null,

        priority: 100,

        is_active: true,

        conditions: {},
      };

      await api.post(
        "/approvals/rules",
        payload,
      );

      setShowRuleForm(false);

      await loadRules();
    } catch (err) {
      console.error(
        "Create approval rule error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Could not create approval rule.",
      );
    } finally {
      setSavingRule(false);
    }
  }

  /* =========================================================
     CREATE REAL APPROVAL REQUEST
  ========================================================= */

  async function handleCreateTestRequest() {
    try {
      setCreatingRequest(true);
      setError("");

      await api.post(
        "/approvals/requests",
        {
          request_type:
            "employee-resignation",

          title:
            "Employee Resignation Approval",

          description:
            "Employee resignation requires manager approval before the remaining offboarding process can continue.",

          priority:
            "normal",

          request_data: {},
        },
      );

      await loadRequests();
    } catch (err) {
      console.error(
        "Create approval request error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Could not create approval request.",
      );
    } finally {
      setCreatingRequest(false);
    }
  }

  /* =========================================================
     APPROVE / REJECT
  ========================================================= */

  function requestDecision(
    request,
    decision,
  ) {
    setConfirmation({
      requestId: request.id,
      decision,
      title: request.title,
    });
  }

  /* =========================================================
     CONFIRM DECISION
  ========================================================= */

  async function confirmDecision() {
    if (!confirmation) {
      return;
    }

    const {
      requestId,
      decision,
    } = confirmation;

    try {
      setProcessingDecision(
        `${requestId}-${decision}`,
      );

      setError("");

      await api.post(
        `/approvals/requests/${requestId}/${decision}`,
        {
          comment:
            decision === "approve"
              ? "Approved by authorized approver."
              : "Rejected by authorized approver.",
        },
      );

      setConfirmation(null);

      await loadRequests();
    } catch (err) {
      console.error(
        "Approval decision error:",
        err,
      );

      setError(
        err?.response?.data?.message ||
          "Could not process approval decision.",
      );
    } finally {
      setProcessingDecision(null);
    }
  }

  /* =========================================================
     CANCEL CONFIRMATION
  ========================================================= */

  function cancelConfirmation() {
    if (
      processingDecision
    ) {
      return;
    }

    setConfirmation(null);
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function handleBack() {
    navigate(
      "/app/categories/administrative-hr",
    );
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="min-h-full bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* =====================================================
            BACK / BREADCRUMB
        ===================================================== */}

        <div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <p className="mt-4 text-sm font-medium text-teal-700">
            Documents & HR Workflows
          </p>
        </div>

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              HR Approval Routing
            </h1>

            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Route real HR approval requests
              to authorized people and keep an
              audit trail of every decision.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                setShowRuleForm(
                  !showRuleForm,
                )
              }
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              <Plus size={16} />
              Create Rule
            </button>
          </div>
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
            CREATE RULE
        ===================================================== */}

        {showRuleForm && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Create approval routing rule
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                This rule will be stored in the
                database and used when matching
                approval requests are submitted.
              </p>
            </div>

            <form
              onSubmit={handleCreateRule}
              className="grid gap-4 md:grid-cols-2"
            >

              {/* RULE NAME */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Rule name
                </label>

                <input
                  value={ruleName}
                  onChange={(event) =>
                    setRuleName(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>

              {/* REQUEST TYPE */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Request type
                </label>

                <input
                  value={requestType}
                  onChange={(event) =>
                    setRequestType(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                />
              </div>

              {/* APPROVER TYPE */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Approver type
                </label>

                <select
                  value={approverType}
                  onChange={(event) =>
                    setApproverType(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
                >
                  <option value="role">
                    Role
                  </option>

                  <option value="user">
                    Specific User
                  </option>

                  <option value="manager">
                    Manager
                  </option>
                </select>
              </div>

              {/* ROLE */}

              {approverType === "role" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Approver role
                  </label>

                  <input
                    value={approverRole}
                    onChange={(event) =>
                      setApproverRole(
                        event.target.value,
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
                  />
                </div>
              )}

              {/* FORM ACTIONS */}

              <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() =>
                    setShowRuleForm(false)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingRule}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingRule
                    ? "Creating..."
                    : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =====================================================
            ACTIVE RULES
        ===================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Active approval rules
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Rules determine who receives an
              approval request.
            </p>
          </div>

          {loadingRules ? (
            <div className="p-6 text-sm text-slate-500">
              Loading approval rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center">
              <Clock3
                className="mx-auto text-slate-400"
                size={28}
              />

              <p className="mt-3 font-medium text-slate-700">
                No approval rules yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create your first routing rule
                above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {rule.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {rule.request_type}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-700">
                      {rule.approver_type}
                    </span>

                    {rule.approver_role && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                        {rule.approver_role}
                      </span>
                    )}

                    <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">
                      {rule.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* =====================================================
            SUBMIT APPROVAL REQUEST
        ===================================================== */}

        <div className="rounded-xl border border-teal-100 bg-teal-50 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Submit approval request
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                This creates a real approval request
                using the routing rules above.
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleCreateTestRequest
              }
              disabled={creatingRequest}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send size={16} />

              {creatingRequest
                ? "Submitting..."
                : "Submit Resignation Approval"}
            </button>
          </div>
        </div>

        {/* =====================================================
            APPROVAL REQUESTS
        ===================================================== */}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900">
              Approval requests
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Real approval requests stored in
              Supabase.
            </p>
          </div>

          {loadingRequests ? (
            <div className="p-6 text-sm text-slate-500">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No approval requests yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {requests.map((request) => {
                const pending =
                  request.status ===
                  "pending";

                const approved =
                  request.status ===
                  "approved";

                const rejected =
                  request.status ===
                  "rejected";

                const approving =
                  processingDecision ===
                  `${request.id}-approve`;

                const rejecting =
                  processingDecision ===
                  `${request.id}-reject`;

                return (
                  <div
                    key={request.id}
                    className="p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">

                      <div>
                        <div className="flex items-center gap-2">

                          {approved && (
                            <CheckCircle2
                              size={18}
                              className="text-green-600"
                            />
                          )}

                          {rejected && (
                            <XCircle
                              size={18}
                              className="text-red-600"
                            />
                          )}

                          {pending && (
                            <Clock3
                              size={18}
                              className="text-amber-600"
                            />
                          )}

                          <h3 className="font-medium text-slate-900">
                            {request.title}
                          </h3>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {request.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                            {request.request_type}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                            {request.priority}
                          </span>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                            {request.status}
                          </span>
                        </div>
                      </div>

                      {pending &&
                        request.assigned_approver_id && (
                          <div className="flex gap-2">

                            {/* APPROVE */}

                            <button
                              type="button"
                              disabled={
                                approving ||
                                rejecting
                              }
                              onClick={() =>
                                requestDecision(
                                  request,
                                  "approve",
                                )
                              }
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {approving
                                ? "Approving..."
                                : "Approve"}
                            </button>

                            {/* REJECT */}

                            <button
                              type="button"
                              disabled={
                                approving ||
                                rejecting
                              }
                              onClick={() =>
                                requestDecision(
                                  request,
                                  "reject",
                                )
                              }
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {rejecting
                                ? "Rejecting..."
                                : "Reject"}
                            </button>

                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =======================================================
          APPROVAL CONFIRMATION MODAL
      ======================================================= */}

      {confirmation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              cancelConfirmation();
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

            {/* ICON */}

            <div
              className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
                confirmation.decision ===
                "approve"
                  ? "bg-green-100"
                  : "bg-red-100"
              }`}
            >
              {confirmation.decision ===
              "approve" ? (
                <CheckCircle2
                  size={24}
                  className="text-green-600"
                />
              ) : (
                <XCircle
                  size={24}
                  className="text-red-600"
                />
              )}
            </div>

            {/* TITLE */}

            <h2 className="mt-4 text-center text-lg font-semibold text-slate-900">
              {confirmation.decision ===
              "approve"
                ? "Approve HR request?"
                : "Reject HR request?"}
            </h2>

            {/* DESCRIPTION */}

            <p className="mt-2 text-center text-sm text-slate-500">
              {confirmation.decision ===
              "approve"
                ? "Are you sure you want to approve this HR request? This decision will be recorded in the approval audit trail."
                : "Are you sure you want to reject this HR request? This decision will be recorded in the approval audit trail."}
            </p>

            {/* REQUEST TITLE */}

            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-sm font-medium text-slate-800">
                {confirmation.title}
              </p>
            </div>

            {/* ACTIONS */}

            <div className="mt-6 flex justify-end gap-3">

              <button
                type="button"
                onClick={
                  cancelConfirmation
                }
                disabled={
                  Boolean(
                    processingDecision,
                  )
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirmDecision
                }
                disabled={
                  Boolean(
                    processingDecision,
                  )
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirmation.decision ===
                  "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processingDecision
                  ? confirmation.decision ===
                    "approve"
                    ? "Approving..."
                    : "Rejecting..."
                  : confirmation.decision ===
                    "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}