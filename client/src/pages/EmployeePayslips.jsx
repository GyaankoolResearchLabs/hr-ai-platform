import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Printer,
  X,
} from "lucide-react";

import employeePayslipsService from "../services/employeePayslipsService";

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatMonth(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
  });
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getStatusClass(status) {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "void":
      return "bg-red-50 text-red-700 border-red-200";

    default:
      return "bg-ink-50 text-ink-600 border-ink-200";
  }
}

/*
 * Extra flat deduction/earning lines that exist as top-level numeric
 * columns on the payslip row rather than entries in the earnings[] /
 * deductions[] arrays. Only shown when nonzero.
 */
function buildExtraLines(payslip, keys) {
  return keys
    .filter(({ field }) => Number(payslip?.[field] || 0) > 0)
    .map(({ field, label }) => ({
      name: label,
      amount: payslip[field],
    }));
}

export default function EmployeePayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [downloading, setDownloading] = useState(false);

  async function loadPayslips() {
    try {
      setLoading(true);
      setError("");

      const data = await employeePayslipsService.list();

      setPayslips(data);
    } catch (err) {
      console.error("Employee payslips load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your payslips.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPayslips();
  }, []);

  async function openPayslip(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const data = await employeePayslipsService.getById(id);

      setDetail(data);
    } catch (err) {
      console.error("Payslip detail load error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to load this payslip.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closePayslip() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  async function handleDownload() {
    if (!selectedId) {
      return;
    }

    try {
      setDownloading(true);

      const updated = await employeePayslipsService.download(selectedId);

      if (updated) {
        setDetail(updated);
      }

      window.print();
    } catch (err) {
      console.error("Payslip download error:", err);

      // Even if the "mark downloaded" call fails, still let the
      // employee print/save what's already on screen.
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your payslips...
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="no-print mb-6">
        <Link
          to="/app/employee/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Portal
        </Link>
      </div>

      <div className="no-print mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Payslips
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your published payslips, most recent first.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayslips}
          className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="no-print mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="no-print card overflow-hidden">
        {payslips.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No published payslips yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {payslips.map((payslip) => (
              <button
                key={payslip.id}
                type="button"
                onClick={() => openPayslip(payslip.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {formatMonth(payslip.payroll_month)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      {payslip.payslip_number}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-ink-500">Gross</p>
                    <p className="text-sm font-medium text-ink-900">
                      {formatCurrency(payslip.gross_pay)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-ink-500">Net pay</p>
                    <p className="text-sm font-semibold text-ink-950">
                      {formatCurrency(payslip.net_pay)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      payslip.status,
                    )}`}
                  >
                    {payslip.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedId && (
        <PayslipModal
          loading={detailLoading}
          error={detailError}
          payslip={detail}
          downloading={downloading}
          onClose={closePayslip}
          onDownload={handleDownload}
        />
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

function PayslipModal({
  loading,
  error,
  payslip,
  downloading,
  onClose,
  onDownload,
}) {
  const snapshot = payslip?.employee_snapshot || {};
  const attendance = payslip?.attendance_snapshot || {};

  const earningLines = [
    ...(Array.isArray(payslip?.earnings) ? payslip.earnings : []),
    ...buildExtraLines(payslip, [
      { field: "allowances", label: "Allowances" },
      { field: "overtime_pay", label: "Overtime Pay" },
      { field: "bonus", label: "Bonus" },
      { field: "reimbursements", label: "Reimbursements" },
    ]),
  ];

  const deductionLines = [
    ...(Array.isArray(payslip?.deductions) ? payslip.deductions : []),
    ...buildExtraLines(payslip, [
      { field: "fixed_deductions", label: "Fixed Deductions" },
      { field: "statutory_deductions", label: "Statutory Deductions" },
      { field: "other_deductions", label: "Other Deductions" },
    ]),
  ];

  const employerContributions = Array.isArray(
    payslip?.employer_contributions,
  )
    ? payslip.employer_contributions
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="print-payslip max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="no-print flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-950">
              Payslip Details
            </h2>
            {payslip?.payslip_number && (
              <p className="mt-0.5 text-xs text-ink-500">
                {payslip.payslip_number}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!loading && !error && payslip && (
          <div className="no-print flex flex-wrap gap-2 border-b border-ink-100 px-5 py-3">
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Save PDF
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 transition hover:bg-ink-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        )}

        <div className="p-5">
          {loading && (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && payslip && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                <div>
                  <p className="text-lg font-semibold text-ink-950">
                    {snapshot.name || "Employee"}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[snapshot.designation, snapshot.department]
                      .filter(Boolean)
                      .join(" - ")}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {snapshot.employee_id}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-medium text-ink-900">
                    {formatMonth(payslip.payroll_month)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatDate(payslip.period_start)} to{" "}
                    {formatDate(payslip.period_end)}
                  </p>
                  <span
                    className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      payslip.status,
                    )}`}
                  >
                    {payslip.status}
                  </span>
                </div>
              </div>

              {(attendance.paid_days !== undefined ||
                attendance.working_days !== undefined) && (
                <div className="grid grid-cols-3 gap-3">
                  <SmallStat
                    label="Working days"
                    value={attendance.working_days}
                  />
                  <SmallStat
                    label="Paid days"
                    value={attendance.paid_days}
                  />
                  <SmallStat
                    label="Unpaid days"
                    value={attendance.unpaid_days}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <LineItemTable
                  title="Earnings"
                  lines={earningLines}
                  total={payslip.gross_pay}
                  totalLabel="Gross Pay"
                />

                <LineItemTable
                  title="Deductions"
                  lines={deductionLines}
                  total={payslip.total_deductions}
                  totalLabel="Total Deductions"
                />
              </div>

              {employerContributions.length > 0 && (
                <LineItemTable
                  title="Employer Contributions"
                  lines={employerContributions}
                  total={payslip.total_employer_contributions}
                  totalLabel="Total Employer Contributions"
                />
              )}

              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
                <p className="text-sm font-semibold text-brand-900">
                  Net Pay
                </p>
                <p className="text-lg font-bold text-brand-900">
                  {formatCurrency(payslip.net_pay)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SmallStat({ label, value }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2 text-center">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-950">
        {value ?? "-"}
      </p>
    </div>
  );
}

function LineItemTable({ title, lines, total, totalLabel }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
        {title}
      </p>

      {lines.length === 0 ? (
        <p className="text-sm text-ink-400">None</p>
      ) : (
        <div className="space-y-1.5">
          {lines.map((line, index) => (
            <div
              key={`${line.code || line.name || index}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-ink-600">{line.name}</span>
              <span className="font-medium text-ink-900">
                {formatCurrency(line.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-sm">
        <span className="font-medium text-ink-900">{totalLabel}</span>
        <span className="font-semibold text-ink-950">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
