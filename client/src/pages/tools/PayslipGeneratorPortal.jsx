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
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  User,
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

const PAGE_SIZE = 10;

const STATUS_META = {
  generated: {
    label: "Generated",
    className: "bg-blue-100 text-blue-700",
  },

  published: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-700",
  },

  void: {
    label: "Void",
    className: "bg-red-100 text-red-700",
  },
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeResponse(response) {
  return (
    response?.data?.data ??
    response?.data ??
    response ??
    null
  );
}

function normalizeArray(response) {
  const data = normalizeResponse(response);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.payslips)) {
    return data.payslips;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function formatCurrency(value) {
  const amount = Number(value) || 0;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatMonth(value) {
  if (!value) {
    return "—";
  }

  const raw = String(value);

  const monthValue =
    raw.length >= 7
      ? raw.slice(0, 7)
      : raw;

  const date = new Date(
    `${monthValue}-01T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return raw;
  }

  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusMeta(status) {
  return (
    STATUS_META[status] || {
      label: status || "Unknown",
      className: "bg-ink-100 text-ink-700",
    }
  );
}

function getEmployeeSnapshot(payslip) {
  return payslip?.employee_snapshot ||
    payslip?.employeeSnapshot ||
    {};
}

function getEmployeeName(payslip) {
  const employee = getEmployeeSnapshot(payslip);

  return (
    employee?.name ||
    employee?.full_name ||
    payslip?.employee_name ||
    payslip?.employee?.name ||
    payslip?.employees?.name ||
    "Unknown employee"
  );
}

function getEmployeeCode(payslip) {
  const employee = getEmployeeSnapshot(payslip);

  return (
    employee?.employee_code ||
    employee?.employeeCode ||
    payslip?.employee_code ||
    payslip?.employee?.employee_code ||
    payslip?.employees?.employee_code ||
    "—"
  );
}

function getEmployeeDepartment(payslip) {
  const employee = getEmployeeSnapshot(payslip);

  return (
    employee?.department ||
    employee?.department_name ||
    payslip?.department ||
    "—"
  );
}

function getEmployeeEmail(payslip) {
  const employee = getEmployeeSnapshot(payslip);

  return (
    employee?.email ||
    payslip?.employee_email ||
    payslip?.employee?.email ||
    "—"
  );
}

function getArray(value) {
  return Array.isArray(value) ? value : [];
}

function getAmount(item) {
  return Number(
    item?.amount ??
      item?.value ??
      item?.total ??
      0,
  ) || 0;
}

function getItemLabel(item) {
  return (
    item?.label ||
    item?.name ||
    item?.title ||
    item?.description ||
    "Component"
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function PayslipGeneratorPortal() {
  const navigate = useNavigate();

  const [payslips, setPayslips] = useState([]);
  const [selectedPayslip, setSelectedPayslip] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [currentPage, setCurrentPage] =
    useState(1);

  const [showGenerateModal, setShowGenerateModal] =
    useState(false);

  const [payrollRuns, setPayrollRuns] =
    useState([]);

  const [selectedPayrollRun, setSelectedPayrollRun] =
    useState(null);

  const [runsLoading, setRunsLoading] =
    useState(false);

  const [payrollRunId, setPayrollRunId] =
    useState("");

  const [generateLoading, setGenerateLoading] =
    useState(false);

  const [summary, setSummary] = useState(null);

  const [runStatus, setRunStatus] =
    useState(null);

  /* =======================================================
     LOAD PAYSLIPS
  ======================================================= */

  const loadPayslips = useCallback(async () => {
    try {
      setLoading(true);

      const response = await api.get(
        "/payslips",
      );

      const data = normalizeArray(response);

      setPayslips(data);
    } catch (error) {
      console.error(
        "Load payslips error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not load payslips.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  /* =======================================================
     LOAD PAYROLL RUNS
  ======================================================= */

  const loadPayrollRuns = useCallback(async () => {
    try {
      setRunsLoading(true);

      const response = await api.get(
        "/payroll-runs",
      );

      const data = normalizeResponse(response);

      let runs = [];

      if (Array.isArray(data)) {
        runs = data;
      } else if (Array.isArray(data?.runs)) {
        runs = data.runs;
      } else if (Array.isArray(data?.data)) {
        runs = data.data;
      }

      setPayrollRuns(runs);
    } catch (error) {
      console.error(
        "Load payroll runs error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not load payroll runs.",
      );
    } finally {
      setRunsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayrollRuns();
  }, [loadPayrollRuns]);

  /* =======================================================
     LOAD SINGLE PAYSLIP
  ======================================================= */

  const loadPayslip = useCallback(
    async (payslipId) => {
      if (!payslipId) {
        return;
      }

      try {
        setLoadingDetails(true);

        const response = await api.get(
          `/payslips/${payslipId}`,
        );

        const data =
          normalizeResponse(response);

        setSelectedPayslip(data);
      } catch (error) {
        console.error(
          "Load payslip error:",
          error,
        );

        toast.error(
          error?.response?.data?.message ||
            "Could not load payslip.",
        );
      } finally {
        setLoadingDetails(false);
      }
    },
    [],
  );

  /* =======================================================
     FILTERING
  ======================================================= */

  const filteredPayslips = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return payslips.filter((payslip) => {
      const matchesStatus =
        statusFilter === "all" ||
        payslip?.status === statusFilter;

      if (!matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        payslip?.payslip_number,
        getEmployeeName(payslip),
        getEmployeeCode(payslip),
        getEmployeeDepartment(payslip),
        payslip?.payroll_month,
        payslip?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    payslips,
    search,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredPayslips.length /
        PAGE_SIZE,
    ),
  );

  const paginatedPayslips =
    filteredPayslips.slice(
      (currentPage - 1) *
        PAGE_SIZE,
      currentPage * PAGE_SIZE,
    );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [
    currentPage,
    totalPages,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    statusFilter,
  ]);

  /* =======================================================
     METRICS
  ======================================================= */

  const metrics = useMemo(() => {
    const generated = payslips.filter(
      (item) =>
        item?.status === "generated",
    ).length;

    const published = payslips.filter(
      (item) =>
        item?.status === "published",
    ).length;

    const voidCount = payslips.filter(
      (item) =>
        item?.status === "void",
    ).length;

    const totalNetPay = payslips.reduce(
      (total, item) =>
        total +
        (Number(item?.net_pay) || 0),
      0,
    );

    return {
      total: payslips.length,
      generated,
      published,
      voidCount,
      totalNetPay,
    };
  }, [payslips]);

  /* =======================================================
     SELECT PAYSLIP
  ======================================================= */

  async function handleSelectPayslip(
    payslip,
  ) {
    if (!payslip?.id) {
      return;
    }

    await loadPayslip(
      payslip.id,
    );

    try {
      await api.post(
        `/payslips/${payslip.id}/view`,
      );
    } catch (error) {
      console.error(
        "Payslip view tracking error:",
        error,
      );
    }
  }

  /* =======================================================
     GENERATE PAYSLIPS
  ======================================================= */

  async function handleGeneratePayslips(
    event,
  ) {
    event.preventDefault();

    if (!selectedPayrollRun?.id) {
      toast.error(
        "Select a payroll run first.",
      );

      return;
    }

    try {
      setGenerateLoading(true);

      const response = await api.post(
        `/payslips/payroll-runs/${selectedPayrollRun.id}/generate`,
      );

      const data =
        normalizeResponse(response);

      const generatedCount =
        Number(
          data?.generatedCount ??
            data?.generated_count ??
            data?.count ??
            0,
        );

      toast.success(
        generatedCount > 0
          ? `${generatedCount} payslip(s) generated successfully.`
          : "Payslips generated successfully.",
      );

      setShowGenerateModal(false);
      setSelectedPayrollRun(null);
      setPayrollRunId("");

      await loadPayslips();
      await loadPayrollRuns();
    } catch (error) {
      console.error(
        "Generate payslips error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not generate payslips.",
      );
    } finally {
      setGenerateLoading(false);
    }
  }

  /* =======================================================
     REGENERATE
  ======================================================= */

  async function handleRegenerate() {
    if (!selectedPayslip?.id) {
      return;
    }

    try {
      setActionLoading("regenerate");

      const response = await api.post(
        `/payslips/${selectedPayslip.id}/regenerate`,
      );

      const data =
        normalizeResponse(response);

      setSelectedPayslip(data);

      toast.success(
        "Payslip regenerated successfully.",
      );

      await loadPayslips();
    } catch (error) {
      console.error(
        "Regenerate payslip error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not regenerate payslip.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     PUBLISH
  ======================================================= */

  async function handlePublish() {
    if (!selectedPayslip?.id) {
      return;
    }

    try {
      setActionLoading("publish");

      const response = await api.post(
        `/payslips/${selectedPayslip.id}/publish`,
      );

      const data =
        normalizeResponse(response);

      setSelectedPayslip(data);

      toast.success(
        "Payslip published successfully.",
      );

      await loadPayslips();
    } catch (error) {
      console.error(
        "Publish payslip error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not publish payslip.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     VOID
  ======================================================= */

  async function handleVoid() {
    if (!selectedPayslip?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Void this payslip? This action cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading("void");

      const response = await api.post(
        `/payslips/${selectedPayslip.id}/void`,
      );

      const data =
        normalizeResponse(response);

      setSelectedPayslip(data);

      toast.success(
        "Payslip voided successfully.",
      );

      await loadPayslips();
    } catch (error) {
      console.error(
        "Void payslip error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not void payslip.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     DELETE
  ======================================================= */

  async function handleDelete() {
    if (!selectedPayslip?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this payslip permanently?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading("delete");

      await api.delete(
        `/payslips/${selectedPayslip.id}`,
      );

      toast.success(
        "Payslip deleted successfully.",
      );

      setSelectedPayslip(null);

      await loadPayslips();
    } catch (error) {
      console.error(
        "Delete payslip error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not delete payslip.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     DOWNLOAD / PRINT
  ======================================================= */

  async function handleDownload() {
    if (!selectedPayslip?.id) {
      return;
    }

    try {
      setActionLoading("download");

      await api.post(
        `/payslips/${selectedPayslip.id}/download`,
      );

      window.print();

      toast.success(
        "Print dialog opened. Choose Save as PDF to save the payslip.",
      );
    } catch (error) {
      console.error(
        "Payslip download tracking error:",
        error,
      );

      window.print();
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     PAYROLL RUN STATUS
  ======================================================= */

  async function loadRunStatus(runId = selectedPayrollRun?.id) {
    if (!runId) {
      toast.error(
        "Select a payroll run first.",
      );

      return;
    }

    try {
      setActionLoading(
        "run-status",
      );

      const response = await api.get(
        `/payslips/payroll-runs/${runId}/status`,
      );

      const data =
        normalizeResponse(response);

      setRunStatus(data);

      toast.success(
        "Payroll payslip status loaded.",
      );
    } catch (error) {
      console.error(
        "Load payroll run status error:",
        error,
      );

      toast.error(
        error?.response?.data?.message ||
          "Could not load payroll run status.",
      );
    } finally {
      setActionLoading("");
    }
  }

  /* =======================================================
     SUMMARY
  ======================================================= */

  async function loadRunSummary(
    runId,
  ) {
    if (!runId) {
      return;
    }

    try {
      const response = await api.get(
        `/payslips/payroll-runs/${runId}/summary`,
      );

      const data =
        normalizeResponse(response);

      setSummary(data);
    } catch (error) {
      console.error(
        "Load payslip summary error:",
        error,
      );
    }
  }

  useEffect(() => {
    if (
      selectedPayslip?.payroll_run_id
    ) {
      loadRunSummary(
        selectedPayslip.payroll_run_id,
      );
    } else {
      setSummary(null);
    }
  }, [
    selectedPayslip?.payroll_run_id,
  ]);

  /* =======================================================
     SELECT PAYROLL RUN
  ======================================================= */

  function handleSelectPayrollRun(run) {
    if (!run?.id) {
      return;
    }

    setSelectedPayrollRun(run);
    setPayrollRunId(run.id);
    setRunStatus(null);
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function handleRefresh() {
    await loadPayslips();

    if (selectedPayslip?.id) {
      await loadPayslip(
        selectedPayslip.id,
      );
    }

    toast.success(
      "Payslip data refreshed.",
    );
  }

  /* =======================================================
     OPEN GENERATE MODAL
  ======================================================= */

  async function handleOpenGenerateModal() {
    setShowGenerateModal(true);
    setSelectedPayrollRun(null);
    setPayrollRunId("");

    await loadPayrollRuns();
  }

  /* =======================================================
     DETAIL ARRAYS
  ======================================================= */

  const employeeSnapshot =
    getEmployeeSnapshot(
      selectedPayslip,
    );

  const earnings = getArray(
    selectedPayslip?.earnings,
  );

  const deductions = getArray(
    selectedPayslip?.deductions,
  );

  const employerContributions =
    getArray(
      selectedPayslip?.employer_contributions,
    );

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-full bg-ink-25">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* =================================================
            BACK
        ================================================= */}

        <button
          type="button"
          onClick={() => navigate("/app/dashboard")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
        >
          <ArrowLeft size={16} />

          Back
        </button>

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <FileText
                  size={20}
                />
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Payroll Processing
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">
              Payslip Generator & Portal
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-ink-500 sm:text-base">
              Generate payslips from completed
              payroll runs and provide employees
              with secure self-service access to
              their payroll records.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 shadow-sm transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              onClick={handleOpenGenerateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-800"
            >
              <FileText
                size={16}
              />

              Generate Payslips
            </button>
          </div>
        </div>

        {/* =================================================
            METRICS
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={
              <FileText
                size={18}
              />
            }
            label="Total Payslips"
            value={metrics.total}
            description="All generated payroll records"
          />

          <MetricCard
            icon={
              <CheckCircle2
                size={18}
              />
            }
            label="Published"
            value={metrics.published}
            description="Available to employees"
          />

          <MetricCard
            icon={
              <ClockIcon />
            }
            label="Awaiting Publication"
            value={metrics.generated}
            description="Generated but not published"
          />

          <MetricCard
            icon={
              <Wallet
                size={18}
              />
            }
            label="Total Net Pay"
            value={formatCurrency(
              metrics.totalNetPay,
            )}
            description="Across loaded payslips"
          />
        </div>

        {/* =================================================
            MAIN GRID
        ================================================= */}

        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_480px]">
          {/* =================================================
              PAYSLIP LIST
          ================================================= */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            <div className="border-b border-ink-100 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-ink-950">
                    Payslip Records
                  </h2>

                  <p className="mt-0.5 text-sm text-ink-500">
                    Select a payslip to view,
                    publish or manage it.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-ink-500">
                  <Users size={14} />

                  {filteredPayslips.length} records
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search employee, payslip number, department..."
                    className="w-full rounded-xl border border-ink-200 bg-ink-25 py-2.5 pl-9 pr-3 text-sm text-ink-900 outline-none transition placeholder:text-ink-400 focus:border-ink-400 focus:bg-white"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value,
                    )
                  }
                  className="rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 outline-none focus:border-ink-400"
                >
                  <option value="all">
                    All statuses
                  </option>

                  <option value="generated">
                    Generated
                  </option>

                  <option value="published">
                    Published
                  </option>

                  <option value="void">
                    Void
                  </option>
                </select>
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : paginatedPayslips.length ===
              0 ? (
              <EmptyState
                onGenerate={handleOpenGenerateModal}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px]">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-25 text-left">
                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">
                          Employee
                        </th>

                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">
                          Payslip
                        </th>

                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">
                          Period
                        </th>

                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">
                          Net Pay
                        </th>

                        <th className="px-5 py-3 text-xs font-bold uppercase tracking-wide text-ink-500">
                          Status
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-ink-500">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {paginatedPayslips.map(
                        (payslip) => {
                          const status =
                            getStatusMeta(
                              payslip?.status,
                            );

                          const selected =
                            selectedPayslip?.id ===
                            payslip?.id;

                          return (
                            <tr
                              key={
                                payslip.id
                              }
                              className={`border-b border-ink-100 transition ${
                                selected
                                  ? "bg-emerald-50/60"
                                  : "hover:bg-ink-25"
                              }`}
                            >
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                                    <User
                                      size={16}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-ink-900">
                                      {getEmployeeName(
                                        payslip,
                                      )}
                                    </p>

                                    <p className="text-xs text-ink-500">
                                      {
                                        getEmployeeCode(
                                          payslip,
                                        )
                                      }
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-5 py-4">
                                <p className="text-sm font-semibold text-ink-800">
                                  {payslip?.payslip_number ||
                                    "—"}
                                </p>

                                <p className="text-xs text-ink-500">
                                  {formatMonth(
                                    payslip?.payroll_month,
                                  )}
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <p className="text-sm text-ink-700">
                                  {formatDate(
                                    payslip?.period_start,
                                  )}
                                </p>

                                <p className="text-xs text-ink-500">
                                  to{" "}
                                  {formatDate(
                                    payslip?.period_end,
                                  )}
                                </p>
                              </td>

                              <td className="px-5 py-4">
                                <span className="text-sm font-bold text-ink-900">
                                  {formatCurrency(
                                    payslip?.net_pay,
                                  )}
                                </span>
                              </td>

                              <td className="px-5 py-4">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                                >
                                  {
                                    status.label
                                  }
                                </span>
                              </td>

                              <td className="px-5 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleSelectPayslip(
                                      payslip,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50"
                                >
                                  <Eye
                                    size={14}
                                  />

                                  View
                                </button>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}

                <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
                  <p className="text-xs text-ink-500">
                    Page{" "}
                    <span className="font-semibold text-ink-800">
                      {currentPage}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-ink-800">
                      {totalPages}
                    </span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        currentPage <= 1
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.max(
                              1,
                              page - 1,
                            ),
                        )
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft
                        size={15}
                      />
                    </button>

                    <button
                      type="button"
                      disabled={
                        currentPage >=
                        totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (page) =>
                            Math.min(
                              totalPages,
                              page + 1,
                            ),
                        )
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight
                        size={15}
                      />
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* =================================================
              DETAIL PANEL
          ================================================= */}

          <section className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
            {!selectedPayslip ? (
              <div className="flex min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
                  <FileText
                    size={25}
                  />
                </div>

                <h3 className="text-base font-bold text-ink-900">
                  No payslip selected
                </h3>

                <p className="mt-1 max-w-xs text-sm text-ink-500">
                  Select a payslip from the
                  records table to view its
                  complete payroll breakdown.
                </p>
              </div>
            ) : loadingDetails ? (
              <LoadingState />
            ) : (
              <PayslipDetail
                payslip={
                  selectedPayslip
                }
                employeeSnapshot={
                  employeeSnapshot
                }
                earnings={earnings}
                deductions={deductions}
                employerContributions={
                  employerContributions
                }
                summary={summary}
                onClose={() =>
                  setSelectedPayslip(
                    null,
                  )
                }
                onPublish={
                  handlePublish
                }
                onRegenerate={
                  handleRegenerate
                }
                onVoid={handleVoid}
                onDelete={
                  handleDelete
                }
                onDownload={
                  handleDownload
                }
                actionLoading={
                  actionLoading
                }
              />
            )}
          </section>
        </div>

        {/* =================================================
            PAYROLL RUN STATUS
        ================================================= */}

        <section className="mt-5 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <ShieldCheck
                  size={17}
                  className="text-emerald-600"
                />

                <h2 className="text-base font-bold text-ink-950">
                  Payroll Run Payslip Status
                </h2>
              </div>

              <p className="text-sm text-ink-500">
                Select a payroll run to check its
                payslip generation status.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
              <select
                value={selectedPayrollRun?.id || ""}
                onChange={(event) => {
                  const run = payrollRuns.find(
                    (item) => item.id === event.target.value,
                  );

                  handleSelectPayrollRun(run || null);
                }}
                disabled={runsLoading || payrollRuns.length === 0}
                className="min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 outline-none focus:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50"
              >
                <option value="">
                  {runsLoading
                    ? "Loading payroll runs..."
                    : payrollRuns.length === 0
                      ? "No payroll runs available"
                      : "Select payroll run"}
                </option>

                {payrollRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatMonth(run.payroll_month)} · {Number(run.employee_count) || 0} employees · {String(run.status || "Draft")}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => loadRunStatus()}
                disabled={
                  !selectedPayrollRun?.id ||
                  actionLoading === "run-status"
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionLoading === "run-status" ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Search size={16} />
                )}

                Check Status
              </button>
            </div>
          </div>

          {selectedPayrollRun && (
            <div className="mt-4 rounded-xl border border-ink-100 bg-ink-25 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {formatMonth(selectedPayrollRun.payroll_month)}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {Number(selectedPayrollRun.employee_count) || 0} employees · {formatCurrency(selectedPayrollRun.gross_pay)} gross · {formatCurrency(selectedPayrollRun.net_pay)} net
                  </p>
                </div>

                <StatusMetric
                  label="Run Status"
                  value={selectedPayrollRun.status || "Draft"}
                />
              </div>
            </div>
          )}

          {runStatus && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatusMetric
                label="Total"
                value={
                  runStatus?.total ??
                  runStatus?.employee_count ??
                  0
                }
              />

              <StatusMetric
                label="Generated"
                value={
                  runStatus?.generated ??
                  runStatus?.generated_count ??
                  0
                }
              />

              <StatusMetric
                label="Published"
                value={
                  runStatus?.published ??
                  runStatus?.published_count ??
                  0
                }
              />

              <StatusMetric
                label="Void"
                value={
                  runStatus?.void ??
                  runStatus?.void_count ??
                  0
                }
              />
            </div>
          )}
        </section>
      </div>

      {/* =====================================================
          GENERATE MODAL
      ===================================================== */}

      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-ink-950">
                  Generate Payslips
                </h2>

                <p className="mt-0.5 text-sm text-ink-500">
                  Generate payslips directly from
                  an existing payroll run.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowGenerateModal(
                    false,
                  )
                }
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={
                handleGeneratePayslips
              }
              className="p-5"
            >
              <label className="mb-2 block text-sm font-semibold text-ink-800">
                Select Payroll Run
              </label>

              <select
                autoFocus
                value={selectedPayrollRun?.id || ""}
                onChange={(event) => {
                  const run = payrollRuns.find(
                    (item) => item.id === event.target.value,
                  );

                  handleSelectPayrollRun(run || null);
                }}
                disabled={runsLoading || payrollRuns.length === 0}
                className="w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-sm text-ink-900 outline-none transition focus:border-ink-400 disabled:cursor-not-allowed disabled:bg-ink-50"
              >
                <option value="">
                  {runsLoading
                    ? "Loading payroll runs..."
                    : payrollRuns.length === 0
                      ? "No payroll runs available"
                      : "Choose a payroll month"}
                </option>

                {payrollRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {formatMonth(run.payroll_month)} · {Number(run.employee_count) || 0} employees · {String(run.status || "Draft")}
                  </option>
                ))}
              </select>

              {selectedPayrollRun && (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-ink-100 bg-ink-25 p-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Employees
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-800">
                      {Number(selectedPayrollRun.employee_count) || 0}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-semibold capitalize text-ink-800">
                      {selectedPayrollRun.status || "Draft"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Gross Pay
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-800">
                      {formatCurrency(selectedPayrollRun.gross_pay)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                      Net Pay
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink-800">
                      {formatCurrency(selectedPayrollRun.net_pay)}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-3">
                  <CircleAlert
                    size={18}
                    className="mt-0.5 shrink-0 text-blue-600"
                  />

                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Payroll source
                    </p>

                    <p className="mt-1 text-xs leading-5 text-blue-700">
                      Payslips are generated from
                      the actual payroll run and
                      its payroll items. No salary
                      values are created on the
                      frontend.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowGenerateModal(
                      false,
                    );
                    setSelectedPayrollRun(null);
                    setPayrollRunId("");
                  }}
                  className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    generateLoading
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generateLoading ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : (
                    <FileText
                      size={16}
                    />
                  )}

                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          PRINT STYLES
      ===================================================== */}

      <style>
        {`
          @media print {
            body {
              background: white !important;
            }

            body * {
              visibility: hidden !important;
            }

            .print-payslip,
            .print-payslip * {
              visibility: visible !important;
            }

            .print-payslip {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              box-shadow: none !important;
              border: none !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
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
  description,
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-ink-600">
          {icon}
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold text-ink-950">
        {value}
      </p>

      <p className="mt-1 text-xs text-ink-500">
        {description}
      </p>
    </div>
  );
}

/* =========================================================
   STATUS METRIC
========================================================= */

function StatusMetric({
  label,
  value,
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-25 p-3">
      <p className="text-xs font-medium text-ink-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-ink-950">
        {value}
      </p>
    </div>
  );
}

/* =========================================================
   LOADING STATE
========================================================= */

function LoadingState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center">
      <Loader2
        size={28}
        className="animate-spin text-ink-500"
      />

      <p className="mt-3 text-sm text-ink-500">
        Loading payslips...
      </p>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyState({
  onGenerate,
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <FileText size={25} />
      </div>

      <h3 className="text-base font-bold text-ink-900">
        No payslips found
      </h3>

      <p className="mt-1 max-w-md text-sm text-ink-500">
        Generate payslips from a completed payroll
        run to start building your employee
        payslip portal.
      </p>

      <button
        type="button"
        onClick={onGenerate}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-ink-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink-800"
      >
        <FileText size={16} />

        Generate Payslips
      </button>
    </div>
  );
}

/* =========================================================
   PAYSLIP DETAIL
========================================================= */

function PayslipDetail({
  payslip,
  employeeSnapshot,
  earnings,
  deductions,
  employerContributions,
  summary,
  onClose,
  onPublish,
  onRegenerate,
  onVoid,
  onDelete,
  onDownload,
  actionLoading,
}) {
  const status =
    getStatusMeta(
      payslip?.status,
    );

  const attendance =
    payslip?.attendance_snapshot ||
    payslip?.attendanceSnapshot ||
    {};

  const companyName =
    employeeSnapshot?.organization_name ||
    employeeSnapshot?.company_name ||
    "HR AI Platform";

  const employeeName =
    getEmployeeName(payslip);

  const employeeCode =
    getEmployeeCode(payslip);

  const department =
    getEmployeeDepartment(payslip);

  const email =
    getEmployeeEmail(payslip);

  return (
    <div className="print-payslip flex max-h-[calc(100vh-150px)] flex-col">
      {/* DETAIL HEADER */}

      <div className="no-print flex items-start justify-between border-b border-ink-100 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText
              size={18}
              className="text-emerald-600"
            />

            <h2 className="truncate text-base font-bold text-ink-950">
              Payslip Details
            </h2>
          </div>

          <p className="mt-1 truncate text-xs text-ink-500">
            {payslip?.payslip_number ||
              "Payslip"}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800"
        >
          <X size={18} />
        </button>
      </div>

      {/* ACTIONS */}

      <div className="no-print flex flex-wrap gap-2 border-b border-ink-100 px-4 py-3 sm:px-5">
        {payslip?.status ===
          "generated" && (
          <button
            type="button"
            onClick={onPublish}
            disabled={
              actionLoading ===
              "publish"
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {actionLoading ===
            "publish" ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Send size={14} />
            )}

            Publish
          </button>
        )}

        <button
          type="button"
          onClick={onRegenerate}
          disabled={
            actionLoading ===
            "regenerate"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
        >
          {actionLoading ===
          "regenerate" ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={14} />
          )}

          Regenerate
        </button>

        <button
          type="button"
          onClick={onDownload}
          disabled={
            actionLoading ===
            "download"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50 disabled:opacity-60"
        >
          {actionLoading ===
          "download" ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <Download size={14} />
          )}

          Save PDF
        </button>

        <button
          type="button"
          onClick={() =>
            window.print()
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50"
        >
          <Printer size={14} />

          Print
        </button>

        {payslip?.status !==
          "void" && (
          <button
            type="button"
            onClick={onVoid}
            disabled={
              actionLoading ===
              "void"
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            {actionLoading ===
            "void" ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <CircleAlert
                size={14}
              />
            )}

            Void
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          disabled={
            actionLoading ===
            "delete"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {actionLoading ===
          "delete" ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <Trash2 size={14} />
          )}

          Delete
        </button>
      </div>

      {/* PAYSLIP CONTENT */}

      <div className="overflow-y-auto">
        <div className="p-4 sm:p-5">
          {/* COMPANY HEADER */}

          <div className="rounded-xl border border-ink-200 bg-white p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-bold text-ink-950">
                  {companyName}
                </p>

                <p className="mt-1 text-xs text-ink-500">
                  Employee Payslip
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>

                <p className="mt-2 text-xs font-medium text-ink-500">
                  {payslip?.payslip_number ||
                    "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">
              <InfoItem
                label="Payroll Month"
                value={formatMonth(
                  payslip?.payroll_month,
                )}
              />

              <InfoItem
                label="Pay Period"
                value={`${formatDate(
                  payslip?.period_start,
                )} – ${formatDate(
                  payslip?.period_end,
                )}`}
              />
            </div>
          </div>

          {/* EMPLOYEE */}

          <div className="mt-4 rounded-xl border border-ink-200 p-4">
            <SectionTitle
              icon={
                <User size={15} />
              }
              title="Employee Information"
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoItem
                label="Employee"
                value={employeeName}
              />

              <InfoItem
                label="Employee ID"
                value={employeeCode}
              />

              <InfoItem
                label="Department"
                value={department}
              />

              <InfoItem
                label="Email"
                value={email}
              />

              <InfoItem
                label="Designation"
                value={
                  employeeSnapshot?.designation ||
                  employeeSnapshot?.job_title ||
                  "—"
                }
              />

              <InfoItem
                label="Location"
                value={
                  employeeSnapshot?.location ||
                  employeeSnapshot?.city ||
                  "—"
                }
              />
            </div>
          </div>

          {/* ATTENDANCE */}

          <div className="mt-4 rounded-xl border border-ink-200 p-4">
            <SectionTitle
              icon={
                <CheckCircle2
                  size={15}
                />
              }
              title="Attendance"
            />

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoItem
                label="Working Days"
                value={
                  attendance?.working_days ??
                  attendance?.workingDays ??
                  "—"
                }
              />

              <InfoItem
                label="Paid Days"
                value={
                  attendance?.paid_days ??
                  attendance?.paidDays ??
                  "—"
                }
              />

              <InfoItem
                label="Unpaid Days"
                value={
                  attendance?.unpaid_days ??
                  attendance?.unpaidDays ??
                  "—"
                }
              />

              <InfoItem
                label="Overtime Hours"
                value={
                  attendance?.overtime_hours ??
                  attendance?.overtimeHours ??
                  "—"
                }
              />
            </div>
          </div>

          {/* EARNINGS */}

          <PayrollSection
            title="Earnings"
            items={earnings}
            emptyLabel="No earning components recorded."
          />

          {/* DEDUCTIONS */}

          <PayrollSection
            title="Deductions"
            items={deductions}
            emptyLabel="No deduction components recorded."
          />

          {/* TOTALS */}

          <div className="mt-4 rounded-xl border border-ink-200 bg-ink-25 p-4">
            <div className="space-y-2.5">
              <TotalRow
                label="Gross Pay"
                value={formatCurrency(
                  payslip?.gross_pay,
                )}
              />

              <TotalRow
                label="Allowances"
                value={formatCurrency(
                  payslip?.allowances,
                )}
              />

              <TotalRow
                label="Overtime Pay"
                value={formatCurrency(
                  payslip?.overtime_pay,
                )}
              />

              <TotalRow
                label="Bonus"
                value={formatCurrency(
                  payslip?.bonus,
                )}
              />

              <TotalRow
                label="Reimbursements"
                value={formatCurrency(
                  payslip?.reimbursements,
                )}
              />

              <div className="border-t border-ink-200 pt-2.5">
                <TotalRow
                  label="Total Deductions"
                  value={formatCurrency(
                    payslip?.total_deductions,
                  )}
                />
              </div>

              <div className="mt-2 rounded-xl bg-ink-950 px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold">
                    Net Pay
                  </span>

                  <span className="text-lg font-bold">
                    {formatCurrency(
                      payslip?.net_pay,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* EMPLOYER CONTRIBUTIONS */}

          {employerContributions.length >
            0 && (
            <PayrollSection
              title="Employer Contributions"
              items={
                employerContributions
              }
              emptyLabel="No employer contributions recorded."
            />
          )}

          {/* SUMMARY */}

          {summary && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <SectionTitle
                icon={
                  <ShieldCheck
                    size={15}
                  />
                }
                title="Payroll Summary"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <InfoItem
                  label="Generated"
                  value={
                    summary?.generated ??
                    summary?.generated_count ??
                    "—"
                  }
                />

                <InfoItem
                  label="Published"
                  value={
                    summary?.published ??
                    summary?.published_count ??
                    "—"
                  }
                />

                <InfoItem
                  label="Total"
                  value={
                    summary?.total ??
                    summary?.employee_count ??
                    "—"
                  }
                />

                <InfoItem
                  label="Net Payroll"
                  value={
                    summary?.net_pay != null
                      ? formatCurrency(
                          summary.net_pay,
                        )
                      : "—"
                  }
                />
              </div>
            </div>
          )}

          {/* AUDIT INFO */}

          <div className="mt-4 rounded-xl border border-ink-100 bg-ink-25 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Record Information
            </p>

            <div className="mt-3 space-y-2">
              <AuditRow
                label="Generated"
                value={formatDateTime(
                  payslip?.created_at,
                )}
              />

              <AuditRow
                label="Published"
                value={formatDateTime(
                  payslip?.published_at,
                )}
              />

              <AuditRow
                label="First Viewed"
                value={formatDateTime(
                  payslip?.first_viewed_at,
                )}
              />

              <AuditRow
                label="Last Viewed"
                value={formatDateTime(
                  payslip?.last_viewed_at,
                )}
              />

              <AuditRow
                label="Last Downloaded"
                value={formatDateTime(
                  payslip?.downloaded_at,
                )}
              />
            </div>
          </div>

          {payslip?.notes && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                Notes
              </p>

              <p className="mt-1 text-sm leading-5 text-amber-800">
                {payslip.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PAYROLL SECTION
========================================================= */

function PayrollSection({
  title,
  items,
  emptyLabel,
}) {
  return (
    <div className="mt-4 rounded-xl border border-ink-200 p-4">
      <SectionTitle
        icon={
          <Wallet size={15} />
        }
        title={title}
      />

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map(
            (item, index) => (
              <div
                key={
                  item?.id ||
                  `${getItemLabel(
                    item,
                  )}-${index}`
                }
                className="flex items-center justify-between gap-4 border-b border-ink-100 py-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">
                    {getItemLabel(
                      item,
                    )}
                  </p>

                  {item?.description &&
                    item.description !==
                      getItemLabel(
                        item,
                      ) && (
                      <p className="truncate text-xs text-ink-500">
                        {
                          item.description
                        }
                      </p>
                    )}
                </div>

                <span className="shrink-0 text-sm font-semibold text-ink-900">
                  {formatCurrency(
                    getAmount(item),
                  )}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SectionTitle({
  icon,
  title,
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
        {icon}
      </div>

      <h3 className="text-sm font-bold text-ink-900">
        {title}
      </h3>
    </div>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({
  label,
  value,
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </p>

      <p className="mt-0.5 truncate text-sm font-medium text-ink-800">
        {value ?? "—"}
      </p>
    </div>
  );
}

/* =========================================================
   TOTAL ROW
========================================================= */

function TotalRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-600">
        {label}
      </span>

      <span className="text-sm font-semibold text-ink-900">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   AUDIT ROW
========================================================= */

function AuditRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-ink-500">
        {label}
      </span>

      <span className="text-xs font-medium text-ink-700">
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   CLOCK ICON
========================================================= */

function ClockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />

      <path d="M12 7v5l3 2" />
    </svg>
  );
}