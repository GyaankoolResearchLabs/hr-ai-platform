import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Loader2,
  Paperclip,
  Receipt,
  Send,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import employeeReimbursementsService from "../services/employeeReimbursementsService";
import api from "../lib/api";

/*
 * Same status vocabulary/coloring as ReimbursementExpenseManager.jsx
 * (the HR-side tool) so a claim looks the same regardless of which
 * side submitted it.
 */
const STATUS_META = {
  draft: {
    label: "Draft",
    className: "bg-ink-50 text-ink-600 border-ink-200",
    icon: FileText,
  },
  submitted: {
    label: "Submitted",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Send,
  },
  under_review: {
    label: "Under Review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock3,
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  partially_approved: {
    label: "Partially Approved",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: XCircle,
  },
  paid: {
    label: "Paid",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: CreditCard,
  },
  reconciled: {
    label: "Reconciled",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-ink-100 text-ink-500 border-ink-200",
    icon: Ban,
  },
};

function getStatusMeta(status) {
  return (
    STATUS_META[String(status || "").toLowerCase()] || {
      label: status || "Unknown",
      className: "bg-ink-50 text-ink-600 border-ink-200",
      icon: FileText,
    }
  );
}

function formatCurrency(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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

function formatFileSize(bytes) {
  if (!bytes) {
    return "";
  }

  const kb = Number(bytes) / 1024;

  return kb < 1024
    ? `${kb.toFixed(1)} KB`
    : `${(kb / 1024).toFixed(1)} MB`;
}

const EMPTY_FORM = {
  category_id: "",
  amount: "",
  description: "",
  expense_date: "",
};

export default function EmployeeReimbursements() {
  const [claims, setClaims] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [receiptLoadingId, setReceiptLoadingId] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptFile, setReceiptFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [claimList, categoryResponse] = await Promise.all([
        employeeReimbursementsService.list(),
        api.get("/expense-claims/categories"),
      ]);

      setClaims(claimList);
      setCategories(
        Array.isArray(categoryResponse.data?.categories)
          ? categoryResponse.data.categories
          : [],
      );
    } catch (err) {
      console.error("Employee reimbursements load error:", err);

      setError(
        err?.response?.data?.message ||
          "Unable to load your reimbursement claims.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function openClaim(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);

    try {
      const data = await employeeReimbursementsService.getById(id);

      setDetail(data);
    } catch (err) {
      console.error("Reimbursement detail load error:", err);

      setDetailError(
        err?.response?.data?.message ||
          "Unable to load this claim.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function closeClaim() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
  }

  async function viewReceipt(receipt) {
    if (!selectedId) {
      return;
    }

    /*
     * Open the tab synchronously, inside the click handler, so the
     * browser still counts it as a direct user gesture. Popup
     * blockers (including headless Chromium) silently drop
     * window.open() calls made after an await — by then the click
     * is no longer "current" as far as the browser is concerned.
     * We navigate this already-open tab once the signed URL
     * resolves instead.
     *
     * IMPORTANT: deliberately no "noopener" here — that flag makes
     * window.open() return null (severing the exact reference this
     * function needs to redirect the tab once the URL is ready).
     * The destination is always our own signed Supabase storage URL,
     * never arbitrary/user-controlled, so this is a safe tradeoff.
     */
    const receiptTab = window.open("", "_blank");

    try {
      setReceiptLoadingId(receipt.id);

      const { url } = await employeeReimbursementsService.getReceiptUrl(
        selectedId,
        receipt.id,
      );

      if (receiptTab) {
        receiptTab.location.href = url;
      }
    } catch (err) {
      console.error("Receipt view error:", err);

      receiptTab?.close();

      setDetailError(
        err?.response?.data?.message || "Unable to open receipt.",
      );
    } finally {
      setReceiptLoadingId("");
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleFileChange(e) {
    setReceiptFile(e.target.files?.[0] || null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("Enter a valid amount greater than zero.");
      return;
    }

    if (!form.description.trim()) {
      setFormError("Description is required.");
      return;
    }

    if (!form.expense_date) {
      setFormError("Expense date is required.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await employeeReimbursementsService.submitClaim({
        categoryId: form.category_id || null,
        amount: form.amount,
        description: form.description.trim(),
        expenseDate: form.expense_date,
        receiptFile,
      });

      setClaims((current) => [
        {
          id: result.claim.id,
          claim_number: result.claim.claim_number,
          title: result.claim.title,
          claim_date: result.claim.claim_date,
          total_amount: result.claim.total_amount,
          approved_amount: result.claim.approved_amount,
          currency_code: result.claim.currency_code,
          status: result.claim.status,
          category: result.claim.items?.[0]?.expense_categories?.name || null,
          created_at: result.claim.created_at,
          submitted_at: result.claim.submitted_at,
        },
        ...current,
      ]);

      setForm(EMPTY_FORM);
      setReceiptFile(null);
      document.getElementById("receipt-file-input").value = "";

      setFormSuccess(
        result.warning ||
          `Claim ${result.claim.claim_number} submitted for ${formatCurrency(result.claim.total_amount)}.`,
      );
    } catch (err) {
      console.error("Reimbursement submission error:", err);

      setFormError(
        err?.response?.data?.message ||
          "Unable to submit your claim.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Loading your reimbursements...
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
            Reimbursements
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Your expense claims, most recent first.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
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

      <section className="mb-6 card overflow-hidden">
        {claims.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-500">
            No reimbursement claims yet.
          </div>
        ) : (
          <div className="divide-y divide-ink-100">
            {claims.map((claim) => {
              const status = getStatusMeta(claim.status);
              const StatusIcon = status.icon;

              return (
                <button
                  key={claim.id}
                  type="button"
                  onClick={() => openClaim(claim.id)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Receipt className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {claim.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {claim.category || "Uncategorized"} &middot;{" "}
                        {formatDate(claim.claim_date)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-4">
                    <p className="text-sm font-semibold text-ink-950">
                      {formatCurrency(claim.total_amount)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedId && (
        <ClaimModal
          loading={detailLoading}
          error={detailError}
          claim={detail}
          receiptLoadingId={receiptLoadingId}
          onClose={closeClaim}
          onViewReceipt={viewReceipt}
        />
      )}

      {/* =====================================================
          NEW CLAIM
      ===================================================== */}

      <section className="card p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Send className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-950">
              Submit a Claim
            </h2>
            <p className="text-sm text-ink-500">
              Attach a receipt if you have one (JPG, PNG, WEBP or PDF,
              up to 5MB)
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {formSuccess}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Category
              </label>
              <select
                value={form.category_id}
                onChange={(e) =>
                  updateField("category_id", e.target.value)
                }
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Amount (INR)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => updateField("amount", e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Expense date
              </label>
              <input
                type="date"
                required
                value={form.expense_date}
                onChange={(e) =>
                  updateField("expense_date", e.target.value)
                }
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
                Receipt (optional)
              </label>
              <label
                htmlFor="receipt-file-input"
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:bg-ink-50"
              >
                <Upload className="h-4 w-4 shrink-0 text-ink-400" />
                <span className="truncate">
                  {receiptFile ? receiptFile.name : "Choose file"}
                </span>
              </label>
              <input
                id="receipt-file-input"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-400">
              Description
            </label>
            <input
              type="text"
              required
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="e.g. Taxi fare to client site"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-900 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit claim
          </button>
        </form>
      </section>
    </div>
  );
}

function ClaimModal({
  loading,
  error,
  claim,
  receiptLoadingId,
  onClose,
  onViewReceipt,
}) {
  const status = getStatusMeta(claim?.status);
  const StatusIcon = status.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-ink-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-950">
              Claim Details
            </h2>
            {claim?.claim_number && (
              <p className="mt-0.5 text-xs text-ink-500">
                {claim.claim_number}
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

          {!loading && !error && claim && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 pb-4">
                <div>
                  <p className="text-lg font-semibold text-ink-950">
                    {claim.title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {formatDate(claim.claim_date)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-lg font-bold text-ink-950">
                    {formatCurrency(claim.total_amount)}
                  </p>
                  <span
                    className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${status.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                  Expense Items
                </p>

                <div className="space-y-2">
                  {(claim.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {item.description}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {item.expense_categories?.name ||
                            "Uncategorized"}
                        </p>
                      </div>
                      <span className="shrink-0 font-medium text-ink-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-400">
                  Receipts
                </p>

                {(claim.receipts || []).length === 0 ? (
                  <p className="text-sm text-ink-400">
                    No receipt attached.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {claim.receipts.map((receipt) => (
                      <button
                        key={receipt.id}
                        type="button"
                        onClick={() => onViewReceipt(receipt)}
                        disabled={receiptLoadingId === receipt.id}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2 text-left text-sm transition hover:bg-ink-50 disabled:opacity-60"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-ink-400" />
                          <span className="truncate text-ink-900">
                            {receipt.file_name}
                          </span>
                          <span className="shrink-0 text-xs text-ink-400">
                            {formatFileSize(receipt.file_size)}
                          </span>
                        </div>
                        {receiptLoadingId === receipt.id ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-400" />
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-brand-700">
                            View
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
