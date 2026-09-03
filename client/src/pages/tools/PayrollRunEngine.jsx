import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { api } from "../../services/api.js";

/* =========================================================
   CONSTANTS
========================================================= */

const EMPTY_RUN_FORM = {
  payrollMonth: new Date()
    .toISOString()
    .slice(0, 7),
  notes: "",
};

const STATUS_META = {
  draft: {
    label: "Draft",
    className:
      "bg-ink-100 text-ink-700",
  },

  review: {
    label: "In Review",
    className:
      "bg-amber-100 text-amber-700",
  },

  approved: {
    label: "Approved",
    className:
      "bg-blue-100 text-blue-700",
  },

  processed: {
    label: "Processed",
    className:
      "bg-emerald-100 text-emerald-700",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function formatCurrency(value) {
  const amount =
    Number(value) || 0;

  return new Intl.NumberFormat(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function formatMonth(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(`${value.slice(0, 7)}-01T00:00:00`);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );
}

function formatDateTime(value) {
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
    return value;
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label:
        status || "Unknown",
      className:
        "bg-ink-100 text-ink-700",
    }
  );
}

function normalizeResponse(response) {
  return (
    response?.data?.data ??
    response?.data ??
    response ??
    null
  );
}

function getItemsFromRun(run) {
  if (
    Array.isArray(
      run?.items,
    )
  ) {
    return run.items;
  }

  return [];
}

function getEmployeeName(item) {
  return (
    item?.employee_name ||
    item?.employees?.full_name ||
    item?.employees?.name ||
    "Unknown employee"
  );
}

function getEmployeeCode(item) {
  return (
    item?.employee_code ||
    item?.employees?.employee_code ||
    "—"
  );
}

function getValidationMessage(item) {
  const messages =
    Array.isArray(
      item?.validation_messages,
    )
      ? item.validation_messages
      : [];

  return messages.join(" ");
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function PayrollRunEngine() {
  const navigate =
    useNavigate();

  const [runs, setRuns] =
    useState([]);

  const [selectedRun, setSelectedRun] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [loadingRun, setLoadingRun] =
    useState(false);

  const [creating, setCreating] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [form, setForm] =
    useState(EMPTY_RUN_FORM);

  const [search, setSearch] =
    useState("");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [editingItemId, setEditingItemId] =
    useState(null);

  const [editValues, setEditValues] =
    useState({});

  const pageSize = 10;

  /* =======================================================
     LOAD RUNS
  ======================================================= */

  const loadRuns = useCallback(
    async () => {
      try {
        setLoading(true);

        const response =
          await api.get(
            "/payroll-runs",
          );

        const data =
          normalizeResponse(
            response,
          );

        setRuns(
          Array.isArray(data)
            ? data
            : [],
        );
      } catch (error) {
        console.error(
          "Load payroll runs error:",
          error,
        );

        toast.error(
          error?.response?.data
            ?.message ||
            "Could not load payroll runs.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* =======================================================
     LOAD SINGLE RUN
  ======================================================= */

  const loadRun = useCallback(
    async (runId) => {
      if (!runId) {
        return;
      }

      try {
        setLoadingRun(true);

        const response =
          await api.get(
            `/payroll-runs/${runId}`,
          );

        const data =
          normalizeResponse(
            response,
          );

        setSelectedRun(
          data,
        );
      } catch (error) {
        console.error(
          "Load payroll run error:",
          error,
        );

        toast.error(
          error?.response?.data
            ?.message ||
            "Could not load payroll run.",
        );
      } finally {
        setLoadingRun(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  /* =======================================================
     CREATE RUN
  ======================================================= */

  async function handleCreateRun(event) {
    event.preventDefault();

    if (!form.payrollMonth) {
      toast.error(
        "Select a payroll month.",
      );

      return;
    }

    try {
      setCreating(true);

      const response =
        await api.post(
          "/payroll-runs",
          {
            payrollMonth:
              form.payrollMonth,

            notes:
              form.notes.trim() ||
              null,
          },
        );

      const run =
        normalizeResponse(
          response,
        );

      toast.success(
        "Payroll run created successfully.",
      );

      setShowCreateModal(
        false,
      );

      setForm(
        EMPTY_RUN_FORM,
      );

      await loadRuns();

      if (run?.id) {
        await loadRun(
          run.id,
        );
      }
    } catch (error) {
      console.error(
        "Create payroll run error:",
        error,
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Could not create payroll run.",
      );
    } finally {
      setCreating(false);
    }
  }

  /* =======================================================
     RUN ACTION
  ======================================================= */

  async function handleRunAction(
    action,
    successMessage,
  ) {
    if (!selectedRun?.id) {
      return;
    }

    try {
      setActionLoading(
        action,
      );

      const response =
        await api.post(
          `/payroll-runs/${selectedRun.id}/${action}`,
        );

      const updatedRun =
        normalizeResponse(
          response,
        );

      toast.success(
        successMessage,
      );

      setSelectedRun(
        updatedRun,
      );

      await loadRuns();
    } catch (error) {
      console.error(
        `Payroll ${action} error:`,
        error,
      );

      toast.error(
        error?.response?.data
          ?.message ||
          `Could not ${action} payroll.`,
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     DELETE RUN
  ======================================================= */

  async function handleDeleteRun() {
    if (!selectedRun?.id) {
      return;
    }

    const confirmed =
      window.confirm(
        "Delete this payroll run? This action cannot be undone.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(
        "delete",
      );

      await api.delete(
        `/payroll-runs/${selectedRun.id}`,
      );

      toast.success(
        "Payroll run deleted.",
      );

      setSelectedRun(
        null,
      );

      await loadRuns();
    } catch (error) {
      console.error(
        "Delete payroll run error:",
        error,
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Could not delete payroll run.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     EDIT ITEM
  ======================================================= */

  function startEditing(item) {
    setEditingItemId(
      item.id,
    );

    setEditValues({
      allowances:
        item.allowances ??
        0,

      overtime_hours:
        item.overtime_hours ??
        0,

      overtime_pay:
        item.overtime_pay ??
        0,

      bonus:
        item.bonus ??
        0,

      reimbursements:
        item.reimbursements ??
        0,

      fixed_deductions:
        item.fixed_deductions ??
        0,

      statutory_deductions:
        item.statutory_deductions ??
        0,

      other_deductions:
        item.other_deductions ??
        0,

      working_days:
        item.working_days ??
        0,

      paid_days:
        item.paid_days ??
        0,

      unpaid_days:
        item.unpaid_days ??
        0,
    });
  }

  function cancelEditing() {
    setEditingItemId(
      null,
    );

    setEditValues({});
  }

  async function saveItem(item) {
    if (
      !selectedRun?.id ||
      !item?.id
    ) {
      return;
    }

    try {
      setActionLoading(
        `item-${item.id}`,
      );

      const response =
        await api.patch(
          `/payroll-runs/${selectedRun.id}/items/${item.id}`,
          editValues,
        );

      const updatedItem =
        normalizeResponse(
          response,
        );

      setSelectedRun(
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,

            items:
              getItemsFromRun(
                previous,
              ).map(
                (existingItem) =>
                  existingItem.id ===
                  item.id
                    ? {
                        ...existingItem,
                        ...updatedItem,
                      }
                    : existingItem,
              ),
          };
        },
      );

      /*
       * Reload the complete run so totals
       * always come from the database.
       */

      await loadRun(
        selectedRun.id,
      );

      toast.success(
        "Payroll item updated.",
      );

      cancelEditing();
      await loadRuns();
    } catch (error) {
      console.error(
        "Update payroll item error:",
        error,
      );

      toast.error(
        error?.response?.data
          ?.message ||
          "Could not update payroll item.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     FILTERED RUNS
  ======================================================= */

  const filteredRuns =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return runs;
      }

      return runs.filter(
        (run) =>
          String(
            run?.payroll_month ||
              "",
          )
            .toLowerCase()
            .includes(query) ||
          String(
            run?.status || "",
          )
            .toLowerCase()
            .includes(query),
      );
    }, [
      runs,
      search,
    ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredRuns.length /
          pageSize,
      ),
    );

  const paginatedRuns =
    filteredRuns.slice(
      (currentPage - 1) *
        pageSize,
      currentPage *
        pageSize,
    );

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages,
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  /* =======================================================
     METRICS
  ======================================================= */

  const metrics =
    useMemo(() => {
      const processed =
        runs.filter(
          (run) =>
            run?.status ===
            "processed",
        ).length;

      const review =
        runs.filter(
          (run) =>
            run?.status ===
            "review",
        ).length;

      const totalNet =
        runs.reduce(
          (
            total,
            run,
          ) =>
            total +
            (Number(
              run?.net_pay,
            ) || 0),
          0,
        );

      return {
        total:
          runs.length,

        processed,

        review,

        totalNet,
      };
    }, [runs]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-ink-25">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* BACK */}

        <button
          type="button"
          onClick={() =>
            navigate(-1)
          }
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
        >
          <ArrowLeft
            size={16}
          />

          Back
        </button>

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
              <Wallet
                size={14}
              />

              Payroll Processing
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
              Payroll Run Engine
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-500">
              Calculate, review, approve,
              and process organization
              payroll runs using actual
              employee data.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowCreateModal(
                true,
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-800"
          >
            <Play
              size={16}
            />

            New Payroll Run
          </button>
        </div>

        {/* METRICS */}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={
              <FileText
                size={18}
              />
            }
            label="Payroll Runs"
            value={
              metrics.total
            }
          />

          <MetricCard
            icon={
              <Clock3
                size={18}
              />
            }
            label="Awaiting Review"
            value={
              metrics.review
            }
          />

          <MetricCard
            icon={
              <CheckCircle2
                size={18}
              />
            }
            label="Processed"
            value={
              metrics.processed
            }
          />

          <MetricCard
            icon={
              <Wallet
                size={18}
              />
            }
            label="Total Net Payroll"
            value={formatCurrency(
              metrics.totalNet,
            )}
          />
        </div>

        {/* CONTENT */}

        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">
          {/* RUN LIST */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            <div className="border-b border-ink-100 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-ink-900">
                    Payroll Runs
                  </h2>

                  <p className="mt-0.5 text-xs text-ink-500">
                    Select a run to review
                    employee-level payroll.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    loadRuns
                  }
                  disabled={
                    loading
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-600 transition hover:bg-ink-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={14}
                    className={
                      loading
                        ? "animate-spin"
                        : ""
                    }
                  />

                  Refresh
                </button>
              </div>

              <div className="relative mt-4">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />

                <input
                  value={search}
                  onChange={(
                    event,
                  ) => {
                    setSearch(
                      event.target
                        .value,
                    );

                    setCurrentPage(
                      1,
                    );
                  }}
                  placeholder="Search month or status..."
                  className="w-full rounded-xl border border-ink-200 bg-ink-25 py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-400 focus:bg-white"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2
                  size={24}
                  className="animate-spin text-ink-400"
                />
              </div>
            ) : paginatedRuns.length ===
              0 ? (
              <EmptyState />
            ) : (
              <>
                <div className="divide-y divide-ink-100">
                  {paginatedRuns.map(
                    (run) => {
                      const status =
                        getStatusMeta(
                          run.status,
                        );

                      const selected =
                        selectedRun?.id ===
                        run.id;

                      return (
                        <button
                          type="button"
                          key={
                            run.id
                          }
                          onClick={() =>
                            loadRun(
                              run.id,
                            )
                          }
                          className={`w-full px-4 py-4 text-left transition ${
                            selected
                              ? "bg-ink-50"
                              : "hover:bg-ink-25"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-ink-900">
                                {formatMonth(
                                  run.payroll_month,
                                )}
                              </p>

                              <p className="mt-1 text-xs text-ink-500">
                                {run.employee_count ??
                                  0}{" "}
                                employees
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                            >
                              {
                                status.label
                              }
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-ink-400">
                                Gross
                              </p>

                              <p className="mt-0.5 text-sm font-medium text-ink-800">
                                {formatCurrency(
                                  run.gross_pay,
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-ink-400">
                                Net
                              </p>

                              <p className="mt-0.5 text-sm font-semibold text-ink-900">
                                {formatCurrency(
                                  run.net_pay,
                                )}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>

                {totalPages >
                  1 && (
                  <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3">
                    <span className="text-xs text-ink-500">
                      Page{" "}
                      {
                        currentPage
                      }{" "}
                      of{" "}
                      {
                        totalPages
                      }
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={
                          currentPage ===
                          1
                        }
                        onClick={() =>
                          setCurrentPage(
                            (
                              page,
                            ) =>
                              page -
                              1,
                          )
                        }
                        className="rounded-lg border border-ink-200 p-1.5 text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                      >
                        <ChevronLeft
                          size={15}
                        />
                      </button>

                      <button
                        type="button"
                        disabled={
                          currentPage ===
                          totalPages
                        }
                        onClick={() =>
                          setCurrentPage(
                            (
                              page,
                            ) =>
                              page +
                              1,
                          )
                        }
                        className="rounded-lg border border-ink-200 p-1.5 text-ink-600 transition hover:bg-ink-50 disabled:opacity-40"
                      >
                        <ChevronRight
                          size={15}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          {/* RUN DETAIL */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            {!selectedRun ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
                  <Wallet
                    size={22}
                  />
                </div>

                <h2 className="font-semibold text-ink-900">
                  Select a payroll run
                </h2>

                <p className="mt-1 max-w-sm text-sm leading-6 text-ink-500">
                  Choose an existing payroll
                  run from the left or create a
                  new run to calculate employee
                  payroll.
                </p>
              </div>
            ) : loadingRun ? (
              <div className="flex min-h-[560px] items-center justify-center">
                <Loader2
                  size={24}
                  className="animate-spin text-ink-400"
                />
              </div>
            ) : (
              <PayrollDetail
                run={selectedRun}
                actionLoading={
                  actionLoading
                }
                editingItemId={
                  editingItemId
                }
                editValues={
                  editValues
                }
                setEditValues={
                  setEditValues
                }
                startEditing={
                  startEditing
                }
                cancelEditing={
                  cancelEditing
                }
                saveItem={
                  saveItem
                }
                onSubmitReview={() =>
                  handleRunAction(
                    "submit",
                    "Payroll submitted for review.",
                  )
                }
                onReturnDraft={() =>
                  handleRunAction(
                    "draft",
                    "Payroll returned to draft.",
                  )
                }
                onApprove={() =>
                  handleRunAction(
                    "approve",
                    "Payroll approved successfully.",
                  )
                }
                onProcess={() =>
                  handleRunAction(
                    "process",
                    "Payroll processed successfully.",
                  )
                }
                onDelete={
                  handleDeleteRun
                }
              />
            )}
          </section>
        </div>
      </div>

      {/* CREATE MODAL */}

      {showCreateModal && (
        <CreatePayrollModal
          form={form}
          setForm={
            setForm
          }
          creating={
            creating
          }
          onClose={() =>
            setShowCreateModal(
              false,
            )
          }
          onSubmit={
            handleCreateRun
          }
        />
      )}
    </div>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-500">
            {label}
          </p>

          <p className="mt-0.5 truncate text-lg font-semibold text-ink-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState() {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink-100 text-ink-500">
        <FileText
          size={20}
        />
      </div>

      <p className="font-semibold text-ink-800">
        No payroll runs yet
      </p>

      <p className="mt-1 max-w-xs text-xs leading-5 text-ink-500">
        Create your first payroll run to
        calculate employee payroll for a
        specific month.
      </p>
    </div>
  );
}

/* =========================================================
   PAYROLL DETAIL
========================================================= */

function PayrollDetail({
  run,
  actionLoading,
  editingItemId,
  editValues,
  setEditValues,
  startEditing,
  cancelEditing,
  saveItem,
  onSubmitReview,
  onReturnDraft,
  onApprove,
  onProcess,
  onDelete,
}) {
  const items =
    getItemsFromRun(
      run,
    );

  const status =
    getStatusMeta(
      run.status,
    );

  const validationErrors =
    items.filter(
      (item) =>
        item.validation_status ===
        "error",
    ).length;

  const validationWarnings =
    items.filter(
      (item) =>
        item.validation_status ===
        "warning",
    ).length;

  const canEdit =
    run.status ===
      "draft" ||
    run.status ===
      "review";

  return (
    <div className="min-w-0">
      {/* DETAIL HEADER */}

      <div className="border-b border-ink-100 p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-ink-950">
                {formatMonth(
                  run.payroll_month,
                )}
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
              >
                {
                  status.label
                }
              </span>
            </div>

            <p className="mt-1 text-xs text-ink-500">
              Created{" "}
              {formatDateTime(
                run.created_at,
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {run.status ===
              "draft" && (
              <button
                type="button"
                onClick={
                  onSubmitReview
                }
                disabled={
                  !!actionLoading
                }
                className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
              >
                {actionLoading ===
                "submit" ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2
                    size={14}
                  />
                )}

                Submit Review
              </button>
            )}

            {run.status ===
              "review" && (
              <>
                <button
                  type="button"
                  onClick={
                    onReturnDraft
                  }
                  disabled={
                    !!actionLoading
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
                >
                  {actionLoading ===
                  "draft" ? (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw
                      size={14}
                    />
                  )}

                  Return to Draft
                </button>

                <button
                  type="button"
                  onClick={
                    onApprove
                  }
                  disabled={
                    !!actionLoading ||
                    validationErrors >
                      0
                  }
                  title={
                    validationErrors >
                    0
                      ? "Resolve payroll validation errors before approval."
                      : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {actionLoading ===
                  "approve" ? (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  ) : (
                    <CheckCircle2
                      size={14}
                    />
                  )}

                  Approve
                </button>
              </>
            )}

            {run.status ===
              "approved" && (
              <button
                type="button"
                onClick={
                  onProcess
                }
                disabled={
                  !!actionLoading
                }
                className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
              >
                {actionLoading ===
                "process" ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <Play
                    size={14}
                  />
                )}

                Process Payroll
              </button>
            )}

            {run.status !==
              "processed" && (
              <button
                type="button"
                onClick={
                  onDelete
                }
                disabled={
                  !!actionLoading
                }
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {actionLoading ===
                "delete" ? (
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
            )}
          </div>
        </div>

        {/* SUMMARY */}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard
            label="Employees"
            value={
              run.employee_count ??
              items.length
            }
            icon={
              <Users
                size={16}
              />
            }
          />

          <SummaryCard
            label="Gross Pay"
            value={formatCurrency(
              run.gross_pay,
            )}
          />

          <SummaryCard
            label="Deductions"
            value={formatCurrency(
              run.total_deductions,
            )}
          />

          <SummaryCard
            label="Net Pay"
            value={formatCurrency(
              run.net_pay,
            )}
          />
        </div>

        {/* VALIDATION */}

        {(validationErrors >
          0 ||
          validationWarnings >
            0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {validationErrors >
              0 && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                <CircleAlert
                  size={14}
                />

                {
                  validationErrors
                }{" "}
                validation error
                {validationErrors !==
                1
                  ? "s"
                  : ""}
              </div>
            )}

            {validationWarnings >
              0 && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                <CircleAlert
                  size={14}
                />

                {
                  validationWarnings
                }{" "}
                warning
                {validationWarnings !==
                1
                  ? "s"
                  : ""}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EMPLOYEE TABLE */}

      <div className="min-w-0 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink-900">
              Employee Payroll
            </h3>

            <p className="mt-0.5 text-xs text-ink-500">
              Review individual payroll
              calculations and adjustments.
            </p>
          </div>

          {!canEdit && (
            <span className="text-xs text-ink-400">
              Locked after processing
            </span>
          )}
        </div>

        {items.length ===
        0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 p-8 text-center">
            <p className="text-sm font-medium text-ink-700">
              No payroll items found.
            </p>
          </div>
        ) : (
          <div className="min-w-0 overflow-hidden rounded-xl border border-ink-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-ink-200 bg-ink-50">
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Employee
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Days
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Base
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Allowances
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Overtime
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Bonus
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Deductions
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Reimbursements
                    </th>

                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                      Net Pay
                    </th>

                    {canEdit && (
                      <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (item) => {
                      const isEditing =
                        editingItemId ===
                        item.id;

                      const validation =
                        item.validation_status;

                      return (
                        <React.Fragment
                          key={
                            item.id
                          }
                        >
                          <tr className="border-b border-ink-100 align-top last:border-b-0">
                            <td className="px-3 py-3">
                              <div className="min-w-[170px]">
                                <p className="font-medium text-ink-900">
                                  {getEmployeeName(
                                    item,
                                  )}
                                </p>

                                <p className="mt-0.5 text-[11px] text-ink-500">
                                  {getEmployeeCode(
                                    item,
                                  )}
                                </p>

                                {validation !==
                                  "valid" && (
                                  <div
                                    className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold ${
                                      validation ===
                                      "error"
                                        ? "bg-red-50 text-red-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}
                                  >
                                    <CircleAlert
                                      size={
                                        11
                                      }
                                    />

                                    {
                                      validation
                                    }
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              <div>
                                <span className="font-medium">
                                  {
                                    item.paid_days
                                  }
                                </span>
                                <span className="text-ink-400">
                                  /
                                  {
                                    item.working_days
                                  }
                                </span>
                              </div>

                              <p className="mt-1 text-[10px] text-ink-400">
                                Unpaid:{" "}
                                {
                                  item.unpaid_days
                                }
                              </p>
                            </td>

                            <td className="px-3 py-3 text-xs font-medium text-ink-800">
                              {formatCurrency(
                                item.base_salary,
                              )}
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              {formatCurrency(
                                item.allowances,
                              )}
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              <div>
                                {formatCurrency(
                                  item.overtime_pay,
                                )}
                              </div>

                              <p className="mt-1 text-[10px] text-ink-400">
                                {
                                  item.overtime_hours
                                }{" "}
                                hrs
                              </p>
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              {formatCurrency(
                                item.bonus,
                              )}
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              {formatCurrency(
                                item.total_deductions,
                              )}
                            </td>

                            <td className="px-3 py-3 text-xs text-ink-700">
                              {formatCurrency(
                                item.reimbursements,
                              )}
                            </td>

                            <td className="px-3 py-3 text-sm font-semibold text-ink-950">
                              {formatCurrency(
                                item.net_pay,
                              )}
                            </td>

                            {canEdit && (
                              <td className="px-3 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isEditing
                                      ? cancelEditing()
                                      : startEditing(
                                          item,
                                        )
                                  }
                                  className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-[11px] font-semibold text-ink-700 transition hover:bg-ink-50"
                                >
                                  {isEditing
                                    ? "Cancel"
                                    : "Edit"}
                                </button>
                              </td>
                            )}
                          </tr>

                          {isEditing && (
                            <tr className="border-b border-ink-100 bg-ink-25">
                              <td
                                colSpan={
                                  canEdit
                                    ? 10
                                    : 9
                                }
                                className="px-3 py-4"
                              >
                                <EditPayrollItem
                                  values={
                                    editValues
                                  }
                                  setValues={
                                    setEditValues
                                  }
                                  saving={
                                    actionLoading ===
                                    `item-${item.id}`
                                  }
                                  onCancel={
                                    cancelEditing
                                  }
                                  onSave={() =>
                                    saveItem(
                                      item,
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          )}

                          {validation !==
                            "valid" &&
                            getValidationMessage(
                              item,
                            ) && (
                              <tr className="border-b border-ink-100 last:border-b-0">
                                <td
                                  colSpan={
                                    canEdit
                                      ? 10
                                      : 9
                                  }
                                  className="bg-amber-50/50 px-3 py-2.5"
                                >
                                  <p className="text-[11px] text-ink-600">
                                    <span className="font-semibold">
                                      Validation:
                                    </span>{" "}
                                    {getValidationMessage(
                                      item,
                                    )}
                                  </p>
                                </td>
                              </tr>
                            )}
                        </React.Fragment>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-25 p-3">
      <div className="flex items-center gap-2 text-ink-400">
        {icon}

        <p className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </p>
      </div>

      <p className="mt-1.5 truncate text-sm font-semibold text-ink-900">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   EDIT PAYROLL ITEM
========================================================= */

function EditPayrollItem({
  values,
  setValues,
  saving,
  onCancel,
  onSave,
}) {
  function updateField(
    field,
    value,
  ) {
    setValues(
      (previous) => ({
        ...previous,
        [field]: value,
      }),
    );
  }

  const fields = [
    {
      key: "working_days",
      label: "Working Days",
    },
    {
      key: "paid_days",
      label: "Paid Days",
    },
    {
      key: "unpaid_days",
      label: "Unpaid Days",
    },
    {
      key: "overtime_hours",
      label: "Overtime Hours",
    },
    {
      key: "allowances",
      label: "Allowances",
    },
    {
      key: "overtime_pay",
      label: "Overtime Pay",
    },
    {
      key: "bonus",
      label: "Bonus",
    },
    {
      key: "reimbursements",
      label: "Reimbursements",
    },
    {
      key: "fixed_deductions",
      label: "Fixed Deductions",
    },
    {
      key: "statutory_deductions",
      label: "Statutory Deductions",
    },
    {
      key: "other_deductions",
      label: "Other Deductions",
    },
  ];

  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-semibold text-ink-800">
          Adjust payroll inputs
        </p>

        <p className="mt-0.5 text-[11px] text-ink-500">
          Gross pay, deductions, and net pay
          will be recalculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {fields.map(
          (field) => (
            <label
              key={
                field.key
              }
              className="block"
            >
              <span className="mb-1 block text-[10px] font-medium text-ink-500">
                {
                  field.label
                }
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  values[
                    field.key
                  ] ?? 0
                }
                onChange={(
                  event,
                ) =>
                  updateField(
                    field.key,
                    event.target
                      .value,
                  )
                }
                className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs text-ink-900 outline-none focus:border-ink-400"
              />
            </label>
          ),
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={
            onCancel
          }
          disabled={
            saving
          }
          className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-white disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={
            onSave
          }
          disabled={
            saving
          }
          className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {saving && (
            <Loader2
              size={13}
              className="animate-spin"
            />
          )}

          Save Changes
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   CREATE MODAL
========================================================= */

function CreatePayrollModal({
  form,
  setForm,
  creating,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-ink-950">
              New Payroll Run
            </h2>

            <p className="mt-1 text-xs leading-5 text-ink-500">
              Select the payroll month. The engine
              will load active employees and
              calculate their payroll.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-50 hover:text-ink-700"
          >
            <X
              size={18}
            />
          </button>
        </div>

        <form
          onSubmit={
            onSubmit
          }
          className="p-5"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-700">
              Payroll Month
            </span>

            <input
              type="month"
              value={
                form.payrollMonth
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    previous,
                  ) => ({
                    ...previous,
                    payrollMonth:
                      event
                        .target
                        .value,
                  }),
                )
              }
              required
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-ink-700">
              Notes
              <span className="ml-1 font-normal text-ink-400">
                Optional
              </span>
            </span>

            <textarea
              value={
                form.notes
              }
              onChange={(
                event,
              ) =>
                setForm(
                  (
                    previous,
                  ) => ({
                    ...previous,
                    notes:
                      event
                        .target
                        .value,
                  }),
                )
              }
              rows={4}
              placeholder="Add an internal note for this payroll run..."
              className="w-full resize-none rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-ink-400"
            />
          </label>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                creating
              }
              className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                creating
              }
              className="inline-flex items-center gap-2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:opacity-50"
            >
              {creating ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <Play
                  size={16}
                />
              )}

              {creating
                ? "Calculating..."
                : "Create & Calculate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}