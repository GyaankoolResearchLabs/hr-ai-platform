import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Banknote, Loader2, X } from "lucide-react";

import employeeFnfService from "../services/employeeFnfService";

function formatCurrency(value, currencyCode = "INR") {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode || "INR",
    maximumFractionDigits: 2,
  }).format(number);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

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
    case "processed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "approved":
      return "bg-blue-50 text-blue-700 border-blue-200";

    default:
      return "bg-ink-50 text-ink-600 border-ink-200";
  }
}

function statusLabel(status) {
  return (
    {
      approved: "Approved",
      processed: "Processed",
    }[status] ||
    status ||
    "Unknown"
  );
}

export default function EmployeeFnf() {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function loadSettlements() {
    try {
      setLoading(true);
      setError("");

      const data = await employeeFnfService.list();

      setSettlements(data);
    } catch (err) {
      console.error("Employee F&F load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your final settlement."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettlements();
  }, []);

  async function openSettlement(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const data = await employeeFnfService.getById(id);

      setDetail(data);
    } catch (err) {
      console.error("Settlement detail load error:", err);

      setDetailError(
        err?.response?.data?.message || "Unable to load this settlement."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeSettlement() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your final settlement...
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-6">
        <Link
          to="/app/employee/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Portal
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink-950">
            Full &amp; Final Settlement
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your finalized settlement records.
          </p>
        </div>

        <button
          type="button"
          onClick={loadSettlements}
          className="inline-flex items-center justify-center rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="card overflow-hidden">
        {settlements.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No final settlement records yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {settlements.map((settlement) => (
              <button
                key={settlement.id}
                type="button"
                onClick={() => openSettlement(settlement.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">
                      {settlement.settlement_number}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-500">
                      Last working day{" "}
                      {formatDate(settlement.last_working_date)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-ink-500">Final amount</p>
                    <p className="text-sm font-semibold text-ink-950">
                      {formatCurrency(
                        settlement.final_settlement_amount,
                        settlement.currency_code
                      )}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      settlement.settlement_status
                    )}`}
                  >
                    {statusLabel(settlement.settlement_status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedId && (
        <SettlementModal
          loading={detailLoading}
          error={detailError}
          settlement={detail}
          onClose={closeSettlement}
        />
      )}
    </div>
  );
}

function SettlementModal({ loading, error, settlement, onClose }) {
  const currencyCode = settlement?.currency_code || "INR";

  const earningItems = (settlement?.items || []).filter(
    (item) => item.item_type === "earning"
  );

  const deductionItems = (settlement?.items || []).filter(
    (item) => item.item_type === "deduction"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-950">
              Settlement Details
            </h2>
            {settlement?.settlement_number && (
              <p className="mt-0.5 text-xs text-ink-500">
                {settlement.settlement_number}
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

          {!loading && !error && settlement && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                <div>
                  <p className="text-sm text-ink-500">Last working day</p>
                  <p className="text-sm font-medium text-ink-900">
                    {formatDate(settlement.last_working_date)}
                  </p>
                  {settlement.resignation_date && (
                    <p className="mt-2 text-sm text-ink-500">
                      Resignation date
                    </p>
                  )}
                  {settlement.resignation_date && (
                    <p className="text-sm font-medium text-ink-900">
                      {formatDate(settlement.resignation_date)}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                      settlement.settlement_status
                    )}`}
                  >
                    {statusLabel(settlement.settlement_status)}
                  </span>
                  {settlement.settlement_date && (
                    <p className="mt-2 text-xs text-ink-500">
                      Settled {formatDate(settlement.settlement_date)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <LineItemTable
                  title="Earnings"
                  lines={earningItems}
                  total={settlement.total_earnings}
                  totalLabel="Total Earnings"
                  currencyCode={currencyCode}
                />

                <LineItemTable
                  title="Deductions"
                  lines={deductionItems}
                  total={settlement.total_deductions}
                  totalLabel="Total Deductions"
                  currencyCode={currencyCode}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
                <p className="text-sm font-semibold text-brand-900">
                  Final Settlement Amount
                </p>
                <p className="text-lg font-bold text-brand-900">
                  {formatCurrency(
                    settlement.final_settlement_amount,
                    currencyCode
                  )}
                </p>
              </div>

              {settlement.payment_reference && (
                <p className="text-xs text-ink-500">
                  Payment reference: {settlement.payment_reference}
                </p>
              )}

              {settlement.notes && (
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">
                    Notes
                  </p>
                  <p className="text-sm text-ink-700">{settlement.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LineItemTable({ title, lines, total, totalLabel, currencyCode }) {
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
              key={line.id || `${line.item_name}-${index}`}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-ink-600">{line.item_name}</span>
              <span className="font-medium text-ink-900">
                {formatCurrency(line.amount, currencyCode)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 text-sm">
        <span className="font-medium text-ink-900">{totalLabel}</span>
        <span className="font-semibold text-ink-950">
          {formatCurrency(total, currencyCode)}
        </span>
      </div>
    </div>
  );
}
