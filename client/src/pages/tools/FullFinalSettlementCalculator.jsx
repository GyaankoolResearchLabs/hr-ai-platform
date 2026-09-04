import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../../services/api.js";

const CURRENCY_SYMBOLS = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const STATUS_META = {
  draft: {
    label: "Draft",
    className:
      "bg-slate-100 text-slate-700 border-slate-200",
  },
  calculated: {
    label: "Calculated",
    className:
      "bg-blue-50 text-blue-700 border-blue-200",
  },
  under_review: {
    label: "Under Review",
    className:
      "bg-amber-50 text-amber-700 border-amber-200",
  },
  approved: {
    label: "Approved",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  processed: {
    label: "Processed",
    className:
      "bg-green-50 text-green-700 border-green-200",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-red-50 text-red-700 border-red-200",
  },
};

function formatCurrency(
  value,
  currency = "INR",
) {
  const numericValue = Number(value || 0);

  const symbol =
    CURRENCY_SYMBOLS[currency] ||
    currency;

  return `${symbol}${numericValue.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function formatNumber(value) {
  return Number(
    value || 0,
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    },
  );
}

function getErrorMessage(
  error,
  fallback,
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function getApiData(response) {
  return response?.data || {};
}

function getEmployeeName(
  employee,
) {
  return (
    employee?.fullName ||
    employee?.full_name ||
    employee?.name ||
    "Employee"
  );
}

function getEmployeeCode(
  employee,
) {
  return (
    employee?.employeeCode ||
    employee?.employee_code ||
    "—"
  );
}

function getEmployeeDepartment(
  employee,
) {
  return (
    employee?.department ||
    employee?.department_name ||
    "—"
  );
}

function getEmployeeTitle(
  employee,
) {
  return (
    employee?.title ||
    employee?.job_title ||
    employee?.designation ||
    "—"
  );
}

function getEmployeeLocation(
  employee,
) {
  return (
    employee?.location ||
    employee?.office_location ||
    employee?.work_location ||
    employee?.city ||
    "—"
  );
}

function getSettlementStatus(
  settlement,
) {
  return (
    settlement?.settlement_status ||
    settlement?.status ||
    "draft"
  );
}

function getSettlementAmount(
  settlement,
) {
  return Number(
    settlement?.final_settlement_amount ||
      settlement?.finalSettlementAmount ||
      0,
  );
}

function StatusBadge({
  status,
}) {
  const meta =
    STATUS_META[status] ||
    {
      label: status || "Unknown",
      className:
        "bg-slate-100 text-slate-700 border-slate-200",
    };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={18} />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  emphasis = false,
}) {
  return (
    <div
      className={`min-h-[132px] rounded-xl border p-4 transition ${
        emphasis
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em] leading-4 ${
              emphasis
                ? "text-slate-300"
                : "text-slate-500"
            }`}
          >
            {label}
          </p>

          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              emphasis
                ? "bg-white/10 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <Icon size={16} />
          </div>
        </div>

        <div className="min-w-0">
          <p
            className={`truncate text-xl font-semibold tracking-tight ${
              emphasis
                ? "text-white"
                : "text-slate-900"
            }`}
          >
            {value}
          </p>

          {description && (
            <p
              className={`mt-1 truncate text-[11px] leading-4 ${
                emphasis
                  ? "text-slate-300"
                  : "text-slate-500"
              }`}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
function EmptyState({
  title,
  description,
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
        <FileText size={20} />
      </div>

      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
        {description}
      </p>
    </div>
  );
}

export default function FullFinalSettlementCalculator() {
  const navigate =
    useNavigate();

  const [employees, setEmployees] =
    useState([]);

  const [settlements, setSettlements] =
    useState([]);

  const [summary, setSummary] =
    useState(null);

  const [selectedEmployeeId, setSelectedEmployeeId] =
    useState("");

  const [selectedSettlementId, setSelectedSettlementId] =
    useState("");

  const [selectedSettlement, setSelectedSettlement] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [showPaymentModal, setShowPaymentModal] =
    useState(false);

  const [paymentReference, setPaymentReference] =
    useState("");

  const [error, setError] =
    useState("");

  const [employeeSearch, setEmployeeSearch] =
    useState("");

  const [showCreatePanel, setShowCreatePanel] =
    useState(true);

  const [showSettlementList, setShowSettlementList] =
    useState(true);

  const [form, setForm] =
    useState({
      lastWorkingDate: "",
      resignationDate: "",
      payableDays: "",
      leaveEncashmentDays: "",
      noticePeriodDays: "",
      noticeServedDays: "",
      bonusAmount: "",
      incentivesAmount: "",
      otherEarnings: "",
      pendingReimbursements: "",
      outstandingDeductions: "",
      assetRecoveryAmount: "",
      otherDeductions: "",
      notes: "",
    });

  const currency =
    selectedSettlement?.currency_code ||
    preview?.calculation?.currencyCode ||
    "INR";

  const loadEmployees =
    useCallback(
      async () => {
        const response =
          await api.get(
            "/fnf-settlements/employees",
          );

        return (
          getApiData(
            response,
          )?.employees || []
        );
      },
      [],
    );

  const loadSettlements =
    useCallback(
      async () => {
        const response =
          await api.get(
            "/fnf-settlements",
          );

        return (
          getApiData(
            response,
          )?.settlements || []
        );
      },
      [],
    );

  const loadSummary =
    useCallback(
      async () => {
        const response =
          await api.get(
            "/fnf-settlements/summary",
          );

        return (
          getApiData(
            response,
          )?.summary || null
        );
      },
      [],
    );

  const loadInitialData =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            employeeData,
            settlementData,
            summaryData,
          ] =
            await Promise.all([
              loadEmployees(),
              loadSettlements(),
              loadSummary(),
            ]);

          setEmployees(
            employeeData,
          );

          setSettlements(
            settlementData,
          );

          setSummary(
            summaryData,
          );

          if (
            settlementData.length
          ) {
            const latest =
              settlementData[0];

            setSelectedSettlementId(
              latest.id,
            );
          }
        } catch (requestError) {
          const message =
            getErrorMessage(
              requestError,
              "Could not load Full & Final Settlement data.",
            );

          setError(message);

          toast.error(
            message,
          );
        } finally {
          setLoading(false);
        }
      },
      [
        loadEmployees,
        loadSettlements,
        loadSummary,
      ],
    );

  const loadSettlement =
    useCallback(
      async (
        settlementId,
      ) => {
        if (!settlementId) {
          setSelectedSettlement(
            null,
          );

          return;
        }

        try {
          const response =
            await api.get(
              `/fnf-settlements/${settlementId}`,
            );

          const settlement =
            getApiData(
              response,
            )?.settlement ||
            null;

          setSelectedSettlement(
            settlement,
          );
        } catch (requestError) {
          const message =
            getErrorMessage(
              requestError,
              "Could not load settlement.",
            );

          toast.error(
            message,
          );
        }
      },
      [],
    );

  useEffect(() => {
    loadInitialData();
  }, [
    loadInitialData,
  ]);

  useEffect(() => {
    if (
      selectedSettlementId
    ) {
      loadSettlement(
        selectedSettlementId,
      );
    } else {
      setSelectedSettlement(
        null,
      );
    }
  }, [
    selectedSettlementId,
    loadSettlement,
  ]);

  const selectedEmployee =
    useMemo(
      () =>
        employees.find(
          (employee) =>
            employee.id ===
            selectedEmployeeId,
        ) || null,
      [
        employees,
        selectedEmployeeId,
      ],
    );

  const filteredEmployees =
    useMemo(() => {
      const search =
        employeeSearch
          .trim()
          .toLowerCase();

      if (!search) {
        return employees;
      }

      return employees.filter(
        (employee) => {
          const values = [
            getEmployeeName(
              employee,
            ),
            getEmployeeCode(
              employee,
            ),
            getEmployeeDepartment(
              employee,
            ),
            getEmployeeTitle(
              employee,
            ),
            getEmployeeLocation(
              employee,
            ),
            employee.email,
          ];

          return values.some(
            (value) =>
              String(
                value || "",
              )
                .toLowerCase()
                .includes(search),
          );
        },
      );
    }, [
      employees,
      employeeSearch,
    ]);

  const handleEmployeeChange =
    (employeeId) => {
      setSelectedEmployeeId(
        employeeId,
      );

      setPreview(
        null,
      );

      const employee =
        employees.find(
          (item) =>
            item.id ===
            employeeId,
        );

      setForm(
        (current) => ({
          ...current,

          resignationDate:
            employee?.resignationDate ||
            "",

          lastWorkingDate:
            employee?.lastWorkingDate ||
            "",
        }),
      );
    };

  const handleFormChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;

      setForm(
        (current) => ({
          ...current,
          [name]: value,
        }),
      );
    };

  const buildPayload =
    () => {
      const payload = {
        employeeId:
          selectedEmployeeId,

        lastWorkingDate:
          form.lastWorkingDate,

        resignationDate:
          form.resignationDate ||
          undefined,

        notes:
          form.notes ||
          undefined,
      };

      const numericFields = [
        "payableDays",
        "leaveEncashmentDays",
        "noticePeriodDays",
        "noticeServedDays",
        "bonusAmount",
        "incentivesAmount",
        "otherEarnings",
        "pendingReimbursements",
        "outstandingDeductions",
        "assetRecoveryAmount",
        "otherDeductions",
      ];

      numericFields.forEach(
        (field) => {
          if (
            form[field] !==
              "" &&
            form[field] !==
              null &&
            form[field] !==
              undefined
          ) {
            payload[field] =
              Number(
                form[field],
              );
          }
        },
      );

      return payload;
    };

  const handlePreview =
    async () => {
      if (
        !selectedEmployeeId
      ) {
        toast.error(
          "Select an employee first.",
        );

        return;
      }

      if (
        !form.lastWorkingDate
      ) {
        toast.error(
          "Last working date is required.",
        );

        return;
      }

      setPreviewLoading(
        true,
      );

      try {
        const response =
          await api.post(
            "/fnf-settlements/preview",
            buildPayload(),
          );

        const data =
          getApiData(
            response,
          )?.preview || null;

        setPreview(
          data,
        );

        toast.success(
          "Settlement preview calculated.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not calculate settlement preview.",
          );

        toast.error(
          message,
        );
      } finally {
        setPreviewLoading(
          false,
        );
      }
    };

  const handleCreate =
    async () => {
      if (
        !selectedEmployeeId
      ) {
        toast.error(
          "Select an employee first.",
        );

        return;
      }

      if (
        !form.lastWorkingDate
      ) {
        toast.error(
          "Last working date is required.",
        );

        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            "/fnf-settlements",
            buildPayload(),
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        if (!settlement) {
          throw new Error(
            "Settlement was not returned by the server.",
          );
        }

        setSelectedSettlementId(
          settlement.id,
        );

        setSelectedSettlement(
          settlement,
        );

        setPreview(
          null,
        );

        setShowCreatePanel(
          false,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        toast.success(
          `${settlement.settlement_number} created successfully.`,
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not create settlement.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleRecalculate =
    async () => {
      if (
        !selectedSettlementId
      ) {
        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            `/fnf-settlements/${selectedSettlementId}/recalculate`,
            {
              ...buildPayload(),
              employeeId:
                selectedSettlement?.employee_id ||
                selectedEmployeeId,
            },
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        setSelectedSettlement(
          settlement,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        toast.success(
          "Settlement recalculated successfully.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not recalculate settlement.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleSubmit =
    async () => {
      if (
        !selectedSettlementId
      ) {
        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            `/fnf-settlements/${selectedSettlementId}/submit`,
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        setSelectedSettlement(
          settlement,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        toast.success(
          "Settlement submitted for review.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not submit settlement for review.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleApprove =
    async () => {
      if (
        !selectedSettlementId
      ) {
        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            `/fnf-settlements/${selectedSettlementId}/approve`,
            {
              notes:
                selectedSettlement?.notes ||
                undefined,
            },
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        setSelectedSettlement(
          settlement,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        toast.success(
          "Settlement approved successfully.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not approve settlement.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleProcess =
    () => {
      if (
        !selectedSettlementId ||
        !selectedSettlement
      ) {
        return;
      }

      setPaymentReference(
        selectedSettlement?.payment_reference ||
          "",
      );
      setShowPaymentModal(true);
    };

  const handleConfirmPayment =
    async () => {
      if (
        !selectedSettlementId
      ) {
        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            `/fnf-settlements/${selectedSettlementId}/process`,
            {
              paymentReference:
                paymentReference.trim() ||
                undefined,
            },
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        setSelectedSettlement(
          settlement,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        setShowPaymentModal(
          false,
        );
        setPaymentReference(
          "",
        );

        toast.success(
          "Settlement marked as processed.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not process settlement.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleCancel =
    async () => {
      if (
        !selectedSettlementId
      ) {
        return;
      }

      const reason =
        window.prompt(
          "Enter cancellation reason:",
        );

      if (
        reason ===
          null ||
        !reason.trim()
      ) {
        return;
      }

      setActionLoading(
        true,
      );

      try {
        const response =
          await api.post(
            `/fnf-settlements/${selectedSettlementId}/cancel`,
            {
              reason:
                reason.trim(),
            },
          );

        const settlement =
          getApiData(
            response,
          )?.settlement;

        setSelectedSettlement(
          settlement,
        );

        const [
          settlementData,
          summaryData,
        ] =
          await Promise.all([
            loadSettlements(),
            loadSummary(),
          ]);

        setSettlements(
          settlementData,
        );

        setSummary(
          summaryData,
        );

        toast.success(
          "Settlement cancelled.",
        );
      } catch (requestError) {
        const message =
          getErrorMessage(
            requestError,
            "Could not cancel settlement.",
          );

        toast.error(
          message,
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  const handleRefresh =
    async () => {
      await loadInitialData();

      if (
        selectedSettlementId
      ) {
        await loadSettlement(
          selectedSettlementId,
        );
      }

      toast.success(
        "Settlement data refreshed.",
      );
    };

  const renderSettlementActions =
    () => {
      if (
        !selectedSettlement
      ) {
        return null;
      }

      const status =
        getSettlementStatus(
          selectedSettlement,
        );

      return (
        <div className="flex flex-wrap items-center gap-2">
          {[
            "draft",
            "calculated",
          ].includes(status) && (
            <>
              <button
                type="button"
                onClick={
                  handleRecalculate
                }
                disabled={
                  actionLoading
                }
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw
                  size={14}
                  className={
                    actionLoading
                      ? "animate-spin"
                      : ""
                  }
                />
                Recalculate
              </button>

              <button
                type="button"
                onClick={
                  handleSubmit
                }
                disabled={
                  actionLoading
                }
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FileCheck2
                  size={14}
                />
                Submit for Review
              </button>
            </>
          )}

          {status ===
            "under_review" && (
            <button
              type="button"
              onClick={
                handleApprove
              }
              disabled={
                actionLoading
              }
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2
                size={14}
              />
              Approve
            </button>
          )}

          {status ===
            "approved" && (
            <button
              type="button"
              onClick={
                handleProcess
              }
              disabled={
                actionLoading
              }
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard
                size={14}
              />
              Process Payment
            </button>
          )}

          {[
            "draft",
            "calculated",
            "under_review",
            "approved",
          ].includes(status) && (
            <button
              type="button"
              onClick={
                handleCancel
              }
              disabled={
                actionLoading
              }
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle
                size={14}
              />
              Cancel
            </button>
          )}
        </div>
      );
    };

  const renderPreview =
    () => {
      if (!preview) {
        return (
          <EmptyState
            title="No calculation preview yet"
            description="Select an employee, enter the last working date, and calculate a preview. The calculation uses the actual payroll, statutory deduction, reimbursement, employee, and available leave data."
          />
        );
      }

      const totals =
        preview.totals ||
        {};

      const items =
        preview.items ||
        [];

      return (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Monthly Gross"
              value={formatCurrency(
                totals.monthlyGrossSalary,
                currency,
              )}
              description="Latest payroll salary basis"
              icon={
                CreditCard
              }
            />

            <MetricCard
              label="Payable Salary"
              value={formatCurrency(
                totals.salaryForPayableDays,
                currency,
              )}
              description={`${formatNumber(
                totals.payableDays,
              )} payable day(s)`}
              icon={
                Clock3
              }
            />

            <MetricCard
              label="Total Earnings"
              value={formatCurrency(
                totals.totalEarnings,
                currency,
              )}
              description="All settlement earnings"
              icon={
                CheckCircle2
              }
            />

            <MetricCard
              label="Final Settlement"
              value={formatCurrency(
                totals.finalSettlementAmount,
                currency,
              )}
              description="Net amount payable"
              icon={
                Calculator
              }
              emphasis
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  CheckCircle2
                }
                title="Earnings"
                description="Amounts added to the final settlement."
              />

              <div className="mt-4 space-y-3">
                {items.filter(
                  (item) =>
                    item.item_type ===
                    "earning",
                ).length ===
                  0 ? (
                  <p className="text-xs text-slate-500">
                    No additional earnings.
                  </p>
                ) : (
                  items
                    .filter(
                      (item) =>
                        item.item_type ===
                        "earning",
                    )
                    .map(
                      (item) => (
                        <div
                          key={
                            `${item.category}-${item.item_name}`
                          }
                          className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {
                                item.item_name
                              }
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {
                                item.description
                              }
                            </p>
                          </div>

                          <p className="shrink-0 text-sm font-semibold text-emerald-700">
                            +
                            {formatCurrency(
                              item.amount,
                              currency,
                            )}
                          </p>
                        </div>
                      ),
                    )
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  CircleAlert
                }
                title="Deductions"
                description="Amounts deducted from the final settlement."
              />

              <div className="mt-4 space-y-3">
                {items.filter(
                  (item) =>
                    item.item_type ===
                    "deduction",
                ).length ===
                  0 ? (
                  <p className="text-xs text-slate-500">
                    No deductions.
                  </p>
                ) : (
                  items
                    .filter(
                      (item) =>
                        item.item_type ===
                        "deduction",
                    )
                    .map(
                      (item) => (
                        <div
                          key={
                            `${item.category}-${item.item_name}`
                          }
                          className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {
                                item.item_name
                              }
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {
                                item.description
                              }
                            </p>
                          </div>

                          <p className="shrink-0 text-sm font-semibold text-red-600">
                            -
                            {formatCurrency(
                              item.amount,
                              currency,
                            )}
                          </p>
                        </div>
                      ),
                    )
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">
                  Leave Encashment
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    totals.leaveEncashmentAmount,
                    currency,
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Notice Recovery
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    totals.noticeRecoveryAmount,
                    currency,
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Reimbursements
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    totals.pendingReimbursements,
                    currency,
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Total Deductions
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(
                    totals.totalDeductions,
                    currency,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    };

  const renderSelectedSettlement =
    () => {
      if (
        !selectedSettlement
      ) {
        return (
          <EmptyState
            title="Select a settlement"
            description="Choose an existing settlement from the list to review its calculation, audit history, and processing status."
          />
        );
      }

      const employee =
        selectedSettlement.employee ||
        selectedSettlement.employee_snapshot ||
        {};

      const status =
        getSettlementStatus(
          selectedSettlement,
        );

      const totalEarnings =
        Number(
          selectedSettlement.total_earnings ||
            0,
        );

      const totalDeductions =
        Number(
          selectedSettlement.total_deductions ||
            0,
        );

      const finalAmount =
        getSettlementAmount(
          selectedSettlement,
        );

      return (
        <div className="space-y-5">
          <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                <FileText
                  size={19}
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">
                    {
                      selectedSettlement.settlement_number
                    }
                  </h2>

                  <StatusBadge
                    status={
                      status
                    }
                  />
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Created{" "}
                  {formatDate(
                    selectedSettlement.created_at,
                  )}
                </p>
              </div>
            </div>

            {renderSettlementActions()}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Total Earnings"
              value={formatCurrency(
                totalEarnings,
                selectedSettlement.currency_code,
              )}
              icon={
                CheckCircle2
              }
            />

            <MetricCard
              label="Total Deductions"
              value={formatCurrency(
                totalDeductions,
                selectedSettlement.currency_code,
              )}
              icon={
                CircleAlert
              }
            />

            <MetricCard
              label="Final Settlement"
              value={formatCurrency(
                finalAmount,
                selectedSettlement.currency_code,
              )}
              icon={
                Calculator
              }
              emphasis
            />

            <MetricCard
              label="Last Working Day"
              value={formatDate(
                selectedSettlement.last_working_date,
              )}
              description={
                selectedSettlement.employee_snapshot
                  ?.fullName ||
                getEmployeeName(
                  employee,
                )
              }
              icon={
                Clock3
              }
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  UserRound
                }
                title="Employee"
                description="Employee snapshot captured at settlement calculation."
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">
                    Name
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      employee.fullName ||
                      employee.full_name ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Employee Code
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      employee.employeeCode ||
                      employee.employee_code ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Department
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      employee.department ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Role
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      employee.title ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Location
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      employee.location ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Email
                  </p>

                  <p className="mt-1 break-all text-sm font-medium text-slate-900">
                    {
                      employee.email ||
                      "—"
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  CreditCard
                }
                title="Payroll Snapshot"
                description="Actual payroll information used by the settlement."
              />

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">
                    Payroll Month
                  </p>

                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {
                      selectedSettlement
                        .payroll_snapshot
                        ?.payrollMonth ||
                      "—"
                    }
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Payroll Status
                  </p>

                  <p className="mt-1 text-sm font-medium capitalize text-slate-900">
                    {String(
                      selectedSettlement
                        .payroll_snapshot
                        ?.payrollStatus ||
                        "—",
                    ).replace(
                      /_/g,
                      " ",
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Monthly Gross
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      selectedSettlement
                        .monthly_gross_salary,
                      selectedSettlement.currency_code,
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Daily Salary
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(
                      selectedSettlement
                        .daily_salary,
                      selectedSettlement.currency_code,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader
              icon={
                Calculator
              }
              title="Settlement Breakdown"
              description="Auditable earnings and deductions captured for this settlement."
            />

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-3 font-medium">
                      Type
                    </th>

                    <th className="px-3 py-3 font-medium">
                      Item
                    </th>

                    <th className="px-3 py-3 font-medium">
                      Description
                    </th>

                    <th className="px-3 py-3 text-right font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {(
                    selectedSettlement.items ||
                    []
                  ).map(
                    (item) => (
                      <tr
                        key={
                          item.id
                        }
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                              item.item_type ===
                              "earning"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {item.item_type}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-sm font-medium text-slate-800">
                          {
                            item.item_name
                          }
                        </td>

                        <td className="max-w-md px-3 py-3 text-xs text-slate-500">
                          {
                            item.description ||
                            "—"
                          }
                        </td>

                        <td
                          className={`px-3 py-3 text-right text-sm font-semibold ${
                            item.item_type ===
                            "earning"
                              ? "text-emerald-700"
                              : "text-red-600"
                          }`}
                        >
                          {item.item_type ===
                          "earning"
                            ? "+"
                            : "-"}
                          {formatCurrency(
                            item.amount,
                            selectedSettlement.currency_code,
                          )}
                        </td>
                      </tr>
                    ),
                  )}

                  {(
                    selectedSettlement.items ||
                    []
                  ).length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={
                          4
                        }
                        className="px-3 py-8 text-center text-xs text-slate-500"
                      >
                        No settlement line items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader
              icon={
                FileCheck2
              }
              title="Audit History"
              description="Important settlement actions are recorded for traceability."
            />

            <div className="mt-4 space-y-3">
              {(
                selectedSettlement.events ||
                []
              ).length ===
                0 ? (
                <p className="text-xs text-slate-500">
                  No audit events found.
                </p>
              ) : (
                selectedSettlement.events.map(
                  (event) => (
                    <div
                      key={
                        event.id
                      }
                      className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500">
                        <Clock3
                          size={
                            14
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-slate-800">
                            {String(
                              event.event_type ||
                                "event",
                            ).replace(
                              /_/g,
                              " ",
                            )}
                          </p>

                          {event.new_status && (
                            <StatusBadge
                              status={
                                event.new_status
                              }
                            />
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {
                            event.message
                          }
                        </p>

                        <p className="mt-1 text-[11px] text-slate-400">
                          {formatDate(
                            event.created_at,
                          )}
                        </p>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </div>
        </div>
      );
    };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/app/dashboard",
                )
              }
              className="mt-0.5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft
                size={14}
              />
              Back
            </button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Calculator
                size={20}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-950 sm:text-2xl">
                  Full & Final Settlement Calculator
                </h1>

                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Live Data
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Consistent, auditable exit settlement calculations.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleRefresh
            }
            disabled={
              loading
            }
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 xl:self-auto"
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

        {/* ERROR */}

        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <CircleAlert
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div>
              <p className="font-medium">
                Could not load settlement data
              </p>

              <p className="mt-0.5 text-xs">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* SUMMARY */}

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Total"
            value={
              summary?.total ??
              0
            }
            description="Settlement records"
            icon={
              FileText
            }
          />

          <MetricCard
            label="Draft"
            value={
              summary?.draft ??
              0
            }
            description="Not submitted"
            icon={
              FileText
            }
          />

          <MetricCard
            label="Under Review"
            value={
              summary?.underReview ??
              0
            }
            description="Awaiting approval"
            icon={
              Clock3
            }
          />

          <MetricCard
            label="Approved"
            value={
              summary?.approved ??
              0
            }
            description="Ready for payment"
            icon={
              CheckCircle2
            }
          />

          <MetricCard
            label="Processed"
            value={
              summary?.processed ??
              0
            }
            description="Completed payments"
            icon={
              CreditCard
            }
          />

          <MetricCard
            label="Final Amount"
            value={formatCurrency(
              summary?.totalFinalSettlement ||
                0,
              "INR",
            )}
            description="Across all records"
            icon={
              Calculator
            }
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
          {/* LEFT PANEL */}

          <div className="space-y-5">
            {/* CREATE */}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <button
                type="button"
                onClick={() =>
                  setShowCreatePanel(
                    (current) =>
                      !current,
                  )
                }
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Calculator
                      size={18}
                    />
                  </div>

                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      New Settlement
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Calculate an employee's final settlement.
                    </p>
                  </div>
                </div>

                <ChevronRight
                  size={17}
                  className={`text-slate-400 transition ${
                    showCreatePanel
                      ? "rotate-90"
                      : ""
                  }`}
                />
              </button>

              {showCreatePanel && (
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Employee
                    </label>

                    <div className="relative">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="text"
                        value={
                          employeeSearch
                        }
                        onChange={(
                          event,
                        ) =>
                          setEmployeeSearch(
                            event.target.value,
                          )
                        }
                        placeholder="Search employees..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <select
                      value={
                        selectedEmployeeId
                      }
                      onChange={(
                        event,
                      ) =>
                        handleEmployeeChange(
                          event.target.value,
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    >
                      <option value="">
                        Select employee
                      </option>

                      {filteredEmployees.map(
                        (
                          employee,
                        ) => (
                          <option
                            key={
                              employee.id
                            }
                            value={
                              employee.id
                            }
                          >
                            {getEmployeeName(
                              employee,
                            )}{" "}
                            —{" "}
                            {getEmployeeCode(
                              employee,
                            )}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  {selectedEmployee && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-start gap-2">
                        <UserRound
                          size={15}
                          className="mt-0.5 text-slate-500"
                        />

                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800">
                            {getEmployeeName(
                              selectedEmployee,
                            )}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {getEmployeeCode(
                              selectedEmployee,
                            )}{" "}
                            ·{" "}
                            {getEmployeeDepartment(
                              selectedEmployee,
                            )}
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {getEmployeeTitle(
                              selectedEmployee,
                            )}{" "}
                            ·{" "}
                            {getEmployeeLocation(
                              selectedEmployee,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Last Working Date *
                      </label>

                      <input
                        type="date"
                        name="lastWorkingDate"
                        value={
                          form.lastWorkingDate
                        }
                        onChange={
                          handleFormChange
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">
                        Resignation Date
                      </label>

                      <input
                        type="date"
                        name="resignationDate"
                        value={
                          form.resignationDate
                        }
                        onChange={
                          handleFormChange
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-xs font-semibold text-slate-800">
                      Settlement Inputs
                    </p>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        [
                          "payableDays",
                          "Payable Days",
                        ],
                        [
                          "leaveEncashmentDays",
                          "Leave Encashment Days",
                        ],
                        [
                          "noticePeriodDays",
                          "Notice Period Days",
                        ],
                        [
                          "noticeServedDays",
                          "Notice Served Days",
                        ],
                        [
                          "bonusAmount",
                          "Bonus",
                        ],
                        [
                          "incentivesAmount",
                          "Incentives",
                        ],
                        [
                          "otherEarnings",
                          "Other Earnings",
                        ],
                        [
                          "pendingReimbursements",
                          "Reimbursements",
                        ],
                        [
                          "outstandingDeductions",
                          "Outstanding Deductions",
                        ],
                        [
                          "assetRecoveryAmount",
                          "Asset Recovery",
                        ],
                        [
                          "otherDeductions",
                          "Other Deductions",
                        ],
                      ].map(
                        ([
                          name,
                          label,
                        ]) => (
                          <div
                            key={
                              name
                            }
                          >
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">
                              {
                                label
                              }
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              name={
                                name
                              }
                              value={
                                form[
                                  name
                                ]
                              }
                              onChange={
                                handleFormChange
                              }
                              placeholder="Auto"
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-700">
                      Notes
                    </label>

                    <textarea
                      name="notes"
                      value={
                        form.notes
                      }
                      onChange={
                        handleFormChange
                      }
                      rows={3}
                      placeholder="Optional settlement notes..."
                      className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={
                        handlePreview
                      }
                      disabled={
                        previewLoading
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Calculator
                        size={14}
                        className={
                          previewLoading
                            ? "animate-pulse"
                            : ""
                        }
                      />
                      {previewLoading
                        ? "Calculating..."
                        : "Preview"}
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleCreate
                      }
                      disabled={
                        actionLoading
                      }
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileCheck2
                        size={14}
                      />
                      {actionLoading
                        ? "Creating..."
                        : "Create Settlement"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SETTLEMENT LIST */}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <button
                type="button"
                onClick={() =>
                  setShowSettlementList(
                    (current) =>
                      !current,
                  )
                }
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Existing Settlements
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Select a settlement to review.
                  </p>
                </div>

                <ChevronRight
                  size={17}
                  className={`text-slate-400 transition ${
                    showSettlementList
                      ? "rotate-90"
                      : ""
                  }`}
                />
              </button>

              {showSettlementList && (
                <div className="mt-4 space-y-2">
                  {loading ? (
                    <div className="space-y-2">
                      {[
                        1,
                        2,
                        3,
                      ].map(
                        (
                          item,
                        ) => (
                          <div
                            key={
                              item
                            }
                            className="h-16 animate-pulse rounded-lg bg-slate-100"
                          />
                        ),
                      )}
                    </div>
                  ) : settlements.length ===
                    0 ? (
                    <EmptyState
                      title="No settlements yet"
                      description="Create the first settlement using the employee selector above."
                    />
                  ) : (
                    settlements.map(
                      (
                        settlement,
                      ) => {
                        const status =
                          getSettlementStatus(
                            settlement,
                          );

                        const employee =
                          settlement.employee_snapshot ||
                          {};

                        return (
                          <button
                            key={
                              settlement.id
                            }
                            type="button"
                            onClick={() => {
                              setSelectedSettlementId(
                                settlement.id,
                              );

                              setSelectedEmployeeId(
                                settlement.employee_id ||
                                  "",
                              );

                              setShowCreatePanel(
                                false,
                              );
                            }}
                            className={`w-full rounded-lg border p-3 text-left transition ${
                              selectedSettlementId ===
                              settlement.id
                                ? "border-slate-900 bg-slate-50"
                                : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-900">
                                  {
                                    settlement.settlement_number
                                  }
                                </p>

                                <p className="mt-1 truncate text-xs text-slate-600">
                                  {
                                    employee.fullName ||
                                    employee.full_name ||
                                    "Employee"
                                  }
                                </p>

                                <p className="mt-1 text-[11px] text-slate-400">
                                  LWD{" "}
                                  {formatDate(
                                    settlement.last_working_date,
                                  )}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <StatusBadge
                                  status={
                                    status
                                  }

                                />

                                <p className="mt-2 text-xs font-semibold text-slate-900">
                                  {formatCurrency(
                                    settlement.final_settlement_amount,
                                    settlement.currency_code,
                                  )}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}

          <div className="min-w-0 space-y-5">
            {/* PREVIEW */}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  Calculator
                }
                title="Settlement Preview"
                description="Live calculation before creating a settlement record."
              />

              <div className="mt-5">
                {renderPreview()}
              </div>
            </div>

            {/* SELECTED SETTLEMENT */}

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader
                icon={
                  FileCheck2
                }
                title="Settlement Details"
                description="Review, approve, process, or cancel the selected settlement."
              />

              <div className="mt-5">
                {renderSelectedSettlement()}
              </div>
            </div>
          </div>
        </div>
      </div>


      {showPaymentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="process-payment-title"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionLoading
            ) {
              setShowPaymentModal(false);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <CreditCard size={18} />
                </div>

                <div>
                  <h2
                    id="process-payment-title"
                    className="text-sm font-semibold text-slate-900"
                  >
                    Process Payment
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Confirm the payment details before marking this settlement as processed.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!actionLoading) {
                    setShowPaymentModal(false);
                  }
                }}
                disabled={actionLoading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close payment dialog"
              >
                <XCircle size={17} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Settlement
                    </p>

                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {selectedSettlement?.settlement_number ||
                        "Selected settlement"}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Amount
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatCurrency(
                        getSettlementAmount(
                          selectedSettlement,
                        ),
                        selectedSettlement?.currency_code ||
                          "INR",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="payment-reference"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Payment Reference
                </label>

                <input
                  id="payment-reference"
                  type="text"
                  value={paymentReference}
                  onChange={(event) =>
                    setPaymentReference(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. UTR, transaction ID, or payment reference"
                  autoFocus
                  disabled={actionLoading}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !actionLoading
                    ) {
                      handleConfirmPayment();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                  Optional. Add the bank UTR, transaction ID, or other payment reference for audit tracking.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  if (!actionLoading) {
                    setShowPaymentModal(false);
                  }
                }}
                disabled={actionLoading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CreditCard
                  size={14}
                  className={
                    actionLoading
                      ? "animate-pulse"
                      : ""
                  }
                />

                {actionLoading
                  ? "Processing..."
                  : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}